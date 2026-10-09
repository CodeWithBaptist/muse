import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  isTesterKey,
  signTesterPass,
  spotifyAccessMode,
  TESTER_COOKIE,
  testerCookieOptions,
} from '@/lib/testers';

export const runtime = 'nodejs';

const InputSchema = z.object({ key: z.string().trim().min(1).max(200) });

/**
 * Exchanges a tester key for the tester pass cookie. Small limit per IP so
 * the key cannot be guessed, and no difference in timing between a wrong
 * key and a disabled feature beyond the status code.
 */
export async function POST(request: Request) {
  const csrf = verifySameOrigin(request);
  if (csrf) return csrf;

  const limited = await enforceRateLimit(request, {
    scope: 'security:tester',
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) return limited;

  if (spotifyAccessMode() !== 'key') {
    return NextResponse.json(
      {
        error: 'Tester access is not enabled.',
        code: 'TESTER_ACCESS_DISABLED',
      },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success || !isTesterKey(parsed.data.key)) {
    return NextResponse.json(
      { error: 'That tester key is not right.', code: 'TESTER_KEY_INVALID' },
      { status: 403 },
    );
  }

  const pass = signTesterPass();
  if (!pass) {
    return NextResponse.json(
      {
        error: 'Tester access is not enabled.',
        code: 'TESTER_ACCESS_DISABLED',
      },
      { status: 403 },
    );
  }
  const store = await cookies();
  store.set(TESTER_COOKIE, pass, testerCookieOptions());
  return NextResponse.json({ ok: true });
}
