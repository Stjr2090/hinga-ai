import type { FastifyInstance } from 'fastify';
import type { ExperimentalLanguageCode } from '../languages/registry.js';
import { createChatRequestSchema, type ChatResponse } from '../schemas/chat.js';
import {
  AdvisoryLanguageUnavailableError,
  AdvisoryUnavailableError,
  AdvisoryWeatherUnavailableError,
  type AdvisoryService,
} from '../services/advisory.js';

export async function registerChatRoute(
  app: FastifyInstance,
  advisoryService: AdvisoryService,
  enabledExperimentalLanguages: readonly ExperimentalLanguageCode[] = [],
): Promise<void> {
  const chatRequestSchema = createChatRequestSchema(enabledExperimentalLanguages);

  app.post('/api/chat', async (request, reply) => {
    const parsedRequest = chatRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request body is invalid.',
          requestId: request.id,
        },
      });
    }

    let result;

    try {
      result = await advisoryService.generate(parsedRequest.data);
    } catch (error) {
      if (error instanceof AdvisoryWeatherUnavailableError) {
        return reply.status(502).send({
          error: {
            code: 'WEATHER_UNAVAILABLE',
            message: 'Verified weather data is temporarily unavailable.',
            requestId: request.id,
          },
        });
      }

      if (error instanceof AdvisoryLanguageUnavailableError) {
        return reply.status(422).send({
          error: {
            code: 'ADVISORY_LANGUAGE_UNAVAILABLE',
            message: 'Farming advice is not yet available in the selected language.',
            requestId: request.id,
          },
        });
      }

      if (error instanceof AdvisoryUnavailableError) {
        request.log.warn({ provider: error.provider }, 'Advisory provider unavailable');
        return reply.status(503).send({
          error: {
            code: 'ADVISORY_UNAVAILABLE',
            message: 'Farming advice is temporarily unavailable. Please try again shortly.',
            requestId: request.id,
          },
        });
      }

      throw error;
    }
    const response: ChatResponse = {
      requestId: request.id,
      answer: result.answer,
      language: parsedRequest.data.language,
      source: result.source,
      ...(result.sources ? { sources: result.sources } : {}),
    };

    return reply.send(response);
  });
}
