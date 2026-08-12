import type { ChatRequest } from '../schemas/chat.js';
import type { WeatherForecast, WeatherRisk } from '../weather/types.js';

export interface AdvisoryRequest extends ChatRequest {
  weather?: {
    forecast: WeatherForecast;
    risks: WeatherRisk[];
  };
}

export interface AdvisoryResult {
  answer: string;
  source: 'groq';
  sources?: Array<{
    provider: 'open-meteo';
    attribution: 'Weather data by Open-Meteo.com';
    fetchedAt: string;
    timezone: string;
  }>;
}

export interface AdvisoryService {
  generate(request: AdvisoryRequest): Promise<AdvisoryResult>;
}

export class AdvisoryUnavailableError extends Error {
  constructor(readonly provider: 'groq' | 'sunbird' = 'groq') {
    super('The advisory service is unavailable.');
    this.name = 'AdvisoryUnavailableError';
  }
}

export class AdvisoryLanguageUnavailableError extends Error {
  constructor() {
    super('The selected advisory language is unavailable.');
    this.name = 'AdvisoryLanguageUnavailableError';
  }
}

export class AdvisoryWeatherUnavailableError extends Error {
  constructor() {
    super('Verified weather data is unavailable.');
    this.name = 'AdvisoryWeatherUnavailableError';
  }
}
