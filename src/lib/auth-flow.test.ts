import { describe, expect, it } from 'vitest';
import {
  AUTH_ERROR_CODES,
  AUTH_HANDSHAKE_COOKIES,
  AUTH_HANDSHAKE_MAX_AGE_SECONDS,
  handshakeCookieOptions,
  isAuthErrorCode,
  loginPathForError,
  loginPathForReturn,
  redirectTo,
  safeNextPath,
} from './auth-flow';

describe('safeNextPath', () => {
  it('accepts in-app paths, with their query string', () => {
    expect(safeNextPath('/chat')).toBe('/chat');
    expect(safeNextPath('/settings')).toBe('/settings');
    expect(safeNextPath('/playlists/abc?tab=tracks')).toBe(
      '/playlists/abc?tab=tracks',
    );
    expect(safeNextPath(['/discover', '/other'])).toBe('/discover');
  });

  it('rejects anything that could leave the app', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '/chat\\..',
      'chat',
      '',
      undefined,
      null,
      '/chat\n',
      '/chat with space',
      'javascript:alert(1)',
      `/${'a'.repeat(600)}`,
    ]) {
      expect(
        safeNextPath(value as string | null | undefined),
        String(value),
      ).toBeNull();
    }
  });

  it('never returns to the login page or an API route', () => {
    expect(safeNextPath('/login')).toBeNull();
    expect(safeNextPath('/login?error=x')).toBeNull();
    expect(safeNextPath('/api/auth/spotify')).toBeNull();
    expect(safeNextPath('/api')).toBeNull();
    // Similar prefixes that are real pages stay allowed.
    expect(safeNextPath('/apiary')).toBe('/apiary');
  });

  it('drops the fragment, which the server never sees anyway', () => {
    expect(safeNextPath('/chat#top')).toBe('/chat');
  });
});

describe('login paths', () => {
  it('builds the error path and only carries a return path worth keeping', () => {
    expect(loginPathForError('access_denied')).toBe(
      '/login?error=access_denied',
    );
    expect(loginPathForError('access_denied', '/chat')).toBe(
      '/login?error=access_denied',
    );
    expect(loginPathForError('state_mismatch', '/settings')).toBe(
      '/login?error=state_mismatch&next=%2Fsettings',
    );
    expect(loginPathForError('auth_failed', 'https://evil.example')).toBe(
      '/login?error=auth_failed',
    );
  });

  it('remembers where a signed out visitor was heading', () => {
    expect(loginPathForReturn('/settings')).toBe('/login?next=%2Fsettings');
    expect(loginPathForReturn('/chat')).toBe('/login');
    expect(loginPathForReturn('/')).toBe('/login?next=%2F');
    expect(loginPathForReturn(null)).toBe('/login');
  });
});

describe('redirectTo', () => {
  it('answers with a 303 and a relative, uncached Location', async () => {
    const response = redirectTo('/login?error=access_denied');
    expect(response.status).toBe(303);
    expect(response.headers.get('Location')).toBe('/login?error=access_denied');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
});

describe('handshake', () => {
  it('names the three cookies, keeps them for ten minutes, and secures them in production', () => {
    expect(AUTH_HANDSHAKE_COOKIES).toEqual([
      'spotify_auth_state',
      'spotify_code_verifier',
      'spotify_auth_next',
    ]);
    expect(AUTH_HANDSHAKE_MAX_AGE_SECONDS).toBe(600);
    expect(handshakeCookieOptions(true)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    expect(handshakeCookieOptions(false).secure).toBe(false);
  });

  it('recognises exactly the codes the routes can send', () => {
    for (const code of AUTH_ERROR_CODES)
      expect(isAuthErrorCode(code)).toBe(true);
    expect(isAuthErrorCode('something_else')).toBe(false);
  });
});
