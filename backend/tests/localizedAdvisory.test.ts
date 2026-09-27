import { describe, expect, it, vi } from 'vitest';
import type { AdvisoryService } from '../src/services/advisory.js';
import { createLocalizedAdvisoryService } from '../src/services/localizedAdvisory.js';
import { createWeatherAwareAdvisoryService } from '../src/services/weatherAwareAdvisory.js';
import { TranslationUnavailableError, type TranslationProvider } from '../src/translation/types.js';
import type { WeatherForecast } from '../src/weather/types.js';

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
      expect(translate).toHaveBeenCalledTimes(2);
      expect(generate).toHaveBeenCalledOnce();
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
    const forecast: WeatherForecast = {
      coordinates: { latitude: 0.3476, longitude: 32.5825 },
      timezone: 'Africa/Kampala',
      fetchedAt: '2026-08-12T00:00:00.000Z',
      current: {
        observedAt: '2026-08-12T03:00',
        temperatureCelsius: 24,
        precipitationMillimeters: 0,
        rainMillimeters: 0,
        weatherCode: 2,
        windSpeedKilometersPerHour: 8,
        windGustKilometersPerHour: 12,
      },
      daily: [],
      source: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com',
    };
    const getForecast = vi.fn().mockResolvedValue(forecast);
    const advisoryService = createWeatherAwareAdvisoryService(
      { generate: vi.fn().mockResolvedValue({ answer: 'Rain is possible.', source: 'groq' }) },
      { getForecast },
    );
    const translate = vi.fn()
      .mockResolvedValueOnce({ translatedText: 'Will it rain?' })
      .mockResolvedValueOnce({ translatedText: 'Enkuba eyinza okutonnya.' });
    const service = createLocalizedAdvisoryService(
      advisoryService,
      createTranslationProvider(translate),
    );

    await expect(service.generate({
      message: 'Enkuba enaatonya?',
      language: 'lg',
      location: forecast.coordinates,
    })).resolves.toMatchObject({
      answer: 'Enkuba eyinza okutonnya.',
      sources: [{
        provider: 'open-meteo',
        attribution: 'Weather data by Open-Meteo.com',
        timezone: 'Africa/Kampala',
      }],
    });
    expect(getForecast).toHaveBeenCalledWith(forecast.coordinates);
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
