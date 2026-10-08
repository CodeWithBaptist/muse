import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './cache';
import { DEEZER_API_BASE } from './deezer';
import { ITUNES_API_BASE } from './itunes';
import { searchLinksFor, searchUrlFor } from './search-links';
import { verifyTracks, type CachedOutcome } from './verify';
import type { RecommendedTrack } from '@/lib/ai/playlist-engine';

function track(title: string, artist: string): RecommendedTrack {
  return {
    id: `${artist}--${title}`.toLowerCase(),
    title,
    artist,
    why: 'Fits.',
    region: 'Nigeria',
  };
}

function deezerTrack(id: number, title: string, artist: string) {
  return {
    id,
    title,
    link: `https://www.deezer.com/track/${id}`,
    duration: 200,
    artist: { name: artist },
    album: {
      title: 'Album',
      cover_small: `https://e-cdns-images.dzcdn.net/${id}/56x56.jpg`,
    },
  };
}

function itunesTrack(id: number, title: string, artist: string) {
  return {
    wrapperType: 'track',
    kind: 'song',
    trackId: id,
    trackName: title,
    artistName: artist,
    collectionName: 'Album',
    trackViewUrl: `https://music.apple.com/ng/album/x/1?i=${id}`,
    artworkUrl60: `https://is1-ssl.mzstatic.com/${id}/60x60bb.jpg`,
    trackTimeMillis: 200000,
  };
}

type Route = (url: URL) => unknown | Promise<unknown>;

