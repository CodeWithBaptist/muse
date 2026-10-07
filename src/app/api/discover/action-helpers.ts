import { getSession } from '@/lib/session';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { verifySameOrigin } from '@/lib/security/csrf';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { NextResponse } from 'next/server';

/**
 * Shared plumbing for the Discover actions.
 *
 * Each of these costs several model calls and several Spotify searches, so they
 * carry the same CSRF check, rate limit, AI availability check, session check,
 * and error mapping as the rest of the API. One copy here rather than three
 * slightly different ones in three route files.
 */
export async function runDiscoverAction<T>(
  request: Request,
  options: { scope: string; limit: number; fallbackError: string },
  action: (userId: string) => Promise<T>
): Promise<NextResponse> {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const rateLimited = await enforceRateLimit(request, {
    scope: options.scope,
    limit: options.limit,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error: AI_NOT_CONNECTED_MESSAGE,
        code: AI_NOT_CONNECTED_CODE,
        aiConnected: false,
      },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return NextResponse.json(await action(session.userId));
  } catch (error: unknown) {
    if (isAINotConnectedError(error)) {
      return NextResponse.json(
        {
          error: AI_NOT_CONNECTED_MESSAGE,
          code: AI_NOT_CONNECTED_CODE,
          aiConnected: false,
        },
        { status: 503 }
      );
    }
    if (isSpotifyReconnectError(error)) {
      return NextResponse.json(
        { error: SPOTIFY_RECONNECT_MESSAGE, code: SPOTIFY_RECONNECT_CODE },
        { status: 401 }
      );
    }
    console.error('Discover action error:', error);
    return NextResponse.json({ error: options.fallbackError }, { status: 500 });
  }
}
