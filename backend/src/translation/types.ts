import type { LanguageCode, TranslationProviderName } from '../languages/registry.js';

export interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface TranslationResult extends TranslationRequest {
  translatedText: string;
  source: TranslationProviderName;
  direction: `${LanguageCode}->${LanguageCode}`;
  durationMilliseconds: number;
}

export interface TranslationProvider {
  readonly provider: TranslationProviderName;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export class TranslationUnavailableError extends Error {
  readonly code = 'TRANSLATION_PROVIDER_UNAVAILABLE';

  constructor(
    readonly provider: TranslationProviderName = 'sunbird',
    readonly direction?: `${LanguageCode}->${LanguageCode}`,
  ) {
    super('The translation service is unavailable.');
    this.name = 'TranslationUnavailableError';
  }
}

export class TranslationConfigurationError extends Error {
  readonly code = 'TRANSLATION_DIRECTION_UNSUPPORTED';

  constructor(
    readonly provider: TranslationProviderName,
    readonly direction: `${LanguageCode}->${LanguageCode}`,
  ) {
    super('The requested translation direction is not configured.');
    this.name = 'TranslationConfigurationError';
  }
}
