export type SupportedLanguage = 'en' | 'lg' | 'nyn';
export type InterfaceLanguage = 'en' | 'lg';
export type LanguageStatus = 'supported' | 'experimental';

export interface LanguageDefinition {
  code: SupportedLanguage;
  displayName: string;
  nativeName: string;
  status: LanguageStatus;
  interfaceCopy: InterfaceLanguage;
}

export const LANGUAGE_CONFIG = {
  en: { code: 'en', displayName: 'English', nativeName: 'English', status: 'supported', interfaceCopy: 'en' },
  lg: { code: 'lg', displayName: 'Luganda', nativeName: 'Oluganda', status: 'supported', interfaceCopy: 'lg' },
  nyn: { code: 'nyn', displayName: 'Runyankore', nativeName: 'Runyankore', status: 'experimental', interfaceCopy: 'en' },
} as const satisfies Record<SupportedLanguage, LanguageDefinition>;

export const LANGUAGE_CODES = Object.keys(LANGUAGE_CONFIG) as SupportedLanguage[];

export function parseEnabledExperimentalLanguages(value: string | undefined): SupportedLanguage[] {
  if (!value) return [];

  const codes = value.split(',').map((code) => code.trim());
  const uniqueCodes = new Set(codes);
  const valid = codes.length === uniqueCodes.size && codes.every((code) => {
    if (!isSupportedLanguage(code)) return false;
    return LANGUAGE_CONFIG[code].status === 'experimental';
  });

  return valid ? codes as SupportedLanguage[] : [];
}

const enabledExperimentalLanguages = new Set(
  parseEnabledExperimentalLanguages(import.meta.env.VITE_ENABLED_EXPERIMENTAL_LANGUAGES),
);

export const enabledLanguages = LANGUAGE_CODES.filter((code) => (
  LANGUAGE_CONFIG[code].status === 'supported' || enabledExperimentalLanguages.has(code)
));

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === 'string' && value in LANGUAGE_CONFIG;
}

export function isEnabledLanguage(value: unknown): value is SupportedLanguage {
  return isSupportedLanguage(value) && enabledLanguages.includes(value);
}

export function getInterfaceLanguage(language: SupportedLanguage): InterfaceLanguage {
  return LANGUAGE_CONFIG[language].interfaceCopy;
}
