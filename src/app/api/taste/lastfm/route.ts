import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  LASTFM_ERROR_MESSAGES,
  LastfmError,
  fetchLastfmTaste,
  isLastfmConfigured,
} from '@/lib/taste/lastfm';

export const runtime = 'nodejs';

/**
 * Turns a public Last.fm username into a taste snapshot for the browser
 * that asked. No account, no storage: the username is used for the three
 * Last.fm calls and forgotten, the key stays on the server, and the
 * snapshot lives on the device. Rate limited per IP because every call
 * spends Last.fm quota.
 */

const InputSchema = z.object({
  username: z.string().trim().min(1).max(40),
});

const STATUS_FOR: Record<LastfmError['code'], number> = {
  LASTFM_NOT_CONFIGURED: 503,
  LASTFM_USER_NOT_FOUND: 404,
  LASTFM_PRIVATE: 422,
  LASTFM_UNAVAILABLE: 502,
};

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const rateLimited = await enforceRateLimit(request, {
    scope: 'taste:lastfm',
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  if (!isLastfmConfigured()) {
    return NextResponse.json(
      {
        error: LASTFM_ERROR_MESSAGES.LASTFM_NOT_CONFIGURED,
        code: 'LASTFM_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }
  const parsed = InputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A Last.fm username is required.' },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchLastfmTaste(parsed.data.username);
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof LastfmError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: STATUS_FOR[error.code] },
      );
    }
    console.error('Last.fm import failed:', error);
    return NextResponse.json(
      {
        error: LASTFM_ERROR_MESSAGES.LASTFM_UNAVAILABLE,
        code: 'LASTFM_UNAVAILABLE',
      },
      { status: 502 },
    );
  }
}
