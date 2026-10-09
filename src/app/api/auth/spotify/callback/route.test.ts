import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The callback is the one place a Spotify sign-in can go wrong in several
 * distinct ways. These tests pin each outcome to its error code, check that
 * the handshake cookies are always cleared, and that every redirect is
 * relative so it lands on the origin the visitor is actually using.
 */

const mocks = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  deleted: [] as string[],
  configured: true,
  exchangeCodeForTokens: vi.fn(),
  getSpotifyUserProfile: vi.fn(),
  createSession: vi.fn(),
  enforceRateLimit: vi.fn(),
  users: [] as Array<Record<string, unknown>>,
  accounts: [] as Array<Record<string, unknown>>,
  inserted: [] as Array<{ table: string; values: Record<string, unknown> }>,
  updated: [] as Array<{ table: string; values: Record<string, unknown> }>,
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      mocks.cookieJar.has(name)
        ? { name, value: mocks.cookieJar.get(name) }
        : undefined,
    set: (name: string, value: string) => mocks.cookieJar.set(name, value),
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
  isSpotifyLoginConfigured: () => mocks.configured,
}));

vi.mock('@/lib/spotify', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/spotify')>('@/lib/spotify');
  return {
    SpotifyAuthRequestError: actual.SpotifyAuthRequestError,
    exchangeCodeForTokens: mocks.exchangeCodeForTokens,
    getSpotifyUserProfile: mocks.getSpotifyUserProfile,
  };
});

vi.mock('@/lib/session', () => ({
  createSession: mocks.createSession,
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: (value: string) => `enc(${value})`,
}));

vi.mock('@/db/schema', () => ({
  users: { __table: 'users', id: 'users.id', spotifyId: 'users.spotifyId' },
  spotifyAccounts: {
    __table: 'spotifyAccounts',
    userId: 'spotifyAccounts.userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: (column: string, value: unknown) => ({ column, value }),
}));

vi.mock('@/db', () => {
  const rowsFor = (table: { __table: string }) =>
    table.__table === 'users' ? mocks.users : mocks.accounts;
  return {
    db: {
      select: () => ({
        from: (table: { __table: string }) => ({
          where: async () => rowsFor(table),
        }),
      }),
      insert: (table: { __table: string }) => ({
        values: (values: Record<string, unknown>) => {
          mocks.inserted.push({ table: table.__table, values });
          const row = { id: `${table.__table}-new`, ...values };
          rowsFor(table).push(row);
          const promise = Promise.resolve([row]);
          return Object.assign(promise, { returning: async () => [row] });
        },
      }),
      update: (table: { __table: string }) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            mocks.updated.push({ table: table.__table, values });
          },
        }),
      }),
    },
  };
});

import { GET } from './route';
import { SpotifyAuthRequestError } from '@/lib/spotify';

const CALLBACK = 'http://0.0.0.0:3000/api/auth/spotify/callback';

function request(query: Record<string, string>): Request {
  const url = new URL(CALLBACK);
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return new Request(url);
}

function armHandshake(next?: string) {
  mocks.cookieJar.set('spotify_auth_state', 'state-123');
  mocks.cookieJar.set('spotify_code_verifier', 'verifier-abc');
  if (next) mocks.cookieJar.set('spotify_auth_next', next);
}

const HANDSHAKE_COOKIES = [
  'spotify_auth_state',
  'spotify_code_verifier',
  'spotify_auth_next',
];

