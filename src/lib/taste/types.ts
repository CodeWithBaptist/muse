import { z } from 'zod';

/**
 * A visitor's listening, reduced to the little MUSE needs: who they play
 * most, what they play most, and what they played last. It comes from a
 * Last.fm profile or from a Spotify data export read on the device, lives
 * in the browser, and travels with a chat or profile request only as this
 * compact summary. The server never stores it.
 */

export const TASTE_SOURCES = ['lastfm', 'spotify_export'] as const;
export type TasteSource = (typeof TASTE_SOURCES)[number];

export const TASTE_SOURCE_LABELS: Record<TasteSource, string> = {
  lastfm: 'Last.fm',
  spotify_export: 'Spotify data export',
};

/** Items kept per list in the snapshot. */
export const TASTE_LIST_LIMIT = 20;
/** Items sent with each chat request; the prompt does not need more. */
export const TASTE_PROMPT_LIMIT = 10;
const TEXT_LIMIT = 120;

const text = z.string().trim().min(1).max(TEXT_LIMIT);
const count = z.number().int().nonnegative().max(10_000_000);

export const TasteArtistSchema = z.object({ name: text, plays: count });
export const TasteTrackSchema = z.object({
  title: text,
  artist: text,
  plays: count.optional(),
});

export const TasteSnapshotSchema = z.object({
  source: z.enum(TASTE_SOURCES),
  /** Short human label, for example "Last.fm: ada". */
  label: z.string().trim().min(1).max(80),
  /** Where the data came from, for attribution; only ever an https URL. */
  sourceUrl: z.string().url().startsWith('https://').max(200).optional(),
  topArtists: z.array(TasteArtistSchema).max(TASTE_LIST_LIMIT),
  topTracks: z.array(TasteTrackSchema).max(TASTE_LIST_LIMIT),
  recentTracks: z.array(TasteTrackSchema).max(TASTE_LIST_LIMIT),
  /** First and last play covered, as ISO dates, when the source says. */
  range: z.object({ from: text, to: text }).optional(),
  /** Plays counted, when the source says. */
  plays: count.optional(),
  capturedAt: z.string().datetime(),
});

export type TasteArtist = z.infer<typeof TasteArtistSchema>;
export type TasteTrack = z.infer<typeof TasteTrackSchema>;
export type TasteSnapshot = z.infer<typeof TasteSnapshotSchema>;

/** True when the snapshot has anything a prompt could use. */
export function tasteHasContent(snapshot: TasteSnapshot | null | undefined) {
  return Boolean(
    snapshot &&
    (snapshot.topArtists.length > 0 ||
      snapshot.topTracks.length > 0 ||
      snapshot.recentTracks.length > 0),
  );
}

/** The slice that rides with a chat request: shorter lists, same shape. */
export function compactTaste(snapshot: TasteSnapshot): TasteSnapshot {
  return {
    ...snapshot,
    topArtists: snapshot.topArtists.slice(0, TASTE_PROMPT_LIMIT),
    topTracks: snapshot.topTracks.slice(0, TASTE_PROMPT_LIMIT),
    recentTracks: snapshot.recentTracks.slice(0, TASTE_PROMPT_LIMIT),
  };
}

/** Parses stored or posted data; null for anything that is not a snapshot. */
export function parseTasteSnapshot(value: unknown): TasteSnapshot | null {
  const result = TasteSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
