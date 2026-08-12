import type { ChatRequest } from '../schemas/chat.js';

export type SupportedLanguage = ChatRequest['language'];

export interface TranslationRequest {
  text: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
}

export interface TranslationResult extends TranslationRequest {
  translatedText: string;
  source: 'sunbird';
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export class TranslationUnavailableError extends Error {
  constructor() {
    super('The translation service is unavailable.');
    this.name = 'TranslationUnavailableError';
  }
}
