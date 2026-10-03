import { getSession } from '@/lib/session';
import { orchestrateProfileInsights } from '@/lib/ai/profile-engine';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  isSpotifyReconnectError,
  SPOTIFY_RECONNECT_CODE,
  SPOTIFY_RECONNECT_MESSAGE,
} from '@/lib/spotify-tokens';
import { ProfileInsightsResponseSchema } from '@/lib/validation/api-schemas';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request?: Request) {
  if (request) {
    const rateLimited = await enforceRateLimit(request, {
      scope: 'ai:profile',
      limit: 15,
      windowMs: 60_000,
    });
    if (rateLimited) return rateLimited;
  }

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
    const data = await orchestrateProfileInsights(session.userId);
    const validated = ProfileInsightsResponseSchema.parse(data);
    return NextResponse.json(validated);
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
    console.error('Profile API Error:', error);
    return NextResponse.json(
      { error: 'Unable to load profile insights right now.' },
      { status: 500 }
    );
  }
}
