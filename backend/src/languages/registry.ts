export type LanguageLifecycle = 'production' | 'experimental';
export type LanguageValidationStatus = 'native' | 'validated' | 'smoke-reviewed' | 'reviewed-blocked';
export type TranslationProviderName = 'sunbird';

interface LanguageDefinition {
  displayName: string;
  lifecycle: LanguageLifecycle;
  providerCodes: Record<TranslationProviderName, string>;
  directions: {
    toEnglish: boolean;
    fromEnglish: boolean;
  };
  validation: {
    status: LanguageValidationStatus;
    reviewedPhrases: number;
    requiredPhrases: number;
  };
}

export const languageRegistry = {
  en: {
    displayName: 'English',
    lifecycle: 'production',
    providerCodes: { sunbird: 'eng' },
    directions: { toEnglish: true, fromEnglish: true },
    validation: { status: 'native', reviewedPhrases: 40, requiredPhrases: 40 },
  },
  lg: {
    displayName: 'Luganda',
    lifecycle: 'production',
    providerCodes: { sunbird: 'lug' },
    directions: { toEnglish: true, fromEnglish: true },
    validation: { status: 'validated', reviewedPhrases: 4, requiredPhrases: 4 },
  },
  nyn: {
    displayName: 'Runyankole',
    lifecycle: 'experimental',
    providerCodes: { sunbird: 'nyn' },
    directions: { toEnglish: true, fromEnglish: true },
    validation: { status: 'reviewed-blocked', reviewedPhrases: 40, requiredPhrases: 40 },
  },
} as const satisfies Record<string, LanguageDefinition>;

export type LanguageCode = keyof typeof languageRegistry;
export type ProductionLanguageCode = {
  [Code in LanguageCode]: typeof languageRegistry[Code]['lifecycle'] extends 'production' ? Code : never
}[LanguageCode];
export type ExperimentalLanguageCode = {
  [Code in LanguageCode]: typeof languageRegistry[Code]['lifecycle'] extends 'experimental' ? Code : never
}[LanguageCode];

export const languageCodes = Object.keys(languageRegistry) as LanguageCode[];
export const productionLanguageCodes = languageCodes.filter(
  (code): code is ProductionLanguageCode => languageRegistry[code].lifecycle === 'production',
);
export const experimentalLanguageCodes = languageCodes.filter(
  (code): code is ExperimentalLanguageCode => languageRegistry[code].lifecycle === 'experimental',
);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && value in languageRegistry;
}

export function isProductionLanguage(value: unknown): value is ProductionLanguageCode {
  return isLanguageCode(value) && languageRegistry[value].lifecycle === 'production';
}

export function isExperimentalLanguage(value: unknown): value is ExperimentalLanguageCode {
  return isLanguageCode(value) && languageRegistry[value].lifecycle === 'experimental';
}

export function isEnabledLanguage(
  value: unknown,
  enabledExperimentalLanguages: readonly ExperimentalLanguageCode[],
): value is LanguageCode {
  return isProductionLanguage(value)
    || (isExperimentalLanguage(value) && enabledExperimentalLanguages.includes(value));
}

export function getProviderLanguageCode(
  language: LanguageCode,
  provider: TranslationProviderName,
): string {
  return languageRegistry[language].providerCodes[provider];
}

export function supportsTranslationDirection(source: LanguageCode, target: LanguageCode): boolean {
  if (source === target) {
    return true;
  }

  if (target === 'en') {
    return languageRegistry[source].directions.toEnglish;
  }

  if (source === 'en') {
    return languageRegistry[target].directions.fromEnglish;
  }

  return false;
}
