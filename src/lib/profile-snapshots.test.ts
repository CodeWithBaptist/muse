// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';

/**
 * Section 41 against a real database.
 *
 * The point of these tests is the refusal cases. Describing a change in taste is
 * easy to fake and hard to notice when it is wrong, so most of what is asserted
 * here is that MUSE stays silent when it has not actually observed a change.
 */

const state = vi.hoisted(() => ({ db: undefined as never }));

vi.mock('@/db', () => ({
  get db() {
    return state.db;
  },
  pool: {},
}));

import { createTestDatabase, seedUser, type TestDatabaseHandle } from '@/test/database';
import { musicProfileSnapshots, users } from '@/db/schema';
import {
  captureSnapshotIfDue,
  describeTasteChange,
  isSnapshotCaptureDue,
  MIN_COMPARISON_GAP_MS,
  SNAPSHOT_TIME_RANGE,
  formatSnapshotDate,
} from './profile-snapshots';

const DAY_MS = 24 * 60 * 60 * 1000;

function artist(name: string, genres: string[] = []) {
  return { name, genres };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY_MS);
}

let handle: TestDatabaseHandle;
let db: TestDatabaseHandle['db'];
let userId: string;

beforeAll(async () => {
  handle = await createTestDatabase();
  db = handle.db;
  state.db = db as never;
}, 60_000);

beforeEach(async () => {
  await handle.client.exec(
    `TRUNCATE TABLE users, music_profile_snapshots RESTART IDENTITY CASCADE`
  );
  const user = await seedUser(db);
  userId = user.id;
});

afterAll(async () => {
  await handle.close();
});

async function insertSnapshot(
  capturedAt: Date,
  topArtists: string[],
  topGenres: string[] = []
) {
  await db.insert(musicProfileSnapshots).values({
    userId,
    topArtists,
    topGenres,
    timeRange: SNAPSHOT_TIME_RANGE,
    capturedAt,
  });
}

async function storedSnapshots() {
  return db
    .select()
    .from(musicProfileSnapshots)
    .where(eq(musicProfileSnapshots.userId, userId))
    .orderBy(asc(musicProfileSnapshots.capturedAt));
}

describe('capturing a reading', () => {
  it('stores the first reading', async () => {
    expect(await isSnapshotCaptureDue(userId)).toBe(true);

    const result = await captureSnapshotIfDue(userId, [
      artist('Tems', ['afrobeats', 'nigerian rnb']),
      artist('Burna Boy', ['afrobeats']),
    ]);

    expect(result).toEqual({ captured: true, reason: 'captured' });

    const rows = await storedSnapshots();
    expect(rows).toHaveLength(1);
    expect(rows[0].topArtists).toEqual(['Tems', 'Burna Boy']);
    expect(rows[0].topGenres).toEqual(['afrobeats', 'nigerian rnb']);
    expect(rows[0].timeRange).toBe(SNAPSHOT_TIME_RANGE);
  });

  it('refuses a second reading inside the same week', async () => {
    await captureSnapshotIfDue(userId, [artist('Tems')]);

    expect(await isSnapshotCaptureDue(userId)).toBe(false);

    const result = await captureSnapshotIfDue(userId, [
      artist('Tems'),
      artist('Ayra Starr'),
    ]);

    expect(result).toEqual({ captured: false, reason: 'too-soon' });
    expect(await storedSnapshots()).toHaveLength(1);
  });

  it('accepts a reading once a week has passed', async () => {
    await insertSnapshot(daysAgo(8), ['Tems']);

    expect(await isSnapshotCaptureDue(userId)).toBe(true);

    const result = await captureSnapshotIfDue(userId, [artist('Ayra Starr')]);
    expect(result.captured).toBe(true);
    expect(await storedSnapshots()).toHaveLength(2);
  });

  it('does not store a reading that changed nothing', async () => {
    await insertSnapshot(daysAgo(8), ['Tems', 'Burna Boy']);

    const result = await captureSnapshotIfDue(userId, [
      artist('Burna Boy'),
      artist('Tems'),
    ]);

    expect(result).toEqual({ captured: false, reason: 'unchanged' });
    expect(await storedSnapshots()).toHaveLength(1);
  });

  it('never stores an empty reading', async () => {
    const result = await captureSnapshotIfDue(userId, []);

    // An empty snapshot would later be diffed against a real one and report
    // that everything changed, which would be a claim about a failed request.
    expect(result).toEqual({ captured: false, reason: 'no-data' });
    expect(await storedSnapshots()).toHaveLength(0);
  });

  it('drops unnamed artists and duplicate genres', async () => {
    await captureSnapshotIfDue(userId, [
      artist('Tems', ['afrobeats']),
      artist('  '),
      artist('Burna Boy', ['afrobeats', 'afro fusion']),
    ]);

    const rows = await storedSnapshots();
    expect(rows[0].topArtists).toEqual(['Tems', 'Burna Boy']);
    expect(rows[0].topGenres).toEqual(['afrobeats', 'afro fusion']);
  });
});

