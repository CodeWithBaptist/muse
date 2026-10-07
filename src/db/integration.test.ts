// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { and, asc, eq, like } from 'drizzle-orm';
import {
  conversations,
  memories,
  messages,
  musicProfiles,
  playlistTracks,
  playlists,
  preferences,
  rateLimits,
  recommendations,
  sessions,
  spotifyAccounts,
  users,
} from './schema';
import {
  createTestDatabase,
  listTables,
  seedUser,
  type TestDatabaseHandle,
} from '@/test/database';

/**
 * Database behaviour, verified against a real engine.
 *
 * Every assertion here is about what PostgreSQL does rather than what the
 * application assumes it does. Several of them exist because reading the code
 * was not enough: the cascade rules, the retention behaviour on disconnect, and
 * the timestamp ordering that refinement depends on are all properties of the
 * database, and none of them had ever been executed before this suite.
 */

let handle: TestDatabaseHandle;
let db: TestDatabaseHandle['db'];

// Booting an engine and running the migration costs about two seconds, so doing
// it per test made the suite take twenty. One engine is created for the file and
// emptied between tests instead. TRUNCATE runs against the real engine, so the
// foreign keys and cascade rules these tests assert are still the real ones.
beforeAll(async () => {
  handle = await createTestDatabase();
  db = handle.db;
}, 60_000);

beforeEach(async () => {
  await handle.client.exec(
    `TRUNCATE TABLE users, sessions, spotify_accounts, music_profiles,
       conversations, messages, playlists, playlist_tracks, recommendations,
       preferences, rate_limits, memories RESTART IDENTITY CASCADE`
  );
});

afterAll(async () => {
  await handle.close();
});

