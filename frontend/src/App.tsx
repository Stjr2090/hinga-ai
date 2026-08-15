import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, CloudRain, Globe, Leaf, MapPin, Plus, Send, ShieldCheck } from 'lucide-react';
import {
  AssistantServiceError,
  getAssistantResponse,
  type AdvisorySource,
  type Coordinates,
} from './services/assistantService';
import {
  enabledLanguages,
  getInterfaceLanguage,
  isEnabledLanguage,
  LANGUAGE_CONFIG,
  type InterfaceLanguage,
  type SupportedLanguage,
} from './languages';

interface Message {
  id: string;
  text: string;
  sender: 'farmer' | 'assistant';
  source?: AdvisorySource;
}

const LANGUAGE_KEY = 'hinga-primary-language';
const COPY = {
  en: {
    name: 'English', languageName: 'English', assistant: 'Agricultural assistant', newChat: 'New conversation',
    emptyTitle: 'How can Hinga help today?', welcome: 'Ask about weather, planting, crop care, or farm planning.',
    placeholder: 'Ask a farming question…', thinking: 'Preparing your advice…', translationThinking: 'Preparing your translation…', send: 'Send question',
    locationOn: 'Location available', locationOff: 'Add location for local weather', useLocation: 'Use my location',
    findingLocation: 'Finding location…', languageMenu: 'Choose response language', retry: 'Retry',
    locationUnavailable: 'Location is not available in this browser.',
    locationDenied: 'Location access was not granted. You can still ask general farming questions.',
    requestFailed: 'Something went wrong. Please try again.', weatherSource: 'Weather by Open-Meteo',
    safety: 'Advice may be uncertain. Confirm critical decisions locally.',
  },
  lg: {
    name: 'Luganda', languageName: 'Oluganda', assistant: 'Omuwabuzi w’ebyobulimi', newChat: 'Tandika emboozi empya',
    emptyTitle: 'Hinga ekuyambe etya leero?', welcome: 'Buuza ku mbeera y’obudde, okusimba, okulabirira ebirime, oba okuteekateeka ennimiro.',
    placeholder: 'Buuza ekibuuzo ky’ebyobulimi…', thinking: 'Nteekateeka amagezi…', translationThinking: 'Nteekateeka okuvvuunula amagezi go…', send: 'Sindika ekibuuzo',
    locationOn: 'Ekifo kyange kimanyiddwa', locationOff: 'Teekako ekifo olw’obudde bw’omu kitundu', useLocation: 'Kozesa ekifo kyange',
    findingLocation: 'Nnoonya ekifo…', languageMenu: 'Londa olulimi lw’okuddamu', retry: 'Ddamu ogezeeko',
    locationUnavailable: 'Okumanya ekifo tekusoboka ku mutimbagano guno.',
    locationDenied: 'Tokkirizza Hinga kumanya kifo kyo. Osobola okusigala ng’obuuza ebibuuzo by’ebyobulimi.',
    requestFailed: 'Waliwo ekitagenze bulungi. Ddamu ogezeeko.', weatherSource: 'Obudde okuva ku Open-Meteo',
    safety: 'Amagezi gayinza obutaba makakafu. Kakasa okusalawo okukulu n’omukugu w’omu kitundu.',
  },
} as const satisfies Record<InterfaceLanguage, Record<string, string>>;

const STARTERS: Record<InterfaceLanguage, string[]> = {
  en: ['Will it rain near me today?', 'When should I plant maize?', 'How can I protect crops in a dry spell?'],
  lg: ['Enkuba enaana leero mu kitundu kyange?', 'Nsimbe ddi kasooli?', 'Nkuume ntya ebirime mu kyeya?'],
};

function savedLanguage(): SupportedLanguage | null {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    if (value === null) return null;
    if (isEnabledLanguage(value)) return value;
    localStorage.setItem(LANGUAGE_KEY, 'en');
    return 'en';
  } catch {
    return null;
  }
}

function saveLanguage(language: SupportedLanguage) {
  try {
    localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    return;
  }
}