/** A fetch that answers from a table keyed by host and path, recording calls. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const impl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    calls.push(url.toString());
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const route = routes[`${url.host}${url.pathname}`];
    if (!route) throw new Error(`no route for ${url}`);
    const body = await route(url);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  return { impl, calls };
}

const deezerSearch = `${new URL(DEEZER_API_BASE).host}/search`;
const deezerArtist = `${new URL(DEEZER_API_BASE).host}/search/artist`;
const itunesSearch = `${new URL(ITUNES_API_BASE).host}/search`;

describe('verifyTracks', () => {
  let cache: TtlCache<CachedOutcome>;
  beforeEach(() => {
    cache = new TtlCache<CachedOutcome>(60_000);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('verifies on Deezer with the advanced query and keeps the small artwork and link', async () => {
    const { impl, calls } = fakeFetch({
      [deezerSearch]: (url) =>
        url.searchParams.get('q') === 'artist:"Wizkid" track:"Essence"'
          ? { data: [deezerTrack(1, 'Essence (feat. Tems)', 'Wizkid')] }
          : { data: [] },
    });
    const result = await verifyTracks([track('Essence', 'Wizkid')], {
      fetch: impl,
      cache,
    });
    expect(result.dropped).toEqual([]);
    expect(result.tracks[0].verification).toEqual({
      status: 'verified',
      source: 'deezer',
      id: '1',
      url: 'https://www.deezer.com/track/1',
      album: 'Album',
      artworkUrl: 'https://e-cdns-images.dzcdn.net/1/56x56.jpg',
      durationMs: 200000,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('limit=5');
  });

  it('falls back to a plain Deezer query, then to iTunes', async () => {
    const { impl, calls } = fakeFetch({
      [deezerSearch]: () => ({ data: [] }),
      [itunesSearch]: () => ({
        results: [itunesTrack(9, 'Ojuelegba', 'Wizkid')],
      }),
    });
    const result = await verifyTracks([track('Ojuelegba', 'Wizkid')], {
      fetch: impl,
      cache,
    });
    expect(result.tracks[0].verification.status).toBe('verified');
    expect(result.tracks[0].verification.source).toBe('itunes');
    expect(result.tracks[0].verification.url).toContain('music.apple.com');
    expect(
      calls.filter((c) => c.includes('api.deezer.com/search?')),
    ).toHaveLength(2);
    expect(calls.filter((c) => c.includes('itunes.apple.com'))).toHaveLength(1);
    expect(calls.at(-1)).toContain('country=NG');
  });

  it('keeps a pick whose artist exists but whose title is missing, marked unverified', async () => {
    const { impl } = fakeFetch({
      [deezerSearch]: () => ({
        data: [deezerTrack(2, 'Some Other Song', 'Ayinla Omowura')],
      }),
      [itunesSearch]: () => ({ results: [] }),
    });
    const result = await verifyTracks(
      [track('Lost Fuji Cut', 'Ayinla Omowura')],
      {
        fetch: impl,
        cache,
      },
    );
    expect(result.dropped).toEqual([]);
    expect(result.tracks[0].verification).toEqual({
      status: 'unverified',
      reason: 'title_not_found',
    });
  });

  it('keeps a pick when the artist search finds the artist even though no track matched', async () => {
    const { impl, calls } = fakeFetch({
      [deezerSearch]: () => ({ data: [] }),
      [deezerArtist]: () => ({ data: [{ name: 'Haruna Ishola' }] }),
      [itunesSearch]: () => ({ results: [] }),
    });
    const result = await verifyTracks(
      [track('Oroki Social Club', 'Haruna Ishola')],
      {
        fetch: impl,
        cache,
      },
    );
    expect(result.dropped).toEqual([]);
    expect(result.tracks[0].verification.reason).toBe('title_not_found');
    expect(calls.some((c) => c.includes('/search/artist'))).toBe(true);
  });

  it('drops a pick only when no catalogue knows the artist at all', async () => {
    const { impl } = fakeFetch({
      [deezerSearch]: () => ({ data: [] }),
      [deezerArtist]: () => ({ data: [] }),
      [itunesSearch]: () => ({ results: [] }),
    });
    const invented = track('Lagoon Lights', 'Chidinma Okonkwo Quartet');
    const result = await verifyTracks([track('Essence', 'Wizkid'), invented], {
      fetch: impl,
      cache,
    });
    // Both got no hits here; Wizkid is only kept if the artist lookup knows him, which this fake does not.
    expect(result.dropped).toEqual([track('Essence', 'Wizkid'), invented]);
    expect(result.tracks).toEqual([]);
  });

  it('never drops when Deezer fails, and reports the failure as unverified', async () => {
    const { impl } = fakeFetch({
      [deezerSearch]: () => ({
        error: { message: 'Quota limit exceeded', code: 4 },
      }),
      [itunesSearch]: () => ({ results: [] }),
    });
    const result = await verifyTracks([track('Essence', 'Wizkid')], {
      fetch: impl,
      cache,
    });
    expect(result.dropped).toEqual([]);
    expect(result.tracks[0].verification).toEqual({
      status: 'unverified',
      reason: 'lookup_failed',
    });
    expect(cache.size).toBe(0);
  });

  it('treats a non-200 answer and a thrown network error as failed lookups', async () => {
    const { impl } = fakeFetch({
      [deezerSearch]: () => new Response('nope', { status: 503 }),
      [itunesSearch]: () => {
        throw new TypeError('fetch failed');
      },
    });
    const result = await verifyTracks([track('Essence', 'Wizkid')], {
      fetch: impl,
      cache,
    });
    expect(result.tracks[0].verification).toEqual({
      status: 'unverified',
      reason: 'lookup_failed',
    });
  });

  it('caps iTunes calls per run and leaves the rest to the Deezer verdict', async () => {
    const { impl, calls } = fakeFetch({
      [deezerSearch]: () => ({ data: [deezerTrack(3, 'Different', 'Asake')] }),
      [itunesSearch]: () => ({ results: [] }),
    });
    const picks = Array.from({ length: 5 }, (_, i) =>
      track(`Song ${i}`, 'Asake'),
    );
    const result = await verifyTracks(picks, {
      fetch: impl,
      cache,
      itunesCallsPerRun: 2,
    });
    expect(calls.filter((c) => c.includes('itunes.apple.com'))).toHaveLength(2);
    expect(result.tracks).toHaveLength(5);
    expect(
      result.tracks.every((t) => t.verification.reason === 'title_not_found'),
    ).toBe(true);
  });

  it('serves repeated picks from the cache without calling out again', async () => {
    const { impl, calls } = fakeFetch({
      [deezerSearch]: () => ({ data: [deezerTrack(1, 'Essence', 'Wizkid')] }),
    });
    await verifyTracks([track('Essence', 'Wizkid')], { fetch: impl, cache });
    await verifyTracks([track('Essence', 'Wizkid')], { fetch: impl, cache });
    expect(calls).toHaveLength(1);
  });

  it('gives up on a slow catalogue at the call timeout and keeps the pick', async () => {
    const impl = vi.fn(
      (input: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const result = await verifyTracks([track('Essence', 'Wizkid')], {
      fetch: impl,
      cache,
      callTimeoutMs: 20,
      runDeadlineMs: 200,
    });
    expect(result.tracks[0].verification).toEqual({
      status: 'unverified',
      reason: 'lookup_failed',
    });
  });
});

describe('search links', () => {
  it('builds encoded public search URLs with Audiomack and Boomplay first', () => {
    const links = searchLinksFor({ title: 'Last Last', artist: 'Burna Boy' });
    expect(links.map((l) => l.service)).toEqual([
      'audiomack',
      'boomplay',
      'spotify',
      'apple-music',
      'youtube-music',
      'deezer',
    ]);
    expect(links[0].url).toBe(
      'https://audiomack.com/search?q=Burna%20Boy%20Last%20Last',
    );
    expect(
      searchUrlFor('youtube-music', { title: 'Essence', artist: 'Wizkid' }),
    ).toBe('https://music.youtube.com/search?q=Wizkid%20Essence');
    expect(
      searchUrlFor('apple-music', { title: 'Ye', artist: 'Burna Boy' }),
    ).toContain('music.apple.com/ng/search?term=');
  });
});