/** One row in every table that hangs off a user, for cascade assertions. */
async function seedFullAccount() {
  const user = await seedUser(db);

  const [session] = await db
    .insert(sessions)
    .values({
      id: `session-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();

  const [spotifyAccount] = await db
    .insert(spotifyAccounts)
    .values({
      userId: user.id,
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'user-read-private',
    })
    .returning();

  await db.insert(musicProfiles).values({
    userId: user.id,
    topArtists: ['Burna Boy'],
    topGenres: ['afrobeats'],
    preferredEnergy: 'medium',
  });

  const [conversation] = await db
    .insert(conversations)
    .values({ userId: user.id, title: 'Late night' })
    .returning();

  await db.insert(messages).values([
    { conversationId: conversation.id, role: 'user', content: 'Late night Afrobeats.' },
    { conversationId: conversation.id, role: 'assistant', content: 'Here is a start.' },
  ]);

  await db.insert(recommendations).values([
    { userId: user.id, conversationId: conversation.id, spotifyTrackId: 'track-1', reason: 'r' },
    { userId: user.id, conversationId: conversation.id, spotifyTrackId: 'track-2', reason: 'r' },
  ]);

  const [playlist] = await db
    .insert(playlists)
    .values({ userId: user.id, name: 'Late night drive' })
    .returning();

  await db.insert(playlistTracks).values({
    playlistId: playlist.id,
    spotifyTrackId: 'track-1',
    position: 0,
    title: 'Night Drive',
    artist: 'Ayra Starr',
    durationMs: 200_000,
  });

  await db.insert(preferences).values({
    userId: user.id,
    key: 'discoveryStyle',
    value: 'deep_cuts',
    source: 'explicit',
  });

  await db.insert(memories).values({
    userId: user.id,
    key: 'favoured artist',
    value: 'Tems',
    source: 'explicit',
  });

  return { user, session, spotifyAccount, conversation, playlist };
}

async function countAll(userId: string) {
  const [
    sessionRows,
    spotifyRows,
    profileRows,
    conversationRows,
    recommendationRows,
    playlistRows,
    preferenceRows,
    memoryRows,
  ] = await Promise.all([
    db.select().from(sessions).where(eq(sessions.userId, userId)),
    db.select().from(spotifyAccounts).where(eq(spotifyAccounts.userId, userId)),
    db.select().from(musicProfiles).where(eq(musicProfiles.userId, userId)),
    db.select().from(conversations).where(eq(conversations.userId, userId)),
    db.select().from(recommendations).where(eq(recommendations.userId, userId)),
    db.select().from(playlists).where(eq(playlists.userId, userId)),
    db.select().from(preferences).where(eq(preferences.userId, userId)),
    db.select().from(memories).where(eq(memories.userId, userId)),
  ]);

  const messageRows = conversationRows.length
    ? await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationRows[0].id))
    : [];
  const trackRows = playlistRows.length
    ? await db
        .select()
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistRows[0].id))
    : [];

  return {
    sessions: sessionRows.length,
    spotifyAccounts: spotifyRows.length,
    musicProfiles: profileRows.length,
    conversations: conversationRows.length,
    messages: messageRows.length,
    recommendations: recommendationRows.length,
    playlists: playlistRows.length,
    playlistTracks: trackRows.length,
    preferences: preferenceRows.length,
    memories: memoryRows.length,
  };
}

describe('committed migrations', () => {
  it('creates exactly the twelve tables the schema declares', async () => {
    const tables = await listTables(handle.client);

    expect(tables.sort()).toEqual(
      [
        'conversations',
        'memories',
        'messages',
        'music_profiles',
        'playlist_tracks',
        'playlists',
        'preferences',
        'rate_limits',
        'recommendations',
        'sessions',
        'spotify_accounts',
        'users',
      ].sort()
    );
  });

  it('enforces the unique index that memory upserts depend on', async () => {
    const user = await seedUser(db);

    await db.insert(memories).values({
      userId: user.id,
      key: 'favoured artist',
      value: 'Tems',
      source: 'explicit',
    });

    // The memory route upserts on this pair, so a second write with the same
    // key must update rather than insert.
    await db
      .insert(memories)
      .values({
        userId: user.id,
        key: 'favoured artist',
        value: 'Ayra Starr',
        source: 'explicit',
      })
      .onConflictDoUpdate({
        target: [memories.userId, memories.key],
        set: { value: 'Ayra Starr' },
      });

    const rows = await db.select().from(memories).where(eq(memories.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('Ayra Starr');
  });
});

describe('account deletion', () => {
  it('removes every related row through the cascades the route relies on', async () => {
    const { user } = await seedFullAccount();

    // This is all DELETE /api/me/account does to the database, besides playlist
    // tracks. It depends entirely on the cascade rules being what the schema says.
    await db.delete(users).where(eq(users.id, user.id));

    const counts = await countAll(user.id);
    expect(counts).toEqual({
      sessions: 0,
      spotifyAccounts: 0,
      musicProfiles: 0,
      conversations: 0,
      messages: 0,
      recommendations: 0,
      playlists: 0,
      playlistTracks: 0,
      preferences: 0,
      memories: 0,
    });
  });

  it('clears only the rate limit buckets belonging to that user', async () => {
    const { user } = await seedFullAccount();

    await db.insert(rateLimits).values([
      { key: `account:delete:user:${user.id}`, count: 1, resetAt: new Date() },
      { key: `ai:chat:user:${user.id}`, count: 4, resetAt: new Date() },
      { key: 'ai:chat:203.0.113.7', count: 9, resetAt: new Date() },
    ]);

    // The limiter writes keys as scope:identifier, and the route deletes with
    // this pattern. If either side changed format the buckets would leak.
    await db.delete(rateLimits).where(like(rateLimits.key, `%:user:${user.id}`));

    const remaining = await db.select().from(rateLimits);
    expect(remaining.map((row) => row.key)).toEqual(['ai:chat:203.0.113.7']);
  });
});

describe('Spotify disconnect retention', () => {
  it('deletes Spotify derived data and keeps data the user entered themselves', async () => {
    const { user, conversation, playlist } = await seedFullAccount();

    // The same sequence DELETE /api/me/spotify runs, in the same order.
    await db.transaction(async (transaction) => {
      await transaction.delete(recommendations).where(eq(recommendations.userId, user.id));
      await transaction.delete(musicProfiles).where(eq(musicProfiles.userId, user.id));
      await transaction.delete(conversations).where(eq(conversations.userId, user.id));
      await transaction.delete(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id));
      await transaction.delete(playlists).where(eq(playlists.userId, user.id));
      await transaction.delete(spotifyAccounts).where(eq(spotifyAccounts.userId, user.id));
    });

    const counts = await countAll(user.id);

    // Everything Spotify gave MUSE is gone.
    expect(counts.spotifyAccounts).toBe(0);
    expect(counts.recommendations).toBe(0);
    expect(counts.musicProfiles).toBe(0);
    expect(counts.conversations).toBe(0);
    expect(counts.messages).toBe(0);
    expect(counts.playlists).toBe(0);
    expect(counts.playlistTracks).toBe(0);

    // What survives is the MUSE identity, the session, and data the user typed.
    // This is the retention gap recorded as D-003 and disclosed in the privacy
    // draft. The test pins the behaviour so changing it is a deliberate act.
    expect(counts.sessions).toBe(1);
    expect(counts.preferences).toBe(1);
    expect(counts.memories).toBe(1);

    const [remainingUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(remainingUser?.spotifyId).toBe(user.spotifyId);
    expect(remainingUser?.email).toBe(user.email);

    // The conversation is gone, so the retained memory is the only trace left.
    const orphaned = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.conversationId, conversation.id));
    expect(orphaned).toHaveLength(0);
  });
});

describe('conversation deletion and orphaned recommendations', () => {
  it('leaves nothing behind when the route deletes recommendations itself', async () => {
    const { user, conversation } = await seedFullAccount();

    // The exact sequence DELETE /api/chat/[id] runs.
    await db.delete(messages).where(eq(messages.conversationId, conversation.id));
    await db.delete(recommendations).where(eq(recommendations.conversationId, conversation.id));
    await db.delete(conversations).where(eq(conversations.id, conversation.id));

    const remaining = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));
    expect(remaining).toHaveLength(0);
  });

  it('orphans recommendations if that explicit delete is ever removed', async () => {
    const { user, conversation } = await seedFullAccount();

    // No live route does this. It documents what the set null foreign key
    // would do if the explicit delete above were dropped in a refactor, so the
    // behaviour is known rather than discovered later.
    await db.delete(conversations).where(eq(conversations.id, conversation.id));

    const remaining = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.userId, user.id));

    expect(remaining).toHaveLength(2);
    expect(remaining.every((row) => row.conversationId === null)).toBe(true);
  });
});

describe('message ordering behind refinement context', () => {
  it('gives messages written together one identical timestamp', async () => {
    const user = await seedUser(db);
    const [conversation] = await db
      .insert(conversations)
      .values({ userId: user.id, title: 'Late night' })
      .returning();

    await db.insert(messages).values([
      { conversationId: conversation.id, role: 'user', content: 'turn-A' },
      { conversationId: conversation.id, role: 'user', content: 'turn-B' },
      { conversationId: conversation.id, role: 'user', content: 'turn-C' },
    ]);

    const rows = await db
      .select({ createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));

    const stamps = rows.map((row) => row.createdAt.getTime());
    // now() is the transaction timestamp, so a multi-row insert ties. Ordering
    // by created_at alone cannot break that tie, which is why the chat route
    // reads the conversation before storing the current turn instead of
    // identifying the newest row afterwards.
    expect(new Set(stamps).size).toBe(1);
  });

  it('returns earlier turns without the current one when read before insert', async () => {
    const user = await seedUser(db);
    const [conversation] = await db
      .insert(conversations)
      .values({ userId: user.id, title: 'Late night' })
      .returning();

    await db.insert(messages).values([
      { conversationId: conversation.id, role: 'user', content: 'Late night Afrobeats.' },
      { conversationId: conversation.id, role: 'assistant', content: 'Here is a start.' },
      { conversationId: conversation.id, role: 'user', content: 'Less mainstream.' },
    ]);

    // Read first, then store the current turn, as the route now does.
    const prior = await db
      .select({ content: messages.content })
      .from(messages)
      .where(
        and(eq(messages.conversationId, conversation.id), eq(messages.role, 'user'))
      )
      .orderBy(asc(messages.createdAt))
      .limit(24);

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: 'No Burna Boy.',
    });

    expect(prior.map((row) => row.content)).toEqual([
      'Late night Afrobeats.',
      'Less mainstream.',
    ]);
  });

  it('orders turns correctly when they arrive as separate requests', async () => {
    const user = await seedUser(db);
    const [conversation] = await db
      .insert(conversations)
      .values({ userId: user.id, title: 'Late night' })
      .returning();

    const turns = ['first', 'second', 'third'];
    for (const [index, content] of turns.entries()) {
      await db.insert(messages).values({
        conversationId: conversation.id,
        role: 'user',
        content,
        // Distinct timestamps, which is what real usage produces.
        createdAt: new Date(Date.now() + index * 1000),
      });
    }

    const rows = await db
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt));

    expect(rows.map((row) => row.content)).toEqual(turns);
  });
});

describe('refinement shown-track lookup', () => {
  it('returns the tracks already recommended in this conversation only', async () => {
    const user = await seedUser(db);

    const [first] = await db
      .insert(conversations)
      .values({ userId: user.id, title: 'First' })
      .returning();
    const [second] = await db
      .insert(conversations)
      .values({ userId: user.id, title: 'Second' })
      .returning();

    await db.insert(recommendations).values([
      { userId: user.id, conversationId: first.id, spotifyTrackId: 'track-1' },
      { userId: user.id, conversationId: first.id, spotifyTrackId: 'track-2' },
      { userId: user.id, conversationId: second.id, spotifyTrackId: 'track-3' },
    ]);

    const shown = await db
      .select({ spotifyTrackId: recommendations.spotifyTrackId })
      .from(recommendations)
      .where(
        and(
          eq(recommendations.conversationId, first.id),
          eq(recommendations.userId, user.id)
        )
      )
      .limit(400);

    // Scoped to the conversation, so a new conversation starts fresh rather
    // than inheriting the exclusions of an unrelated one.
    expect(shown.map((row) => row.spotifyTrackId).sort()).toEqual([
      'track-1',
      'track-2',
    ]);
  });
});
