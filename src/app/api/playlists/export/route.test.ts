// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';

/**
 * The Spotify calls behind "Create in Spotify".
 *
 * Spotify's February 2026 Web API changes removed `POST /users/{id}/playlists`
 * and `POST /playlists/{id}/tracks`. Both were still being called here, which
 * means the export path was asking for endpoints that no longer exist. These
 * tests pin the replacements and, just as importantly, pin how a refusal is
 * reported: a broken call must say so instead of retrying every track and then
 * listing all of them as rejected.
 *
 * The database is real, the Spotify API is not. Everything under
 * api.spotify.com is intercepted, so no test here can pass by accident against
 * the live service or fail because of it.
 */

const state = vi.hoisted(() => ({
  db: undefined as never,
  sessionId: 'export-session-id',
  calls: [] as { url: string; method: string; body: unknown }[],
  respond: undefined as ((url: string) => Response) | undefined,
}));

vi.mock('@/db', () => ({
  get db() {
    return state.db;
  },
  pool: {},
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'muse_session' ? { value: state.sessionId } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

// Only the token lookup is replaced. The reconnect error class stays real, so
// the route still takes its existing reconnect path on a 401.
vi.mock('@/lib/spotify-tokens', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/spotify-tokens')>();
  return {
    ...actual,
    getValidAccessToken: vi.fn().mockResolvedValue('fake-access-token'),
  };
});

import { createTestDatabase, seedUser, type TestDatabaseHandle } from '@/test/database';
import { sessions } from '@/db/schema';
import { POST as exportPlaylist } from '@/app/api/playlists/export/route';

const TRACK_A = 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh';
const TRACK_B = 'spotify:track:1301WleyT98MSxVHPZCA6M';
const SPOTIFY_PLAYLIST_ID = '3cEYpjA9oz9GiPac4AsH4n';

function spotifyJson(body: unknown, status = 201) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const CREATED_PLAYLIST = {
  id: SPOTIFY_PLAYLIST_ID,
  external_urls: {
    spotify: `https://open.spotify.com/playlist/${SPOTIFY_PLAYLIST_ID}`,
  },
};

/** Every Spotify call succeeds. */
function allowAll(url: string) {
  if (url.includes('/me/playlists')) return spotifyJson(CREATED_PLAYLIST);
  if (url.includes('/items')) return spotifyJson({ snapshot_id: 'abc' });
  return spotifyJson({}, 200);
}

let handle: TestDatabaseHandle;
let db: TestDatabaseHandle['db'];

beforeAll(async () => {
  handle = await createTestDatabase();
  db = handle.db;
  state.db = db as never;
}, 60_000);

beforeEach(async () => {
  await handle.client.exec(
    `TRUNCATE TABLE users, sessions, playlists, playlist_tracks, rate_limits
       RESTART IDENTITY CASCADE`
  );
  vi.clearAllMocks();

  state.calls = [];
  state.respond = allowAll;
  state.sessionId = 'export-session-id';

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (!url.startsWith('https://api.spotify.com')) {
        throw new Error(`Unexpected non-Spotify fetch in export test: ${url}`);
      }

      state.calls.push({
        url,
        method,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });

      return state.respond ? state.respond(url) : spotifyJson({}, 200);
    })
  );

  const user = await seedUser(db);
  await db.insert(sessions).values({
    id: state.sessionId,
    userId: user.id,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await handle.close();
});

function exportRequest(body?: Record<string, unknown>) {
  return new Request('http://localhost:3000/api/playlists/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Late night drive',
      trackUris: [TRACK_A, TRACK_B],
      ...body,
    }),
  });
}

function itemCalls() {
  return state.calls.filter((call) => call.url.includes('/items'));
}

