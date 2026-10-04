import { db } from '@/db';
import {
  conversations,
  memories,
  messages,
  musicProfiles,
  playlistTracks,
  playlists,
  preferences,
  recommendations,
  spotifyAccounts,
  users,
} from '@/db/schema';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { getSession } from '@/lib/session';
import { asc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'account:export',
    limit: 5,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  try {
    const [user] = await db
      .select({
        id: users.id,
        spotifyId: users.spotifyId,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, session.userId));

    if (!user) {
      return NextResponse.json(
        { error: 'Account not found.' },
        { status: 404 },
      );
    }

    const [spotifyConnection, musicProfile] = await Promise.all([
      db
        .select({
          scope: spotifyAccounts.scope,
          expiresAt: spotifyAccounts.expiresAt,
          connectedAt: spotifyAccounts.createdAt,
          updatedAt: spotifyAccounts.updatedAt,
        })
        .from(spotifyAccounts)
        .where(eq(spotifyAccounts.userId, session.userId))
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(musicProfiles)
        .where(eq(musicProfiles.userId, session.userId))
        .then((rows) => rows[0] ?? null),
    ]);

    const [
      savedPreferences,
      savedMemories,
      userConversations,
      userPlaylists,
      userRecommendations,
    ] = await Promise.all([
      db
        .select({
          key: preferences.key,
          value: preferences.value,
          confidence: preferences.confidence,
          source: preferences.source,
          updatedAt: preferences.updatedAt,
        })
        .from(preferences)
        .where(eq(preferences.userId, session.userId)),
      db
        .select({
          id: memories.id,
          key: memories.key,
          value: memories.value,
          confidence: memories.confidence,
          source: memories.source,
          createdAt: memories.createdAt,
          updatedAt: memories.updatedAt,
        })
        .from(memories)
        .where(eq(memories.userId, session.userId)),
      db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, session.userId))
        .orderBy(asc(conversations.createdAt)),
      db
        .select()
        .from(playlists)
        .where(eq(playlists.userId, session.userId))
        .orderBy(asc(playlists.createdAt)),
      db
        .select()
        .from(recommendations)
        .where(eq(recommendations.userId, session.userId))
        .orderBy(asc(recommendations.createdAt)),
    ]);

    const conversationIds = userConversations.map(
      (conversation) => conversation.id,
    );
    const playlistIds = userPlaylists.map((playlist) => playlist.id);
    const [conversationMessages, savedTracks] = await Promise.all([
      conversationIds.length > 0
        ? db
            .select()
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds))
            .orderBy(asc(messages.createdAt))
        : Promise.resolve([]),
      playlistIds.length > 0
        ? db
            .select()
            .from(playlistTracks)
            .where(inArray(playlistTracks.playlistId, playlistIds))
            .orderBy(asc(playlistTracks.position))
        : Promise.resolve([]),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      spotifyConnection: spotifyConnection
        ? {
            scopes: spotifyConnection.scope.split(/\s+/).filter(Boolean),
            connectedAt: spotifyConnection.connectedAt,
            expiresAt: spotifyConnection.expiresAt,
            updatedAt: spotifyConnection.updatedAt,
          }
        : null,
      musicProfile,
      preferences: savedPreferences,
      memories: savedMemories,
      conversations: userConversations.map((conversation) => ({
        ...conversation,
        messages: conversationMessages.filter(
          (message) => message.conversationId === conversation.id,
        ),
        recommendations: userRecommendations.filter(
          (recommendation) => recommendation.conversationId === conversation.id,
        ),
      })),
      playlists: userPlaylists.map((playlist) => ({
        ...playlist,
        tracks: savedTracks.filter((track) => track.playlistId === playlist.id),
      })),
      recommendations: userRecommendations,
    };

    return NextResponse.json(exportData, {
      headers: {
        'Cache-Control': 'no-store, private, max-age=0',
        'Content-Disposition': 'attachment; filename="muse-data-export.json"',
        Pragma: 'no-cache',
      },
    });
  } catch {
    console.error('Account data export failed.');
    return NextResponse.json(
      { error: 'Unable to export account data right now.' },
      { status: 500 },
    );
  }
}