describe('describing a change', () => {
  it('says nothing at all when there are no readings', async () => {
    const change = await describeTasteChange(userId);

    expect(change.available).toBe(false);
    if (change.available) return;
    expect(change.snapshotsHeld).toBe(0);
    expect(change.nextComparisonAt).toBeNull();
    expect(change.reason).toMatch(/has not recorded your taste yet/i);
  });

  it('says nothing with only one reading, and names when the next is possible', async () => {
    await insertSnapshot(daysAgo(3), ['Tems']);

    const change = await describeTasteChange(userId);

    expect(change.available).toBe(false);
    if (change.available) return;
    expect(change.snapshotsHeld).toBe(1);
    expect(change.reason).toMatch(/one reading/i);
    expect(change.nextComparisonAt).not.toBeNull();
  });

  it('refuses to describe a change between readings that are too close', async () => {
    await insertSnapshot(daysAgo(6), ['Tems']);
    await insertSnapshot(daysAgo(1), ['Ayra Starr']);

    const change = await describeTasteChange(userId);

    expect(change.available).toBe(false);
    if (change.available) return;
    expect(change.snapshotsHeld).toBe(2);
    expect(change.reason).toMatch(/not enough distance/i);
  });

  it('reports the real difference between two readings', async () => {
    await insertSnapshot(daysAgo(30), ['Tems', 'Burna Boy'], ['afrobeats']);
    await insertSnapshot(daysAgo(2), ['Tems', 'Ayra Starr'], [
      'afrobeats',
      'nigerian rnb',
    ]);

    const change = await describeTasteChange(userId);

    expect(change.available).toBe(true);
    if (!change.available) return;

    expect(change.newArtists).toEqual(['Ayra Starr']);
    expect(change.retainedArtists).toEqual(['Tems']);
    expect(change.droppedArtists).toEqual(['Burna Boy']);
    expect(change.newGenres).toEqual(['nigerian rnb']);
    expect(change.droppedGenres).toEqual([]);
    expect(change.daysApart).toBeGreaterThanOrEqual(28);

    // The wording the section asks for, derived from the diff rather than
    // generated, so it cannot claim anything the arrays do not show.
    expect(change.summary).toMatch(/usual top artists are still here/i);
    expect(change.summary).toMatch(/branching out/i);
    expect(change.summary).toContain('Ayra Starr');
    expect(change.summary).toMatch(/nigerian rnb/i);
  });

  it('reports a complete change of rotation without softening it', async () => {
    await insertSnapshot(daysAgo(40), ['Burna Boy', 'Wizkid']);
    await insertSnapshot(daysAgo(1), ['Ayra Starr', 'Fave']);

    const change = await describeTasteChange(userId);
    if (!change.available) throw new Error('expected a comparison');

    expect(change.retainedArtists).toEqual([]);
    expect(change.summary).toMatch(/Your rotation changed/i);
    expect(change.summary).toMatch(/None of the artists from/i);
  });

  it('says the rotation has been steady when nothing moved', async () => {
    await insertSnapshot(daysAgo(30), ['Tems', 'Burna Boy'], ['afrobeats']);
    await insertSnapshot(daysAgo(2), ['Tems', 'Burna Boy'], ['afrobeats']);

    const change = await describeTasteChange(userId);
    if (!change.available) throw new Error('expected a comparison');

    expect(change.newArtists).toEqual([]);
    expect(change.droppedArtists).toEqual([]);
    expect(change.summary).toMatch(/steady/i);
    expect(change.summary).toContain('2 artists are still your most played');
  });

  it('compares against the most recent reading far enough back, not the oldest', async () => {
    // A year old reading exists, but the honest comparison for "how is your
    // taste changing" is against three weeks ago.
    await insertSnapshot(daysAgo(365), ['Fela Kuti']);
    await insertSnapshot(daysAgo(21), ['Tems', 'Burna Boy']);
    await insertSnapshot(daysAgo(1), ['Tems', 'Ayra Starr']);

    const change = await describeTasteChange(userId);
    if (!change.available) throw new Error('expected a comparison');

    expect(change.droppedArtists).toEqual(['Burna Boy']);
    expect(change.newArtists).toEqual(['Ayra Starr']);
    expect(change.daysApart).toBeLessThan(30);
    expect(change.summary).not.toContain('Fela Kuti');
  });

  it('does not describe one user using another user history', async () => {
    await insertSnapshot(daysAgo(30), ['Tems']);
    await insertSnapshot(daysAgo(1), ['Ayra Starr']);

    const [stranger] = await db
      .insert(users)
      .values({
        spotifyId: 'stranger-spotify-id',
        email: 'stranger@example.com',
        displayName: 'Stranger',
      })
      .returning();

    const change = await describeTasteChange(stranger.id);

    expect(change.available).toBe(false);
    if (change.available) return;
    expect(change.snapshotsHeld).toBe(0);
  });
});

describe('formatSnapshotDate', () => {
  it('writes a real date in full', () => {
    expect(formatSnapshotDate(new Date('2026-10-07T12:00:00Z'))).toMatch(
      /2026$/
    );
    expect(formatSnapshotDate(new Date('2026-10-07T12:00:00Z'))).toContain(
      'October'
    );
  });

  it('falls back rather than printing Invalid Date', () => {
    expect(formatSnapshotDate('not a date')).toBe('an earlier date');
  });
});

describe('comparison thresholds', () => {
  it('needs a fortnight between readings', () => {
    expect(MIN_COMPARISON_GAP_MS).toBe(14 * DAY_MS);
  });
});
