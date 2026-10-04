export const SPOTIFY_PLAYBACK_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
] as const;

const SPOTIFY_TRACK_URI_PATTERN = /^spotify:track:[A-Za-z0-9]{22}$/;

export function hasSpotifyPlaybackScopes(
  scopeValue: string | null | undefined,
) {
  if (!scopeValue) return false;
  const scopes = new Set(scopeValue.split(/\s+/).filter(Boolean));
  return SPOTIFY_PLAYBACK_SCOPES.every((scope) => scopes.has(scope));
}

export function getSpotifyTrackUri(track: {
  id?: string | null;
  uri?: string | null;
}) {
  const uri = track.uri?.trim();
  if (uri && SPOTIFY_TRACK_URI_PATTERN.test(uri)) return uri;

  const id = track.id?.trim().replace(/^spotify:track:/, '');
  if (!id || !/^[A-Za-z0-9]{22}$/.test(id)) return null;

  return `spotify:track:${id}`;
}
