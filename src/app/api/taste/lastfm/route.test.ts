import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  fetchImpl: vi.fn(),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
}));

import { POST } from './route';

function post(body: unknown) {
  return new Request('http://localhost/api/taste/lastfm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      Host: 'localhost',
    },
    body: JSON.stringify(body),
  });
}

function lastfmBody(method: string) {
  switch (method) {
    case 'user.gettopartists':
      return { topartists: { artist: [{ name: 'Asake', playcount: '312' }] } };
    case 'user.gettoptracks':
      return {
        toptracks: {
          track: [
            {
              name: 'Lonely At The Top',
              playcount: '40',
              artist: { name: 'Asake' },
            },
          ],
        },
      };
    default:
      return {
        recenttracks: {
          track: [{ name: 'Last Last', artist: { '#text': 'Burna Boy' } }],
        },
      };
  }
}

describe('POST /api/taste/lastfm', () => {
  beforeEach(() => {
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    mocks.fetchImpl.mockReset().mockImplementation(async (input: string) => {
      const method = new URL(input).searchParams.get('method') ?? '';
      return new Response(JSON.stringify(lastfmBody(method)), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', mocks.fetchImpl);
    process.env.LASTFM_API_KEY = 'server-only-key';
  });

  it('answers 503 with a code when no key is configured, before any call', async () => {
    delete process.env.LASTFM_API_KEY;
    const response = await POST(post({ username: 'ada' }));
    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe('LASTFM_NOT_CONFIGURED');
    expect(mocks.fetchImpl).not.toHaveBeenCalled();
  });

  it('returns the snapshot for a public profile and keeps the key out of it', async () => {
    const response = await POST(post({ username: 'ada' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.snapshot.source).toBe('lastfm');
    expect(body.snapshot.topArtists).toEqual([{ name: 'Asake', plays: 312 }]);
    expect(body.snapshot.sourceUrl).toBe('https://www.last.fm/user/ada');
    expect(JSON.stringify(body)).not.toContain('server-only-key');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ scope: 'taste:lastfm', limit: 10 }),
    );
  });

  it('maps an unknown user to 404 and a bad body to 400', async () => {
    mocks.fetchImpl.mockResolvedValue(
      new Response(JSON.stringify({ error: 6, message: 'User not found' }), {
        status: 404,
      }),
    );
    const missing = await POST(post({ username: 'nobodyhere' }));
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('LASTFM_USER_NOT_FOUND');

    const bad = await POST(post({ user: 'ada' }));
    expect(bad.status).toBe(400);
  });
});
