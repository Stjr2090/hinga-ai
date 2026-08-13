import { describe, expect, it, vi } from 'vitest';
import type { AdvisoryService } from '../src/services/advisory.js';
import { createLocalizedAdvisoryService } from '../src/services/localizedAdvisory.js';
import { TranslationUnavailableError, type TranslationProvider } from '../src/translation/types.js';

describe('Localized advisory service', () => {
  it('translates Luganda into English and the advisory back into Luganda', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'Check the soil.', source: 'groq' });
    const advisoryService: AdvisoryService = { generate };
    const translate = vi.fn()
      .mockResolvedValueOnce({ translatedText: 'When should I plant maize?' })
      .mockResolvedValueOnce({ translatedText: 'Kebera ettaka.' });
    const translationProvider = { translate } as unknown as TranslationProvider;
    const service = createLocalizedAdvisoryService(
      advisoryService,
      translationProvider,
    );

    await expect(service.generate({
      message: 'Nnina kusimba ddi kasooli?',
      language: 'lg',
    })).resolves.toEqual({ answer: 'Kebera ettaka.', source: 'groq' });
    expect(generate).toHaveBeenCalledWith({
      message: 'When should I plant maize?',
      language: 'en',
    });
    expect(translate).toHaveBeenCalledTimes(2);
  });

  it('does not translate English requests', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'Check the soil.', source: 'groq' });
    const translate = vi.fn();
    const service = createLocalizedAdvisoryService(
      { generate },
      { translate } as unknown as TranslationProvider,
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
      { translate } as unknown as TranslationProvider,
    );

    await expect(service.generate({ message: 'Enkuba enaatonya?', language: 'lg' }))
      .resolves.toMatchObject({ sources });
  });

  it('runs an experimental Runyankole fixture through the reusable pipeline', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'Wait for reliable rain.', source: 'groq' });
    const translate = vi.fn()
      .mockResolvedValueOnce({ translatedText: 'Should I plant maize today?' })
      .mockResolvedValueOnce({ translatedText: 'Rinda enjura erikwesigwa.' });
    const service = createLocalizedAdvisoryService(
      { generate },
      { translate } as unknown as TranslationProvider,
    );

    await expect(service.generate({
      message: 'Mbiibire ebicoori eriizooba?',
      language: 'nyn',
    })).resolves.toMatchObject({ answer: 'Rinda enjura erikwesigwa.' });
    expect(generate).toHaveBeenCalledWith({
      message: 'Should I plant maize today?',
      language: 'en',
    });
    expect(translate).toHaveBeenNthCalledWith(1, {
      text: 'Mbiibire ebicoori eriizooba?',
      sourceLanguage: 'nyn',
      targetLanguage: 'en',
    });
    expect(translate).toHaveBeenNthCalledWith(2, {
      text: 'Wait for reliable rain.',
      sourceLanguage: 'en',
      targetLanguage: 'nyn',
    });
  });

  it('labels translation provider failures', async () => {
    const service = createLocalizedAdvisoryService(
      { generate: vi.fn() },
      {
        provider: 'sunbird',
        translate: vi.fn().mockRejectedValue(new TranslationUnavailableError()),
      },
    );

    await expect(service.generate({ message: 'Nsimbe ddi?', language: 'lg' }))
      .rejects.toMatchObject({ provider: 'sunbird' });
  });

});
