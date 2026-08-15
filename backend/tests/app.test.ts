import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnvironment } from '../src/config/environment.js';
import { AdvisoryUnavailableError, type AdvisoryService } from '../src/services/advisory.js';
import { WeatherProviderError, type WeatherForecast, type WeatherProvider } from '../src/weather/types.js';

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
  environmentValues: NodeJS.ProcessEnv = {},
) {
  const environment = loadEnvironment({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    ...environmentValues,
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
  it('uses distinct production advisory model defaults', () => {
    const environment = loadEnvironment({ NODE_ENV: 'test' });

    expect(environment.GROQ_PRIMARY_MODEL).toBe('openai/gpt-oss-20b');
    expect(environment.GROQ_FALLBACK_MODEL).toBe('openai/gpt-oss-120b');
    expect(environment.REQUEST_DEADLINE_MS).toBe(25_000);
    expect(environment.TRANSLATION_TIMEOUT_MS).toBe(15_000);
    expect(environment.ENABLED_EXPERIMENTAL_LANGUAGES).toEqual([]);
  });

  it('keeps the provider translation timeout separate from the total request deadline', () => {
    const environment = loadEnvironment({ NODE_ENV: 'test' });

    expect(environment.TRANSLATION_TIMEOUT_MS).toBe(15_000);
    expect(environment.REQUEST_DEADLINE_MS).toBe(25_000);
  });

  it('keeps the backend deadline below the frontend timeout', () => {
    expect(() => loadEnvironment({ NODE_ENV: 'test', REQUEST_DEADLINE_MS: '30000' }))
      .toThrow('REQUEST_DEADLINE_MS');
  });

  it('rejects identical primary and fallback models', () => {
    expect(() => loadEnvironment({
      NODE_ENV: 'test',
      GROQ_PRIMARY_MODEL: 'same-model',
      GROQ_FALLBACK_MODEL: 'same-model',
    })).toThrow('GROQ_PRIMARY_MODEL and GROQ_FALLBACK_MODEL must differ');
  });

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

  it('returns the validation envelope for malformed JSON', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request body is invalid.',
        requestId: expect.any(String),
      },
    });
  });

  it('keeps experimental languages outside the production API', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Mbiibire ebicoori eriizooba?',
        language: 'nyn',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts an explicitly enabled experimental language', async () => {
    const app = await createTestApp(testWeatherProvider, testAdvisoryService, {
      ENABLED_EXPERIMENTAL_LANGUAGES: 'nyn',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: {
        message: 'Mbiibire ebicoori eriizooba?',
        language: 'nyn',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      language: 'nyn',
      source: 'groq',
    });
  });

  it.each([
    ['', []],
    ['nyn', ['nyn']],
    [' nyn ', ['nyn']],
  ] as const)('parses valid experimental language configuration %j', (value, expected) => {
    expect(loadEnvironment({
      NODE_ENV: 'test',
      ENABLED_EXPERIMENTAL_LANGUAGES: value,
    }).ENABLED_EXPERIMENTAL_LANGUAGES).toEqual(expected);
  });

  it.each([
    ['nyn,nyn', 'Experimental language codes must be unique'],
    ['nyn,', 'Experimental language codes must be non-empty'],
    [',nyn', 'Experimental language codes must be non-empty'],
    ['nyn,,nyn', 'Experimental language codes must be non-empty'],
    ['unknown', 'Unknown or non-experimental language codes: unknown'],
    ['en', 'Unknown or non-experimental language codes: en'],
    ['nyn,en', 'Unknown or non-experimental language codes: en'],
  ])('rejects invalid experimental language configuration %j', (value, message) => {
    expect(() => loadEnvironment({
      NODE_ENV: 'test',
      ENABLED_EXPERIMENTAL_LANGUAGES: value,
    })).toThrow(message);
  });

  it.each(['en', 'lg'] as const)('accepts production language %s independently', async (language) => {
    const app = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Test agricultural question', language },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ language, source: 'groq' });
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

  it('cancels provider work at the total request deadline', async () => {
    let receivedSignal: AbortSignal | undefined;
    const advisoryService: AdvisoryService = {
      async generate(request) {
        receivedSignal = request.signal;
        return new Promise((_, reject) => {
          request.signal?.addEventListener(
            'abort',
            () => reject(new AdvisoryUnavailableError()),
            { once: true },
          );
        });
      },
    };
    const app = await createTestApp(testWeatherProvider, advisoryService, {
      REQUEST_DEADLINE_MS: '1000',
    });
    const response = await app.inject({
      method: 'POST',
      url: '/api/chat',
      payload: { message: 'Should I plant maize?', language: 'en' },
    });

    expect(response.statusCode).toBe(503);
    expect(receivedSignal?.aborted).toBe(true);
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

  it('logs only safe request and provider diagnostics', async () => {
    const groqKey = 'gsk_unique_runtime_log_secret_7f1d';
    const farmerMessage = 'unique farmer message 3a96 about private field conditions';
    const authorization = 'Bearer unique-authorization-value-84c2';
    const latitude = '1.234567';
    const longitude = '31.765432';
    const unsafeErrorDetail = 'unique-provider-error-detail-b773';
    const logLines: string[] = [];
    const advisoryService: AdvisoryService = {
      async generate() {
        throw new Error(`${unsafeErrorDetail} ${groqKey}`);
      },
    };
    const weatherProvider: WeatherProvider = {
      async getForecast() {
        throw new WeatherProviderError('UPSTREAM_ERROR', unsafeErrorDetail);
      },
    };
    const environment = loadEnvironment({
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      GROQ_API_KEY: groqKey,
    });
    const app = await buildApp({
      environment,
      advisoryService,
      weatherProvider,
      loggerStream: { write: (message) => logLines.push(message) },
    });
    applications.push(app);

    const chatResponse = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization },
      payload: { message: farmerMessage, language: 'en' },
    });
    const weatherResponse = await app.inject({
      method: 'GET',
      url: `/api/weather?latitude=${latitude}&longitude=${longitude}`,
      headers: { authorization },
    });
    const logs = logLines.join('');
    const fingerprint = createHash('sha256').update(groqKey).digest('hex').slice(0, 12);

    expect(chatResponse.statusCode).toBe(500);
    expect(weatherResponse.statusCode).toBe(502);
    expect(logs).not.toContain(groqKey);
    expect(logs).not.toContain(fingerprint);
    expect(logs).not.toContain(farmerMessage);
    expect(logs).not.toContain(latitude);
    expect(logs).not.toContain(longitude);
    expect(logs).not.toContain(authorization);
    expect(logs).not.toContain(unsafeErrorDetail);
    expect(logs).toContain(chatResponse.json().error.requestId);
    expect(logs).toContain('"route":"/api/chat"');
    expect(logs).toContain('"status":500');
    expect(logs).toMatch(/"durationMilliseconds":\d+/);
    expect(logs).toContain('"provider":"open-meteo"');
    expect(logs).toContain('"failureClassification":"UPSTREAM_ERROR"');
    expect(logs).toContain('"failureClassification":"UNEXPECTED_ERROR"');
  });
});
