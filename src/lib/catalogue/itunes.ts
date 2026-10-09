import { CatalogueLookupError, type FetchLike } from './deezer';
import type { CatalogueCandidate } from './types';

/**
 * Apple's iTunes Search API, also keyless, is the fallback: it allows only
 * about twenty calls a minute per source, so the verifier keeps it for
 * tracks Deezer could not settle and caps how many it asks per run.
 */

export const ITUNES_API_BASE = 'https://itunes.apple.com/search';
export const ITUNES_RESULT_LIMIT = 5;
export const ITUNES_COUNTRY = 'NG';

interface ItunesResult {
  wrapperType?: string;
  kind?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackViewUrl?: string;
  artworkUrl60?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

function toCandidate(result: ItunesResult): CatalogueCandidate | null {
  if (
    result.kind !== 'song' ||
    !result.trackId ||
    !result.trackName ||
    !result.artistName
  ) {
    return null;
  }
  return {
    source: 'itunes',
    id: String(result.trackId),
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    url:
      result.trackViewUrl ??
      `https://music.apple.com/${ITUNES_COUNTRY.toLowerCase()}/song/${result.trackId}`,
    artworkUrl: result.artworkUrl60 ?? result.artworkUrl100,
    durationMs: result.trackTimeMillis,
  };
}

export async function searchItunesTracks(
  term: string,
  options: { fetch?: FetchLike; signal?: AbortSignal } = {},
): Promise<CatalogueCandidate[]> {
  const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike);
  const params = new URLSearchParams({
    term,
    media: 'music',
    entity: 'song',
    limit: String(ITUNES_RESULT_LIMIT),
    country: ITUNES_COUNTRY,
  });
  const response = await fetchImpl(`${ITUNES_API_BASE}?${params}`, {
    signal: options.signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new CatalogueLookupError(
      `iTunes answered ${response.status}`,
      'itunes',
    );
  }
  const body = (await response.json()) as { results?: ItunesResult[] };
  return (body.results ?? [])
    .map(toCandidate)
    .filter((c): c is CatalogueCandidate => c !== null);
}
