import { z } from 'zod';
import { getProviderLanguageCode, supportsTranslationDirection } from '../languages/registry.js';
import {
  TranslationConfigurationError,
  TranslationUnavailableError,
  type TranslationDiagnosticReporter,
  type TranslationErrorCode,
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
  reportDiagnostic?: TranslationDiagnosticReporter;
}

export function createSunbirdTranslationProvider(
  options: SunbirdTranslationOptions,
  request: typeof fetch = fetch,
): TranslationProvider {
  return {
    provider: 'sunbird',
    async translate(translationRequest): Promise<TranslationResult> {
      const direction = `${translationRequest.sourceLanguage}->${translationRequest.targetLanguage}` as const;
      const startedAt = Date.now();
      const report = (outcome: 'success' | 'bypassed' | 'failure', errorCode?: TranslationErrorCode) => {
        options.reportDiagnostic?.({
          provider: 'sunbird',
          direction,
          durationMilliseconds: Date.now() - startedAt,
          outcome,
          ...(errorCode ? { errorCode } : {}),
        });
      };

      if (!supportsTranslationDirection(
        translationRequest.sourceLanguage,
        translationRequest.targetLanguage,
      )) {
        report('failure', 'TRANSLATION_DIRECTION_UNSUPPORTED');
        throw new TranslationConfigurationError('sunbird', direction);
      }

      if (translationRequest.sourceLanguage === translationRequest.targetLanguage) {
        report('bypassed');
        return {
          ...translationRequest,
          translatedText: translationRequest.text,
          source: 'sunbird',
          direction,
          durationMilliseconds: 0,
        };
      }

      const sourceProviderCode = getProviderLanguageCode(translationRequest.sourceLanguage, 'sunbird');
      const targetProviderCode = getProviderLanguageCode(translationRequest.targetLanguage, 'sunbird');

      try {
        const response = await request(`${options.baseUrl.replace(/\/$/, '')}/tasks/translate`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${options.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_language: sourceProviderCode,
            target_language: targetProviderCode,
            text: translationRequest.text,
          }),
          signal: translationRequest.signal
            ? AbortSignal.any([
                translationRequest.signal,
                AbortSignal.timeout(options.timeoutMilliseconds),
              ])
            : AbortSignal.timeout(options.timeoutMilliseconds),
        });

        if (!response.ok) {
          throw new TranslationUnavailableError('sunbird', direction);
        }

        const parsedResponse = sunbirdResponseSchema.safeParse(await response.json());

        if (!parsedResponse.success) {
          throw new TranslationUnavailableError('sunbird', direction);
        }

        const result = 'translation' in parsedResponse.data
          ? parsedResponse.data.translation
          : parsedResponse.data;
        const payload = 'output' in result ? result.output : result;

        if (
          payload.Error
          || payload.source_language !== sourceProviderCode
          || payload.target_language !== targetProviderCode
        ) {
          throw new TranslationUnavailableError('sunbird', direction);
        }

        report('success');

        return {
          ...translationRequest,
          translatedText: payload.translated_text,
          source: 'sunbird',
          direction,
          durationMilliseconds: Date.now() - startedAt,
        };
      } catch (error) {
        const wasAborted = translationRequest.signal?.aborted
          || (error instanceof DOMException
            && (error.name === 'AbortError' || error.name === 'TimeoutError'));
        const providerError = error instanceof TranslationUnavailableError
          ? error
          : new TranslationUnavailableError(
              'sunbird',
              direction,
              wasAborted ? 'TRANSLATION_TIMEOUT' : 'TRANSLATION_PROVIDER_UNAVAILABLE',
            );
        report('failure', providerError.code);
        throw providerError;
      }
    },
  };
}
