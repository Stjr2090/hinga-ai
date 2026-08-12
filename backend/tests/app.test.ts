import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnvironment } from '../src/config/environment.js';
import { AdvisoryUnavailableError, type AdvisoryService } from '../src/services/advisory.js';
import type { WeatherForecast, WeatherProvider } from '../src/weather/types.js';

const applications: Awaited<ReturnType<typeof buildApp>>[] = [];

const weatherForecast: WeatherForecast = {
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
  daily: [
    {
      date: '2026-08-12',
      minimumTemperatureCelsius: 19,
      maximumTemperatureCelsius: 29,
      precipitationMillimeters: 24,
      precipitationProbabilityPercent: 85,
      maximumWindSpeedKilometersPerHour: 18,
      maximumWindGustKilometersPerHour: 26,
    },
  ],
  source: 'open-meteo',
  attribution: 'Weather data by Open-Meteo.com',
};

const testWeatherProvider: WeatherProvider = {
  async getForecast() {
    return weatherForecast;
  },
};

const testAdvisoryService: AdvisoryService = {
  async generate() {
    return {
      answer: 'Test agricultural guidance.',
      source: 'groq',
    };
  },
};

async function createTestApp(
  weatherProvider: WeatherProvider = testWeatherProvider,
  advisoryService?: AdvisoryService,
) {
  const environment = loadEnvironment({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  });
  const app = await buildApp({
    environment,
    weatherProvider,
    advisoryService: advisoryService ?? testAdvisoryService,
  });
  applications.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe('HINGA backend', () => {
  it('requires production provider credentials', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'production' }))
      .toThrow('GROQ_API_KEY, SUNBIRD_API_TOKEN required in production');
  });

  it('requires an advisory provider', async () => {
    const environment = loadEnvironment({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    });

    await expect(buildApp({ environment, weatherProvider: testWeatherProvider }))
      .rejects.toThrow('GROQ_API_KEY is required');
  });

  it('reports service health', async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'hinga-backend',
    });
  });

  it('accepts a supported chat request', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Should I plant maize today?',
        language: 'en',
        location: {
          latitude: 0.3476,
          longitude: 32.5825,
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      language: 'en',
      source: 'groq',
    });
    expect(response.json().requestId).toBeTruthy();
  });

  it('rejects invalid chat input', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: '',
        language: 'unsupported',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a safe response when the advisory provider is unavailable', async () => {
    const advisoryService: AdvisoryService = {
      async generate() {
        throw new AdvisoryUnavailableError();
      },
    };
    const app = await createTestApp(testWeatherProvider, advisoryService);
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Should I plant maize today?',
        language: 'en',
      },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toMatchObject({
      code: 'ADVISORY_UNAVAILABLE',
      message: 'Farming advice is temporarily unavailable. Please try again shortly.',
    });
    expect(response.json().error.requestId).toBeTruthy();
  });

  it('returns a safe not-found response', async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/missing' });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.',
    });
  });

  it('returns validated weather and deterministic risks', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/weather?latitude=0.3476&longitude=32.5825',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      forecast: {
        source: 'open-meteo',
        timezone: 'Africa/Kampala',
      },
      risks: [{ code: 'HEAVY_RAIN', severity: 'high' }],
    });
  });

  it('rejects invalid weather coordinates', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/weather?latitude=200&longitude=32.5825',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });
});
