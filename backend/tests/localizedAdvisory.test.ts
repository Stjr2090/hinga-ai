import { describe, expect, it, vi } from 'vitest';
import type { AdvisoryService } from '../src/services/advisory.js';
import { createLocalizedAdvisoryService } from '../src/services/localizedAdvisory.js';
import type { TranslationProvider } from '../src/translation/types.js';

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

});
