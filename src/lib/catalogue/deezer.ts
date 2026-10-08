import type { CatalogueCandidate } from './types';

/**
 * Deezer's public search needs no key. Advanced syntax (artist:"" track:"")
 * is tried first because it is far more precise; a plain query follows when
 * it returns nothing. Deezer answers quota problems with HTTP 200 and an
 * error object, so both are treated as a failed lookup, never as "no match".
 */

export const DEEZER_API_BASE = 'https://api.deezer.com';
export const DEEZER_RESULT_LIMIT = 5;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

interface DeezerTrack {
  id?: number | string;
  title?: string;
  link?: string;
  duration?: number;
  artist?: { name?: string };
  album?: { title?: string; cover_small?: string; cover_medium?: string };
}

interface DeezerSearchBody {
  data?: DeezerTrack[];
  error?: { message?: string; code?: number };
}

export class CatalogueLookupError extends Error {
  constructor(
    message: string,
    readonly source: 'deezer' | 'itunes',
  ) {
    super(message);
    this.name = 'CatalogueLookupError';
  }
}

export function deezerTrackQuery(artist: string, title: string): string {
  const clean = (value: string) => value.replace(/"/g, '').trim();
  return `artist:"${clean(artist)}" track:"${clean(title)}"`;
}

function toCandidate(track: DeezerTrack): CatalogueCandidate | null {
  if (track.id === undefined || !track.title || !track.artist?.name)
    return null;
  return {
    source: 'deezer',
    id: String(track.id),
    title: track.title,
    artist: track.artist.name,
    album: track.album?.title,
    url: track.link ?? `https://www.deezer.com/track/${track.id}`,
    artworkUrl: track.album?.cover_small ?? track.album?.cover_medium,
    durationMs:
      typeof track.duration === 'number' ? track.duration * 1000 : undefined,
  };
}

async function readDeezer(
  url: string,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<DeezerSearchBody> {
  const response = await fetchImpl(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new CatalogueLookupError(
      `Deezer answered ${response.status}`,
      'deezer',
    );
  }
  const body = (await response.json()) as DeezerSearchBody;
  if (body.error) {
    throw new CatalogueLookupError(
      `Deezer error ${body.error.code ?? ''}: ${body.error.message ?? 'unknown'}`,
      'deezer',
    );
  }
  return body;
}

export async function searchDeezerTracks(
  query: string,
  options: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<CatalogueCandidate[]> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike);
  const params = new URLSearchParams({
    q: query,
    limit: String(DEEZER_RESULT_LIMIT),
  });
  const body = await readDeezer(
    `${DEEZER_API_BASE}/search?${params}`,
    fetchImpl,
    options.signal,
  );
  return (body.data ?? [])
    .map(toCandidate)
    .filter((c): c is CatalogueCandidate => c !== null);
}

/** Names of artists Deezer lists for this query, used before dropping a pick as invented. */
export async function searchDeezerArtists(
  name: string,
  options: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<string[]> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike);
  const params = new URLSearchParams({ q: name, limit: '5' });
  const body = (await readDeezer(
    `${DEEZER_API_BASE}/search/artist?${params}`,
    fetchImpl,
    options.signal,
  )) as { data?: { name?: string }[] };
  return (body.data ?? []).map((artist) => artist.name ?? '').filter(Boolean);
}