describe('playlist export against the current Spotify API', () => {
  it('creates the playlist at POST /me/playlists', async () => {
    const response = await exportPlaylist(exportRequest());

    expect(response.status).toBe(200);

    const create = state.calls.find((call) => call.method === 'POST' && call.url.endsWith('/me/playlists'));
    expect(create).toBeDefined();
    expect(create?.body).toEqual({
      name: 'Late night drive',
      description: 'Created with MUSE',
      public: false,
    });
  });

  it('adds items at POST /playlists/{id}/items, not the removed /tracks', async () => {
    await exportPlaylist(exportRequest());

    expect(itemCalls()).toHaveLength(1);
    expect(itemCalls()[0].url).toBe(
      `https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/items`
    );
    expect(itemCalls()[0].body).toEqual({ uris: [TRACK_A, TRACK_B] });
  });

  it('never calls an endpoint Spotify removed', async () => {
    await exportPlaylist(exportRequest());

    const removed = state.calls.filter(
      (call) =>
        /\/playlists\/[^/]+\/tracks$/.test(call.url) ||
        /\/users\/[^/]+\/playlists$/.test(call.url)
    );

    expect(removed).toEqual([]);
  });

  it('reports both tracks added when Spotify accepts the batch', async () => {
    const response = await exportPlaylist(exportRequest());
    const body = (await response.json()) as {
      success: boolean;
      addedCount: number;
      failedTrackUris: string[];
      spotifyUrl: string;
    };

    expect(body.success).toBe(true);
    expect(body.addedCount).toBe(2);
    expect(body.failedTrackUris).toEqual([]);
    expect(body.spotifyUrl).toBe(
      `https://open.spotify.com/playlist/${SPOTIFY_PLAYLIST_ID}`
    );
  });

  it('says the endpoint is gone instead of blaming every track', async () => {
    state.respond = (url) =>
      url.includes('/me/playlists')
        ? spotifyJson(CREATED_PLAYLIST)
        : spotifyJson({ error: { message: 'Not found' } }, 404);

    const response = await exportPlaylist(exportRequest());
    const body = (await response.json()) as {
      error: string;
      code: string;
      spotifyStatus: number;
    };

    expect(response.status).toBe(502);
    expect(body.code).toBe('SPOTIFY_PLAYLIST_ITEMS_FAILED');
    expect(body.spotifyStatus).toBe(404);
    expect(body.error).toMatch(/no longer serves that playlist endpoint/i);

    // One attempt only. The old behaviour retried each track, which would have
    // been two more calls here and a report claiming both tracks were rejected.
    expect(itemCalls()).toHaveLength(1);
  });

  it('asks for a reconnect when Spotify rejects the token', async () => {
    state.respond = (url) =>
      url.includes('/me/playlists')
        ? spotifyJson(CREATED_PLAYLIST)
        : spotifyJson({ error: { message: 'Unauthorized' } }, 401);

    const response = await exportPlaylist(exportRequest());
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('SPOTIFY_RECONNECT_REQUIRED');
    expect(itemCalls()).toHaveLength(1);
  });

  it('names only the tracks Spotify actually refused', async () => {
    let itemCount = 0;
    state.respond = (url) => {
      if (url.includes('/me/playlists')) return spotifyJson(CREATED_PLAYLIST);
      if (!url.includes('/items')) return spotifyJson({}, 200);

      itemCount += 1;
      // The batch is refused, then the first track succeeds and the second does
      // not, which is what a genuinely unavailable track looks like.
      if (itemCount === 1) return spotifyJson({ error: { message: 'Bad' } }, 400);
      if (itemCount === 2) return spotifyJson({ snapshot_id: 'abc' });
      return spotifyJson({ error: { message: 'Bad' } }, 400);
    };

    const response = await exportPlaylist(exportRequest());
    const body = (await response.json()) as {
      addedCount: number;
      failedTrackUris: string[];
    };

    expect(response.status).toBe(200);
    expect(body.addedCount).toBe(1);
    expect(body.failedTrackUris).toEqual([TRACK_B]);
  });
});
