// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { asc, eq } from 'drizzle-orm';

/**
 * Route handlers driven end to end against a real PostgreSQL engine.
 *
 * The database suite verifies what the schema does. This verifies what the
 * handlers do with it: ownership checks, session handling, transaction order,
 * and the exact rows each deletion path leaves behind. Both matter, because the
 * handlers are where those behaviours are actually decided.
 *
 * No production code is changed to make this possible. `@/db` is mocked with a
 * getter that resolves at call time, and `next/headers` is mocked to present a
 * session cookie, so the real `getSession` runs against the real sessions
 * table. Requests are built without an Origin header, which the CSRF guard
 * treats as a non-browser caller and allows through.
 */

const state = vi.hoisted(() => ({
  db: undefined as never,
  sessionId: 'integration-session-id',
}));

vi.mock('@/db', () => ({
  get db() {
    return state.db;
  },
  pool: {},
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'muse_session' ? { value: state.sessionId } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

// The AI pipeline is mocked here on purpose. These tests are about what reaches
// the database and what the handlers return, not about model behaviour, which
// src/lib/ai/refinement.test.ts covers separately.
vi.mock('@/lib/ai/provider', () => ({
  AI_NOT_CONNECTED_CODE: 'AI_NOT_CONNECTED',
  AI_NOT_CONNECTED_MESSAGE: 'AI is not connected yet',
  chatCompletion: vi.fn(),
  chatCompletionStream: vi.fn(),
  isAIConfigured: () => true,
  isAINotConnectedError: () => false,
  sanitizePromptInput: (value: string) => value,
}));

vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemoryForPrompt: vi.fn().mockResolvedValue([]),
  formatUserMemoryContext: vi.fn().mockReturnValue(''),
}));

const orchestrateRecommendations = vi.hoisted(() => vi.fn());
const extractChatIntent = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/recommendation-engine', () => ({
  orchestrateRecommendations,
  extractChatIntent,
}));

import {
  createTestDatabase,
  seedUser,
  type TestDatabaseHandle,
} from '@/test/database';
import {
  conversations,
  memories,
  messages,
  musicProfiles,
  playlistTracks,
  playlists,
  preferences,
  recommendations,
  sessions,
  spotifyAccounts,
  users,
} from '@/db/schema';
import { DELETE as deleteConversation } from '@/app/api/chat/[id]/route';
import { POST as postChat } from '@/app/api/chat/route';
import { DELETE as disconnectSpotify } from '@/app/api/me/spotify/route';
import { DELETE as deleteAccount } from '@/app/api/me/account/route';
import { PATCH as patchPlaylist } from '@/app/api/playlists/[id]/route';

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
    `TRUNCATE TABLE users, sessions, spotify_accounts, music_profiles,
       conversations, messages, playlists, playlist_tracks, recommendations,
       preferences, rate_limits, memories RESTART IDENTITY CASCADE`
  );
  vi.clearAllMocks();

  state.sessionId = 'integration-session-id';
  const user = await seedUser(db);
  userId = user.id;
  await db.insert(sessions).values({
    id: state.sessionId,
    userId,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
});

afterAll(async () => {
  await handle.close();
});

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
}