function messageId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function LanguageMenu({ language, disabled, onChange }: {
  language: SupportedLanguage;
  disabled: boolean;
  onChange: (language: SupportedLanguage) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const config = LANGUAGE_CONFIG[language];
  const copy = COPY[getInterfaceLanguage(language)];

  return (
    <div className="language-menu" ref={menuRef}>
      <button
        type="button"
        className="language-switch"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4" />
        <span>{config.displayName}{config.status === 'experimental' && ' · Experimental'}</span>
        <ChevronDown className="language-chevron" />
      </button>
      {open && (
        <div className="language-popover" role="menu" aria-label={copy.languageMenu}>
          {enabledLanguages.map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={language === option}
              aria-label={`${LANGUAGE_CONFIG[option].displayName}, ${LANGUAGE_CONFIG[option].status === 'experimental' ? 'Experimental' : 'Supported'}`}
              key={option}
              onClick={() => { onChange(option); setOpen(false); }}
            >
              <span>
                <strong>{LANGUAGE_CONFIG[option].displayName}</strong>
                <small>{LANGUAGE_CONFIG[option].nativeName}{LANGUAGE_CONFIG[option].status === 'experimental' && ' · Experimental'}</small>
              </span>
              {language === option && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<SupportedLanguage | null>(savedLanguage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locationPending, setLocationPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const chooseLanguage = (next: SupportedLanguage) => {
    if (!isEnabledLanguage(next)) return;
    saveLanguage(next);
    setLanguage(next);
    setMessages([]);
    setError(null);
  };

  const switchLanguage = (next: SupportedLanguage) => {
    if (!isEnabledLanguage(next) || next === language || loading) return;
    saveLanguage(next);
    setLanguage(next);
    setError(null);
    setLastQuestion(null);
  };

  const startNewConversation = () => {
    setMessages([]);
    setInput('');
    setError(null);
    setLastQuestion(null);
  };

  const requestLocation = () => {
    const copy = COPY[language ? getInterfaceLanguage(language) : 'en'];
    if (!navigator.geolocation) return setError(copy.locationUnavailable);
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationPending(false);
        setError(null);
      },
      () => {
        setLocationPending(false);
        setError(copy.locationDenied);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const send = async (question = input) => {
    const clean = question.trim();
    if (!clean || !isEnabledLanguage(language) || loading) return;

    setMessages((current) => [...current, { id: messageId(), text: clean, sender: 'farmer' }]);
    setInput('');
    setError(null);
    setLastQuestion(clean);
    setLoading(true);

    try {
      const response = await getAssistantResponse(clean, language, location || undefined);
      setMessages((current) => [...current, {
        id: response.requestId,
        text: response.answer,
        sender: 'assistant',
        source: response.sources?.[0],
      }]);
      setLastQuestion(null);
    } catch (caught) {
      if (language === 'nyn') {
        setError('Runyankore is temporarily unavailable. Please switch to English or Luganda and try again.');
      } else {
        const copy = COPY[getInterfaceLanguage(language)];
        setError(caught instanceof AssistantServiceError && language === 'en' ? caught.message : copy.requestFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!language) {
    return (
      <main className="onboarding">
        <div className="onboarding-card">
          <div className="brand-mark"><Leaf className="w-5 h-5" /></div>
          <p className="eyebrow">HINGA AI</p>
          <h1>Farm advice in the language you know best.</h1>
          <p className="onboarding-copy">Choose your primary language. Hinga will remember it on this device.</p>
          <div className="language-options">
            {enabledLanguages.map((code) => {
              const option = LANGUAGE_CONFIG[code];
              const status = option.status === 'experimental' ? 'Experimental' : 'Supported';
              return <button key={code} aria-label={`${option.displayName}, ${status}`} onClick={() => chooseLanguage(code)}><span>{option.displayName}</span><small>{status}</small></button>;
            })}
          </div>
          <p className="privacy-note"><ShieldCheck className="w-4 h-4" /> Your language preference stays in this browser.</p>
        </div>
      </main>
    );
  }

  const copyLanguage = getInterfaceLanguage(language);
  const copy = COPY[copyLanguage];
  return (
    <div className="app-shell">
      <section className="conversation-panel">
        <header className="conversation-header">
          <div className="header-brand">
            <div className="mobile-brand-mark"><Leaf className="w-5 h-5" /></div>
            <div><h1>Hinga AI</h1><p>{copy.assistant}</p></div>
          </div>
          <div className="header-actions">
            <button className="header-new-chat" onClick={startNewConversation} disabled={loading}>
              <Plus className="w-4 h-4" /><span>{copy.newChat}</span>
            </button>
            <LanguageMenu language={language} disabled={loading} onChange={switchLanguage} />
          </div>
        </header>

        <main className="message-list">
          {language === 'nyn' && (
            <aside className="experimental-notice" aria-label="Experimental language notice">
              <AlertCircle className="w-4 h-4" />
              <span><strong>Experimental Runyankore</strong> Runyankore is available for this demo and is still being improved. Confirm important farming, pesticide, disease and storage advice with a local agricultural extension worker.</span>
            </aside>
          )}
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Leaf className="w-6 h-6" /></div>
              <h2>{copy.emptyTitle}</h2>
              <p>{copy.welcome}</p>
              <div className="starter-grid">
                {STARTERS[copyLanguage].map((starter) => <button key={starter} onClick={() => send(starter)}>{starter}</button>)}
              </div>
            </div>
          )}

          {messages.map((message) => (
              <article key={message.id} className={`message ${message.sender === 'farmer' ? 'message-farmer' : 'message-assistant'}`}>
                {message.sender === 'assistant' && <div className="assistant-mark"><Leaf className="w-4 h-4" /></div>}
                <div className="message-content">{message.text}
                {message.source && <small className="source-note"><CloudRain className="w-3 h-3" /> {copy.weatherSource} · {new Date(message.source.fetchedAt).toLocaleString(copyLanguage === 'lg' ? 'lg-UG' : 'en')}</small>}
                </div>
              </article>
          ))}
          {loading && <div className="message message-assistant"><div className="assistant-mark"><Leaf className="w-4 h-4" /></div><div className="loading-message"><span /><span /><span /> {language === 'en' ? copy.thinking : copy.translationThinking}</div></div>}
          {error && <div className="error-card"><AlertCircle className="w-4 h-4" /><span>{error}</span>{lastQuestion && <button onClick={() => send(lastQuestion)}>{copy.retry}</button>}</div>}
        </main>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} rows={1} className="message-input" placeholder={copy.placeholder} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
            <div className="composer-toolbar">
              <button type="button" onClick={requestLocation} disabled={locationPending} className={`location-button ${location ? 'location-active' : ''}`} aria-label={location ? copy.locationOn : copy.locationOff}>
                <MapPin className="w-4 h-4" /><span>{locationPending ? copy.findingLocation : location ? copy.locationOn : copy.useLocation}</span>
              </button>
              <button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label={copy.send}><Send className="w-5 h-5" /></button>
            </div>
          </form>
          <div className="composer-meta"><span>{input.length}/1000</span><span>{copy.safety}</span></div>
        </footer>
      </section>
    </div>
  );
}
