import { describe, expect, it, vi } from 'vitest';
import {
  LASTFM_API_BASE,
  LastfmError,
  fetchLastfmTaste,
  isLastfmUsername,
  lastfmProfileUrl,
} from './lastfm';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fakeLastfm(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (input: string) => {
    const url = new URL(input);
    const method = url.searchParams.get('method') ?? '';
    if (method in overrides) {
      const value = overrides[method];
      return value instanceof Response ? value : jsonResponse(value);
    }
    switch (method) {
      case 'user.gettopartists':
        return jsonResponse({
          topartists: {
            artist: [
              { name: 'Asake', playcount: '312' },
              { name: '  Burna   Boy ', playcount: '280' },
              { playcount: '5' },
            ],
          },
        });
      case 'user.gettoptracks':
        return jsonResponse({
          toptracks: {
            track: [
              {
                name: 'Lonely At The Top',
                playcount: '40',
                artist: { name: 'Asake' },
              },
              { name: 'No artist', playcount: '3' },
            ],
          },
        });
      case 'user.getrecenttracks':
        return jsonResponse({
          recenttracks: {
            track: [
              {
                name: 'Last Last',
                artist: { '#text': 'Burna Boy', mbid: '' },
                '@attr': { nowplaying: 'true' },
              },
              { name: 'Essence', artist: { '#text': 'Wizkid' } },
            ],
          },
        });
      default:
        return jsonResponse({ error: 3, message: 'Invalid Method' }, 400);
    }
  });
}

describe('Last.fm taste', () => {
  it('validates handles the way Last.fm does', () => {
    expect(isLastfmUsername('ada')).toBe(true);
    expect(isLastfmUsername('ada_lovelace-99')).toBe(true);
    expect(isLastfmUsername('9ada')).toBe(false);
    expect(isLastfmUsername('a')).toBe(false);
    expect(isLastfmUsername('ada lovelace')).toBe(false);
    expect(isLastfmUsername('x'.repeat(16))).toBe(false);
    expect(lastfmProfileUrl('ada')).toBe('https://www.last.fm/user/ada');
  });

  it('builds a snapshot from the three calls with the key kept server-side', async () => {
    const fetchImpl = fakeLastfm();
    const snapshot = await fetchLastfmTaste('ada', {
      fetchImpl,
      apiKey: 'secret-key',
      now: new Date('2024-03-01T00:00:00Z'),
    });
    expect(snapshot).toEqual({
      source: 'lastfm',
      label: 'Last.fm: ada',
      sourceUrl: 'https://www.last.fm/user/ada',
      topArtists: [
        { name: 'Asake', plays: 312 },
        { name: 'Burna Boy', plays: 280 },
      ],
      topTracks: [{ title: 'Lonely At The Top', artist: 'Asake', plays: 40 }],
      recentTracks: [
        { title: 'Last Last', artist: 'Burna Boy' },
        { title: 'Essence', artist: 'Wizkid' },
      ],
      capturedAt: '2024-03-01T00:00:00.000Z',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const [url] of fetchImpl.mock.calls) {
      expect(url.startsWith(LASTFM_API_BASE)).toBe(true);
      expect(url).toContain('api_key=secret-key');
      expect(url).toContain('format=json');
    }
    expect(JSON.stringify(snapshot)).not.toContain('secret-key');
  });

  it('maps Last.fm errors onto codes and stops after the first call for an unknown user', async () => {
    const notFound = fakeLastfm({
      'user.gettopartists': jsonResponse(
        { error: 6, message: 'User not found' },
        404,
      ),
    });
    await expect(
      fetchLastfmTaste('nobody', { fetchImpl: notFound, apiKey: 'k' }),
    ).rejects.toMatchObject({ code: 'LASTFM_USER_NOT_FOUND' });
    expect(notFound).toHaveBeenCalledTimes(1);

    const privateRecent = fakeLastfm({
      'user.getrecenttracks': jsonResponse({
        error: 17,
        message: 'Login: User required to be logged in',
      }),
    });
    const partial = await fetchLastfmTaste('ada', {
      fetchImpl: privateRecent,
      apiKey: 'k',
    });
    expect(partial.topArtists).toHaveLength(2);
    expect(partial.recentTracks).toEqual([]);

    const down = fakeLastfm({
      'user.gettopartists': new Response('<html>503</html>', { status: 503 }),
    });
    await expect(
      fetchLastfmTaste('ada', { fetchImpl: down, apiKey: 'k' }),
    ).rejects.toMatchObject({ code: 'LASTFM_UNAVAILABLE' });

    const network = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      fetchLastfmTaste('ada', { fetchImpl: network, apiKey: 'k' }),
    ).rejects.toBeInstanceOf(LastfmError);
  });

  it('refuses without a key or with a handle Last.fm would never accept, before any call', async () => {
    const fetchImpl = fakeLastfm();
    await expect(
      fetchLastfmTaste('ada', { fetchImpl, apiKey: '' }),
    ).rejects.toMatchObject({ code: 'LASTFM_NOT_CONFIGURED' });
    await expect(
      fetchLastfmTaste('not a handle', { fetchImpl, apiKey: 'k' }),
    ).rejects.toMatchObject({ code: 'LASTFM_USER_NOT_FOUND' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
