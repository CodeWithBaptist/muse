import { TASTE_LIST_LIMIT, type TasteSnapshot } from './types';
import { isLastfmUsername } from './lastfm-username';

export { LASTFM_USERNAME_PATTERN, isLastfmUsername } from './lastfm-username';

/**
 * Reads a public Last.fm profile with the server's API key: top artists and
 * top tracks over the last six months, plus the most recent plays. The
 * username is validated here so the only thing that ever reaches Last.fm is
 * a plausible handle, and the key never leaves the server. Nothing is
 * stored; the snapshot goes back to the browser that asked.
 *
 * Last.fm's terms ask for a link back wherever its data is shown, so the
 * snapshot carries the profile URL and the UI shows it.
 */

export const LASTFM_API_BASE = 'https://ws.audioscrobbler.com/2.0/';
export const LASTFM_PERIOD = '6month';
export const LASTFM_TIMEOUT_MS = 8_000;

export type LastfmErrorCode =
  | 'LASTFM_NOT_CONFIGURED'
  | 'LASTFM_USER_NOT_FOUND'
  | 'LASTFM_PRIVATE'
  | 'LASTFM_UNAVAILABLE';

export class LastfmError extends Error {
  constructor(
    readonly code: LastfmErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LastfmError';
  }
}

export const LASTFM_ERROR_MESSAGES: Record<LastfmErrorCode, string> = {
  LASTFM_NOT_CONFIGURED: 'Last.fm import is not switched on for this MUSE yet.',
  LASTFM_USER_NOT_FOUND: 'Last.fm does not know that username.',
  LASTFM_PRIVATE:
    'That Last.fm profile keeps its listening private. Make recent listening public on Last.fm, then try again.',
  LASTFM_UNAVAILABLE:
    'Last.fm could not be reached right now. Try again in a moment.',
};

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function isLastfmConfigured(): boolean {
  return Boolean(process.env.LASTFM_API_KEY?.trim());
}

export function lastfmProfileUrl(username: string): string {
  return `https://www.last.fm/user/${encodeURIComponent(username)}`;
}

interface LastfmArtistRow {
  name?: string;
  playcount?: string | number;
}

interface LastfmTrackRow {
  name?: string;
  playcount?: string | number;
  artist?: { name?: string; '#text'?: string } | string;
  '@attr'?: { nowplaying?: string };
}

interface LastfmBody {
  error?: number;
  message?: string;
  topartists?: { artist?: LastfmArtistRow[] };
  toptracks?: { track?: LastfmTrackRow[] };
  recenttracks?: { track?: LastfmTrackRow[] };
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function plays(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : 0;
}

function artistName(row: LastfmTrackRow): string | null {
  if (typeof row.artist === 'string') return text(row.artist);
  return text(row.artist?.name) ?? text(row.artist?.['#text']);
}

/** Maps Last.fm's error numbers onto the few outcomes the UI distinguishes. */
function errorFor(code: number | undefined, message: string | undefined) {
  if (code === 6) {
    return new LastfmError(
      'LASTFM_USER_NOT_FOUND',
      LASTFM_ERROR_MESSAGES.LASTFM_USER_NOT_FOUND,
    );
  }
  if (code === 17) {
    return new LastfmError(
      'LASTFM_PRIVATE',
      LASTFM_ERROR_MESSAGES.LASTFM_PRIVATE,
    );
  }
  return new LastfmError(
    'LASTFM_UNAVAILABLE',
    message
      ? `Last.fm answered: ${message}`
      : LASTFM_ERROR_MESSAGES.LASTFM_UNAVAILABLE,
  );
}

async function callLastfm(
  method: string,
  params: Record<string, string>,
  apiKey: string,
  fetchImpl: FetchLike,
  signal: AbortSignal,
): Promise<LastfmBody> {
  const query = new URLSearchParams({
    method,
    ...params,
    api_key: apiKey,
    format: 'json',
  });
  let response: Response;
  try {
    response = await fetchImpl(`${LASTFM_API_BASE}?${query.toString()}`, {
      signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MUSE (muse-six-pink.vercel.app)',
      },
    });
  } catch (error) {
    throw new LastfmError(
      'LASTFM_UNAVAILABLE',
      error instanceof Error && error.name === 'AbortError'
        ? 'Last.fm took too long to answer.'
        : LASTFM_ERROR_MESSAGES.LASTFM_UNAVAILABLE,
    );
  }
  let body: LastfmBody;
  try {
    body = (await response.json()) as LastfmBody;
  } catch {
    throw new LastfmError(
      'LASTFM_UNAVAILABLE',
      `Last.fm answered ${response.status} without JSON.`,
    );
  }
  if (typeof body.error === 'number') throw errorFor(body.error, body.message);
  if (!response.ok) throw errorFor(undefined, `HTTP ${response.status}`);
  return body;
}

