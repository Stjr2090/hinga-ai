import { describe, expect, it, vi } from 'vitest';
import type { AdvisoryService } from '../src/services/advisory.js';
import { AdvisoryWeatherUnavailableError } from '../src/services/advisory.js';
import {
  createWeatherAwareAdvisoryService,
  isWeatherSensitiveQuestion,
} from '../src/services/weatherAwareAdvisory.js';
import { WeatherProviderError, type WeatherForecast, type WeatherProvider } from '../src/weather/types.js';

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
  daily: [{
    date: '2026-08-12',
    minimumTemperatureCelsius: 19,
    maximumTemperatureCelsius: 29,
    precipitationMillimeters: 24,
    precipitationProbabilityPercent: 85,
    maximumWindSpeedKilometersPerHour: 18,
    maximumWindGustKilometersPerHour: 26,
  }],
  source: 'open-meteo',
  attribution: 'Weather data by Open-Meteo.com',
};

describe('Weather-aware advisory service', () => {
  it('recognizes weather-sensitive farming questions', () => {
    expect(isWeatherSensitiveQuestion('Should I plant maize tomorrow?')).toBe(true);
    expect(isWeatherSensitiveQuestion('Hello, I need help.')).toBe(false);
  });

  it('supplies verified forecasts and deterministic risks', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'Wait for safer conditions.', source: 'groq' });
    const getForecast = vi.fn().mockResolvedValue(forecast);
    const service = createWeatherAwareAdvisoryService(
      { generate } as AdvisoryService,
      { getForecast } as WeatherProvider,
    );

    const result = await service.generate({
      message: 'Should I plant maize today?',
      language: 'en',
      location: forecast.coordinates,
    });

    expect(getForecast).toHaveBeenCalledWith(forecast.coordinates);
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({
      weather: {
        forecast,
        risks: [{ code: 'HEAVY_RAIN', severity: 'high', value: 24, unit: 'mm' }],
      },
    }));
    expect(result.sources).toEqual([{
      provider: 'open-meteo',
      attribution: 'Weather data by Open-Meteo.com',
      fetchedAt: '2026-08-12T00:00:00.000Z',
      timezone: 'Africa/Kampala',
    }]);
  });

  it('does not request weather without coordinates', async () => {
    const generate = vi.fn().mockResolvedValue({ answer: 'General advice.', source: 'groq' });
    const getForecast = vi.fn();
    const service = createWeatherAwareAdvisoryService(
      { generate } as AdvisoryService,
      { getForecast } as WeatherProvider,
    );

    await service.generate({ message: 'Will it rain tomorrow?', language: 'en' });

    expect(getForecast).not.toHaveBeenCalled();
  });

  it('returns a safe error when verified weather is unavailable', async () => {
    const weatherProvider: WeatherProvider = {
      async getForecast() {
        throw new WeatherProviderError('TIMEOUT', 'Provider details');
      },
    };
    const service = createWeatherAwareAdvisoryService(
      { generate: vi.fn() } as unknown as AdvisoryService,
      weatherProvider,
    );

    await expect(service.generate({
      message: 'Will it rain?',
      language: 'en',
      location: forecast.coordinates,
    })).rejects.toBeInstanceOf(AdvisoryWeatherUnavailableError);
  });
});
