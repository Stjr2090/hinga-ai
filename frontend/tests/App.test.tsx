import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/assistantService', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/assistantService')>();
  return { ...original, getAssistantResponse: vi.fn() };
});

async function loadFrontend() {
  vi.resetModules();
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
    expect(screen.getByRole('img', { name: 'HINGA' })).toBeVisible();
    await user.type(screen.getByPlaceholderText(/Ask a farming question/), 'How do I prepare my field?');
    await user.click(screen.getByRole('button', { name: 'Send question' }));

    const response = await screen.findByText('Prepare a fine seedbed and confirm soil moisture before planting.');
    expect(response).toBeVisible();
    const assistantMark = response.closest('.message-assistant')?.querySelector('.assistant-logo img');
    expect(assistantMark).toHaveAttribute('alt', '');
    expect(assistantMark).toHaveAttribute('aria-hidden', 'true');
    expect(assistantMark).toHaveAttribute('src', expect.stringContaining('hinga-logo.svg'));
    expect(screen.getByText('How do I prepare my field?')).toBeVisible();
    expect(screen.getByText('Your agricultural advisory assistant')).toBeVisible();
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
    expect(screen.getByText('Your agricultural advisory assistant')).toBeVisible();
  });

  it('translates the complete chat interface when Luganda is selected', async () => {
    localStorage.setItem('hinga-primary-language', 'lg');
    const { App } = await loadFrontend();

    render(<App />);

    expect(screen.getByText('Omuwabuzi wo ow’ebyobulimi')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga ekuyambe etya leero?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tandika emboozi empya' })).toBeVisible();
    expect(screen.getByPlaceholderText(/Buuza ekibuuzo/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Teekako ekifo/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sindika ekibuuzo' })).toBeVisible();
    expect(screen.queryByText('How can Hinga help today?')).not.toBeInTheDocument();
  });

  it('exposes English, Luganda, and Runyankore by default', async () => {
    localStorage.clear();
    const { App } = await loadFrontend();

    render(<App />);
    expect(screen.getByRole('img', { name: 'HINGA' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'English, Supported' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Luganda, Supported' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Runyankore, Supported' })).toBeVisible();
    expect(screen.queryByText(/Experimental Runyankore/)).not.toBeInTheDocument();
  });

  it('uses Runyankore interface copy and nyn for chat submission', async () => {
    localStorage.clear();
    const { App, mockedAssistant } = await loadFrontend();
    mockedAssistant.mockResolvedValue({ requestId: 'runyankore-response', answer: 'Eki ni ekyokugarukamu omu Runyankore.', language: 'nyn', source: 'groq' });
    const user = userEvent.setup();

    render(<App />);
    const runyankore = screen.getByRole('button', { name: 'Runyankore, Supported' });
    expect(runyankore).toBeVisible();
    await user.click(runyankore);

    expect(localStorage.getItem('hinga-primary-language')).toBe('nyn');
    expect(screen.getByText("Omuhwezi waawe omu by'obuhingi n'oburiisa")).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hinga neebaasa kuhwera eta eriizooba?' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Okugaaniira okusya' })).toBeVisible();
    expect(screen.getByRole('button', { name: "Oyongyereho omwanya gw'obwire bw'omwihanga" })).toBeVisible();
    expect(screen.queryByText('Your agricultural advisory assistant')).not.toBeInTheDocument();
    expect(screen.queryByText('How can Hinga help today?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New conversation' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Experimental Runyankore/)).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Buuza ekibuuzo/), 'How should I store maize?');
    await user.click(screen.getByRole('button', { name: 'Oheereze ekibuuzo' }));
    expect(mockedAssistant).toHaveBeenCalledWith('How should I store maize?', 'nyn', undefined);
    expect(await screen.findByText('Eki ni ekyokugarukamu omu Runyankore.')).toBeVisible();
  });

  it('restores a saved nyn preference normally', async () => {
    localStorage.setItem('hinga-primary-language', 'nyn');
    const { App } = await loadFrontend();

    render(<App />);

    expect(screen.getByRole('button', { name: 'Runyankore' })).toBeVisible();
    expect(screen.getByText("Omuhwezi waawe omu by'obuhingi n'oburiisa")).toBeVisible();
    expect(screen.getByRole('button', { name: 'Oheereze ekibuuzo' })).toBeVisible();
    expect(screen.queryByText('Your agricultural advisory assistant')).not.toBeInTheDocument();
    expect(localStorage.getItem('hinga-primary-language')).toBe('nyn');
  });

  it('corrects an unknown saved preference to en', async () => {
    localStorage.setItem('hinga-primary-language', 'unknown');
    const { App } = await loadFrontend();

    render(<App />);

    expect(screen.getByRole('button', { name: 'English' })).toBeVisible();
    expect(localStorage.getItem('hinga-primary-language')).toBe('en');
  });

});
