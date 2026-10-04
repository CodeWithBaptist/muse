import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockDbExecute = vi.fn();
const mockDbSelectWhere = vi.fn();
const mockDbInsertReturning = vi.fn();
const mockDbDeleteWhere = vi.fn();
const mockDbUpdateWhere = vi.fn();
const mockDbTransaction = vi.fn();

vi.mock('@/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: (...args: unknown[]) => mockDbSelectWhere(...args),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: () => mockDbInsertReturning(),
      })),
    })),
    delete: vi.fn(() => ({
      where: (...args: unknown[]) => mockDbDeleteWhere(...args),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: (...args: unknown[]) => mockDbUpdateWhere(...args),
      })),
    })),
    transaction: (...args: unknown[]) => mockDbTransaction(...args),
  },
}));

const mockGetSession = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: () => mockGetSession(),
  deleteSession: () => mockDeleteSession(),
}));

import { verifySameOrigin } from './csrf';
import { enforceRateLimit } from './rate-limit';
import { GET as logoutGet, POST as logoutPost } from '@/app/api/auth/logout/route';
import { DELETE as chatClearDelete, POST as chatPost } from '@/app/api/chat/route';
import { GET as chatByIdGet, DELETE as chatByIdDelete } from '@/app/api/chat/[id]/route';
import { DELETE as accountDelete } from '@/app/api/me/account/route';
import { DELETE as spotifyDisconnectDelete } from '@/app/api/me/spotify/route';
import { GET as musicGet } from '@/app/api/music/route';
import { GET as musicSearchGet } from '@/app/api/music/search/route';
import { POST as playlistExportPost } from '@/app/api/playlists/export/route';
import { getValidAccessToken, SpotifyReconnectError } from '@/lib/spotify-tokens';
import { encrypt } from '@/lib/encryption';

