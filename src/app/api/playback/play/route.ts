import { db } from '@/db';
import { spotifyAccounts } from '@/db/schema';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import { hasSpotifyPlaybackScopes } from '@/lib/spotify-playback';
import { getSession } from '@/lib/session';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import {
  SpotifyPlaybackRequestError,
  spotifyService,
} from '@/lib/spotify-service';
import {
  PlaybackStartInputSchema,
  PlaybackStartResponseSchema,
} from '@/lib/validation/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeError(error: string, code: string, status: number) {
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
    return safeError(
      'Spotify playback is unavailable right now.',
      'PLAYBACK_UNAVAILABLE',
      503,
    );
  }
  if (!session) {
    return safeError(
      'Spotify connection is required.',
      'SPOTIFY_DISCONNECTED',
      401,
    );
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'playback:start',
    limit: 30,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return safeError('Invalid playback request.', 'INVALID_REQUEST', 400);
  }

  const parsedBody = PlaybackStartInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return safeError('Invalid playback request.', 'INVALID_REQUEST', 400);
  }

  try {
    const [account] = await db
      .select()
      .from(spotifyAccounts)
      .where(eq(spotifyAccounts.userId, session.userId));

    if (!account) {
      return safeError(
        'Spotify connection is required.',
        'SPOTIFY_DISCONNECTED',
        401,
      );
    }
    if (!hasSpotifyPlaybackScopes(account.scope)) {
      return safeError(
        'Reconnect Spotify to enable playback.',
        'SPOTIFY_RECONNECT_REQUIRED',
        403,
      );
    }

    const deviceResponse = (await spotifyService.getAvailableDevices(
      session.userId,
    )) as {
      devices?: Array<{
        id?: string | null;
        is_active?: boolean;
        is_restricted?: boolean;
      }>;
    };
    const activeDevice = deviceResponse.devices?.find(
      (device) =>
        device.is_active &&
        !device.is_restricted &&
        typeof device.id === 'string',
    );

    if (!activeDevice?.id) {
      return safeError(
        'Open Spotify on an active device, then try again.',
        'NO_ACTIVE_DEVICE',
        409,
      );
    }

    await spotifyService.startPlayback(
      session.userId,
      parsedBody.data.trackUri,
      activeDevice.id,
    );

    return NextResponse.json(
      PlaybackStartResponseSchema.parse({ success: true }),
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error: unknown) {
    if (isSpotifyReconnectError(error)) {
      return safeError(SPOTIFY_RECONNECT_MESSAGE, SPOTIFY_RECONNECT_CODE, 401);
    }

    if (error instanceof SpotifyPlaybackRequestError && error.status === 403) {
      return safeError(
        'An eligible Spotify Premium subscription is required for playback.',
        'PREMIUM_REQUIRED',
        403,
      );
    }

    if (error instanceof SpotifyPlaybackRequestError && error.status === 404) {
      return safeError(
        'Open Spotify on an active device, then try again.',
        'NO_ACTIVE_DEVICE',
        409,
      );
    }

    console.error('Spotify playback request failed.');
    return safeError(
      'Spotify could not start playback. Open this track in Spotify.',
      'PLAYBACK_FAILED',
      502,
    );
  }
}
