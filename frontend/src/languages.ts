export type SupportedLanguage = 'en' | 'lg' | 'nyn';
export type InterfaceLanguage = 'en' | 'lg' | 'nyn';

export interface LanguageDefinition {
  code: SupportedLanguage;
  displayName: string;
  nativeName: string;
  interfaceCopy: InterfaceLanguage;
}

export const LANGUAGE_CONFIG = {
  en: { code: 'en', displayName: 'English', nativeName: 'English', interfaceCopy: 'en' },
  lg: { code: 'lg', displayName: 'Luganda', nativeName: 'Oluganda', interfaceCopy: 'lg' },
  nyn: { code: 'nyn', displayName: 'Runyankore', nativeName: 'Runyankore', interfaceCopy: 'nyn' },
} as const satisfies Record<SupportedLanguage, LanguageDefinition>;

export const LANGUAGE_CODES = Object.keys(LANGUAGE_CONFIG) as SupportedLanguage[];
export const enabledLanguages = LANGUAGE_CODES;

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && value in LANGUAGE_CONFIG;
}

export function isEnabledLanguage(value: unknown): value is SupportedLanguage {
  return isSupportedLanguage(value) && enabledLanguages.includes(value);
}

export function getInterfaceLanguage(language: SupportedLanguage): InterfaceLanguage {
  return LANGUAGE_CONFIG[language].interfaceCopy;
}
