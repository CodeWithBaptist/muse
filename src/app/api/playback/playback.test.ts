import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SPOTIFY_PLAYBACK_SCOPES } from '@/lib/spotify-playback';

const mocks = vi.hoisted(() => ({
  dbWhere: vi.fn(),
  getSession: vi.fn(),
  getValidAccessToken: vi.fn(),
  getAvailableDevices: vi.fn(),
  startPlayback: vi.fn(),
  controlPlayback: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...args: unknown[]) => mocks.dbWhere(...args),
      }),
    }),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: () => mocks.getSession(),
}));

vi.mock('@/lib/spotify-tokens', () => ({
  getValidAccessToken: (userId: string) => mocks.getValidAccessToken(userId),
  isSpotifyReconnectError: (error: unknown) =>
    error instanceof Error && error.message === 'SPOTIFY_RECONNECT_REQUIRED',
  SPOTIFY_RECONNECT_CODE: 'SPOTIFY_RECONNECT_REQUIRED',
  SPOTIFY_RECONNECT_MESSAGE:
    'Spotify connection expired. Please reconnect your Spotify account.',
}));

vi.mock('@/lib/spotify-service', () => ({
  SpotifyPlaybackRequestError: class SpotifyPlaybackRequestError extends Error {
    constructor(readonly status: number) {
      super('Spotify playback request failed');
    }
  },
  spotifyService: {
    getAvailableDevices: (...args: unknown[]) =>
      mocks.getAvailableDevices(...args),
    startPlayback: (...args: unknown[]) => mocks.startPlayback(...args),
    controlPlayback: (...args: unknown[]) => mocks.controlPlayback(...args),
  },
}));

import { SpotifyPlaybackRequestError } from '@/lib/spotify-service';
import { PUT as playbackControlPut } from './control/route';
import { GET as playbackStatusGet } from './status/route';
import { PUT as playbackPut } from './play/route';

const userId = '11111111-1111-4111-8111-111111111111';
const trackUri = 'spotify:track:3n3Ppam7vgaVa1iaRUc9Lp';
const deviceId = 'test-device-id';

function sameOriginRequest(path: string, body: unknown) {
  return new Request(`https://muse.example${path}`, {
    method: 'PUT',
    headers: {
      host: 'muse.example',
      origin: 'https://muse.example',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('Spotify playback routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId });
  });

  it('reports disconnected playback without requiring a Spotify account query', async () => {
    mocks.getSession.mockResolvedValueOnce(null);

    const response = await playbackStatusGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      availability: 'disconnected',
    });
    expect(mocks.dbWhere).not.toHaveBeenCalled();
  });

  it('validates playback credentials only on the server before enabling controls', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getValidAccessToken.mockResolvedValueOnce('server-side-test-token');

    const response = await playbackStatusGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ availability: 'ready' });
    expect(mocks.getValidAccessToken).toHaveBeenCalledWith(userId);
  });

  it('asks users with older grants to reconnect before showing playback controls', async () => {
    mocks.dbWhere.mockResolvedValueOnce([{ scope: 'user-read-private' }]);

    const response = await playbackStatusGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      availability: 'reconnect-required',
    });
    expect(mocks.getValidAccessToken).not.toHaveBeenCalled();
  });

  it('rejects invalid track URIs before calling Spotify', async () => {
    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', {
        trackUri: 'https://example.com/track',
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.getAvailableDevices).not.toHaveBeenCalled();
    expect(mocks.startPlayback).not.toHaveBeenCalled();
  });

  it('requires an active Spotify device before starting remote playback', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getAvailableDevices.mockResolvedValueOnce({
      devices: [{ id: deviceId, is_active: false }],
    });

    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', { trackUri }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Open Spotify on an active device, then try again.',
      code: 'NO_ACTIVE_DEVICE',
    });
    expect(mocks.startPlayback).not.toHaveBeenCalled();
  });

  it('does not send playback commands to a restricted device', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getAvailableDevices.mockResolvedValueOnce({
      devices: [{ id: deviceId, is_active: true, is_restricted: true }],
    });

    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', { trackUri }),
    );

    expect(response.status).toBe(409);
    expect(mocks.startPlayback).not.toHaveBeenCalled();
  });

  it('starts playback on the active device without returning an access token', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getAvailableDevices.mockResolvedValueOnce({
      devices: [{ id: deviceId, is_active: true }],
    });
    mocks.startPlayback.mockResolvedValueOnce(undefined);

    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', { trackUri }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.startPlayback).toHaveBeenCalledWith(
      userId,
      trackUri,
      deviceId,
    );
  });

  it('reports Spotify Premium requirements from the playback API', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getAvailableDevices.mockResolvedValueOnce({
      devices: [{ id: deviceId, is_active: true }],
    });
    mocks.startPlayback.mockRejectedValueOnce(
      new SpotifyPlaybackRequestError(403),
    );

    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', { trackUri }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        'An eligible Spotify Premium subscription is required for playback.',
      code: 'PREMIUM_REQUIRED',
    });
  });

  it('controls playback through the server-side Spotify connection', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.controlPlayback.mockResolvedValueOnce(undefined);

    const response = await playbackControlPut(
      sameOriginRequest('/api/playback/control', { action: 'pause' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(mocks.controlPlayback).toHaveBeenCalledWith(userId, 'pause');
  });

  it('keeps Spotify service error details out of playback responses', async () => {
    mocks.dbWhere.mockResolvedValueOnce([
      { scope: SPOTIFY_PLAYBACK_SCOPES.join(' ') },
    ]);
    mocks.getAvailableDevices.mockResolvedValueOnce({
      devices: [{ id: deviceId, is_active: true }],
    });
    mocks.startPlayback.mockRejectedValueOnce(
      new Error('INTERNAL_SPOTIFY_DETAIL'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await playbackPut(
      sameOriginRequest('/api/playback/play', { trackUri }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain('INTERNAL_SPOTIFY_DETAIL');
    expect(body).toEqual({
      error: 'Spotify could not start playback. Open this track in Spotify.',
      code: 'PLAYBACK_FAILED',
    });
  });
});
