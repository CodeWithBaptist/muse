import { db } from '@/db';
import { musicProfileSnapshots } from '@/db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { SpotifyArtistSummary } from './validation/api-schemas';

/**
 * Section 41. Capturing taste over time and describing how it changed.
 *
 * Every claim this module produces is computed from two stored observations by
 * set arithmetic. There is no model call anywhere in here, which is deliberate:
 * the section allows only claims supported by real data, and a deterministic
 * diff of two real Spotify readings cannot overstate what happened the way a
 * generated sentence can.
 *
 * Silence is the default. With fewer than two snapshots, or two that are too
 * close together to mean anything, this says so rather than describing a change
 * it has not observed.
 */

/**
 * The time range snapshots are taken at.
 *
 * Fixed on purpose. Spotify's long_term and medium_term windows answer
 * different questions, so diffing one against the other would report a change
 * in the question rather than in the taste.
 */
export const SNAPSHOT_TIME_RANGE = 'long_term';

const DAY_MS = 24 * 60 * 60 * 1000;

/** One capture a week is enough to see a month of change without storing noise. */
export const MIN_CAPTURE_GAP_MS = 7 * DAY_MS;

/** Two weeks is the shortest gap that supports a claim about a change. */
export const MIN_COMPARISON_GAP_MS = 14 * DAY_MS;

const MAX_ARTISTS = 20;
const MAX_GENRES = 12;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatSnapshotDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'an earlier date';
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function unique(values: string[], limit: number): string[] {
  const seen: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    if (seen.includes(trimmed)) continue;
    seen.push(trimmed);
    if (seen.length >= limit) break;
  }
  return seen;
}

function difference(added: string[], removed: string[]): string[] {
  const gone = new Set(removed.map((v) => v.toLowerCase()));
  return added.filter((value) => !gone.has(value.toLowerCase()));
}

function intersection(a: string[], b: string[]): string[] {
  const other = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((value) => other.has(value.toLowerCase()));
}

/**
 * Whether a capture is due, without needing the Spotify reading first.
 *
 * Profile views are far more common than weekly captures, so this lets the
 * route skip the extra top artists call in the common case.
 */
export async function isSnapshotCaptureDue(userId: string): Promise<boolean> {
  const [newest] = await db
    .select({ capturedAt: musicProfileSnapshots.capturedAt })
    .from(musicProfileSnapshots)
    .where(
      and(
        eq(musicProfileSnapshots.userId, userId),
        eq(musicProfileSnapshots.timeRange, SNAPSHOT_TIME_RANGE)
      )
    )
    .orderBy(desc(musicProfileSnapshots.capturedAt))
    .limit(1);

  if (!newest) return true;
  return Date.now() - newest.capturedAt.getTime() >= MIN_CAPTURE_GAP_MS;
}

export interface CaptureResult {
  captured: boolean;
  reason: 'captured' | 'too-soon' | 'unchanged' | 'no-data';
}

/**
 * Records what Spotify reported, if it is worth recording.
 *
 * An empty reading is never stored. A snapshot with no artists would later be
 * compared against a real one and report that everything changed, which would
 * be a claim about a failed request rather than about taste.
 */
export async function captureSnapshotIfDue(
  userId: string,
  artists: SpotifyArtistSummary[]
): Promise<CaptureResult> {
  const names = unique(
    artists.map((artist) => artist.name),
    MAX_ARTISTS
  );

  if (names.length === 0) return { captured: false, reason: 'no-data' };

  const genres = unique(
    artists.flatMap((artist) => artist.genres ?? []),
    MAX_GENRES
  );

  const [newest] = await db
    .select()
    .from(musicProfileSnapshots)
    .where(
      and(
        eq(musicProfileSnapshots.userId, userId),
        eq(musicProfileSnapshots.timeRange, SNAPSHOT_TIME_RANGE)
      )
    )
    .orderBy(desc(musicProfileSnapshots.capturedAt))
    .limit(1);

  const now = Date.now();

  if (newest && now - newest.capturedAt.getTime() < MIN_CAPTURE_GAP_MS) {
    return { captured: false, reason: 'too-soon' };
  }

  if (
    newest &&
    newest.topArtists.length === names.length &&
    newest.topArtists.every((name) => names.includes(name))
  ) {
    // Nothing moved. Storing an identical row would only make the history look
    // busier than it was.
    return { captured: false, reason: 'unchanged' };
  }

  await db.insert(musicProfileSnapshots).values({
    userId,
    topArtists: names,
    topGenres: genres,
    timeRange: SNAPSHOT_TIME_RANGE,
  });

  return { captured: true, reason: 'captured' };
}

export interface TasteChangeUnavailable {
  available: false;
  /** Plain language reason, safe to show. */
  reason: string;
  snapshotsHeld: number;
  /** When a comparison first becomes possible, if one capture exists. */
  nextComparisonAt: string | null;
}

