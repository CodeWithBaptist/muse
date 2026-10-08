import type { RecommendedTrack } from '@/lib/ai/playlist-engine';

/**
 * Shapes shared by the catalogue lookups (Deezer first, iTunes second) and
 * the chat payload. A verification never carries more than the few fields
 * the screen needs, so the payload stays small on an expensive connection.
 */

export const CATALOGUE_SOURCES = ['deezer', 'itunes'] as const;
export type CatalogueSource = (typeof CATALOGUE_SOURCES)[number];

export interface CatalogueCandidate {
  source: CatalogueSource;
  id: string;
  title: string;
  artist: string;
  album?: string;
  url: string;
  artworkUrl?: string;
  durationMs?: number;
}

export type UnverifiedReason =
  /** The artist exists in a catalogue but this title was not found under them. */
  | 'title_not_found'
  /** Nothing matched, but the lookups were incomplete, so no verdict either way. */
  | 'not_found'
  /** The catalogues did not answer in time; nothing is known either way. */
  | 'lookup_failed';

export interface TrackVerification {
  status: 'verified' | 'unverified';
  source?: CatalogueSource;
  id?: string;
  url?: string;
  album?: string;
  artworkUrl?: string;
  durationMs?: number;
  reason?: UnverifiedReason;
}

export interface VerifiedTrack extends RecommendedTrack {
  verification: TrackVerification;
}

export interface VerificationResult {
  tracks: VerifiedTrack[];
  /** Picks with no artist match in any catalogue: treated as hallucinations. */
  dropped: RecommendedTrack[];
}

export const CATALOGUE_ATTRIBUTION =
  'Catalogue checks use the Deezer API and the Apple iTunes Search API. MUSE is not affiliated with or endorsed by Deezer or Apple.';
