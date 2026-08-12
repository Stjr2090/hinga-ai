import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, CloudRain, Globe, Leaf, MapPin, Plus, Send, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AssistantServiceError,
  getAssistantResponse,
  type AdvisorySource,
  type Coordinates,
  type SupportedLanguage,
} from './services/assistantService';

interface Message {
  id: string;
  text: string;
  sender: 'farmer' | 'assistant';
  source?: AdvisorySource;
}

const LANGUAGE_KEY = 'hinga-primary-language';
const COPY = {
  en: {
    name: 'English', welcome: 'Ask about weather, planting, crop care, or farm planning.',
    placeholder: 'Ask a farming question…', thinking: 'Preparing your advice…',
    locationOn: 'Location available', locationOff: 'Add location for local weather',
  },
  lg: {
    name: 'Luganda', welcome: 'Buuza ku mbeera y’obudde, okusimba, oba okulabirira ebirime.',
    placeholder: 'Buuza ekibuuzo ky’obulimi…', thinking: 'Nteekateeka amagezi…',
    locationOn: 'Ekifo kimanyiddwa', locationOff: 'Teekako ekifo olw’obudde bw’omu kitundu',
  },
} satisfies Record<SupportedLanguage, Record<string, string>>;

const STARTERS: Record<SupportedLanguage, string[]> = {
  en: ['Will it rain near me today?', 'When should I plant maize?', 'How can I protect crops in a dry spell?'],
  lg: ['Enkuba enaana leero mu kitundu kyange?', 'Nsimbe ddi kasooli?', 'Nkuume ntya ebirime mu kyeya?'],
};

function savedLanguage(): SupportedLanguage | null {
  const value = localStorage.getItem(LANGUAGE_KEY);
  return value === 'en' || value === 'lg' ? value : null;
}

function LanguageMenu({ language, disabled, onChange, compact = false }: {
  language: SupportedLanguage;
  disabled: boolean;
  onChange: (language: SupportedLanguage) => void;
  compact?: boolean;
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

  return (
    <div className={`language-menu ${compact ? 'language-menu-compact' : ''}`} ref={menuRef}>
      <button
        type="button"
        className={compact ? 'sidebar-settings' : 'language-switch'}
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Globe className="w-4 h-4" /> {COPY[language].name} <ChevronDown className="language-chevron" />
      </button>
      {open && (
        <div className="language-popover" role="menu" aria-label="Choose response language">
          {(['en', 'lg'] as SupportedLanguage[]).map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={language === option}
              key={option}
              onClick={() => { onChange(option); setOpen(false); }}
            >
              <span><strong>{COPY[option].name}</strong><small>{option === 'en' ? 'English' : 'Oluganda'}</small></span>
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading]);

  const chooseLanguage = (next: SupportedLanguage) => {
    localStorage.setItem(LANGUAGE_KEY, next);
    setLanguage(next);
    setMessages([]);
    setError(null);
  };

  const switchLanguage = (next: SupportedLanguage) => {
    if (next === language || loading) return;
    localStorage.setItem(LANGUAGE_KEY, next);
    setLanguage(next);
    setError(null);
    setLastQuestion(null);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) return setError('Location is not available in this browser.');
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationPending(false);
        setError(null);
      },
      () => {
        setLocationPending(false);
        setError('Location access was not granted. You can still ask general farming questions.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  const send = async (question = input) => {
    const clean = question.trim();
    if (!clean || !language || loading) return;

    setMessages((current) => [...current, { id: crypto.randomUUID(), text: clean, sender: 'farmer' }]);
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
      setError(caught instanceof AssistantServiceError ? caught.message : 'Something went wrong. Please try again.');
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
            <button onClick={() => chooseLanguage('en')}><span>English</span><small>Supported</small></button>
            <button onClick={() => chooseLanguage('lg')}><span>Luganda</span><small>Supported</small></button>
          </div>
          <p className="privacy-note"><ShieldCheck className="w-4 h-4" /> Your language preference stays in this browser.</p>
        </div>
      </main>
    );
  }

  const copy = COPY[language];
  return (
    <div className="app-shell">
      <aside className="workspace-sidebar">
        <div className="brand-mark"><Leaf className="w-5 h-5" /></div>
        <div className="brand-copy"><strong>Hinga AI</strong><span>Field assistant</span></div>
        <button className="new-chat-button" onClick={() => { setMessages([]); setError(null); }}>
          <Plus className="w-4 h-4" /> New conversation
        </button>
        <div className="scope-card">
          <strong>Prototype scope</strong>
          <span>Weather-aware agricultural guidance for East African smallholder farmers.</span>
        </div>
        <LanguageMenu language={language} disabled={loading} onChange={switchLanguage} compact />
        <p className="prototype-label">Non-commercial school prototype</p>
      </aside>

      <section className="conversation-panel">
        <header className="conversation-header">
          <div className="flex items-center gap-3">
            <div className="mobile-brand-mark"><Leaf className="w-5 h-5" /></div>
            <div><h1>Hinga Assistant</h1><p><span className="status-dot" /> Agricultural advisory</p></div>
          </div>
          <LanguageMenu language={language} disabled={loading} onChange={switchLanguage} />
        </header>

        <main className="message-list">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><Leaf className="w-6 h-6" /></div>
              <h2>How can Hinga help today?</h2>
              <p>{copy.welcome}</p>
              <div className="starter-grid">
                {STARTERS[language].map((starter) => <button key={starter} onClick={() => send(starter)}>{starter}</button>)}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.article key={message.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`sms-bubble ${message.sender === 'farmer' ? 'sms-farmer' : 'sms-assistant'}`}>
                {message.text}
                {message.source && <small className="source-note"><CloudRain className="w-3 h-3" /> {message.source.attribution} · {new Date(message.source.fetchedAt).toLocaleString()}</small>}
              </motion.article>
            ))}
          </AnimatePresence>
          {loading && <div className="sms-bubble sms-assistant loading-message"><span /><span /><span /> {copy.thinking}</div>}
          {error && <div className="error-card"><AlertCircle className="w-4 h-4" /><span>{error}</span>{lastQuestion && <button onClick={() => send(lastQuestion)}>Retry</button>}</div>}
          <div ref={endRef} />
        </main>

        <div className="context-bar">
          <button onClick={requestLocation} disabled={locationPending} className={location ? 'location-active' : ''}>
            <MapPin className="w-4 h-4" /> {locationPending ? 'Finding location…' : location ? copy.locationOn : copy.locationOff}
          </button>
          <span>Weather by Open-Meteo</span>
        </div>

        <footer className="composer-wrap">
          <form className="composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} rows={1} className="message-input" placeholder={copy.placeholder} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} />
            <button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label="Send question"><Send className="w-5 h-5" /></button>
          </form>
          <div className="composer-meta"><span>{input.length}/1000</span><span>Advice may be uncertain—confirm critical decisions locally.</span></div>
        </footer>
      </section>
    </div>
  );
}
