import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  search: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: () => mocks.getSession(),
}));

vi.mock('@/lib/spotify-service', () => ({
  spotifyService: {
    search: (...args: unknown[]) => mocks.search(...args),
  },
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
}));

import { POST } from './route';
import { SpotifyReconnectError } from '@/lib/spotify-tokens';

function post(body: unknown) {
  return new Request('http://localhost/api/playlists/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      Host: 'localhost',
    },
    body: JSON.stringify(body),
  });
}

function spotifyTrack(name: string, artist: string, id: string) {
  return {
    id,
    uri: `spotify:track:${id}`,
    name,
    artists: [{ name: artist }],
    album: { images: [{ url: `https://i.scdn.co/${id}` }] },
    duration_ms: 201_000,
  };
}

const tracks = [
  { id: 'a', title: 'Essence', artist: 'Wizkid' },
  { id: 'b', title: 'Made Up Song Title', artist: 'Nobody Real' },
];

describe('POST /api/playlists/resolve', () => {
  beforeEach(() => {
    mocks.getSession.mockReset().mockResolvedValue({ userId: 'user-1' });
    mocks.search.mockReset();
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('requires a signed-in tester session', async () => {
    mocks.getSession.mockResolvedValue(null);
    const response = await POST(post({ tracks }));
    expect(response.status).toBe(401);
    expect(mocks.search).not.toHaveBeenCalled();
  });

  it('rate limits per user and validates the body', async () => {
    const limited = await POST(post({ tracks: [] }));
    expect(limited.status).toBe(400);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        scope: 'playlists:resolve',
        limit: 10,
        identifier: 'user:user-1',
      }),
    );
  });

  it('resolves only real matches and reports the rest as unresolved', async () => {
    mocks.search.mockImplementation(async (_user: string, query: string) => {
      if (query.includes('Essence')) {
        return {
          tracks: {
            items: [
              spotifyTrack('Essence (feat. Tems)', 'Wizkid', 'ess1'),
              spotifyTrack('Essence', 'Someone Else', 'ess2'),
            ],
          },
        };
      }
      return {
        tracks: {
          items: [spotifyTrack('A Different Song', 'Nobody Real', 'x1')],
        },
      };
    });

    const response = await POST(post({ tracks }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resolved).toEqual([
      expect.objectContaining({
        id: 'a',
        uri: 'spotify:track:ess1',
        spotifyId: 'ess1',
        artist: 'Wizkid',
        albumArtUrl: 'https://i.scdn.co/ess1',
        durationMs: 201_000,
      }),
    ]);
    expect(body.unresolved).toEqual(['b']);
  });

  it('keeps going when a single search fails, but surfaces a reconnect', async () => {
    mocks.search.mockImplementation(async (_user: string, query: string) => {
      if (query.includes('Essence')) throw new Error('Spotify 500');
      return {
        tracks: {
          items: [spotifyTrack('Made Up Song Title', 'Nobody Real', 'm1')],
        },
      };
    });
    const partial = await POST(post({ tracks }));
    expect(partial.status).toBe(200);
    const body = await partial.json();
    expect(body.unresolved).toEqual(['a']);
    expect(body.resolved.map((item: { id: string }) => item.id)).toEqual(['b']);

    mocks.search.mockReset().mockRejectedValue(new SpotifyReconnectError());
    const reconnect = await POST(post({ tracks }));
    expect(reconnect.status).toBe(401);
    expect((await reconnect.json()).code).toBe('SPOTIFY_RECONNECT_REQUIRED');
  });

  it('accepts a full 40-song list and rejects one song more', async () => {
    mocks.search.mockImplementation(async () => ({
      tracks: {
        items: [spotifyTrack('A Real Song', 'A Real Artist', 'ok1')],
      },
    }));

    const makeList = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `t${index}`,
        title: 'A Real Song',
        artist: 'A Real Artist',
      }));

    const full = await POST(post({ tracks: makeList(40) }));
    expect(full.status).toBe(200);
    const fullBody = await full.json();
    expect(fullBody.resolved).toHaveLength(40);

    const over = await POST(post({ tracks: makeList(41) }));
    expect(over.status).toBe(400);
    // Each of the 40 songs resolved on its first search query.
    expect(mocks.search).toHaveBeenCalledTimes(40);
  });
});
