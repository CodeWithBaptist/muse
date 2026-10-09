import type { RecommendedTrack } from '@/lib/ai/playlist-engine';
import { TtlCache } from './cache';
import {
  CatalogueLookupError,
  deezerTrackQuery,
  searchDeezerArtists,
  searchDeezerTracks,
  type FetchLike,
} from './deezer';
import { searchItunesTracks } from './itunes';
import { artistMatches, splitArtists, titleMatches } from './normalise';
import type {
  CatalogueCandidate,
  TrackVerification,
  VerificationResult,
  VerifiedTrack,
} from './types';

/**
 * Checks a model-built list against real catalogues. Deezer first, iTunes
 * when Deezer cannot settle it. A pick is verified when both the artist and
 * the core title match a catalogue entry. A pick whose artist exists but
 * whose title was not found stays in the list marked unverified, because
 * a lot of Nigerian music, old and new, is missing or named differently on
 * these services. Only a pick with no artist match anywhere, after a final
 * artist search, is dropped as invented. Lookups that fail or time out
 * leave the pick unverified; our failure is never the visitor's loss.
 */

export const VERIFY_CALL_TIMEOUT_MS = 2500;
export const VERIFY_RUN_DEADLINE_MS = 7000;
export const VERIFY_CACHE_TTL_MS = 10 * 60 * 1000;
/** Apple allows roughly twenty calls a minute; keep a run well under it. */
export const ITUNES_CALLS_PER_RUN = 8;

export interface VerifyDeps {
  fetch?: FetchLike;
  callTimeoutMs?: number;
  runDeadlineMs?: number;
  itunesCallsPerRun?: number;
  cache?: TtlCache<CachedOutcome>;
  /** Injected in tests to bypass real timers. */
  now?: () => number;
}

export type CachedOutcome =
  { kind: 'kept'; verification: TrackVerification } | { kind: 'dropped' };

const defaultCache = new TtlCache<CachedOutcome>(VERIFY_CACHE_TTL_MS);

export function verificationCacheKey(
  track: Pick<RecommendedTrack, 'title' | 'artist'>,
): string {
  return `${track.artist}::${track.title}`.toLowerCase();
}

function verified(candidate: CatalogueCandidate): TrackVerification {
  return {
    status: 'verified',
    source: candidate.source,
    id: candidate.id,
    url: candidate.url,
    album: candidate.album,
    artworkUrl: candidate.artworkUrl,
    durationMs: candidate.durationMs,
  };
}

function pickMatch(
  track: RecommendedTrack,
  candidates: CatalogueCandidate[],
): CatalogueCandidate | undefined {
  return candidates.find(
    (candidate) =>
      titleMatches(track.title, candidate.title) &&
      artistMatches(track.artist, candidate.artist, candidate.title),
  );
}

function artistSeenIn(
  track: RecommendedTrack,
  candidates: CatalogueCandidate[],
): boolean {
  return candidates.some((candidate) =>
    artistMatches(track.artist, candidate.artist, candidate.title),
  );
}

interface RunContext {
  fetch: FetchLike;
  signalFor: () => AbortSignal;
  takeItunesCall: () => boolean;
}

