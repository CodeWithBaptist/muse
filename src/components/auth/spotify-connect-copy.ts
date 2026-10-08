/**
 * Words shared by every place that offers the Spotify connection: the landing
 * page, the login page, and the notices that explain a failed sign-in. One
 * source so the honest "not configured" state reads the same everywhere.
 */

export const SPOTIFY_UNAVAILABLE_LABEL = 'Spotify connection unavailable';
/** The landing header is narrow on phones; the explanation is still attached in full. */
export const SPOTIFY_UNAVAILABLE_LABEL_COMPACT = 'Spotify unavailable';
export const SPOTIFY_UNAVAILABLE_EXPLANATION =
  'Spotify sign-in is not configured for this deployment yet, so nothing can be connected right now.';
