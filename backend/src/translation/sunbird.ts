import { z } from 'zod';
import { getProviderLanguageCode, supportsTranslationDirection } from '../languages/registry.js';
import {
  TranslationConfigurationError,
  TranslationUnavailableError,
  type TranslationProvider,
  type TranslationResult,
} from './types.js';

const translationPayloadSchema = z.object({
  translated_text: z.string().trim().min(1),
  source_language: z.string().min(1),
  target_language: z.string().min(1),
  Error: z.string().nullable().optional(),
});

const completedTranslationSchema = z.object({
  status: z.literal('COMPLETED'),
  output: translationPayloadSchema,
});

const sunbirdResponseSchema = z.union([
  translationPayloadSchema,
  completedTranslationSchema,
  z.object({
    translation: z.union([translationPayloadSchema, completedTranslationSchema]),
  }),
]);

export interface SunbirdTranslationOptions {
  apiToken: string;
  baseUrl: string;
  timeoutMilliseconds: number;
}

export function createSunbirdTranslationProvider(
  options: SunbirdTranslationOptions,
  request: typeof fetch = fetch,
): TranslationProvider {
  return {
    provider: 'sunbird',
    async translate(translationRequest): Promise<TranslationResult> {
      const direction = `${translationRequest.sourceLanguage}->${translationRequest.targetLanguage}` as const;

      if (!supportsTranslationDirection(
        translationRequest.sourceLanguage,
        translationRequest.targetLanguage,
      )) {
        throw new TranslationConfigurationError('sunbird', direction);
      }

      if (translationRequest.sourceLanguage === translationRequest.targetLanguage) {
        return {
          ...translationRequest,
          translatedText: translationRequest.text,
          source: 'sunbird',
          direction,
          durationMilliseconds: 0,
        };
      }

      const startedAt = Date.now();

      try {
        const response = await request(`${options.baseUrl.replace(/\/$/, '')}/tasks/translate`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${options.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_language: getProviderLanguageCode(translationRequest.sourceLanguage, 'sunbird'),
            target_language: getProviderLanguageCode(translationRequest.targetLanguage, 'sunbird'),
            text: translationRequest.text,
          }),
          signal: AbortSignal.timeout(options.timeoutMilliseconds),
        });

        if (!response.ok) {
          throw new TranslationUnavailableError();
        }

        const parsedResponse = sunbirdResponseSchema.safeParse(await response.json());

        if (!parsedResponse.success) {
          throw new TranslationUnavailableError();
        }

        const result = 'translation' in parsedResponse.data
          ? parsedResponse.data.translation
          : parsedResponse.data;
        const payload = 'output' in result ? result.output : result;

        if (payload.Error) {
          throw new TranslationUnavailableError();
        }

        return {
          ...translationRequest,
          translatedText: payload.translated_text,
          source: 'sunbird',
          direction,
          durationMilliseconds: Date.now() - startedAt,
        };
      } catch (error) {
        if (error instanceof TranslationUnavailableError || error instanceof TranslationConfigurationError) {
          throw error;
        }

        throw new TranslationUnavailableError('sunbird', direction);
      }
    },
  };
}
