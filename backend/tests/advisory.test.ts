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
  model: 'test-model',
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
  });

  it('rejects an empty provider response', async () => {
    const { client } = createClient(null);
    const service = createGroqAdvisoryService(options, client);

    await expect(service.generate({ message: 'Help', language: 'en' }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
  });

  it('converts provider failures into an unavailable error', async () => {
    const create = vi.fn().mockRejectedValue(new Error('Provider details'));
    const client = { chat: { completions: { create } } };
    const service = createGroqAdvisoryService(options, client);

    await expect(service.generate({ message: 'Help', language: 'en' }))
      .rejects.toBeInstanceOf(AdvisoryUnavailableError);
  });
});