describe('Stage B Security Hardening', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalSpotifyId = process.env.SPOTIFY_CLIENT_ID;
  const originalSpotifySecret = process.env.SPOTIFY_CLIENT_SECRET;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
    process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
    mockGetSession.mockResolvedValue({ userId: '11111111-1111-4111-8111-111111111111' });
    mockDbExecute.mockResolvedValue({
      rows: [{ count: 1, reset_at: new Date(Date.now() + 60_000).toISOString() }],
    });
    mockDbTransaction.mockImplementation(
      async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback({
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: (...whereArgs: unknown[]) => mockDbSelectWhere(...whereArgs),
            })),
          })),
          delete: (..._deleteArgs: unknown[]) => ({
            where: (...whereArgs: unknown[]) => mockDbDeleteWhere(...whereArgs),
          }),
        }),
    );
  });

  afterEach(() => {
    if (originalOpenAiKey !== undefined) process.env.OPENAI_API_KEY = originalOpenAiKey;
    else delete process.env.OPENAI_API_KEY;
    if (originalSpotifyId !== undefined) process.env.SPOTIFY_CLIENT_ID = originalSpotifyId;
    else delete process.env.SPOTIFY_CLIENT_ID;
    if (originalSpotifySecret !== undefined) process.env.SPOTIFY_CLIENT_SECRET = originalSpotifySecret;
    else delete process.env.SPOTIFY_CLIENT_SECRET;
    if (originalEncryptionKey !== undefined) process.env.ENCRYPTION_KEY = originalEncryptionKey;
    else delete process.env.ENCRYPTION_KEY;
  });

  it('rejects cross-origin state-changing requests with 403 and allows matching origin', async () => {
    const crossOriginReq = new Request('https://muse-six-pink.vercel.app/api/auth/logout', {
      method: 'POST',
      headers: {
        host: 'muse-six-pink.vercel.app',
        origin: 'https://evil.example.com',
      },
    });
    const rejected = verifySameOrigin(crossOriginReq);
    expect(rejected?.status).toBe(403);
    await expect(rejected?.json()).resolves.toEqual({
      error: 'Forbidden cross-origin request.',
      code: 'CSRF_REJECTED',
    });

    const sameOriginReq = new Request('https://muse-six-pink.vercel.app/api/auth/logout', {
      method: 'POST',
      headers: {
        host: 'muse-six-pink.vercel.app',
        origin: 'https://muse-six-pink.vercel.app',
      },
    });
    expect(verifySameOrigin(sameOriginReq)).toBeNull();
  });

  it('enforces POST-only logout and rejects GET /api/auth/logout with 405', async () => {
    const getRes = await logoutGet();
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get('Allow')).toBe('POST');

    const postRes = await logoutPost(
      new Request('http://127.0.0.1:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          host: '127.0.0.1:3000',
          origin: 'http://127.0.0.1:3000',
        },
      })
    );
    expect(postRes.status).toBe(200);
    await expect(postRes.json()).resolves.toEqual({ success: true });
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it('returns 429 Too Many Requests when database rate limit is exceeded', async () => {
    mockDbExecute.mockResolvedValue({
      rows: [{ count: 16, reset_at: new Date(Date.now() + 45_000).toISOString() }],
    });

    const req = new Request('http://127.0.0.1:3000/api/chat', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    const res = await enforceRateLimit(req, {
      scope: 'ai:chat',
      limit: 15,
      windowMs: 60_000,
    });

    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBeDefined();
    await expect(res?.json()).resolves.toEqual({
      error: 'Too many requests. Please wait a moment and try again.',
      code: 'RATE_LIMITED',
    });
  });

  it('validates API inputs with Zod across chat, music, search, and playlist export', async () => {
    const badChatRes = await chatPost(
      new Request('http://127.0.0.1:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '   ' }),
      })
    );
    expect(badChatRes.status).toBe(400);

    const badMusicRes = await musicGet(
      new Request('http://127.0.0.1:3000/api/music?type=invalid-tab&limit=500')
    );
    expect(badMusicRes.status).toBe(400);

    const badSearchRes = await musicSearchGet(
      new Request('http://127.0.0.1:3000/api/music/search?q=')
    );
    expect(badSearchRes.status).toBe(400);

    const badExportRes = await playlistExportPost(
      new Request('http://127.0.0.1:3000/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Mix',
          trackUris: ['not-a-spotify-uri'],
        }),
      })
    );
    expect(badExportRes.status).toBe(400);

    const badPlaylistIdRes = await playlistExportPost(
      new Request('http://127.0.0.1:3000/api/playlists/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'My Mix',
          trackUris: ['spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'],
          spotifyPlaylistId: 'not-a-playlist-id',
        }),
      })
    );
    expect(badPlaylistIdRes.status).toBe(400);

    const badIdRes = await chatByIdGet(
      new Request('http://127.0.0.1:3000/api/chat/not-a-uuid'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    );
    expect(badIdRes.status).toBe(400);
  });

  it('enforces session ownership on conversation GET, DELETE, and POST', async () => {
    const foreignConvId = '22222222-2222-4222-8222-222222222222';
    mockDbSelectWhere.mockResolvedValueOnce([]);

    const getRes = await chatByIdGet(
      new Request(`http://127.0.0.1:3000/api/chat/${foreignConvId}`),
      { params: Promise.resolve({ id: foreignConvId }) }
    );
    expect(getRes.status).toBe(404);

    mockDbSelectWhere.mockResolvedValueOnce([]);
    const deleteRes = await chatByIdDelete(
      new Request(`http://127.0.0.1:3000/api/chat/${foreignConvId}`, {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: foreignConvId }) }
    );
    expect(deleteRes.status).toBe(404);
    expect(mockDbDeleteWhere).not.toHaveBeenCalled();

    process.env.OPENAI_API_KEY = 'sk-real-key-for-test';
    mockDbSelectWhere.mockResolvedValueOnce([]);
    const postRes = await chatPost(
      new Request('http://127.0.0.1:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'Hello MUSE',
          conversationId: foreignConvId,
        }),
      })
    );
    expect(postRes.status).toBe(404);
  });

  it('clears saved recommendations with conversation history', async () => {
    const response = await chatClearDelete(
      new Request('http://127.0.0.1:3000/api/chat', { method: 'DELETE' })
    );

    expect(response.status).toBe(200);
    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(mockDbDeleteWhere).toHaveBeenCalledTimes(2);
  });

  it('deletes account data and clears playlist tracks before removing the account', async () => {
    mockDbSelectWhere.mockResolvedValueOnce([
      { id: '22222222-2222-4222-8222-222222222222' },
    ]);

    const response = await accountDelete(
      new Request('http://127.0.0.1:3000/api/me/account', { method: 'DELETE' }),
    );

    expect(response.status).toBe(200);
    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(mockDbDeleteWhere).toHaveBeenCalledTimes(3);
    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it('disconnects Spotify and clears Spotify-derived data and chat history transactionally', async () => {
    mockDbSelectWhere.mockResolvedValueOnce([
      { id: '22222222-2222-4222-8222-222222222222' },
    ]);

    const response = await spotifyDisconnectDelete(
      new Request('http://127.0.0.1:3000/api/me/spotify', { method: 'DELETE' }),
    );

    expect(response.status).toBe(200);
    expect(mockDbTransaction).toHaveBeenCalledTimes(1);
    expect(mockDbDeleteWhere).toHaveBeenCalledTimes(6);
  });

  it('keeps database error details out of the client response and logs', async () => {
    process.env.OPENAI_API_KEY = 'sk-real-key-for-test';
    mockDbInsertReturning.mockRejectedValueOnce(
      new Error('SENSITIVE_DB_ERROR: connection string password=secret')
    );
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await chatPost(
        new Request('http://127.0.0.1:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Hello there' }),
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toContain('SENSITIVE_DB_ERROR');
      expect(body).toEqual({ error: 'Unable to process chat request right now.' });
      const loggedDetails = JSON.stringify(errorLog.mock.calls);
      expect(loggedDetails).not.toContain('SENSITIVE_DB_ERROR');
      expect(loggedDetails).not.toContain('password=secret');
    } finally {
      errorLog.mockRestore();
    }
  });

  it('refreshes expired Spotify tokens and throws SpotifyReconnectError when refresh is rejected', async () => {
    const expiredAccount = {
      userId: 'user-123',
      accessToken: encrypt('old-access-token'),
      refreshToken: encrypt('valid-refresh-token'),
      expiresAt: new Date(Date.now() - 10_000),
    };

    mockDbSelectWhere.mockResolvedValueOnce([expiredAccount]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'fresh-access-token',
          expires_in: 3600,
          refresh_token: 'fresh-refresh-token',
        }),
        { status: 200 }
      )
    );

    const token = await getValidAccessToken('user-123');
    expect(token).toBe('fresh-access-token');
    expect(mockDbUpdateWhere).toHaveBeenCalledTimes(1);

    mockDbSelectWhere.mockResolvedValueOnce([expiredAccount]);
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
    );

    await expect(getValidAccessToken('user-123')).rejects.toThrow(SpotifyReconnectError);
  });
});
