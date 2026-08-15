import type { LanguageCode, TranslationProviderName } from '../languages/registry.js';

export interface TranslationRequest {
  text: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  signal?: AbortSignal;
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

export type TranslationDiagnosticOutcome = 'success' | 'bypassed' | 'failure';
export type TranslationErrorCode =
  | 'TRANSLATION_PROVIDER_UNAVAILABLE'
  | 'TRANSLATION_TIMEOUT'
  | 'TRANSLATION_DIRECTION_UNSUPPORTED';

export interface TranslationDiagnostic {
  provider: TranslationProviderName;
  direction: `${LanguageCode}->${LanguageCode}`;
  durationMilliseconds: number;
  outcome: TranslationDiagnosticOutcome;
  errorCode?: TranslationErrorCode;
}

export type TranslationDiagnosticReporter = (diagnostic: TranslationDiagnostic) => void;

export class TranslationUnavailableError extends Error {
  constructor(
    readonly provider: TranslationProviderName = 'sunbird',
    readonly direction?: `${LanguageCode}->${LanguageCode}`,
    readonly code: TranslationErrorCode = 'TRANSLATION_PROVIDER_UNAVAILABLE',
  ) {
    super('The translation service is unavailable.');
    this.name = 'TranslationUnavailableError';
  }
}

export class TranslationConfigurationError extends Error {
  readonly code: TranslationErrorCode = 'TRANSLATION_DIRECTION_UNSUPPORTED';

  constructor(
    readonly provider: TranslationProviderName,
    readonly direction: `${LanguageCode}->${LanguageCode}`,
  ) {
    super('The requested translation direction is not configured.');
    this.name = 'TranslationConfigurationError';
  }
}
