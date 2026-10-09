import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieJar: new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >(),
  deleted: [] as string[],
  status: { configured: true, missing: [] as string[] },
  enforceRateLimit: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mocks.cookieJar.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) =>
      mocks.cookieJar.set(name, { value, options }),
    delete: (name: string) => {
      mocks.deleted.push(name);
      mocks.cookieJar.delete(name);
    },
  })),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/spotify-config', () => ({
  getSpotifyLoginStatus: () => mocks.status,
}));

vi.mock('@/lib/spotify', () => ({
  generateCodeChallenge: (verifier: string) => `challenge(${verifier})`,
  generateSpotifyAuthUrl: (state: string, challenge: string) =>
    `https://accounts.spotify.com/authorize?state=${state}&code_challenge=${challenge}`,
}));

import { GET } from './route';

function request(path: string, accept = 'text/html'): Request {
  return new Request(`http://0.0.0.0:3000${path}`, { headers: { accept } });
}

describe('GET /api/auth/spotify', () => {
  beforeEach(() => {
    mocks.cookieJar.clear();
    mocks.deleted.length = 0;
    mocks.status = { configured: true, missing: [] };
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    // Testers only: the email allowlist makes the sign-in visible for these tests.
    process.env.SPOTIFY_TESTER_EMAILS = 'ada@example.com';
    delete process.env.TESTER_KEY;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('refuses to start when no tester access is configured', async () => {
    delete process.env.SPOTIFY_TESTER_EMAILS;
    const response = await GET(request('/api/auth/spotify?next=/settings'));
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/login?error=testers_only&next=%2Fsettings');
    expect(mocks.cookieJar.has('spotify_auth_state')).toBe(false);

    const json = await GET(request('/api/auth/spotify', 'application/json'));
    expect(json.status).toBe(403);
    expect((await json.json()).code).toBe('TESTERS_ONLY');
  });

  it('in key mode starts only with a valid tester pass cookie', async () => {
    delete process.env.SPOTIFY_TESTER_EMAILS;
    process.env.TESTER_KEY = 'a-long-enough-tester-key-123';
    const refused = await GET(request('/api/auth/spotify'));
    expect(refused.headers.get('Location')).toBe('/login?error=testers_only');

    const { signTesterPass } = await import('@/lib/testers');
    mocks.cookieJar.set('muse_tester', { value: signTesterPass()!, options: {} });
    const started = await GET(request('/api/auth/spotify'));
    expect(started.status).toBe(307);
    expect(started.headers.get('Location')).toContain('accounts.spotify.com/authorize');
  });

  it('starts the PKCE handshake and sends the browser to Spotify', async () => {
    const response = await GET(request('/api/auth/spotify'));

    const state = mocks.cookieJar.get('spotify_auth_state');
    const verifier = mocks.cookieJar.get('spotify_code_verifier');
    expect(state?.value).toHaveLength(16);
    expect(verifier?.value).toHaveLength(64);
    for (const cookie of [state, verifier]) {
      expect(cookie?.options).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      });
    }

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('Location') ?? '');
    expect(location.origin).toBe('https://accounts.spotify.com');
    expect(location.searchParams.get('state')).toBe(state?.value);
    expect(location.searchParams.get('code_challenge')).toBe(
      `challenge(${verifier?.value})`,
    );
  });

  it('remembers a valid return path and forgets any previous one otherwise', async () => {
    await GET(request('/api/auth/spotify?next=%2Fsettings'));
    expect(mocks.cookieJar.get('spotify_auth_next')?.value).toBe('/settings');

    await GET(request('/api/auth/spotify?next=https%3A%2F%2Fevil.example'));
    expect(mocks.cookieJar.get('spotify_auth_next')).toBeUndefined();
    expect(mocks.deleted).toContain('spotify_auth_next');
  });

  it('explains on the login page when sign-in is not configured', async () => {
    mocks.status = { configured: false, missing: ['SPOTIFY_CLIENT_SECRET'] };
    const response = await GET(request('/api/auth/spotify?next=%2Flibrary'));

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      '/login?error=auth_not_configured&next=%2Flibrary',
    );
    expect(mocks.cookieJar.size).toBe(0);
  });

  it('keeps the machine readable 503 for non-browser callers', async () => {
    mocks.status = { configured: false, missing: ['SPOTIFY_CLIENT_ID'] };
    const response = await GET(
      request('/api/auth/spotify', 'application/json'),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Spotify login is not configured yet.',
    });
  });

  it('lets the rate limiter answer first', async () => {
    const limited = new Response('slow down', { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limited);
    const response = await GET(request('/api/auth/spotify'));
    expect(response).toBe(limited);
    expect(mocks.cookieJar.size).toBe(0);
  });
});
