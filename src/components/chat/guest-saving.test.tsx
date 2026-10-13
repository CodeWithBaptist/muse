import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatPage from '@/app/(app)/chat/page';
import { clearGuestMessages } from '@/lib/guest-chat-store';
import {
  clearSavedLists,
  SAVED_LIST_NOTE,
  SAVED_LIST_STORAGE_KEY,
} from '@/lib/guest-saved-store';

/**
 * The guest path through the real chat page: a list arrives, it is kept in
 * this browser without a second tap, and the panel that holds it offers copy,
 * downloads, share, open-in links, delete, and clear all.
 */

const auth = vi.hoisted(() => ({ authenticated: false, isLoading: false }));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: null,
    authenticated: auth.authenticated,
    isLoading: auth.isLoading,
    logout: async () => ({ ok: true }),
  }),
}));

const TRACKS = [
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
    id: 'tems--free-mind',
    title: 'Free Mind',
    artist: 'Tems',
    why: 'A calm stretch.',
    region: 'Nigeria',
  },
];

const TITLE = 'Third Mainland at 1am';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function mockChat() {
  const encoder = new TextEncoder();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/api/ai/status')) {
      return new Response(JSON.stringify({ connected: true }), { status: 200 });
    }
    if (url.includes('/api/chat')) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'status', stage: 'Building your list' })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                role: 'assistant',
                content: 'Windows down for these ones.',
                playlistTitle: TITLE,
                recommendations: TRACKS,
              })}\n\n`,
            ),
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
}

describe('guest saving on this device', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    auth.authenticated = false;
    auth.isLoading = false;
    window.localStorage.clear();
    clearGuestMessages();
    clearSavedLists();
  });

  it('keeps the list the moment it arrives and shows it in the chat panel', async () => {
    mockChat();
    renderWithQueryClient(<ChatPage />);

    fireEvent.click(screen.getByText('Lagos traffic'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: TITLE })).toBeDefined();
    });

    // Kept without a second tap, in this browser only.
    const stored = window.localStorage.getItem(SAVED_LIST_STORAGE_KEY);
    expect(stored).toContain('wizkid--essence');
    expect(window.localStorage.getItem('muse.chat.local.v1')).toContain(
      'Windows down for these ones.',
    );

    const button = screen.getByTestId('saved-on-device-button');
    expect(button.textContent).toContain('Saved on this device (1)');
    const panel = screen.getByTestId('saved-on-device-panel');
    expect(panel).toHaveProperty('hidden', true);

    fireEvent.click(button);
    expect(panel).toHaveProperty('hidden', false);
    expect(within(panel).getByTestId('saved-on-device-note').textContent).toBe(
      SAVED_LIST_NOTE,
    );

    const item = within(panel).getByTestId('saved-list-item');
    expect(item.textContent).toContain(TITLE);
    expect(item.textContent).toContain('2 songs');
    for (const name of ['Copy list', 'Download as text', 'Download as CSV']) {
      expect(within(item).getByRole('button', { name })).toBeDefined();
    }
    // jsdom exposes no share sheet, so the WhatsApp fallback stands in.
    expect(within(item).getByTestId('share-whatsapp')).toBeDefined();
  });

  it('copies the saved list, and deletes one list or all of them', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    mockChat();
    renderWithQueryClient(<ChatPage />);

    fireEvent.click(screen.getByText('Lagos traffic'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: TITLE })).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('saved-on-device-button'));
    const panel = screen.getByTestId('saved-on-device-panel');
    const item = within(panel).getByTestId('saved-list-item');

    fireEvent.click(within(item).getByRole('button', { name: 'Copy list' }));
    await waitFor(() => {
      expect(within(item).getByText('List copied.')).toBeDefined();
    });
    expect(writeText.mock.calls[0][0]).toContain('1. Essence by Wizkid');
    expect(writeText.mock.calls[0][0]).toContain('2. Free Mind by Tems');

    fireEvent.click(
      within(item).getByRole('button', { name: `Delete ${TITLE}` }),
    );
    expect(within(panel).queryByTestId('saved-list-item')).toBeNull();
    expect(window.localStorage.getItem(SAVED_LIST_STORAGE_KEY)).toBeNull();

    // The conversation itself is untouched by deleting the saved list.
    expect(screen.getByText('Windows down for these ones.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('shows the open-in links on a saved list', async () => {
    mockChat();
    renderWithQueryClient(<ChatPage />);
    fireEvent.click(screen.getByText('Lagos traffic'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: TITLE })).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('saved-on-device-button'));
    const item = within(
      screen.getByTestId('saved-on-device-panel'),
    ).getByTestId('saved-list-item');

    fireEvent.click(
      within(item).getByRole('button', { name: 'Songs and open-in links' }),
    );
    for (const service of ['audiomack', 'boomplay']) {
      expect(item.querySelector(`a[data-open-in="${service}"]`)).not.toBeNull();
    }
    fireEvent.click(within(item).getAllByRole('button', { name: 'More' })[0]);
    for (const service of [
      'youtube-music',
      'apple-music',
      'deezer',
      'spotify',
    ]) {
      expect(item.querySelector(`a[data-open-in="${service}"]`)).not.toBeNull();
    }
  });

  it('draws neither the tester history control nor a guest control while the session is unknown', () => {
    // The server renders this state, so a guest never sees a History button
    // that would do nothing before the session answers.
    mockChat();
    auth.isLoading = true;
    renderWithQueryClient(<ChatPage />);
    expect(screen.queryByRole('button', { name: /History \(/ })).toBeNull();
    expect(screen.queryByTestId('chat-on-device-note')).toBeNull();
    expect(screen.queryByTestId('saved-on-device-button')).toBeNull();
    auth.isLoading = false;
  });

  it('offers the feedback link in the chat menu without a tracker', () => {
    mockChat();
    renderWithQueryClient(<ChatPage />);
    const link = screen.getByTestId('send-feedback');
    expect(link.getAttribute('href')).toBe(
      'mailto:barowomutin@gmail.com?subject=MUSE%20feedback',
    );
  });
});
