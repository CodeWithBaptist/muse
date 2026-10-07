/**
 * The one place that adds items to a Spotify playlist.
 *
 * Spotify's February 2026 changes replaced `POST /playlists/{id}/tracks` with
 * `POST /playlists/{id}/items`. Keeping the call in one module means there is a
 * single place to check if that moves again, rather than one per route that
 * happens to write to a playlist.
 */

const SPOTIFY_API = 'https://api.spotify.com/v1';

/** Spotify accepts at most 100 items per request. */
export const SPOTIFY_ADD_ITEMS_MAX = 100;

export interface SpotifyCallResult {
  ok: boolean;
  status: number;
}

export async function addItemsToSpotifyPlaylist(
  token: string,
  playlistId: string,
  uris: string[]
): Promise<SpotifyCallResult> {
  const response = await fetch(`${SPOTIFY_API}/playlists/${playlistId}/items`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uris: uris.slice(0, SPOTIFY_ADD_ITEMS_MAX) }),
  });

  return { ok: response.ok, status: response.status };
}
