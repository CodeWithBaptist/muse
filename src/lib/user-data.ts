import { db } from '@/db';
import {
  conversations,
  memories,
  musicProfiles,
  playlistTracks,
  playlists,
  preferences,
  rateLimits,
  recommendations,
  sessions,
  spotifyAccounts,
  users,
} from '@/db/schema';
import { eq, inArray, like } from 'drizzle-orm';

/**
 * Delete every row MUSE holds for a user, in one transaction.
 *
 * Both the Spotify disconnect flow and full account deletion must remove the
 * same set of data. Spotify's Developer Policy requires deleting a user's
 * personal data — including the Spotify account identity MUSE stores on
 * `users` — when they disconnect, so a partial delete is a compliance bug, not
 * just a UX choice. Keeping this in one place is what stops the two routes from
 * drifting apart again.
 *
 * The user's Spotify identity is also their MUSE login (`users.spotifyId`), so
 * there is deliberately no "keep the account, drop the Spotify data" variant:
 * nothing identifiable would remain to log in with. Callers must clear the
 * session cookie afterwards.
 *
 * Children are deleted before parents, and rely on the FK cascades as a backstop
 * only, so this stays correct even against a database whose cascades are stale.
 */
export async function deleteUserAccountData(userId: string): Promise<void> {
  await db.transaction(async (transaction) => {
    // playlist_tracks has no user FK; it hangs off playlists.
    const userPlaylists = await transaction
      .select({ id: playlists.id })
      .from(playlists)
      .where(eq(playlists.userId, userId));

    if (userPlaylists.length > 0) {
      await transaction.delete(playlistTracks).where(
        inArray(
          playlistTracks.playlistId,
          userPlaylists.map(({ id }) => id),
        ),
      );
    }

    await transaction.delete(recommendations).where(eq(recommendations.userId, userId));
    await transaction.delete(memories).where(eq(memories.userId, userId));
    await transaction.delete(preferences).where(eq(preferences.userId, userId));
    await transaction.delete(musicProfiles).where(eq(musicProfiles.userId, userId));
    await transaction.delete(conversations).where(eq(conversations.userId, userId));
    await transaction.delete(playlists).where(eq(playlists.userId, userId));
    await transaction.delete(spotifyAccounts).where(eq(spotifyAccounts.userId, userId));
    await transaction.delete(sessions).where(eq(sessions.userId, userId));

    // The identity row last: spotify_id, display_name, email, and avatar_url are
    // all Spotify-derived personal data.
    await transaction.delete(users).where(eq(users.id, userId));

    await transaction.delete(rateLimits).where(like(rateLimits.key, `%:user:${userId}`));
  });
}

/**
 * Every table `deleteUserAccountData` must clear. Exported so tests can assert
 * the deletion set stays complete instead of counting delete calls, which would
 * silently tolerate a table being dropped from the list.
 */
export const USER_SCOPED_TABLES = [
  'recommendations',
  'memories',
  'preferences',
  'music_profiles',
  'conversations',
  'playlists',
  'spotify_accounts',
  'sessions',
  'users',
  // Counters keyed per user (for example `ai:chat:user:<id>`); not personal
  // data, but they are keyed by the identity being removed.
  'rate_limits',
] as const;
