import type { Page, Route } from '@playwright/test';

export const TEST_TRACKS = [
  {
    id: '3n3Ppam7vgaVa1iaRUc9Lp',
    uri: 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp',
    name: 'Cranes in the Sky',
    artists: [{ name: 'Solange' }],
    album: { name: 'A Seat at the Table', images: [] },
    duration_ms: 243_000,
    reason: 'Soft vocals and a spacious groove suit the late-night mood.',
  },
  {
    id: '4uLU6hMCjMI75M1A2tKUQC',
    uri: 'spotify:track:4uLU6hMCjMI75M1A2tKUQC',
    name: 'Stay Flo',
    artists: [{ name: 'Solange' }],
    album: { name: 'When I Get Home', images: [] },
    duration_ms: 176_000,
    reason: 'A steady rhythm keeps the set moving.',
  },
];

const DEFAULT_PREFERENCES = {
  discoveryStyle: 'balanced',
  playlistLength: '15',
  explicitContent: 'allow',
  favoriteGenres: 'neo-soul',
  playbackPreference: 'muse',
  updatedAt: null,
};

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111';

export interface ChatResponseMock {
  status?: number;
  body?: Record<string, unknown>;
  events?: Record<string, unknown>[];
}

export interface MockAppApiOptions {
  authenticated?: boolean;
  aiConnected?: boolean;
  spotifyConnected?: boolean;
  playbackAvailability?: 'ready' | 'reconnect-required' | 'disconnected' | 'unavailable';
  chatResponse?: ChatResponseMock;
  discoverStatus?: number;
  discoverResponse?: Record<string, unknown>;
  musePlaylists?: Record<string, unknown>[];
  spotifyPlaylists?: Record<string, unknown>[];
  playlistDraftStatus?: number;
  exportStatus?: number;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function eventStream(events: Record<string, unknown>[]) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
}

export async function mockAppApi(
  page: Page,
  options: MockAppApiOptions = {},
) {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    if (pathname === '/api/auth/spotify' && method === 'GET') {
      await route.fulfill({
        status: 302,
        headers: {
          location:
            'https://accounts.spotify.com/authorize?client_id=playwright-test&response_type=code',
        },
      });
      return;
    }

    if (pathname === '/api/me' && method === 'GET') {
      await route.fulfill(
        jsonResponse(
          options.authenticated === false
            ? { authenticated: false }
            : {
                authenticated: true,
                user: {
                  id: 'playwright-user',
                  displayName: 'MUSE Test User',
                  email: 'muse-test@example.invalid',
                  avatarUrl: null,
                },
              },
        ),
      );
      return;
    }

    if (pathname === '/api/auth/logout' && method === 'POST') {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    if (pathname === '/api/ai/status' && method === 'GET') {
      const connected = options.aiConnected ?? true;
      await route.fulfill(
        jsonResponse({
          connected,
          code: connected ? 'AI_CONNECTED' : 'AI_NOT_CONNECTED',
          message: connected ? 'AI is connected.' : 'AI is not connected yet.',
        }),
      );
      return;
    }

    if (pathname === '/api/me/spotify') {
      if (method === 'DELETE') {
        await route.fulfill(jsonResponse({ success: true }));
      } else {
        await route.fulfill(
          jsonResponse({ connected: options.spotifyConnected ?? true }),
        );
      }
      return;
    }

    if (pathname === '/api/playback/status' && method === 'GET') {
      await route.fulfill(
        jsonResponse({ availability: options.playbackAvailability ?? 'ready' }),
      );
      return;
    }

    if (pathname === '/api/playback/play' && method === 'POST') {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    if (pathname === '/api/playback/control' && method === 'POST') {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    if (pathname === '/api/preferences') {
      if (method === 'PUT') {
        let preferences = DEFAULT_PREFERENCES;
        try {
          preferences = {
            ...DEFAULT_PREFERENCES,
            ...request.postDataJSON(),
          };
        } catch {
          // Keep the deterministic default response for malformed test input.
        }
        await route.fulfill(jsonResponse(preferences));
      } else {
        await route.fulfill(jsonResponse(DEFAULT_PREFERENCES));
      }
      return;
    }

    if (pathname === '/api/chat') {
      if (method === 'GET') {
        await route.fulfill(jsonResponse([]));
        return;
      }
      if (method === 'DELETE') {
        await route.fulfill(jsonResponse({ success: true }));
        return;
      }
      if (method === 'POST') {
        const response = options.chatResponse;
        const status = response?.status ?? 200;
        if (status >= 400) {
          await route.fulfill(
            jsonResponse(
              response?.body ?? {
                error: 'MUSE could not complete that response.',
                code: 'AI_ERROR',
              },
              status,
            ),
          );
          return;
        }
        if (response?.events) {
          await route.fulfill({
            status,
            contentType: 'text/event-stream',
            headers: { 'cache-control': 'no-cache' },
            body: eventStream(response.events),
          });
          return;
        }
        await route.fulfill(
          jsonResponse(
            response?.body ?? {
              conversationId: CONVERSATION_ID,
              role: 'assistant',
              content: 'Here are a few tracks to try.',
              tracks: TEST_TRACKS,
            },
            status,
          ),
        );
        return;
      }
    }

    if (pathname.startsWith('/api/chat/')) {
      if (method === 'DELETE') {
        await route.fulfill(jsonResponse({ success: true }));
      } else {
        await route.fulfill(
          jsonResponse({ messages: [], recommendations: [] }),
        );
      }
      return;
    }

    if (pathname === '/api/discover' && method === 'GET') {
      const status = options.discoverStatus ?? 200;
      await route.fulfill(
        jsonResponse(
          options.discoverResponse ?? { sections: [] },
          status,
        ),
      );
      return;
    }

    if (pathname === '/api/playlists') {
      if (method === 'POST') {
        const status = options.playlistDraftStatus ?? 201;
        await route.fulfill(
          jsonResponse(
            status >= 400
              ? { error: 'Unable to save the playlist draft.' }
              : {
                  playlist: {
                    id: CONVERSATION_ID,
                    name: 'Playwright playlist',
                  },
                },
            status,
          ),
        );
      } else {
        await route.fulfill(
          jsonResponse({ playlists: options.musePlaylists ?? [] }),
        );
      }
      return;
    }

    if (pathname === '/api/playlists/export' && method === 'POST') {
      const status = options.exportStatus ?? 200;
      await route.fulfill(
        jsonResponse(
          status >= 400
            ? { error: 'Unable to create the Spotify playlist.' }
            : {
                success: true,
                spotifyUrl:
                  'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
              },
          status,
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/playlists/')) {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    if (pathname === '/api/music' && method === 'GET') {
      await route.fulfill(
        jsonResponse({ items: options.spotifyPlaylists ?? [] }),
      );
      return;
    }

    if (pathname === '/api/me/profile' && method === 'GET') {
      await route.fulfill(jsonResponse({ aiConnected: false }));
      return;
    }

    if (pathname === '/api/me/export' && method === 'GET') {
      await route.fulfill(jsonResponse({ exportedAt: '2026-01-01T00:00:00.000Z' }));
      return;
    }

    if (pathname === '/api/me/account' && method === 'DELETE') {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    if (pathname === '/api/memory') {
      await route.fulfill(
        jsonResponse(method === 'GET' ? { memories: [] } : { success: true }),
      );
      return;
    }

    if (pathname.startsWith('/api/memory/')) {
      await route.fulfill(jsonResponse({ success: true }));
      return;
    }

    await route.fulfill(
      jsonResponse(
        { error: `No E2E mock for ${method} ${pathname}` },
        404,
      ),
    );
  });
}
