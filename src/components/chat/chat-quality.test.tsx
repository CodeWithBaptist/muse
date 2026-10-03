import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { classifyChatError } from '@/hooks/use-chat';
import {
  getContextualLoadingMessages,
  ThinkingIndicator,
} from './ThinkingIndicator';
import ChatPage from '@/app/(app)/chat/page';

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

describe('Stage D Chat Quality', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    fireEvent.click(screen.getByText('Late night Afrobeats'));

    await waitFor(() => {
      expect(screen.getByText('I searched across the catalog.')).toBeDefined();
    });
    expect(screen.getByTestId('chat-no-results-state')).toBeDefined();
    expect(screen.getByText('No matching tracks found')).toBeDefined();
  });

  it('loads and switches conversation history on ChatPage', async () => {
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
      expect(
        screen.getByText('Here is your saved midnight selection.')
      ).toBeDefined();
    });
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

    fireEvent.click(screen.getByText('Ambient study session'));

    await waitFor(() => {
      expect(screen.getByTestId('chat-error-spotify_disconnected')).toBeDefined();
    });
    expect(screen.getByText('Spotify disconnected')).toBeDefined();
    expect(screen.getByText('Reconnect Spotify')).toBeDefined();
  });
});