describe('DELETE /api/chat/[id]', () => {
  it('removes the conversation, its messages, and its recommendations', async () => {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: 'Late night' })
      .returning();

    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: 'Late night Afrobeats.',
    });
    await db.insert(recommendations).values({
      userId,
      conversationId: conversation.id,
      spotifyTrackId: 'track-1',
      reason: 'Fits the request.',
    });

    const response = await deleteConversation(
      jsonRequest(`/api/chat/${conversation.id}`, 'DELETE'),
      { params: Promise.resolve({ id: conversation.id }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    expect(
      await db.select().from(recommendations).where(eq(recommendations.userId, userId))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
    ).toHaveLength(0);
    expect(
      await db.select().from(conversations).where(eq(conversations.id, conversation.id))
    ).toHaveLength(0);
  });

  it('refuses another user\'s conversation and leaves it intact', async () => {
    const other = await seedUser(db);
    const [theirs] = await db
      .insert(conversations)
      .values({ userId: other.id, title: 'Theirs' })
      .returning();

    const response = await deleteConversation(
      jsonRequest(`/api/chat/${theirs.id}`, 'DELETE'),
      { params: Promise.resolve({ id: theirs.id }) }
    );

    expect(response.status).toBe(404);
    expect(
      await db.select().from(conversations).where(eq(conversations.id, theirs.id))
    ).toHaveLength(1);
  });

  it('rejects a malformed conversation id before touching the database', async () => {
    const response = await deleteConversation(
      jsonRequest('/api/chat/not-a-uuid', 'DELETE'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
  });

  it('rejects a request whose session does not exist', async () => {
    state.sessionId = 'no-such-session';

    const id = '11111111-1111-4111-8111-111111111111';
    const response = await deleteConversation(jsonRequest(`/api/chat/${id}`, 'DELETE'), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(401);
  });
});

describe('POST /api/chat refinement context', () => {
  it('passes earlier turns and shown tracks, without the current message', async () => {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: 'Late night' })
      .returning();

    await db.insert(messages).values([
      { conversationId: conversation.id, role: 'user', content: 'Late night Afrobeats.' },
      { conversationId: conversation.id, role: 'assistant', content: 'Here is a start.' },
      { conversationId: conversation.id, role: 'user', content: 'Less mainstream.' },
    ]);
    await db.insert(recommendations).values([
      {
        userId,
        conversationId: conversation.id,
        spotifyTrackId: 'shown-1',
        reason: 'Fits the request.',
        title: 'Night Drive',
        artist: 'Ayra Starr',
        albumName: 'A',
        albumArtUrl: 'https://i.scdn.co/image/a',
        durationMs: 200000,
      },
      {
        userId,
        conversationId: conversation.id,
        spotifyTrackId: 'shown-2',
        reason: 'Fits the request.',
        title: 'Lagos After Dark',
        artist: 'Odumodublvck',
        albumName: 'B',
        albumArtUrl: null,
        durationMs: 190000,
      },
    ]);

    extractChatIntent.mockResolvedValue({
      intent: 'discover',
      isDiscovery: true,
      isPlaylistRequest: false,
      reasoning: 'test',
    });
    orchestrateRecommendations.mockResolvedValue({
      message: 'Here is what changed.',
      tracks: [{ id: 'new-1', name: 'Night Drive', artists: [{ name: 'Ayra Starr' }] }],
      refinement: {
        summary: 'Less mainstream, still late night.',
        excludedArtists: [],
        excludedGenres: [],
        avoided: ['too mainstream'],
        newTracks: 1,
        droppedAlreadyShown: 2,
        droppedExcludedArtist: 0,
      },
    });

    const response = await postChat(
      jsonRequest('/api/chat', 'POST', {
        content: 'No Burna Boy.',
        conversationId: conversation.id,
        // Deliberately out of screen order, plus an id MUSE never recommended.
        currentSelectionIds: ['shown-2', 'shown-1', 'never-recommended'],
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.refinement?.summary).toBe('Less mainstream, still late night.');

    expect(orchestrateRecommendations).toHaveBeenCalledTimes(1);
    const [calledUserId, calledMessage, calledContext] =
      orchestrateRecommendations.mock.calls[0];

    expect(calledUserId).toBe(userId);
    expect(calledMessage).toBe('No Burna Boy.');

    // The point of reading before the insert: the current turn is not in the
    // prior turns, and nothing depends on timestamp ordering to achieve that.
    expect(calledContext.priorUserMessages).toEqual([
      'Late night Afrobeats.',
      'Less mainstream.',
    ]);
    // Metadata comes back with the shown tracks, so a surviving row can be
    // re-rendered without another Spotify call.
    expect(calledContext.shownTracks).toEqual([
      {
        id: 'shown-1',
        title: 'Night Drive',
        artist: 'Ayra Starr',
        albumName: 'A',
        albumArtUrl: 'https://i.scdn.co/image/a',
        durationMs: 200000,
      },
      {
        id: 'shown-2',
        title: 'Lagos After Dark',
        artist: 'Odumodublvck',
        albumName: 'B',
        albumArtUrl: null,
        durationMs: 190000,
      },
    ]);

    // The current selection follows the client's screen order, and the id MUSE
    // never recommended to this user is dropped rather than trusted.
    expect(calledContext.currentSelection.map((track: { id: string }) => track.id)).toEqual([
      'shown-2',
      'shown-1',
    ]);

    // The turn is stored, and so is what it recommended.
    const stored = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id));
    expect(stored.map((row) => row.content)).toContain('No Burna Boy.');

    const newRecs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.conversationId, conversation.id));
    expect(newRecs.map((row) => row.spotifyTrackId).sort()).toEqual([
      'new-1',
      'shown-1',
      'shown-2',
    ]);
  });

  it('passes no context on the first turn of a new conversation', async () => {
    extractChatIntent.mockResolvedValue({
      intent: 'discover',
      isDiscovery: true,
      isPlaylistRequest: false,
      reasoning: 'test',
    });
    orchestrateRecommendations.mockResolvedValue({
      message: 'Here is a start.',
      tracks: [],
    });

    const response = await postChat(
      jsonRequest('/api/chat', 'POST', { content: 'Late night Afrobeats.' })
    );

    expect(response.status).toBe(200);
    const [, , calledContext] = orchestrateRecommendations.mock.calls[0];
    expect(calledContext).toBeNull();
  });

  it('refuses a conversation belonging to someone else', async () => {
    const other = await seedUser(db);
    const [theirs] = await db
      .insert(conversations)
      .values({ userId: other.id, title: 'Theirs' })
      .returning();

    const response = await postChat(
      jsonRequest('/api/chat', 'POST', {
        content: 'Late night Afrobeats.',
        conversationId: theirs.id,
      })
    );

    expect(response.status).toBe(404);
    expect(orchestrateRecommendations).not.toHaveBeenCalled();
  });

  it('rejects an empty message before reaching the database', async () => {
    const response = await postChat(
      jsonRequest('/api/chat', 'POST', { content: '   ' })
    );

    expect(response.status).toBe(400);
    expect(orchestrateRecommendations).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/me/spotify', () => {
  it('deletes Spotify derived rows and keeps identity, memories, and preferences', async () => {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: 'Late night' })
      .returning();
    const [playlist] = await db
      .insert(playlists)
      .values({ userId, name: 'Late night drive' })
      .returning();

    await db.insert(spotifyAccounts).values({
      userId,
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'user-read-private',
    });
    await db.insert(musicProfiles).values({ userId, topArtists: ['Burna Boy'] });
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: 'Late night Afrobeats.',
    });
    await db.insert(recommendations).values({
      userId,
      conversationId: conversation.id,
      spotifyTrackId: 'track-1',
    });
    await db.insert(playlistTracks).values({
      playlistId: playlist.id,
      spotifyTrackId: 'track-1',
      position: 0,
      title: 'Night Drive',
      artist: 'Ayra Starr',
      durationMs: 200_000,
    });
    await db.insert(preferences).values({
      userId,
      key: 'discoveryStyle',
      value: 'deep_cuts',
      source: 'explicit',
    });
    await db.insert(memories).values({
      userId,
      key: 'favoured artist',
      value: 'Tems',
      source: 'explicit',
    });

    const response = await disconnectSpotify(jsonRequest('/api/me/spotify', 'DELETE'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    expect(
      await db.select().from(spotifyAccounts).where(eq(spotifyAccounts.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(musicProfiles).where(eq(musicProfiles.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(conversations).where(eq(conversations.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(recommendations).where(eq(recommendations.userId, userId))
    ).toHaveLength(0);
    expect(await db.select().from(playlists).where(eq(playlists.userId, userId))).toHaveLength(0);
    expect(
      await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id))
    ).toHaveLength(0);

    // The retention D-003 describes, produced by the real handler rather than
    // by a transcription of it.
    expect(
      await db.select().from(preferences).where(eq(preferences.userId, userId))
    ).toHaveLength(1);
    expect(await db.select().from(memories).where(eq(memories.userId, userId))).toHaveLength(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(1);
    expect(await db.select().from(users).where(eq(users.id, userId))).toHaveLength(1);

    expect(
      await db.select().from(messages).where(eq(messages.conversationId, conversation.id))
    ).toHaveLength(0);
  });

  it('succeeds for a user who has nothing stored yet', async () => {
    const response = await disconnectSpotify(jsonRequest('/api/me/spotify', 'DELETE'));
    expect(response.status).toBe(200);
  });
});

describe('DELETE /api/me/account', () => {
  it('removes the account and every related row', async () => {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: 'Late night' })
      .returning();
    const [playlist] = await db
      .insert(playlists)
      .values({ userId, name: 'Late night drive' })
      .returning();

    await db.insert(spotifyAccounts).values({
      userId,
      accessToken: 'encrypted-access',
      refreshToken: 'encrypted-refresh',
      expiresAt: new Date(Date.now() + 3_600_000),
      scope: 'user-read-private',
    });
    await db.insert(messages).values({
      conversationId: conversation.id,
      role: 'user',
      content: 'Late night Afrobeats.',
    });
    await db.insert(recommendations).values({
      userId,
      conversationId: conversation.id,
      spotifyTrackId: 'track-1',
    });
    await db.insert(playlistTracks).values({
      playlistId: playlist.id,
      spotifyTrackId: 'track-1',
      position: 0,
      title: 'Night Drive',
      artist: 'Ayra Starr',
      durationMs: 200_000,
    });
    await db.insert(preferences).values({
      userId,
      key: 'discoveryStyle',
      value: 'deep_cuts',
      source: 'explicit',
    });
    await db.insert(memories).values({
      userId,
      key: 'favoured artist',
      value: 'Tems',
      source: 'explicit',
    });

    const response = await deleteAccount(jsonRequest('/api/me/account', 'DELETE'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    // Unlike disconnect, nothing about this user survives.
    expect(await db.select().from(users).where(eq(users.id, userId))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
    expect(
      await db.select().from(spotifyAccounts).where(eq(spotifyAccounts.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(conversations).where(eq(conversations.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(messages).where(eq(messages.conversationId, conversation.id))
    ).toHaveLength(0);
    expect(
      await db.select().from(recommendations).where(eq(recommendations.userId, userId))
    ).toHaveLength(0);
    expect(
      await db.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlist.id))
    ).toHaveLength(0);
    expect(
      await db.select().from(preferences).where(eq(preferences.userId, userId))
    ).toHaveLength(0);
    expect(await db.select().from(memories).where(eq(memories.userId, userId))).toHaveLength(0);
  });

  it('leaves other users untouched', async () => {
    const other = await seedUser(db);
    await db.insert(memories).values({
      userId: other.id,
      key: 'favoured artist',
      value: 'Tems',
      source: 'explicit',
    });

    const response = await deleteAccount(jsonRequest('/api/me/account', 'DELETE'));
    expect(response.status).toBe(200);

    expect(await db.select().from(users).where(eq(users.id, other.id))).toHaveLength(1);
    expect(
      await db.select().from(memories).where(eq(memories.userId, other.id))
    ).toHaveLength(1);
  });
});

describe('playlist reorder', () => {
  async function createPlaylistWithTracks(count: number) {
    const [playlist] = await db
      .insert(playlists)
      .values({ userId, name: 'Night drive' })
      .returning();

    await db.insert(playlistTracks).values(
      Array.from({ length: count }, (_, index) => ({
        playlistId: playlist.id,
        spotifyTrackId: `track-${index}`,
        position: index,
        title: `Track ${index}`,
        artist: 'Ayra Starr',
        durationMs: 200_000,
      }))
    );

    return playlist;
  }

  async function storedOrder(playlistId: string) {
    const rows = await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(asc(playlistTracks.position));
    return rows.map((row) => row.spotifyTrackId);
  }

  it('persists the new order', async () => {
    const playlist = await createPlaylistWithTracks(3);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-2', 'track-0', 'track-1'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(200);
    expect(await storedOrder(playlist.id)).toEqual([
      'track-2',
      'track-0',
      'track-1',
    ]);
  });

  it('rejects an order that drops a track, and leaves the order alone', async () => {
    const playlist = await createPlaylistWithTracks(3);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-2', 'track-0'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(400);
    expect(await storedOrder(playlist.id)).toEqual([
      'track-0',
      'track-1',
      'track-2',
    ]);
  });

  it('rejects a duplicated track in the order', async () => {
    const playlist = await createPlaylistWithTracks(3);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-0', 'track-0', 'track-1'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(400);
  });

  it('scopes the permutation check to the playlist being patched', async () => {
    const playlist = await createPlaylistWithTracks(2);
    const other = await createPlaylistWithTracks(2);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-1', 'track-0'],
      }),
      { params: Promise.resolve({ id: other.id }) }
    );

    // Both playlists happen to hold track-0 and track-1, so this checks the
    // handler scopes the permutation test to the playlist being patched rather
    // than to any track the user owns.
    expect(response.status).toBe(200);
    expect(await storedOrder(other.id)).toEqual(['track-1', 'track-0']);
    expect(await storedOrder(playlist.id)).toEqual(['track-0', 'track-1']);
  });

  it('accepts uris that arrive with the spotify:track: prefix', async () => {
    const playlist = await createPlaylistWithTracks(2);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['spotify:track:track-1', 'spotify:track:track-0'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(200);
    expect(await storedOrder(playlist.id)).toEqual(['track-1', 'track-0']);
  });

  it('returns 404 when the playlist belongs to another user', async () => {
    const playlist = await createPlaylistWithTracks(2);

    // A second user with their own session, so the ownership check is exercised
    // rather than assumed. Patching as the owner would prove nothing.
    const stranger = await seedUser(db, { email: 'stranger@example.com' });
    await db.insert(sessions).values({
      id: 'stranger-session-id',
      userId: stranger.id,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    state.sessionId = 'stranger-session-id';

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-1', 'track-0'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(404);
    expect(await storedOrder(playlist.id)).toEqual(['track-0', 'track-1']);
  });

  it('rejects an order naming a track this playlist does not have', async () => {
    const playlist = await createPlaylistWithTracks(2);

    const response = await patchPlaylist(
      jsonRequest(`/api/playlists/${playlist.id}`, 'PATCH', {
        trackOrder: ['track-1', 'somewhere-else'],
      }),
      { params: Promise.resolve({ id: playlist.id }) }
    );

    expect(response.status).toBe(400);
    expect(await storedOrder(playlist.id)).toEqual(['track-0', 'track-1']);
  });
});
