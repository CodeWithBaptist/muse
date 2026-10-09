import { describe, expect, it } from 'vitest';
import {
  SPOTIFY_LOGIN_ENV_VARS,
  getSpotifyLoginStatus,
  isSpotifyLoginConfigured,
} from './spotify-config';

const complete = {
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_CLIENT_SECRET: 'client-secret',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:3000/api/auth/spotify/callback',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
};

describe('getSpotifyLoginStatus', () => {
  it('is configured only when every variable sign-in depends on is present', () => {
    expect(getSpotifyLoginStatus(complete)).toEqual({
      configured: true,
      missing: [],
    });
    expect(isSpotifyLoginConfigured(complete)).toBe(true);
  });

  it('reports an empty environment as unconfigured and names every variable', () => {
    const status = getSpotifyLoginStatus({});
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual([...SPOTIFY_LOGIN_ENV_VARS]);
  });

  it('names only the variables that are missing', () => {
    const status = getSpotifyLoginStatus({
      ...complete,
      SPOTIFY_CLIENT_SECRET: undefined,
    });
    expect(status).toEqual({
      configured: false,
      missing: ['SPOTIFY_CLIENT_SECRET'],
    });
  });

  it('treats blank values as missing', () => {
    const status = getSpotifyLoginStatus({
      ...complete,
      SPOTIFY_REDIRECT_URI: '   ',
    });
    expect(status.missing).toEqual(['SPOTIFY_REDIRECT_URI']);
  });

  it('rejects an encryption key the encryption helper would refuse', () => {
    const status = getSpotifyLoginStatus({
      ...complete,
      ENCRYPTION_KEY: 'too-short',
    });
    expect(status.missing).toEqual(['ENCRYPTION_KEY']);
  });

  it('never exposes variable values', () => {
    const serialized = JSON.stringify(
      getSpotifyLoginStatus({ ...complete, ENCRYPTION_KEY: 'x' }),
    );
    expect(serialized).not.toContain('client-secret');
    expect(serialized).not.toContain('client-id');
  });
});
