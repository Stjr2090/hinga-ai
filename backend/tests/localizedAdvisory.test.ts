import { describe, expect, it, vi } from 'vitest';
import type { AdvisoryService } from '../src/services/advisory.js';
import { createLocalizedAdvisoryService } from '../src/services/localizedAdvisory.js';
import { TranslationUnavailableError, type TranslationProvider } from '../src/translation/types.js';

function createTranslationProvider(translate: ReturnType<typeof vi.fn>): TranslationProvider {
  return { provider: 'sunbird', translate } as TranslationProvider;
}

const localizedFixtures = [
  {
    language: 'lg' as const,
    localQuestion: 'Nnina kusimba ddi kasooli?',
    englishQuestion: 'When should I plant maize?',
    englishAnswer: 'Check the soil.',
    localAnswer: 'Kebera ettaka.',
  },
  {
    language: 'nyn' as const,
    localQuestion: 'Mbiibire ebicoori eriizooba?',
    englishQuestion: 'Should I plant maize today?',
    englishAnswer: 'Wait for reliable rain.',
    localAnswer: 'Rinda enjura erikwesigwa.',
  },
];

describe('Localized advisory service', () => {
  it.each(localizedFixtures)(
    'uses the shared localization pipeline for $language',
    async ({ language, localQuestion, englishQuestion, englishAnswer, localAnswer }) => {
      const generate = vi.fn().mockResolvedValue({ answer: englishAnswer, source: 'groq' });
      const advisoryService: AdvisoryService = { generate };
      const translate = vi.fn()
        .mockResolvedValueOnce({ translatedText: englishQuestion })
        .mockResolvedValueOnce({ translatedText: localAnswer });
      const service = createLocalizedAdvisoryService(
        advisoryService,
        createTranslationProvider(translate),
      );

      await expect(service.generate({
        message: localQuestion,
        language,
      })).resolves.toEqual({ answer: localAnswer, source: 'groq' });
      expect(generate).toHaveBeenCalledWith({
        message: englishQuestion,
        language: 'en',
      });
      expect(translate).toHaveBeenNthCalledWith(1, {
        text: localQuestion,
        sourceLanguage: language,
        targetLanguage: 'en',
      });
      expect(translate).toHaveBeenNthCalledWith(2, {
        text: englishAnswer,
        sourceLanguage: 'en',
        targetLanguage: language,
      });
    },
  );

  it('does not translate English requests', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'Check the soil.', source: 'groq' });
    const translate = vi.fn();
    const service = createLocalizedAdvisoryService(
      { generate },
      createTranslationProvider(translate),
    );

    await service.generate({ message: 'When should I plant maize?', language: 'en' });

    expect(generate).toHaveBeenCalledOnce();
    expect(translate).not.toHaveBeenCalled();
  });

  it('preserves weather source metadata through translation', async () => {
    const sources = [{
      provider: 'open-meteo' as const,
      attribution: 'Weather data by Open-Meteo.com' as const,
      fetchedAt: '2026-08-12T00:00:00.000Z',
      timezone: 'Africa/Kampala',
    }];
    const advisoryService: AdvisoryService = {
      generate: vi.fn().mockResolvedValue({ answer: 'Rain is possible.', source: 'groq', sources }),
    };
    const translate = vi.fn()
      .mockResolvedValueOnce({ translatedText: 'Will it rain?' })
      .mockResolvedValueOnce({ translatedText: 'Enkuba eyinza okutonnya.' });
    const service = createLocalizedAdvisoryService(
      advisoryService,
      createTranslationProvider(translate),
    );

    await expect(service.generate({ message: 'Enkuba enaatonya?', language: 'lg' }))
      .resolves.toMatchObject({ sources });
  });

  it('labels translation provider failures', async () => {
    const service = createLocalizedAdvisoryService(
      { generate: vi.fn() },
      createTranslationProvider(vi.fn().mockRejectedValue(new TranslationUnavailableError())),
    );

    await expect(service.generate({ message: 'Nsimbe ddi?', language: 'lg' }))
      .rejects.toMatchObject({ provider: 'sunbird' });
  });

});
