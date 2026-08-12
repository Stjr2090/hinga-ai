import { describe, expect, it, vi } from 'vitest';
import { createCachedWeatherProvider } from '../src/weather/cache.js';
import { createOpenMeteoProvider } from '../src/weather/openMeteo.js';
import { evaluateWeatherRisks } from '../src/weather/risks.js';
import { WeatherProviderError, type WeatherForecast, type WeatherProvider } from '../src/weather/types.js';

const openMeteoPayload = {
  latitude: 0.35,
  longitude: 32.58,
  timezone: 'Africa/Kampala',
  current: {
    time: '2026-08-12T03:00',
    temperature_2m: 24,
    precipitation: 0,
    rain: 0,
    weather_code: 2,
    wind_speed_10m: 8,
    wind_gusts_10m: 12,
  },
  daily: {
    time: ['2026-08-12', '2026-08-13', '2026-08-14'],
    temperature_2m_max: [33, 30, 29],
    temperature_2m_min: [19, 18, 18],
    precipitation_sum: [6, 0, 0],
    precipitation_probability_max: [70, 10, 5],
    wind_speed_10m_max: [32, 16, 14],
    wind_gusts_10m_max: [45, 22, 20],
  },
};

describe('Open-Meteo provider', () => {
  it('maps a valid response into the provider-neutral forecast', async () => {
    const requestedUrls: string[] = [];
    const fetchImplementation: typeof fetch = async (input) => {
      requestedUrls.push(input.toString());
      return new Response(JSON.stringify(openMeteoPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = createOpenMeteoProvider({
      baseUrl: 'https://api.open-meteo.com/v1',
      timeoutMilliseconds: 5000,
      fetchImplementation,
    });

    const forecast = await provider.getForecast({ latitude: 0.3476, longitude: 32.5825 });
    const requestedUrl = new URL(requestedUrls[0]);

    expect(requestedUrl.pathname).toBe('/v1/forecast');
    expect(requestedUrl.searchParams.get('forecast_days')).toBe('3');
    expect(forecast).toMatchObject({
      timezone: 'Africa/Kampala',
      source: 'open-meteo',
      current: { temperatureCelsius: 24 },
    });
    expect(forecast.daily).toHaveLength(3);
  });

  it('rejects malformed provider data', async () => {
    const provider = createOpenMeteoProvider({
      baseUrl: 'https://api.open-meteo.com/v1',
      timeoutMilliseconds: 5000,
      fetchImplementation: async () => new Response(JSON.stringify({ invalid: true }), { status: 200 }),
    });

    await expect(provider.getForecast({ latitude: 0, longitude: 0 })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('rejects upstream errors safely', async () => {
    const provider = createOpenMeteoProvider({
      baseUrl: 'https://api.open-meteo.com/v1',
      timeoutMilliseconds: 5000,
      fetchImplementation: async () => new Response('', { status: 503 }),
    });

    await expect(provider.getForecast({ latitude: 0, longitude: 0 })).rejects.toBeInstanceOf(WeatherProviderError);
  });
});

describe('Weather cache', () => {
  it('reuses a forecast for nearby coordinates during the cache period', async () => {
    const forecast = {
      coordinates: { latitude: 0.348, longitude: 32.583 },
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
    } satisfies WeatherForecast;
    const getForecast = vi.fn(async () => forecast);
    const provider: WeatherProvider = { getForecast };
    const cachedProvider = createCachedWeatherProvider(provider, 600);

    await cachedProvider.getForecast({ latitude: 0.34761, longitude: 32.58251 });
    await cachedProvider.getForecast({ latitude: 0.34762, longitude: 32.58252 });

    expect(getForecast).toHaveBeenCalledTimes(1);
  });
});

describe('Weather risks', () => {
  it('derives rain, heat and wind risks from structured values', () => {
    const provider = createOpenMeteoProvider({
      baseUrl: 'https://api.open-meteo.com/v1',
      timeoutMilliseconds: 5000,
      fetchImplementation: async () => new Response(JSON.stringify(openMeteoPayload), { status: 200 }),
    });

    return provider.getForecast({ latitude: 0.3476, longitude: 32.5825 }).then((forecast) => {
      expect(evaluateWeatherRisks(forecast).map((risk) => risk.code)).toEqual(['RAIN', 'HEAT', 'STRONG_WIND']);
    });
  });
});
