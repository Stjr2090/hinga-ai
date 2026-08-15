import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/assistantService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/assistantService')>();
  return { ...original, getAssistantResponse: vi.fn() };
});

async function loadFrontend(experimentalLanguages = '') {
  vi.resetModules();
  vi.stubEnv('VITE_ENABLED_EXPERIMENTAL_LANGUAGES', experimentalLanguages);
  const service = await import('../src/services/assistantService');
  const App = (await import('../src/App')).default;
  const mockedAssistant = vi.mocked(service.getAssistantResponse);
  mockedAssistant.mockReset();
  return { App, mockedAssistant, AssistantServiceError: service.AssistantServiceError };
}

describe('App prompt flow', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
    localStorage.setItem('hinga-primary-language', 'en');
  });

  it('keeps the interface visible and renders a response after submission', async () => {
    const { App, mockedAssistant } = await loadFrontend();
    mockedAssistant.mockResolvedValue({ requestId: 'response-1', answer: 'Prepare a fine seedbed and confirm soil moisture before planting.', language: 'en', source: 'groq' });
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByPlaceholderText(/Ask a farming question/), 'How do I prepare my field?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('Prepare a fine seedbed and confirm soil moisture before planting.')).toBeVisible();
    expect(screen.getByText('How do I prepare my field?')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga AI' })).toBeVisible();
  });

  it('shows a retry error without replacing the application', async () => {
    const { App, mockedAssistant, AssistantServiceError } = await loadFrontend();
    mockedAssistant.mockRejectedValue(new AssistantServiceError('Service temporarily unavailable.', 'ADVISORY_UNAVAILABLE'));
    const user = userEvent.setup();

    render(<App />);
    await user.type(screen.getByPlaceholderText(/Ask a farming question/), 'When should I plant maize?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('Service temporarily unavailable.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga AI' })).toBeVisible();
  });

  it('translates the complete chat interface when Luganda is selected', async () => {
    localStorage.setItem('hinga-primary-language', 'lg');
    const { App } = await loadFrontend();

    render(<App />);

    expect(screen.getByText(/Omuwabuzi/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga ekuyambe etya leero?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tandika emboozi empya' })).toBeVisible();
    expect(screen.getByPlaceholderText(/Buuza ekibuuzo/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Teekako ekifo/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sindika ekibuuzo' })).toBeVisible();
    expect(screen.queryByText('How can Hinga help today?')).not.toBeInTheDocument();
  });

  it('exposes only English and Luganda by default and cannot submit nyn', async () => {
    localStorage.clear();
    const { App, mockedAssistant } = await loadFrontend();
    mockedAssistant.mockResolvedValue({ requestId: 'english', answer: 'Advice.', language: 'en', source: 'groq' });
    const user = userEvent.setup();

    render(<App />);
    expect(screen.getByRole('button', { name: 'English, Supported' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Luganda, Supported' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Runyankore, Experimental' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English, Supported' }));
    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Runyankore, Experimental' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Ask a farming question/), 'How should I store maize?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(mockedAssistant).toHaveBeenCalledWith('How should I store maize?', 'en', undefined);
    expect(mockedAssistant.mock.calls.some((call) => call[1] === 'nyn')).toBe(false);
  });

  it('enables nyn with its experimental label, warning, and chat language', async () => {
    localStorage.clear();
    const { App, mockedAssistant } = await loadFrontend('nyn');
    mockedAssistant.mockResolvedValue({ requestId: 'runyankore-response', answer: 'Eki ni ekyokugarukamu omu Runyankore.', language: 'nyn', source: 'groq' });
    const user = userEvent.setup();

    render(<App />);
    const runyankore = screen.getByRole('button', { name: 'Runyankore, Experimental' });
    expect(runyankore).toBeVisible();
    await user.click(runyankore);

    expect(localStorage.getItem('hinga-primary-language')).toBe('nyn');
    expect(screen.getByText('Experimental Runyankore')).toBeVisible();
    await user.type(screen.getByPlaceholderText(/Ask a farming question/), 'How should I store maize?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(mockedAssistant).toHaveBeenCalledWith('How should I store maize?', 'nyn', undefined);
    expect(await screen.findByText('Eki ni ekyokugarukamu omu Runyankore.')).toBeVisible();
  });

  it('trims surrounding whitespace in the experimental allowlist', async () => {
    localStorage.clear();
    const { App } = await loadFrontend('  nyn  ');

    render(<App />);

    expect(screen.getByRole('button', { name: 'Runyankore, Experimental' })).toBeVisible();
  });

  it('restores a saved nyn preference only when enabled', async () => {
    localStorage.setItem('hinga-primary-language', 'nyn');
    const { App } = await loadFrontend('nyn');

    render(<App />);

    expect(screen.getByText('Experimental Runyankore')).toBeVisible();
    expect(screen.getByRole('button', { name: /Runyankore.*Experimental/ })).toBeVisible();
    expect(localStorage.getItem('hinga-primary-language')).toBe('nyn');
  });

  it('corrects a disabled saved nyn preference to en', async () => {
    localStorage.setItem('hinga-primary-language', 'nyn');
    const { App } = await loadFrontend();

    render(<App />);

    expect(screen.getByRole('button', { name: 'English' })).toBeVisible();
    expect(screen.queryByText('Experimental Runyankore')).not.toBeInTheDocument();
    expect(localStorage.getItem('hinga-primary-language')).toBe('en');
  });

  it('corrects an unknown saved preference to en', async () => {
    localStorage.setItem('hinga-primary-language', 'unknown');
    const { App } = await loadFrontend('nyn');

    render(<App />);

    expect(screen.getByRole('button', { name: 'English' })).toBeVisible();
    expect(localStorage.getItem('hinga-primary-language')).toBe('en');
  });

  it.each([
    ['unknown code', 'xyz'],
    ['production code', 'en'],
    ['duplicate code', 'nyn,nyn'],
    ['empty segment', 'nyn,'],
    ['mixed valid and invalid codes', 'nyn,xyz'],
    ['malformed input', 'nyn!'],
  ])('rejects %s in the experimental allowlist', async (_case, value) => {
    localStorage.clear();
    const { App } = await loadFrontend(value);

    render(<App />);

    expect(screen.getByRole('button', { name: 'English, Supported' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Luganda, Supported' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Runyankore, Experimental' })).not.toBeInTheDocument();
  });
});
