import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { AssistantServiceError, getAssistantResponse } from '../src/services/assistantService';

vi.mock('../src/services/assistantService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/assistantService')>();
  return {
    ...original,
    getAssistantResponse: vi.fn(),
  };
});

const mockedAssistant = vi.mocked(getAssistantResponse);

describe('App prompt flow', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('hinga-primary-language', 'en');
  });

  it('keeps the interface visible and renders a response after submission', async () => {
    mockedAssistant.mockResolvedValue({
      requestId: 'response-1',
      answer: 'Prepare a fine seedbed and confirm soil moisture before planting.',
      language: 'en',
      source: 'groq',
    });
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByPlaceholderText('Ask a farming question…'), 'How do I prepare my field?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('Prepare a fine seedbed and confirm soil moisture before planting.')).toBeVisible();
    expect(screen.getByText('How do I prepare my field?')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga Assistant' })).toBeVisible();
  });

  it('shows a retry error without replacing the application', async () => {
    mockedAssistant.mockRejectedValue(new AssistantServiceError('Service temporarily unavailable.', 'ADVISORY_UNAVAILABLE'));
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByPlaceholderText('Ask a farming question…'), 'When should I plant maize?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('Service temporarily unavailable.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga Assistant' })).toBeVisible();
  });
});