export interface FetchLastfmOptions {
  fetchImpl?: FetchLike;
  apiKey?: string;
  now?: Date;
}

/**
 * Builds a snapshot from a public profile. Throws LastfmError so the route
 * can answer with a code the page understands; anything else is a bug.
 */
export async function fetchLastfmTaste(
  username: string,
  options: FetchLastfmOptions = {},
): Promise<TasteSnapshot> {
  const apiKey = options.apiKey ?? process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    throw new LastfmError(
      'LASTFM_NOT_CONFIGURED',
      LASTFM_ERROR_MESSAGES.LASTFM_NOT_CONFIGURED,
    );
  }
  if (!isLastfmUsername(username)) {
    throw new LastfmError(
      'LASTFM_USER_NOT_FOUND',
      LASTFM_ERROR_MESSAGES.LASTFM_USER_NOT_FOUND,
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(LASTFM_TIMEOUT_MS);
  const limit = String(TASTE_LIST_LIMIT);

  // Top artists first on its own: a wrong username fails here with one call
  // instead of three.
  const topArtists = await callLastfm(
    'user.gettopartists',
    { user: username, period: LASTFM_PERIOD, limit },
    apiKey,
    fetchImpl,
    signal,
  );
  const [topTracks, recent] = await Promise.all([
    callLastfm(
      'user.gettoptracks',
      { user: username, period: LASTFM_PERIOD, limit },
      apiKey,
      fetchImpl,
      signal,
    ),
    callLastfm(
      'user.getrecenttracks',
      { user: username, limit },
      apiKey,
      fetchImpl,
      signal,
    ).catch((error: unknown) => {
      // Recent plays can be private while the top lists are public.
      if (error instanceof LastfmError && error.code === 'LASTFM_PRIVATE')
        return null;
      throw error;
    }),
  ]);

  const artists = (topArtists.topartists?.artist ?? [])
    .map((row) => ({ name: text(row.name), plays: plays(row.playcount) }))
    .filter((row): row is { name: string; plays: number } => row.name !== null)
    .slice(0, TASTE_LIST_LIMIT);
  const tracks = (topTracks.toptracks?.track ?? [])
    .map((row) => ({
      title: text(row.name),
      artist: artistName(row),
      plays: plays(row.playcount),
    }))
    .filter(
      (row): row is { title: string; artist: string; plays: number } =>
        row.title !== null && row.artist !== null,
    )
    .slice(0, TASTE_LIST_LIMIT);
  const recentTracks = (recent?.recenttracks?.track ?? [])
    .map((row) => ({ title: text(row.name), artist: artistName(row) }))
    .filter(
      (row): row is { title: string; artist: string } =>
        row.title !== null && row.artist !== null,
    )
    .slice(0, TASTE_LIST_LIMIT);

  return {
    source: 'lastfm',
    label: `Last.fm: ${username}`,
    sourceUrl: lastfmProfileUrl(username),
    topArtists: artists,
    topTracks: tracks,
    recentTracks,
    capturedAt: (options.now ?? new Date()).toISOString(),
  };
}
