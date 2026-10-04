import { db } from '@/db';
import { spotifyAccounts } from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { hasSpotifyPlaybackScopes } from '@/lib/spotify-playback';
import { getSession } from '@/lib/session';
import { isSpotifyReconnectError } from '@/lib/spotify-tokens';
import {
  SpotifyPlaybackRequestError,
  spotifyService,
} from '@/lib/spotify-service';
import {
  PlaybackControlInputSchema,
  PlaybackStartResponseSchema,
} from '@/lib/validation/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function controlError(error: string, code: string, status: number) {
  return NextResponse.json(
    { error, code },
    { status, headers: { 'Cache-Control': 'no-store, private' } },
  );
}

export async function PUT(request: Request) {
  const originError = verifySameOrigin(request);
  if (originError) return originError;

  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession();
  } catch {
    console.error('Spotify playback session lookup failed.');
    return controlError(
      'Spotify playback is unavailable right now.',
      'PLAYBACK_UNAVAILABLE',
      503,
    );
  }
  if (!session) {
    return controlError(
      'Spotify connection is required.',
      'SPOTIFY_DISCONNECTED',
      401,
    );
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playback:control',
    limit: 60,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return controlError('Invalid playback request.', 'INVALID_REQUEST', 400);
  }

  const parsed = PlaybackControlInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return controlError('Invalid playback request.', 'INVALID_REQUEST', 400);
  }

  try {
    const [account] = await db
      .select()
      .from(spotifyAccounts)
      .where(eq(spotifyAccounts.userId, session.userId));

    if (!account) {
      return controlError(
        'Spotify connection is required.',
        'SPOTIFY_DISCONNECTED',
        401,
      );
    }
    if (!hasSpotifyPlaybackScopes(account.scope)) {
      return controlError(
        'Reconnect Spotify to enable playback.',
        'SPOTIFY_RECONNECT_REQUIRED',
        403,
      );
    }

    await spotifyService.controlPlayback(session.userId, parsed.data.action);
    return NextResponse.json(
      PlaybackStartResponseSchema.parse({ success: true }),
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return controlError(
        'Spotify connection expired. Please reconnect your Spotify account.',
        'SPOTIFY_RECONNECT_REQUIRED',
        401,
      );
    }

    if (error instanceof SpotifyPlaybackRequestError && error.status === 403) {
      return controlError(
        'An eligible Spotify Premium subscription is required for playback.',
        'PREMIUM_REQUIRED',
        403,
      );
    }

    if (error instanceof SpotifyPlaybackRequestError && error.status === 404) {
      return controlError(
        'Open Spotify on an active device, then try again.',
        'NO_ACTIVE_DEVICE',
        409,
      );
    }

    console.error('Spotify playback control request failed.');
    return controlError(
      'Spotify playback is unavailable right now.',
      'PLAYBACK_UNAVAILABLE',
      503,
    );
  }
}
