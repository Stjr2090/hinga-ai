import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, LogController } from 'fastify';
import type { Environment } from './config/environment.js';
import { registerChatRoute } from './routes/chat.js';
import { registerHealthRoute } from './routes/health.js';
import { registerWeatherRoute } from './routes/weather.js';
import type { AdvisoryService } from './services/advisory.js';
import { createGroqAdvisoryService } from './services/groqAdvisory.js';
import { createLocalizedAdvisoryService } from './services/localizedAdvisory.js';
import { createWeatherAwareAdvisoryService } from './services/weatherAwareAdvisory.js';
import { createSunbirdTranslationProvider } from './translation/sunbird.js';
import { createCachedWeatherProvider } from './weather/cache.js';
import { createOpenMeteoProvider } from './weather/openMeteo.js';
import type { WeatherProvider } from './weather/types.js';

export interface BuildAppOptions {
  environment: Environment;
  advisoryService?: AdvisoryService;
  weatherProvider?: WeatherProvider;
  loggerStream?: { write(message: string): void };
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: () => randomUUID(),
    logController: new LogController({ disableRequestLogging: true }),
    logger: options.environment.LOG_LEVEL === 'silent'
      ? false
      : {
          level: options.environment.LOG_LEVEL,
          redact: ['req.headers.authorization', 'req.headers.x-api-key'],
          ...(options.loggerStream ? { stream: options.loggerStream } : {}),
        },
    bodyLimit: 1_048_576,
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      requestId: request.id,
      route: request.routeOptions.url,
      status: reply.statusCode,
      durationMilliseconds: Math.round(reply.elapsedTime),
    }, 'Request completed');
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: options.environment.CORS_ORIGIN,
    methods: ['GET', 'POST'],
  });
  await app.register(rateLimit, {
    max: options.environment.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
  });

  app.setNotFoundHandler(async (request, reply) => reply.status(404).send({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist.',
      requestId: request.id,
    },
  }));

  app.setErrorHandler(async (error, request, reply) => {
    if (
      typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'FST_ERR_CTP_INVALID_JSON_BODY'
    ) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request body is invalid.',
          requestId: request.id,
        },
      });
    }

    request.log.error({ failureClassification: 'UNEXPECTED_ERROR' }, 'Request failed');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The request could not be completed.',
        requestId: request.id,
      },
    });
  });

  await registerHealthRoute(app);
  const openMeteoProvider = createOpenMeteoProvider({
    baseUrl: options.environment.OPEN_METEO_BASE_URL,
    timeoutMilliseconds: options.environment.WEATHER_TIMEOUT_MS,
  });
  const weatherProvider = options.weatherProvider
    ?? createCachedWeatherProvider(
      openMeteoProvider,
      options.environment.WEATHER_CACHE_TTL_SECONDS,
      options.environment.WEATHER_CACHE_MAX_ENTRIES,
    );
  const providerAdvisoryService = options.advisoryService
    ?? (options.environment.GROQ_API_KEY
      ? createGroqAdvisoryService({
          apiKey: options.environment.GROQ_API_KEY,
          primaryModel: options.environment.GROQ_PRIMARY_MODEL,
          fallbackModel: options.environment.GROQ_FALLBACK_MODEL,
          timeoutMilliseconds: options.environment.ADVISORY_TIMEOUT_MS,
          reportDiagnostic: (diagnostic) => {
            const level = diagnostic.outcome === 'failure' ? 'warn' : 'info';
            app.log[level]({ provider: 'groq', advisory: diagnostic }, 'Groq provider attempt completed');
          },
        })
      : null);

  if (!providerAdvisoryService) {
    throw new Error('GROQ_API_KEY is required when no advisory service is provided.');
  }
  const baseAdvisoryService = options.environment.GROQ_API_KEY && !options.advisoryService
    ? createWeatherAwareAdvisoryService(providerAdvisoryService, weatherProvider)
    : providerAdvisoryService;
  const advisoryService = options.environment.SUNBIRD_API_TOKEN && !options.advisoryService
    ? createLocalizedAdvisoryService(
        baseAdvisoryService,
        createSunbirdTranslationProvider({
          apiToken: options.environment.SUNBIRD_API_TOKEN,
          baseUrl: options.environment.SUNBIRD_BASE_URL,
          timeoutMilliseconds: options.environment.TRANSLATION_TIMEOUT_MS,
          reportDiagnostic: (diagnostic) => {
            if (diagnostic.outcome === 'failure') {
              app.log.warn({ translation: diagnostic }, 'Translation request failed');
              return;
            }

            app.log.info({ translation: diagnostic }, 'Translation request completed');
          },
        }),
      )
    : baseAdvisoryService;
  await registerChatRoute(
    app,
    advisoryService,
    options.environment.ENABLED_EXPERIMENTAL_LANGUAGES,
    options.environment.REQUEST_DEADLINE_MS,
  );
  await registerWeatherRoute(app, weatherProvider);

  return app;
}
