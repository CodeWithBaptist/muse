/**
 * Playlist export: the pure state machine behind the Create in Spotify button.
 *
 * The machine only ever reflects what the export API actually reported:
 * a playlist is opened only after the API confirmed creation, part of a
 * playlist can be reported as incomplete, and a failure never becomes a
 * success. It is a plain reducer so it can be unit tested without rendering,
 * and so the same machine can be driven by a real request or by a controlled
 * state prop.
 */

export type CreateInSpotifyStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'open'
  | 'error'
  | 'partial';

export interface CreateInSpotifyState {
  status: CreateInSpotifyStatus;
  /** Real Spotify playlist URL returned by the API. Never optimistic. */
  spotifyUrl: string | null;
  /** Real Spotify playlist id, kept so a retry never creates a second playlist. */
  spotifyPlaylistId: string | null;
  requestedCount: number;
  addedCount: number;
  /** Track URIs the API reported as not added. Empty unless the API said so. */
  failedTrackUris: string[];
  error: string | null;
  /** True while a retry is adding only the previously failed tracks. */
  retryingFailedOnly: boolean;
}

export const initialCreateInSpotifyState: CreateInSpotifyState = {
  status: 'idle',
  spotifyUrl: null,
  spotifyPlaylistId: null,
  requestedCount: 0,
  addedCount: 0,
  failedTrackUris: [],
  error: null,
  retryingFailedOnly: false,
};

export type CreateInSpotifyEvent =
  | { type: 'start'; requestedCount: number; retryingFailedOnly?: boolean }
  | { type: 'resolved'; result: PlaylistExportResult }
  | { type: 'rejected'; error: string }
  | { type: 'settle' }
  | { type: 'reset' };

export function createInSpotifyReducer(
  state: CreateInSpotifyState,
  event: CreateInSpotifyEvent,
): CreateInSpotifyState {
  switch (event.type) {
    case 'start':
      return {
        ...state,
        status: 'loading',
        requestedCount: event.requestedCount,
        error: null,
        retryingFailedOnly: Boolean(event.retryingFailedOnly),
      };

    case 'resolved': {
      const { result } = event;
      if (result.failedTrackUris.length > 0) {
        return {
          ...state,
          status: 'partial',
          spotifyUrl: result.spotifyUrl,
          spotifyPlaylistId: result.spotifyPlaylistId,
          requestedCount: result.requestedCount,
          addedCount: result.addedCount,
          failedTrackUris: result.failedTrackUris,
          error: null,
          retryingFailedOnly: false,
        };
      }
      return {
        ...state,
        status: 'success',
        spotifyUrl: result.spotifyUrl,
        spotifyPlaylistId: result.spotifyPlaylistId,
        requestedCount: result.requestedCount,
        addedCount: result.addedCount,
        failedTrackUris: [],
        error: null,
        retryingFailedOnly: false,
      };
    }

    case 'rejected':
      // A playlist that already exists cannot become "not created". Keep the
      // playlist and report the incomplete part instead of a full failure.
      if (state.spotifyUrl && state.spotifyPlaylistId) {
        return {
          ...state,
          status: 'partial',
          error: event.error,
          retryingFailedOnly: false,
        };
      }
      return {
        ...state,
        status: 'error',
        error: event.error,
        failedTrackUris: [],
        retryingFailedOnly: false,
      };

    case 'settle':
      if (state.status !== 'success' || !state.spotifyUrl) return state;
      return { ...state, status: 'open' };

    case 'reset':
      return { ...initialCreateInSpotifyState };

    default:
      return state;
  }
}

export interface PlaylistExportTrackMeta {
  id: string;
  title: string;
  artist: string;
  albumArtUrl?: string | null;
  durationMs?: number;
}

export interface PlaylistExportRequest {
  name: string;
  description?: string;
  trackUris: string[];
  tracks?: PlaylistExportTrackMeta[];
  /** MUSE playlist row id, when the export should update a saved draft. */
  playlistId?: string;
  /** Existing Spotify playlist id, set only when adding missing tracks. */
  spotifyPlaylistId?: string;
}

export interface PlaylistExportResult {
  spotifyUrl: string;
  spotifyPlaylistId: string | null;
  created: boolean;
  requestedCount: number;
  addedCount: number;
  failedTrackUris: string[];
}

export type PlaylistExportFetcher = (
  request: PlaylistExportRequest,
) => Promise<PlaylistExportResult>;

/**
 * Real export request. Resolves only with what the API confirmed, and rejects
 * with the API message when the playlist itself could not be created.
 */
export async function requestPlaylistExport(
  request: PlaylistExportRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<PlaylistExportResult> {
  const response = await fetchImpl('/api/playlists/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Unable to export playlist to Spotify right now.';
    throw new Error(message);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof (payload as { spotifyUrl?: unknown }).spotifyUrl !== 'string'
  ) {
    throw new Error('The Spotify export response was incomplete.');
  }

  const data = payload as {
    spotifyUrl: string;
    playlistId?: string | null;
    spotifyPlaylistId?: string | null;
    created?: boolean;
    requestedCount?: number;
    addedCount?: number;
    failedTrackUris?: unknown;
  };

  const failedTrackUris = Array.isArray(data.failedTrackUris)
    ? data.failedTrackUris.filter(
        (uri): uri is string => typeof uri === 'string',
      )
    : [];

  return {
    spotifyUrl: data.spotifyUrl,
    spotifyPlaylistId: data.spotifyPlaylistId ?? null,
    created: Boolean(data.created),
    requestedCount:
      typeof data.requestedCount === 'number'
        ? data.requestedCount
        : request.trackUris.length,
    addedCount:
      typeof data.addedCount === 'number'
        ? data.addedCount
        : Math.max(request.trackUris.length - failedTrackUris.length, 0),
    failedTrackUris,
  };
}

export const SUCCESS_HOLD_MS = 1200;

/** Visible label for the primary control in each state. */
export function createInSpotifyLabel(state: CreateInSpotifyState): string {
  switch (state.status) {
    case 'idle':
      return 'Create in Spotify';
    case 'loading':
      return 'Creating this in Spotify';
    case 'success':
      return 'Playlist created.';
    case 'open':
      return 'Open in Spotify';
    case 'error':
    case 'partial':
      return 'Try again';
  }
}

/** Every label the primary control can show, used to keep its width fixed. */
export const CREATE_IN_SPOTIFY_LABELS = [
  'Create in Spotify',
  'Creating this in Spotify',
  'Playlist created.',
  'Open in Spotify',
];

/** Short message shown next to the retry control when a state needs one. */
export function createInSpotifyMessage(state: CreateInSpotifyState): string | null {
  if (state.status === 'error') {
    return state.error
      ? `Couldn't create the playlist. ${state.error}`
      : "Couldn't create the playlist.";
  }
  if (state.status === 'partial') {
    const missing = state.failedTrackUris.length;
    const trackWord = missing === 1 ? 'track was' : 'tracks were';
    return `Playlist created, but ${missing} ${trackWord} not added.`;
  }
  return null;
}

/** Announced to assistive technology on every state change. */
export function createInSpotifyAnnouncement(state: CreateInSpotifyState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Creating this in Spotify.';
    case 'success':
      return 'Playlist created in Spotify.';
    case 'open':
      return 'The playlist is ready. Open in Spotify.';
    case 'error':
      return "Couldn't create the playlist. Try again.";
    case 'partial':
      return `${createInSpotifyMessage(state)} Try again to add them.`;
  }
}
