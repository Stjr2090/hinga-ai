import type { TranslationProvider } from '../translation/types.js';
import { TranslationUnavailableError } from '../translation/types.js';
import {
  AdvisoryLanguageUnavailableError,
  AdvisoryUnavailableError,
  type AdvisoryService,
} from './advisory.js';

export function createLocalizedAdvisoryService(
  advisoryService: AdvisoryService,
  translationProvider: TranslationProvider,
): AdvisoryService {
  return {
    async generate(request) {
      if (request.language === 'en') {
        return advisoryService.generate(request);
      }

      try {
        const incoming = await translationProvider.translate({
          text: request.message,
          sourceLanguage: request.language,
          targetLanguage: 'en',
        });
        const advisory = await advisoryService.generate({
          ...request,
          message: incoming.translatedText,
          language: 'en',
        });
        const outgoing = await translationProvider.translate({
          text: advisory.answer,
          sourceLanguage: 'en',
          targetLanguage: request.language,
        });

        return {
          ...advisory,
          answer: outgoing.translatedText,
        };
      } catch (error) {
        if (error instanceof AdvisoryLanguageUnavailableError) {
          throw error;
        }

        if (error instanceof TranslationUnavailableError) {
          throw new AdvisoryUnavailableError('sunbird');
        }

        throw error;
      }
    },
  };
}
