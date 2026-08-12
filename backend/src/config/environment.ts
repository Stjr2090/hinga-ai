import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  OPEN_METEO_BASE_URL: z.string().url().default('https://api.open-meteo.com/v1'),
  WEATHER_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
  WEATHER_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(600),
  WEATHER_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).max(10_000).default(250),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().min(1).default('llama-3.3-70b-versatile'),
  ADVISORY_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(10_000),
  SUNBIRD_API_TOKEN: z.string().min(1).optional(),
  SUNBIRD_BASE_URL: z.string().url().default('https://api.sunbird.ai'),
  TRANSLATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30_000).default(10_000),
});

export type Environment = z.infer<typeof environmentSchema>;

export function loadEnvironment(values: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(values);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid backend configuration: ${issues}`);
  }

  if (result.data.NODE_ENV === 'production') {
    const missingProviders = [
      !result.data.GROQ_API_KEY && 'GROQ_API_KEY',
      !result.data.SUNBIRD_API_TOKEN && 'SUNBIRD_API_TOKEN',
    ].filter(Boolean);

    if (missingProviders.length > 0) {
      throw new Error(`Invalid backend configuration: ${missingProviders.join(', ')} required in production`);
    }
  }

  return result.data;
}
