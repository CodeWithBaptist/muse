import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  classifyChatError,
  isAiNotConnectedMessage,
} from '@/hooks/use-chat';
import {
  getContextualLoadingMessages,
  ThinkingIndicator,
} from './ThinkingIndicator';
import ChatPage from '@/app/(app)/chat/page';
import { setChatPreferences } from '@/lib/chat-preferences-store';

const auth = vi.hoisted(() => ({ authenticated: false, isLoading: false }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    authenticated: auth.authenticated,
    isLoading: auth.isLoading,
    logout: async () => ({ ok: true }),
  }),
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

/**
 * Assistant replies reveal word by word, so the reply text lives in a word
 * reveal container rather than a single text node.
 */
function hasRevealedText(text: string): boolean {
  return screen
    .getAllByTestId('word-reveal')
    .some((element) => (element.textContent ?? '').includes(text));
}

describe('Stage D Chat Quality', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.authenticated = false;
    auth.isLoading = false;
    window.localStorage.clear();
    setChatPreferences({ scope: 'nigeria', language: 'english' });
  });

  it('provides contextual loading messages and renders the equalizer thinking indicator', () => {
    expect(getContextualLoadingMessages('Build me a playlist for a road trip')[0]).toBe(
      'Shaping your playlist concept'
    );
    expect(getContextualLoadingMessages('Songs like Brent Faiyaz')[0]).toBe(
      'Mapping artist sonic textures'
    );
    expect(getContextualLoadingMessages('Why is 90s hip hop so influential?')[0]).toBe(
      'Reading your question'
    );

    render(<ThinkingIndicator stage="Searching Spotify catalog" />);
    expect(screen.getByText('Searching Spotify catalog')).toBeDefined();
  });

  it('detects AI configuration errors without misclassifying unrelated failures', () => {
    expect(
      isAiNotConnectedMessage({
        code: 'AI_NOT_CONNECTED',
        message: 'The AI provider is unavailable.',
      }),
    ).toBe(true);
    expect(
      isAiNotConnectedMessage({
        message: 'Set OPENAI_API_KEY to enable chat.',
      }),
    ).toBe(true);
    expect(isAiNotConnectedMessage(new Error('Network request failed'))).toBe(
      false,
    );
    expect(isAiNotConnectedMessage(null)).toBe(false);
  });

  it('classifies all distinct chat error kinds accurately', () => {
    expect(
      classifyChatError({ code: 'AI_NOT_CONNECTED', message: 'AI is not connected yet' })
    ).toBe('ai_not_connected');
    expect(
      classifyChatError({ code: 'SPOTIFY_DISCONNECTED', status: 401, message: 'Unauthorized' })
    ).toBe('spotify_disconnected');
    expect(
      classifyChatError({ code: 'SPOTIFY_ERROR', status: 502, message: 'Spotify API error' })
    ).toBe('spotify_error');
    expect(
      classifyChatError({ code: 'RATE_LIMITED', status: 429, message: 'Too many requests' })
    ).toBe('rate_limited');
    expect(
      classifyChatError({ code: 'OFFLINE', message: 'Failed to fetch' })
    ).toBe('offline');
    expect(
      classifyChatError({ code: 'AI_ERROR', status: 500, message: 'Internal failure' })
    ).toBe('ai_error');
  });

  it('streams SSE replies into ChatPage and displays no-results state when 0 tracks match', async () => {
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'status', stage: 'Searching Spotify catalog' })}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'delta', delta: 'I searched across ' })}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'delta', delta: 'the catalog.' })}\n\n`
          )
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              conversationId: 'conv-101',
              role: 'assistant',
              content: 'I searched across the catalog.',
              tracks: [],
              noResults: true,
            })}\n\n`
          )
        );
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(
          JSON.stringify({
            connected: true,
            code: 'AI_CONNECTED',
            message: 'AI is connected',
          }),
          { status: 200 }
        );
      }
      if (url === '/api/chat' && init?.method === 'POST') {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'status', stage: 'Searching Spotify catalog' })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', delta: 'I searched across ' })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'delta', delta: 'the catalog.' })}\n\n`
              )
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  conversationId: 'conv-101',
                  role: 'assistant',
                  content: 'I searched across the catalog.',
                  tracks: [],
                  noResults: true,
                })}\n\n`
              )
            );
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }
      return new Response('[]', { status: 200 });
    });

    renderWithQueryClient(<ChatPage />);

    fireEvent.click(screen.getByText('Lagos traffic'));

    await waitFor(() => {
      expect(hasRevealedText('I searched across the catalog.')).toBe(true);
    });
    expect(screen.getByTestId('chat-no-results-state')).toBeDefined();
    expect(screen.getByText('No matching tracks found')).toBeDefined();
  });

  it('loads and switches conversation history on ChatPage', async () => {
    auth.authenticated = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(
          JSON.stringify({
            connected: true,
            code: 'AI_CONNECTED',
            message: 'AI is connected',
          }),
          { status: 200 }
        );
      }
      if (url === '/api/chat') {
        return new Response(
          JSON.stringify([
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'Lagos Midnight Grooves',
              createdAt: new Date().toISOString(),
            },
          ]),
          { status: 200 }
        );
      }
      if (url.includes('/api/chat/11111111-1111-4111-8111-111111111111')) {
        return new Response(
          JSON.stringify({
            messages: [
              { role: 'user', content: 'Play some Lagos midnight grooves' },
              { role: 'assistant', content: 'Here is your saved midnight selection.' },
            ],
            recommendations: [],
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 200 });
    });

    renderWithQueryClient(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('History (1)')).toBeDefined();
    });

    fireEvent.click(screen.getByText('History (1)'));
    expect(screen.getByTestId('conversation-history-panel')).toBeDefined();
    expect(screen.getByText('Lagos Midnight Grooves')).toBeDefined();

    fireEvent.click(screen.getByText('Lagos Midnight Grooves'));

    await waitFor(() => {
      expect(hasRevealedText('Here is your saved midnight selection.')).toBe(
        true,
      );
    });
  });

  it('keeps the history disclosure target mounted and marks the conversation log', async () => {
    auth.authenticated = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(
          JSON.stringify({
            connected: true,
            code: 'AI_CONNECTED',
            message: 'AI is connected',
          }),
          { status: 200 },
        );
      }
      return new Response('[]', { status: 200 });
    });

    renderWithQueryClient(<ChatPage />);

    const historyButton = await screen.findByRole('button', {
      name: 'History (0)',
    });
    const historyPanel = screen.getByTestId('conversation-history-panel');
    expect(historyButton).toHaveAttribute(
      'aria-controls',
      'conversation-history-panel',
    );
    expect(historyButton).toHaveAttribute('aria-expanded', 'false');
    expect(historyPanel).toHaveProperty('hidden', true);

    const conversationLog = screen.getByRole('log', {
      name: 'Conversation messages',
    });
    expect(conversationLog).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(historyButton);
    expect(historyButton).toHaveAttribute('aria-expanded', 'true');
    expect(historyPanel).toHaveProperty('hidden', false);
  });

  it('renders distinct error banners for rate limited and Spotify disconnected states', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(
          JSON.stringify({
            connected: true,
            code: 'AI_CONNECTED',
            message: 'AI is connected',
          }),
          { status: 200 }
        );
      }
      if (url === '/api/chat') {
        return new Response(
          JSON.stringify({
            error: 'Spotify connection expired. Please reconnect your Spotify account.',
            code: 'SPOTIFY_DISCONNECTED',
          }),
          { status: 401 }
        );
      }
      return new Response('[]', { status: 200 });
    });

    renderWithQueryClient(<ChatPage />);

    fireEvent.click(screen.getByText('Owambe'));

    await waitFor(() => {
      expect(screen.getByTestId('chat-error-spotify_disconnected')).toBeDefined();
    });
    expect(screen.getByText('Spotify disconnected')).toBeDefined();
    expect(screen.getByText('Reconnect Spotify')).toBeDefined();
  });

  it('lets a guest get a list with region tags, keeps the chat on the device, and sends it back as context', async () => {
    const encoder = new TextEncoder();
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(JSON.stringify({ connected: true }), { status: 200 });
      }
      if (url === '/api/chat' && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)));
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'status', stage: 'Building your list' })}\n\n`),
            );
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  role: 'assistant',
                  content: 'Windows down for this one.',
                  playlistTitle: 'Third Mainland at 1am',
                  isPlaylistSuggestion: true,
                  recommendations: [
                    {
                      id: 'wizkid--essence',
                      title: 'Essence',
                      artist: 'Wizkid',
                      why: 'Slow heat.',
                      region: 'Nigeria',
                      verification: {
                        status: 'verified',
                        source: 'deezer',
                        id: '1',
                        url: 'https://www.deezer.com/track/1',
                      },
                    },
                    {
                      id: 'focalistic--ke-star',
                      title: 'Ke Star',
                      artist: 'Focalistic',
                      why: 'Log drums.',
                      region: 'Africa',
                      verification: { status: 'unverified', reason: 'title_not_found' },
                    },
                    { id: 'frank-ocean--nights', title: 'Nights', artist: 'Frank Ocean', why: 'The quiet stretch.', region: 'Global' },
                  ],
                  short: true,
                  dropped: 1,
                })}\n\n`,
              ),
            );
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    renderWithQueryClient(<ChatPage />);

    // No server history for guests, just a note about where the chat lives.
    expect(screen.getByTestId('chat-on-device-note').textContent).toContain('Saved on this device only');
    expect(screen.queryByRole('button', { name: /History \(/ })).toBeNull();

    fireEvent.click(screen.getByText('Lagos traffic'));

    await waitFor(() => {
      expect(screen.getByTestId('recommendation-list')).toBeDefined();
    });
    expect(hasRevealedText('Windows down for this one.')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Third Mainland at 1am' })).toBeDefined();
    const rows = screen.getAllByTestId('recommendation-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Essence');
    expect(rows[0].textContent).toContain('Wizkid');
    expect(rows[0].textContent).toContain('Slow heat.');
    expect(
      rows.map((row) => row.querySelector('[data-region]')?.getAttribute('data-region')),
    ).toEqual(['Nigeria', 'Africa', 'Global']);
    expect(screen.getByText(/3 songs, 1 verified, only the ones MUSE was sure about/)).toBeDefined();

    // Verified picks link to the catalogue entry; unverified picks stay, say why, and offer searches.
    const verified = rows[0].querySelector('[data-verification="verified"]');
    expect(verified?.textContent).toContain('Verified on Deezer');
    expect(verified?.getAttribute('href')).toBe('https://www.deezer.com/track/1');
    expect(verified?.getAttribute('rel')).toContain('noopener');
    expect(rows[1].querySelector('[data-verification="unverified"]')?.textContent).toContain('Unverified');
    const help = rows[1].querySelector('[data-testid="unverified-help"]');
    expect(help?.textContent).toContain('this title was not found there');
    const helpLinks = Array.from(help?.querySelectorAll('a') ?? []);
    expect(helpLinks.map((a) => a.textContent)).toEqual(['Audiomack', 'Boomplay', 'YouTube Music']);
    expect(helpLinks[0].getAttribute('href')).toBe('https://audiomack.com/search?q=Focalistic%20Ke%20Star');
    expect(rows[2].querySelector('[data-verification]')).toBeNull();
    expect(screen.getByText(/checked against Deezer and the Apple iTunes Search API/)).toBeDefined();
    expect(screen.getByText(/1 pick was left out because no catalogue lists the artist/)).toBeDefined();

    // The first request carries no history; nothing is sent that the guest did not type.
    expect(bodies[0]).toEqual({
      content: 'Lagos traffic',
      history: [],
      preferences: { scope: 'nigeria', language: 'english' },
    });

    // The exchange is kept on the device, without any streaming leftovers.
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem('muse.chat.local.v1') ?? '[]');
      expect(stored).toHaveLength(2);
    });
    const stored = JSON.parse(window.localStorage.getItem('muse.chat.local.v1') ?? '[]');
    expect(stored[0]).toEqual({ role: 'user', content: 'Lagos traffic' });
    expect(stored[1].recommendations).toHaveLength(3);
    expect(stored[1].isStreaming).toBeUndefined();

    // The next message sends the earlier turns back as context.
    const composer = screen.getByRole('textbox');
    fireEvent.change(composer, { target: { value: 'More like the first one' } });
    fireEvent.submit(composer.closest('form') as HTMLFormElement);
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies[1]).toEqual({
      content: 'More like the first one',
      history: [
        { role: 'user', content: 'Lagos traffic' },
        { role: 'assistant', content: 'Windows down for this one.' },
      ],
      preferences: { scope: 'nigeria', language: 'english' },
    });
  });

  it('offers the nine vibes and remembers the scope and language choices on the device', async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(JSON.stringify({ connected: true }), { status: 200 });
      }
      if (url === '/api/chat' && init?.method === 'POST') {
        bodies.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({ role: 'assistant', content: 'Oya.', intent: 'general_chat' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    renderWithQueryClient(<ChatPage />);

    const chips = screen.getAllByRole('button', { name: /./ }).filter((b) => b.hasAttribute('data-vibe-chip'));
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Detty December',
      'Lagos traffic',
      'Owambe',
      'Sunday rice and stew',
      'Late-night drive on the Third Mainland',
      'Campus read-and-cram',
      'Morning devotion',
      'Gym grind',
      'Heartbreak but make it danceable',
    ]);
    for (const chip of chips) expect(chip.className).toContain('min-h-11');

    const scope = screen.getByRole('group', { name: 'Music scope' });
    const language = screen.getByRole('group', { name: 'Language' });
    expect(scope.querySelector('[aria-pressed="true"]')?.textContent).toBe('Naija first');
    expect(language.querySelector('[aria-pressed="true"]')?.textContent).toBe('English');

    fireEvent.click(screen.getByRole('button', { name: 'Global' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pidgin' }));
    expect(scope.querySelector('[aria-pressed="true"]')?.textContent).toBe('Global');
    expect(language.querySelector('[aria-pressed="true"]')?.textContent).toBe('Pidgin');
    expect(JSON.parse(window.localStorage.getItem('muse.chat.prefs.v1') ?? '{}')).toEqual({
      scope: 'global',
      language: 'pidgin',
    });

    fireEvent.click(screen.getByText('Detty December'));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      content: 'Detty December',
      history: [],
      preferences: { scope: 'global', language: 'pidgin' },
    });
    await waitFor(() => expect(hasRevealedText('Oya.')).toBe(true));
  });

  it('restores a guest chat from the device on the next visit', async () => {
    window.localStorage.setItem(
      'muse.chat.local.v1',
      JSON.stringify([
        { role: 'user', content: 'Owambe energy' },
        { role: 'assistant', content: 'Aso ebi ready.' },
      ]),
    );
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(JSON.stringify({ connected: true }), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    renderWithQueryClient(<ChatPage />);

    await waitFor(() => {
      expect(hasRevealedText('Aso ebi ready.')).toBe(true);
    });
    expect(screen.getByText('Owambe energy')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /New chat/ }));
    await waitFor(() => {
      expect(window.localStorage.getItem('muse.chat.local.v1')).toBeNull();
    });
    expect(screen.getByText('What are we listening to?')).toBeDefined();
  });
});
