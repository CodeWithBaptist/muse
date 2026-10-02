import { getValidAccessToken } from './spotify-tokens';

async function spotifyFetch(userId: string, endpoint: string, options: RequestInit = {}) {
  const token = await getValidAccessToken(userId);
  const url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1${endpoint}`;

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
    const error = await response.json().catch(() => ({ message: 'Unknown Spotify API error' }));
    throw new Error(`Spotify API error: ${error.message || response.statusText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const spotifyService = {
  async getProfile(userId: string) {
    return spotifyFetch(userId, '/me');
  },

  async getRecentlyPlayed(userId: string, limit = 20) {
    return spotifyFetch(userId, `/me/player/recently-played?limit=${limit}`);
  },

  async getTopArtists(userId: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 20) {
    return spotifyFetch(userId, `/me/top/artists?time_range=${timeRange}&limit=${limit}`);
  },

  async getTopTracks(userId: string, timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term', limit = 20) {
    return spotifyFetch(userId, `/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
  },

  async getSavedTracks(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(userId, `/me/tracks?limit=${limit}&offset=${offset}`);
  },

  async getSavedAlbums(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(userId, `/me/albums?limit=${limit}&offset=${offset}`);
  },

  async getUserPlaylists(userId: string, limit = 20, offset = 0) {
    return spotifyFetch(userId, `/me/playlists?limit=${limit}&offset=${offset}`);
  },

  async search(userId: string, query: string, types: string[] = ['track', 'artist'], limit = 20) {
    const q = encodeURIComponent(query);
    const t = types.join(',');
    return spotifyFetch(userId, `/search?q=${q}&type=${t}&limit=${limit}`);
  },

  async getTrack(userId: string, trackId: string) {
    return spotifyFetch(userId, `/tracks/${trackId}`);
  },

  async getPlaylist(userId: string, playlistId: string) {
    return spotifyFetch(userId, `/playlists/${playlistId}`);
  }
};
