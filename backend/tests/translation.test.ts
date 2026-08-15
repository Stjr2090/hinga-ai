import { describe, expect, it, vi } from 'vitest';
import { createSunbirdTranslationProvider } from '../src/translation/sunbird.js';
import { TranslationConfigurationError, TranslationUnavailableError } from '../src/translation/types.js';

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
    const reportDiagnostic = vi.fn();
    const request = vi.fn().mockResolvedValue(createResponse({
      translated_text: 'Ettaka kkalu.',
      source_language: 'eng',
      target_language: 'lug',
      Error: null,
    }));
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);

    await expect(provider.translate({
      text: 'The soil is dry.',
      sourceLanguage: 'en',
      targetLanguage: 'lg',
    })).resolves.toMatchObject({
      translatedText: 'Ettaka kkalu.',
      source: 'sunbird',
    });
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'sunbird',
      direction: 'en->lg',
      outcome: 'success',
      durationMilliseconds: expect.any(Number),
    }));
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('The soil is dry.');
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('test-token');
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
    const reportDiagnostic = vi.fn();
    const request = vi.fn();
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);
    const result = await provider.translate({
      text: 'Check the soil.',
      sourceLanguage: 'en',
      targetLanguage: 'en',
    });

    expect(result.translatedText).toBe('Check the soil.');
    expect(result).toMatchObject({ direction: 'en->en', durationMilliseconds: 0 });
    expect(reportDiagnostic).toHaveBeenCalledWith({
      provider: 'sunbird',
      direction: 'en->en',
      durationMilliseconds: expect.any(Number),
      outcome: 'bypassed',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('uses the registry code for experimental Runyankole fixtures', async () => {
    const request = vi.fn().mockResolvedValue(createResponse({
      translated_text: 'Ninteekateeka ryari ebicoori?',
      source_language: 'eng',
      target_language: 'nyn',
      Error: null,
    }));
    const provider = createSunbirdTranslationProvider(options, request);

    const result = await provider.translate({
      text: 'When should I plant maize?',
      sourceLanguage: 'en',
      targetLanguage: 'nyn',
    });

    expect(result).toMatchObject({
      translatedText: 'Ninteekateeka ryari ebicoori?',
      direction: 'en->nyn',
      source: 'sunbird',
    });
    expect(JSON.parse(request.mock.calls[0][1].body as string)).toMatchObject({
      source_language: 'eng',
      target_language: 'nyn',
    });
  });

  it('returns a typed error for an unconfigured direction', async () => {
    const reportDiagnostic = vi.fn();
    const request = vi.fn();
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);

    await expect(provider.translate({
      text: 'Test',
      sourceLanguage: 'lg',
      targetLanguage: 'nyn',
    })).rejects.toMatchObject({
      code: 'TRANSLATION_DIRECTION_UNSUPPORTED',
      provider: 'sunbird',
      direction: 'lg->nyn',
    });
    await expect(provider.translate({
      text: 'Test',
      sourceLanguage: 'lg',
      targetLanguage: 'nyn',
    })).rejects.toBeInstanceOf(TranslationConfigurationError);
    expect(reportDiagnostic).toHaveBeenCalledWith({
      provider: 'sunbird',
      direction: 'lg->nyn',
      durationMilliseconds: expect.any(Number),
      outcome: 'failure',
      errorCode: 'TRANSLATION_DIRECTION_UNSUPPORTED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects malformed provider output', async () => {
    const reportDiagnostic = vi.fn();
    const request = vi.fn().mockResolvedValue(createResponse({ unexpected: true }));
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);

    await expect(provider.translate({
      text: 'Help',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
    })).rejects.toBeInstanceOf(TranslationUnavailableError);
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'sunbird',
      direction: 'lg->en',
      outcome: 'failure',
      errorCode: 'TRANSLATION_PROVIDER_UNAVAILABLE',
    }));
  });

  it('classifies an aborted provider request as a translation timeout', async () => {
    const controller = new AbortController();
    const reportDiagnostic = vi.fn();
    let providerSignal: AbortSignal | undefined;
    const request = vi.fn().mockImplementation(async (_url, init) => {
      providerSignal = init.signal;
      return new Promise((_, reject) => {
        init.signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);
    const translation = provider.translate({
      text: 'Private farmer question',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
      signal: controller.signal,
    });

    controller.abort();

    await expect(translation).rejects.toMatchObject({ code: 'TRANSLATION_TIMEOUT' });
    expect(providerSignal).not.toBe(controller.signal);
    expect(providerSignal?.aborted).toBe(true);
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'sunbird',
      outcome: 'failure',
      errorCode: 'TRANSLATION_TIMEOUT',
    }));
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('Private farmer question');
  });

  it.each([
    ['HTTP failure', vi.fn().mockResolvedValue(createResponse({}, 503))],
    ['network failure', vi.fn().mockRejectedValue(new Error('offline'))],
    ['provider error', vi.fn().mockResolvedValue(createResponse({
      translated_text: 'Ignored',
      source_language: 'lug',
      target_language: 'eng',
      Error: 'failed',
    }))],
    ['direction mismatch', vi.fn().mockResolvedValue(createResponse({
      translated_text: 'Ignored',
      source_language: 'eng',
      target_language: 'lug',
      Error: null,
    }))],
  ])('normalizes %s without leaking input into diagnostics', async (_name, request) => {
    const reportDiagnostic = vi.fn();
    const provider = createSunbirdTranslationProvider({ ...options, reportDiagnostic }, request);

    await expect(provider.translate({
      text: 'Private farmer question',
      sourceLanguage: 'lg',
      targetLanguage: 'en',
    })).rejects.toMatchObject({
      code: 'TRANSLATION_PROVIDER_UNAVAILABLE',
      provider: 'sunbird',
      direction: 'lg->en',
    });
    expect(reportDiagnostic).toHaveBeenCalledTimes(1);
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'sunbird',
      direction: 'lg->en',
      outcome: 'failure',
      errorCode: 'TRANSLATION_PROVIDER_UNAVAILABLE',
    }));
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('Private farmer question');
  });
});
