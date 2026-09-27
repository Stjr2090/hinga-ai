import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { registerChatRoute } from '../src/routes/chat.js';
import { createGroqAdvisoryService } from '../src/services/groqAdvisory.js';
import { createLocalizedAdvisoryService } from '../src/services/localizedAdvisory.js';
import { normalizeFinalAnswer } from '../src/services/normalizeFinalAnswer.js';
import type { TranslationProvider } from '../src/translation/types.js';

describe('final advisory formatting', () => {
  it.each([
    ['**Check moisture.**\n\n* Wait for rain.\n* Ask an extension worker.', 'Check moisture.\n\n- Wait for rain.\n- Ask an extension worker.'],
    ['```text\n**Check moisture.**\n```', 'Check moisture.'],
    ['{"answer":"**Check moisture.**"}', 'Check moisture.'],
    ['"{\\"answer\\":\\"**Check moisture.**\\"}"', 'Check moisture.'],
    ['"Use \\"mulch\\" carefully."', 'Use "mulch" carefully.'],
  ])('unwraps a recognized provider presentation shape', (input, expected) => {
    expect(normalizeFinalAnswer(input)).toBe(expected);
  });

  it.each([
    'Mix 2 * 3 handfuls only if a local expert confirms the rate.',
    'The field note says {soil: wet}.',
    '"Rain is possible."',
    '{"weather":"rain"}',
    '{"answer":"Keep \\q visible."}',
    'Check **the label before mixing.',
    '1. Check soil.\n2. Ask an extension worker.',
  ])('preserves ordinary content and unrecognized wrappers', (answer) => {
    expect(normalizeFinalAnswer(answer)).toBe(answer);
  });

  it('does not turn an empty presentation wrapper into an empty public answer', () => {
    expect(normalizeFinalAnswer('```text\n\n```')).toBe('```text\n\n```');
  });

  it('requests plain text from Groq and cleans its answer at the final English response boundary', async () => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '**Check soil.**\n\n* Wait for rain.' } }] });
    const service = createGroqAdvisoryService(
      { apiKey: 'synthetic-key', primaryModel: 'primary', fallbackModel: 'fallback', timeoutMilliseconds: 5000 },
      { chat: { completions: { create } } },
    );
    const app = Fastify();
    try {
      await registerChatRoute(app, service);
      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        payload: { language: 'en', message: 'Should I plant maize?' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().answer).toBe('Check soil.\n\n- Wait for rain.');
      expect(create).toHaveBeenCalledOnce();
      expect(create.mock.calls[0][0].messages[0].content).toContain('Use ordinary plain text');
    } finally {
      await app.close();
    }
  });

  it.each(['lg', 'nyn'] as const)('cleans outgoing Sunbird text after translation for %s', async (language) => {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content: '**Check soil.**' } }] });
    const groq = createGroqAdvisoryService(
      { apiKey: 'synthetic-key', primaryModel: 'primary', fallbackModel: 'fallback', timeoutMilliseconds: 5000 },
      { chat: { completions: { create } } },
    );
    const translate = vi.fn()
      .mockResolvedValueOnce({ translatedText: 'Should I plant maize?' })
      .mockResolvedValueOnce({ translatedText: '```text\n{"answer":"**Wait for reliable rain.**\\n\\n* Ask a local expert."}\n```' });
    const provider = { provider: 'sunbird', translate } as TranslationProvider;
    const app = Fastify();
    try {
      await registerChatRoute(app, createLocalizedAdvisoryService(groq, provider));
      const response = await app.inject({
        method: 'POST',
        url: '/api/chat',
        payload: { language, message: 'Synthetic farming question.' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().answer).toBe('Wait for reliable rain.\n\n- Ask a local expert.');
      expect(response.json().language).toBe(language);
      expect(translate).toHaveBeenCalledTimes(2);
      expect(translate.mock.calls[0][0]).toMatchObject({ sourceLanguage: language, targetLanguage: 'en' });
      expect(translate.mock.calls[1][0]).toMatchObject({ sourceLanguage: 'en', targetLanguage: language, text: '**Check soil.**' });
      expect(create).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });
});
