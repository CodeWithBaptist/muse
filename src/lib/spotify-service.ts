import { getValidAccessToken, SpotifyReconnectError } from './spotify-tokens';

function stripSpotifyPreviewUrls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSpotifyPreviewUrls(item)) as T;
  }
  if (typeof value !== 'object' || value === null) return value;

  const fields = Object.entries(value).filter(([key]) => key !== 'preview_url');
  return Object.fromEntries(
    fields.map(([key, nestedValue]) => [
      key,
      stripSpotifyPreviewUrls(nestedValue),
    ]),
  ) as T;
}

async function spotifyPlaybackRequest(
  userId: string,
  endpoint: string,
  method: 'PUT',
  body?: unknown,
) {
  const token = await getValidAccessToken(userId);
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401) throw new SpotifyReconnectError();
  if (!response.ok) throw new SpotifyPlaybackRequestError(response.status);
}

export class SpotifyPlaybackRequestError extends Error {
  constructor(readonly status: number) {
    super('Spotify playback request failed');
    this.name = 'SpotifyPlaybackRequestError';
  }
}

async function spotifyFetch(
  userId: string,
  endpoint: string,
  options: RequestInit = {},
) {
  const token = await getValidAccessToken(userId);
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://api.spotify.com/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized: Spotify token might be invalid');
    }
    const error = await response
      .json()
      .catch(() => ({ message: 'Unknown Spotify API error' }));
    throw new Error(
      `Spotify API error: ${error.message || response.statusText}`,
    );
  }

  if (response.status === 204) return null;
  return stripSpotifyPreviewUrls(await response.json());
}

export const spotifyService = {
  async getProfile(userId: string) {
    return spotifyFetch(userId, '/me');
  },

  async getRecentlyPlayed(userId: string, limit = 20) {
    return spotifyFetch(userId, `/me/player/recently-played?limit=${limit}`);
  },

  async getTopArtists(
    userId: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20,
  ) {
    return spotifyFetch(
      userId,
      `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
    );
  },

  async getTopTracks(
    userId: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit = 20,
  ) {
    return spotifyFetch(
      userId,
      `/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
    );
  },

  async getSavedTracks(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(userId, `/me/tracks?limit=${limit}&offset=${offset}`);
  },

  async getSavedAlbums(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(userId, `/me/albums?limit=${limit}&offset=${offset}`);
  },

  async getUserPlaylists(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(
      userId,
      `/me/playlists?limit=${limit}&offset=${offset}`,
    );
  },

  async search(
    userId: string,
    query: string,
    types: string[] = ['track', 'artist'],
    limit = 10,
  ) {
    const q = encodeURIComponent(query);
    const t = types.join(',');
    return spotifyFetch(userId, `/search?q=${q}&type=${t}&limit=${limit}`);
  },

  async getTrack(userId: string, trackId: string) {
    return spotifyFetch(userId, `/tracks/${trackId}`);
  },

  async getPlaylist(userId: string, playlistId: string) {
    return spotifyFetch(userId, `/playlists/${playlistId}`);
  },

  async getAvailableDevices(userId: string) {
    return spotifyFetch(userId, '/me/player/devices');
  },

  async startPlayback(userId: string, trackUri: string, deviceId: string) {
    await spotifyPlaybackRequest(
      userId,
      `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      'PUT',
      { uris: [trackUri] },
    );
  },

  async controlPlayback(userId: string, action: 'pause' | 'resume') {
    await spotifyPlaybackRequest(userId, `/me/player/${action}`, 'PUT');
  },
};
