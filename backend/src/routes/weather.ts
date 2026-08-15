import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { evaluateWeatherRisks } from '../weather/risks.js';
import { WeatherProviderError, type WeatherProvider } from '../weather/types.js';

const weatherQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function registerWeatherRoute(app: FastifyInstance, weatherProvider: WeatherProvider): Promise<void> {
  app.get('/api/weather', async (request, reply) => {
    const parsedQuery = weatherQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid latitude and longitude are required.',
          requestId: request.id,
        },
      });
    }

    try {
      const forecast = await weatherProvider.getForecast(parsedQuery.data);

      return reply.send({
        requestId: request.id,
        forecast,
        risks: evaluateWeatherRisks(forecast),
      });
    } catch (error) {
      if (error instanceof WeatherProviderError) {
        request.log.warn({
          provider: 'open-meteo',
          failureClassification: error.code,
        }, 'Weather provider unavailable');
        return reply.status(502).send({
          error: {
            code: 'WEATHER_UNAVAILABLE',
            message: 'Weather data is temporarily unavailable.',
            requestId: request.id,
          },
        });
      }

      throw error;
    }
  });
}