describe('GET /api/auth/spotify/callback', () => {
  beforeEach(() => {
    mocks.cookieJar.clear();
    mocks.deleted.length = 0;
    mocks.configured = true;
    mocks.users.length = 0;
    mocks.accounts.length = 0;
    mocks.inserted.length = 0;
    mocks.updated.length = 0;
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    mocks.createSession.mockReset().mockResolvedValue(undefined);
    mocks.exchangeCodeForTokens.mockReset().mockResolvedValue({
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'user-read-private',
      token_type: 'Bearer',
    });
    mocks.getSpotifyUserProfile.mockReset().mockResolvedValue({
      id: 'spotify-user',
      display_name: 'Ada',
      email: 'ada@example.com',
      images: [{ url: 'https://i.scdn.co/ada.jpg' }],
    });
    // Testers only: Ada is on the list for these tests.
    process.env.SPOTIFY_TESTER_EMAILS = 'ada@example.com';
    delete process.env.TESTER_KEY;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('reports testers_only when no tester access is configured, before any exchange', async () => {
    delete process.env.SPOTIFY_TESTER_EMAILS;
    armHandshake();
    const response = await GET(request({ code: 'auth-code', state: 'state-123' }));
    await expectLoginRedirect(response, 'testers_only');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('reports not_a_tester for a Spotify account that is not on the list, storing nothing', async () => {
    process.env.SPOTIFY_TESTER_EMAILS = 'tunde@lagos.ng';
    armHandshake();
    const response = await GET(request({ code: 'auth-code', state: 'state-123' }));
    await expectLoginRedirect(response, 'not_a_tester');
    expect(mocks.exchangeCodeForTokens).toHaveBeenCalledTimes(1);
    expect(mocks.users).toEqual([]);
    expect(mocks.accounts).toEqual([]);
  });

  async function expectLoginRedirect(
    response: Response,
    code: string,
    extra = '',
  ) {
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe(
      `/login?error=${code}${extra}`,
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocks.createSession).not.toHaveBeenCalled();
    expect(mocks.inserted).toEqual([]);
    for (const name of HANDSHAKE_COOKIES) expect(mocks.deleted).toContain(name);
  }

  it('signs the visitor in, stores the account, clears the handshake, and returns them', async () => {
    armHandshake('/settings');
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );

    expect(mocks.exchangeCodeForTokens).toHaveBeenCalledWith(
      'auth-code',
      'verifier-abc',
    );
    expect(mocks.getSpotifyUserProfile).toHaveBeenCalledWith('access');
    expect(mocks.inserted.map((entry) => entry.table)).toEqual([
      'users',
      'spotifyAccounts',
    ]);
    const account = mocks.inserted[1].values;
    expect(account.accessToken).toBe('enc(access)');
    expect(account.refreshToken).toBe('enc(refresh)');
    expect(account.scope).toBe('user-read-private');
    expect(mocks.createSession).toHaveBeenCalledWith('users-new');

    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/settings');
    for (const name of HANDSHAKE_COOKIES) expect(mocks.deleted).toContain(name);
  });

  it('lands on /chat when no return path was asked for', async () => {
    armHandshake();
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    expect(response.headers.get('Location')).toBe('/chat');
  });

  it('never follows a return path that is not an in-app path', async () => {
    armHandshake('https://evil.example/phish');
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    expect(response.headers.get('Location')).toBe('/chat');
  });

  it('updates an existing user and account instead of creating duplicates', async () => {
    mocks.users.push({ id: 'user-1', spotifyId: 'spotify-user' });
    mocks.accounts.push({ userId: 'user-1' });
    armHandshake();
    await GET(request({ code: 'auth-code', state: 'state-123' }));

    expect(mocks.inserted).toEqual([]);
    expect(mocks.updated.map((entry) => entry.table)).toEqual([
      'users',
      'spotifyAccounts',
    ]);
    expect(mocks.createSession).toHaveBeenCalledWith('user-1');
  });

  it('reports access_denied when the visitor declines on Spotify', async () => {
    armHandshake();
    const response = await GET(
      request({ error: 'access_denied', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'access_denied');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('keeps the return path when the visitor declines', async () => {
    armHandshake('/library');
    const response = await GET(
      request({ error: 'access_denied', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'access_denied', '&next=%2Flibrary');
  });

  it('reports session_expired when the handshake cookies are gone', async () => {
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'session_expired');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('reports state_mismatch when the state does not match this browser', async () => {
    armHandshake();
    const response = await GET(
      request({ code: 'auth-code', state: 'someone-else' }),
    );
    await expectLoginRedirect(response, 'state_mismatch');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('reports auth_not_configured instead of attempting an exchange without credentials', async () => {
    mocks.configured = false;
    armHandshake();
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'auth_not_configured');
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it('reports user_not_registered when Spotify answers 403 for the account', async () => {
    armHandshake();
    mocks.getSpotifyUserProfile.mockRejectedValue(
      new SpotifyAuthRequestError('Failed to fetch Spotify profile', 403),
    );
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'user_not_registered');
  });

  it('reports token_exchange_failed for any other failure on the way to a session', async () => {
    armHandshake();
    mocks.exchangeCodeForTokens.mockRejectedValue(
      new SpotifyAuthRequestError(
        'Failed to exchange Spotify authorization code',
        400,
      ),
    );
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    await expectLoginRedirect(response, 'token_exchange_failed');
  });

  it('reports auth_failed when Spotify sends neither a code nor an error', async () => {
    armHandshake();
    const response = await GET(request({ state: 'state-123' }));
    await expectLoginRedirect(response, 'auth_failed');
  });

  it('lets the rate limiter answer first', async () => {
    const limited = new Response('slow down', { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limited);
    armHandshake();
    const response = await GET(
      request({ code: 'auth-code', state: 'state-123' }),
    );
    expect(response).toBe(limited);
    expect(mocks.exchangeCodeForTokens).not.toHaveBeenCalled();
  });
});