/** One pick, resolved to a kept verification or a drop. Never throws. */
export async function verifyOne(
  track: RecommendedTrack,
  context: RunContext,
): Promise<CachedOutcome> {
  let artistSeen = false;
  let deezerFailed = false;
  let itunesSettled = false;

  try {
    let candidates = await searchDeezerTracks(
      deezerTrackQuery(track.artist, track.title),
      {
        fetch: context.fetch,
        signal: context.signalFor(),
      },
    );
    if (candidates.length === 0) {
      candidates = await searchDeezerTracks(`${track.artist} ${track.title}`, {
        fetch: context.fetch,
        signal: context.signalFor(),
      });
    }
    const hit = pickMatch(track, candidates);
    if (hit) return { kind: 'kept', verification: verified(hit) };
    artistSeen = artistSeenIn(track, candidates);
  } catch (error) {
    deezerFailed = true;
    logLookupFailure('deezer', error);
  }

  if (context.takeItunesCall()) {
    try {
      const candidates = await searchItunesTracks(
        `${track.artist} ${track.title}`,
        {
          fetch: context.fetch,
          signal: context.signalFor(),
        },
      );
      const hit = pickMatch(track, candidates);
      if (hit) return { kind: 'kept', verification: verified(hit) };
      artistSeen = artistSeen || artistSeenIn(track, candidates);
      itunesSettled = true;
    } catch (error) {
      logLookupFailure('itunes', error);
    }
  }

  if (artistSeen) {
    return {
      kind: 'kept',
      verification: { status: 'unverified', reason: 'title_not_found' },
    };
  }
  if (deezerFailed) {
    // Without Deezer there is not enough evidence to call anything invented.
    return {
      kind: 'kept',
      verification: { status: 'unverified', reason: 'lookup_failed' },
    };
  }

  // Last check before dropping: does this artist exist on Deezer at all?
  try {
    const names = await searchDeezerArtists(
      splitArtists(track.artist)[0] ?? track.artist,
      {
        fetch: context.fetch,
        signal: context.signalFor(),
      },
    );
    if (names.some((name) => artistMatches(track.artist, name))) {
      return {
        kind: 'kept',
        verification: { status: 'unverified', reason: 'title_not_found' },
      };
    }
    return { kind: 'dropped' };
  } catch (error) {
    logLookupFailure('deezer', error);
    return {
      kind: 'kept',
      verification: {
        status: 'unverified',
        reason: itunesSettled ? 'not_found' : 'lookup_failed',
      },
    };
  }
}

function logLookupFailure(source: 'deezer' | 'itunes', error: unknown): void {
  const message =
    error instanceof CatalogueLookupError || error instanceof Error
      ? error.message
      : String(error);
  console.warn(`Catalogue lookup failed (${source}): ${message}`);
}

/**
 * Verifies every pick in parallel under one run deadline, caching outcomes
 * that are stable (verified, title not found, dropped) for a few minutes.
 */
export async function verifyTracks(
  tracks: RecommendedTrack[],
  deps: VerifyDeps = {},
): Promise<VerificationResult> {
  const fetchImpl = deps.fetch ?? (globalThis.fetch as FetchLike);
  const cache = deps.cache ?? defaultCache;
  const callTimeoutMs = deps.callTimeoutMs ?? VERIFY_CALL_TIMEOUT_MS;
  const runDeadlineMs = deps.runDeadlineMs ?? VERIFY_RUN_DEADLINE_MS;
  const runSignal = AbortSignal.timeout(runDeadlineMs);
  let itunesCalls = 0;
  const itunesCap = deps.itunesCallsPerRun ?? ITUNES_CALLS_PER_RUN;

  const context: RunContext = {
    fetch: fetchImpl,
    signalFor: () =>
      AbortSignal.any([runSignal, AbortSignal.timeout(callTimeoutMs)]),
    takeItunesCall: () => {
      if (itunesCalls >= itunesCap) return false;
      itunesCalls += 1;
      return true;
    },
  };

  const outcomes = await Promise.all(
    tracks.map(async (track): Promise<CachedOutcome> => {
      const key = verificationCacheKey(track);
      const cached = cache.get(key);
      if (cached) return cached;
      const outcome = await verifyOne(track, context);
      const transient =
        outcome.kind === 'kept' &&
        outcome.verification.status === 'unverified' &&
        outcome.verification.reason !== 'title_not_found';
      if (!transient) cache.set(key, outcome);
      return outcome;
    }),
  );

  const kept: VerifiedTrack[] = [];
  const dropped: RecommendedTrack[] = [];
  outcomes.forEach((outcome, index) => {
    const track = tracks[index];
    if (outcome.kind === 'dropped') dropped.push(track);
    else kept.push({ ...track, verification: outcome.verification });
  });
  return { tracks: kept, dropped };
}

/** Clears the shared cache; for tests. */
export function resetVerificationCache(): void {
  defaultCache.clear();
}
