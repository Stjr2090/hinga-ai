import { describe, expect, it, vi } from 'vitest';
import { createSunbirdTranslationProvider } from '../src/translation/sunbird.js';
import { TranslationUnavailableError } from '../src/translation/types.js';

const options = {
  apiToken: 'test-token',
  baseUrl: 'https://api.sunbird.ai',
  timeoutMilliseconds: 5000,
};

function createResponse(translation: unknown, status = 200): Response {
  return new Response(JSON.stringify({ translation }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Sunbird translation provider', () => {
  it('normalizes a direct translation response', async () => {
    const request = vi.fn().mockResolvedValue(createResponse({
      translated_text: 'Ettaka kkalu.',
      source_language: 'eng',
      target_language: 'lug',
      Error: null,
    }));
    const provider = createSunbirdTranslationProvider(options, request);

    await expect(provider.translate({
      text: 'The soil is dry.',
      sourceLanguage: 'en',
      targetLanguage: 'lg',
    })).resolves.toMatchObject({
      translatedText: 'Ettaka kkalu.',
      source: 'sunbird',
    });
  });

  it('normalizes a completed task response', async () => {
    const request = vi.fn().mockResolvedValue(createResponse({
      status: 'COMPLETED',
      output: {
        translated_text: 'The cassava leaves have turned white.',
        source_language: 'lug',
        target_language: 'eng',
        Error: null,
      },
    }));
    const provider = createSunbirdTranslationProvider(options, request);

    await expect(provider.translate({
      text: 'Ebikoola by’omuwogo byeruuse.',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
    })).resolves.toMatchObject({
      translatedText: 'The cassava leaves have turned white.',
      source: 'sunbird',
    });
  });

  it('normalizes a top-level completed task response', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'COMPLETED',
      output: {
        translated_text: 'I need help with my garden.',
        source_language: 'lug',
        target_language: 'eng',
        Error: null,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const provider = createSunbirdTranslationProvider(options, request);

    await expect(provider.translate({
      text: 'Nsaba obuyambi ku nnimiro yange.',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
    })).resolves.toMatchObject({
      translatedText: 'I need help with my garden.',
      source: 'sunbird',
    });
  });

  it('does not call Sunbird when both languages match', async () => {
    const request = vi.fn();
    const provider = createSunbirdTranslationProvider(options, request);
    const result = await provider.translate({
      text: 'Check the soil.',
      sourceLanguage: 'en',
      targetLanguage: 'en',
    });

    expect(result.translatedText).toBe('Check the soil.');
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output', async () => {
    const request = vi.fn().mockResolvedValue(createResponse({ unexpected: true }));
    const provider = createSunbirdTranslationProvider(options, request);

    await expect(provider.translate({
      text: 'Help',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
    })).rejects.toBeInstanceOf(TranslationUnavailableError);
  });
});
