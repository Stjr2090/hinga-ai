import { describe, expect, it } from 'vitest';
import {
  experimentalLanguageCodes,
  isEnabledLanguage,
  languageCodes,
  languageRegistry,
  productionLanguageCodes,
  supportsTranslationDirection,
} from '../src/languages/registry.js';

describe('language registry', () => {
  it('keeps experimental languages outside the production language list', () => {
    expect(productionLanguageCodes).toEqual(['en', 'lg']);
    expect(experimentalLanguageCodes).toEqual(['nyn']);
    expect(languageRegistry.nyn).toMatchObject({
      lifecycle: 'experimental',
      providerCodes: { sunbird: 'nyn' },
      validation: { status: 'reviewed-blocked', reviewedPhrases: 40, requiredPhrases: 40 },
    });
  });

  it('enables experimental languages only through an explicit allowlist', () => {
    expect(isEnabledLanguage('en', [])).toBe(true);
    expect(isEnabledLanguage('lg', [])).toBe(true);
    expect(isEnabledLanguage('nyn', [])).toBe(false);
    expect(isEnabledLanguage('nyn', ['nyn'])).toBe(true);
  });

  it.each(languageCodes)('configures English translation directions for %s', (language) => {
    expect(supportsTranslationDirection(language, 'en')).toBe(true);
    expect(supportsTranslationDirection('en', language)).toBe(true);
  });

  it('rejects unconfigured translation directions between localized languages', () => {
    expect(supportsTranslationDirection('lg', 'nyn')).toBe(false);
    expect(supportsTranslationDirection('nyn', 'lg')).toBe(false);
  });
});
