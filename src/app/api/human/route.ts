import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  clientIpForTurnstile,
  createHumanPass,
  getTurnstileSiteKey,
  HUMAN_CHECK_FAILED_CODE,
  HUMAN_CHECK_FAILED_MESSAGE,
  HUMAN_PASS_COOKIE,
  humanPassCookieOptions,
  isTurnstileEnabled,
  verifyTurnstileToken,
} from '@/lib/security/turnstile';

export const runtime = 'nodejs';

/**
 * Turns a solved Turnstile challenge into the two hour "human pass" cookie
 * the AI routes require. When Turnstile is not configured the route says so
 * and sets nothing, so clients can skip the widget entirely.
 */
export async function GET() {
  return NextResponse.json(
    {
      enabled: isTurnstileEnabled(),
      siteKey: isTurnstileEnabled() ? getTurnstileSiteKey() : null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const rateLimited = await enforceRateLimit(request, {
    scope: 'security:human',
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  if (!isTurnstileEnabled()) {
    return NextResponse.json({ ok: true, enabled: false });
  }

  let token: unknown;
  try {
    token = ((await request.json()) as { token?: unknown })?.token;
  } catch {
    token = undefined;
  }

  const verification = await verifyTurnstileToken(
    typeof token === 'string' ? token : null,
    clientIpForTurnstile(request),
  );

  if (!verification.ok) {
    const status = verification.reason === 'unavailable' ? 503 : 403;
    if (verification.reason === 'unavailable') {
      console.warn('Turnstile verification service unavailable.');
    }
    return NextResponse.json(
      {
        error: HUMAN_CHECK_FAILED_MESSAGE,
        code: HUMAN_CHECK_FAILED_CODE,
        reason: verification.reason,
      },
      { status },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(
    HUMAN_PASS_COOKIE,
    createHumanPass(process.env.TURNSTILE_SECRET_KEY!.trim()),
    humanPassCookieOptions(process.env.NODE_ENV === 'production'),
  );
  return NextResponse.json({ ok: true, enabled: true });
}
