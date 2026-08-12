export type SupportedLanguage = 'en' | 'lg';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface AdvisorySource {
  provider: 'open-meteo';
  attribution: 'Weather data by Open-Meteo.com';
  fetchedAt: string;
  timezone: string;
}

export interface ChatResponse {
  requestId: string;
  answer: string;
  language: SupportedLanguage;
  source: 'groq';
  sources?: AdvisorySource[];
}

interface ErrorResponse {
  error?: { code?: string; message?: string; requestId?: string };
}

export class AssistantServiceError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'AssistantServiceError';
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export async function getAssistantResponse(
  message: string,
  language: SupportedLanguage,
  location?: Coordinates,
): Promise<ChatResponse> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language, ...(location ? { location } : {}) }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new AssistantServiceError(
        'HINGA is taking longer than expected. Please retry your question.',
        'REQUEST_TIMEOUT',
      );
    }

    throw new AssistantServiceError(
      'Hinga could not reach the advisory service. Check your connection and try again.',
      'NETWORK_ERROR',
    );
  }

  const data = await response.json().catch(() => ({})) as ChatResponse & ErrorResponse;
  if (!response.ok) {
    throw new AssistantServiceError(
      data.error?.message || 'The advisory service could not complete your request.',
      data.error?.code || 'REQUEST_FAILED',
      data.error?.requestId,
    );
  }

  return data;
}
