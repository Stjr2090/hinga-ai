import { describe, expect, it, vi } from 'vitest';
import { AdvisoryUnavailableError } from '../src/services/advisory.js';
import { createGroqAdvisoryService } from '../src/services/groqAdvisory.js';

function createClient(content: string | null) {
  const create = vi.fn().mockResolvedValue({
    choices: [{ message: { content } }],
  });

  return {
    client: { chat: { completions: { create } } },
    create,
  };
}

const options = {
  apiKey: 'test-key',
  primaryModel: 'test-primary-model',
  fallbackModel: 'test-fallback-model',
  timeoutMilliseconds: 5000,
};

describe('Groq advisory provider', () => {
  it('returns a trimmed provider response', async () => {
    const { client, create } = createClient('  Check soil moisture before planting.  ');
    const service = createGroqAdvisoryService(options, client);
    const result = await service.generate({
      message: 'Should I plant maize?',
      language: 'en',
    });

    expect(result).toEqual({
      answer: 'Check soil moisture before planting.',
      source: 'groq',
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-primary-model',
        reasoning_effort: 'low',
        include_reasoning: false,
        max_completion_tokens: 300,
      }),
      expect.any(Object),
    );
  });

  it('uses the fallback after an empty primary response', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Fallback advice.' } }] });
    const client = { chat: { completions: { create } } };
    const service = createGroqAdvisoryService(options, client);

    await expect(service.generate({ message: 'Help', language: 'en' })).resolves.toEqual({
      answer: 'Fallback advice.',
      source: 'groq',
    });
    expect(create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ model: 'test-fallback-model' }),
      expect.any(Object),
    );
  });

  it('uses the fallback after a transient provider failure', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Unavailable'), { status: 503 }))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Fallback advice.' } }] });
    const client = { chat: { completions: { create } } };
    const service = createGroqAdvisoryService(options, client);

    await expect(service.generate({ message: 'Help', language: 'en' })).resolves.toEqual({
      answer: 'Fallback advice.',
      source: 'groq',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('does not use the fallback for authentication or request errors', async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const client = { chat: { completions: { create } } };
    const service = createGroqAdvisoryService(options, client);

    await expect(service.generate({ message: 'Help', language: 'en' }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
    expect(create).toHaveBeenCalledOnce();
  });

  it('does not start fallback after the request is cancelled', async () => {
    const controller = new AbortController();
    const create = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new DOMException('Cancelled', 'AbortError');
    });
    const service = createGroqAdvisoryService(options, { chat: { completions: { create } } });

    await expect(service.generate({ message: 'Help', language: 'en', signal: controller.signal }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
    expect(create).toHaveBeenCalledOnce();
  });

  it('does not use fallback for a provider validation failure', async () => {
    const create = vi.fn().mockRejectedValue(Object.assign(new Error('Invalid request'), { status: 422 }));
    const service = createGroqAdvisoryService(options, { chat: { completions: { create } } });

    await expect(service.generate({ message: 'Help', language: 'en' }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
    expect(create).toHaveBeenCalledOnce();
  });

  it('converts failure of both models into an unavailable error', async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Primary details'), {
        status: 503,
        error: { error: { code: 'service_unavailable', type: 'server_error' } },
      }))
      .mockRejectedValueOnce(Object.assign(new Error('Fallback details'), {
        status: 429,
        error: { error: { code: 'rate_limit_exceeded', type: 'rate_limit_error' } },
      }));
    const client = { chat: { completions: { create } } };
    const reportDiagnostic = vi.fn();
    const service = createGroqAdvisoryService({ ...options, reportDiagnostic }, client);

    await expect(service.generate({ message: 'Help', language: 'en' }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
    expect(create).toHaveBeenCalledTimes(2);
    expect(reportDiagnostic).toHaveBeenNthCalledWith(1, expect.objectContaining({
      selectedModel: 'test-primary-model',
      callNumber: 1,
      outcome: 'failure',
      providerStatus: 503,
      providerErrorCode: 'service_unavailable',
      providerErrorType: 'server_error',
      fallbackAttempted: true,
    }));
    expect(reportDiagnostic).toHaveBeenNthCalledWith(2, expect.objectContaining({
      selectedModel: 'test-fallback-model',
      callNumber: 2,
      outcome: 'failure',
      providerStatus: 429,
      providerErrorCode: 'rate_limit_exceeded',
      providerErrorType: 'rate_limit_error',
      fallbackAttempted: true,
    }));
    expect(JSON.stringify(reportDiagnostic.mock.calls)).not.toContain('details');
  });
});