export interface TasteChange {
  available: true;
  from: string;
  to: string;
  daysApart: number;
  newArtists: string[];
  retainedArtists: string[];
  droppedArtists: string[];
  newGenres: string[];
  droppedGenres: string[];
  /** Built only from the arrays above. */
  summary: string;
}

function joinNames(names: string[], limit = 3): string {
  const shown = names.slice(0, limit);
  const extra = names.length - shown.length;
  const text = shown.join(', ');
  return extra > 0 ? `${text} and ${extra} more` : text;
}

function buildSummary(
  change: Omit<TasteChange, 'summary' | 'available'>,
  fromDate: string
): string {
  const { newArtists, retainedArtists, droppedArtists, newGenres } = change;

  if (
    newArtists.length === 0 &&
    droppedArtists.length === 0 &&
    newGenres.length === 0
  ) {
    return `Your rotation has been steady since ${fromDate}. The same ${retainedArtists.length} ${
      retainedArtists.length === 1 ? 'artist is' : 'artists are'
    } still your most played.`;
  }

  const parts: string[] = [];

  if (retainedArtists.length > 0 && newArtists.length > 0) {
    parts.push(
      `Your usual top artists are still here, but you have been branching out.`
    );
  } else if (retainedArtists.length === 0 && newArtists.length > 0) {
    parts.push(
      `Your rotation changed. None of the artists from ${fromDate} are in your top ${newArtists.length} now.`
    );
  } else if (retainedArtists.length > 0) {
    parts.push(
      `Your usual top artists are still here since ${fromDate}.`
    );
  }

  if (newArtists.length > 0) {
    parts.push(`New since then: ${joinNames(newArtists)}.`);
  }

  if (droppedArtists.length > 0 && retainedArtists.length > 0) {
    parts.push(`${joinNames(droppedArtists)} dropped out.`);
  }

  if (newGenres.length > 0) {
    parts.push(`More ${joinNames(newGenres, 2)} in the mix than before.`);
  }

  return parts.join(' ');
}

/**
 * Compares the newest snapshot with the most recent one far enough behind it to
 * mean something.
 *
 * The oldest snapshot is deliberately not used. Comparing today against a
 * capture from a year ago would describe a change that happened long before
 * this month, which is not what the visitor is being told about.
 */
export async function describeTasteChange(
  userId: string
): Promise<TasteChange | TasteChangeUnavailable> {
  const snapshots = await db
    .select()
    .from(musicProfileSnapshots)
    .where(
      and(
        eq(musicProfileSnapshots.userId, userId),
        eq(musicProfileSnapshots.timeRange, SNAPSHOT_TIME_RANGE)
      )
    )
    .orderBy(asc(musicProfileSnapshots.capturedAt));

  if (snapshots.length < 2) {
    const only = snapshots[0];
    return {
      available: false,
      reason: only
        ? `MUSE has one reading of your taste, from ${formatSnapshotDate(
            only.capturedAt
          )}. A second one is needed before anything can be said about how it is changing.`
        : 'MUSE has not recorded your taste yet. Open this page again after listening on Spotify and a reading will be taken.',
      snapshotsHeld: snapshots.length,
      nextComparisonAt: only
        ? new Date(only.capturedAt.getTime() + MIN_COMPARISON_GAP_MS).toISOString()
        : null,
    };
  }

  const newest = snapshots[snapshots.length - 1];
  const newestTime = newest.capturedAt.getTime();

  // Walk back to the most recent snapshot that is far enough behind the newest.
  let baseline: (typeof snapshots)[number] | undefined;
  for (let i = snapshots.length - 2; i >= 0; i -= 1) {
    if (newestTime - snapshots[i].capturedAt.getTime() >= MIN_COMPARISON_GAP_MS) {
      baseline = snapshots[i];
      break;
    }
  }

  if (!baseline) {
    return {
      available: false,
      reason: `MUSE has ${snapshots.length} readings, but the oldest is less than two weeks behind the newest, so there is not enough distance between them to describe a change.`,
      snapshotsHeld: snapshots.length,
      nextComparisonAt: new Date(
        newestTime + MIN_COMPARISON_GAP_MS
      ).toISOString(),
    };
  }

  const newArtists = difference(newest.topArtists, baseline.topArtists);
  const retainedArtists = intersection(newest.topArtists, baseline.topArtists);
  const droppedArtists = difference(baseline.topArtists, newest.topArtists);
  const newGenres = difference(newest.topGenres, baseline.topGenres);
  const droppedGenres = difference(baseline.topGenres, newest.topGenres);

  const from = formatSnapshotDate(baseline.capturedAt);

  const withoutSummary = {
    from,
    to: formatSnapshotDate(newest.capturedAt),
    daysApart: Math.round(
      (newestTime - baseline.capturedAt.getTime()) / DAY_MS
    ),
    newArtists,
    retainedArtists,
    droppedArtists,
    newGenres,
    droppedGenres,
  };

  return {
    available: true,
    ...withoutSummary,
    summary: buildSummary(withoutSummary, from),
  };
}
