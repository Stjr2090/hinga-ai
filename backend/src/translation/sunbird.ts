import { z } from 'zod';
import {
  TranslationUnavailableError,
  type SupportedLanguage,
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

const languageCodes: Record<SupportedLanguage, string> = {
  en: 'eng',
  lg: 'lug',
  sw: 'swa',
};

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
    async translate(translationRequest): Promise<TranslationResult> {
      if (translationRequest.sourceLanguage === translationRequest.targetLanguage) {
        return {
          ...translationRequest,
          translatedText: translationRequest.text,
          source: 'sunbird',
        };
      }

      try {
        const response = await request(`${options.baseUrl.replace(/\/$/, '')}/tasks/translate`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${options.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_language: languageCodes[translationRequest.sourceLanguage],
            target_language: languageCodes[translationRequest.targetLanguage],
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
        };
      } catch (error) {
        if (error instanceof TranslationUnavailableError) {
          throw error;
        }

        throw new TranslationUnavailableError();
      }
    },
  };
}
