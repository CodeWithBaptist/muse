import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getClientIdentifier } from './rate-limit';

/**
 * Cloudflare Turnstile bot protection for the AI endpoints.
 *
 * Enabled only when both TURNSTILE_SECRET_KEY (server) and
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY (widget) are set; without them every helper
 * here is a no-op, so the app keeps working on deployments that have not
 * created a Turnstile site yet.
 *
 * Flow: the browser solves the (usually invisible) challenge once, posts the
 * token to /api/human, and receives a signed, HttpOnly "human pass" cookie
 * that is good for two hours. AI routes require that cookie and answer 403
 * HUMAN_CHECK_REQUIRED when it is missing or stale; the client then shows
 * the widget and retries. One challenge per couple of hours keeps chat
 * snappy while still stopping scripted abuse of the free endpoint.
 */

import {
  HUMAN_CHECK_REQUIRED_CODE,
  HUMAN_CHECK_REQUIRED_MESSAGE,
} from './turnstile-shared';

export {
  HUMAN_CHECK_FAILED_CODE,
  HUMAN_CHECK_FAILED_MESSAGE,
  HUMAN_CHECK_REQUIRED_CODE,
  HUMAN_CHECK_REQUIRED_MESSAGE,
  TURNSTILE_SCRIPT_URL,
} from './turnstile-shared';

export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export const HUMAN_PASS_COOKIE = 'muse_human';
export const HUMAN_PASS_MAX_AGE_SECONDS = 2 * 60 * 60;

type Env = Record<string, string | undefined>;

export function getTurnstileSiteKey(env: Env = process.env): string | null {
  const key = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return key ? key : null;
}

export function isTurnstileEnabled(env: Env = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim() && getTurnstileSiteKey(env));
}

export type TurnstileVerification =
  | { ok: true; hostname?: string }
  | {
      ok: false;
      reason: 'missing-token' | 'rejected' | 'unavailable';
      codes?: string[];
    };

/**
 * Asks Cloudflare whether a widget token is genuine. Network trouble is
 * reported as "unavailable" so the route can tell it apart from a bot.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string,
  options: { fetchImpl?: typeof fetch; env?: Env; timeoutMs?: number } = {},
): Promise<TurnstileVerification> {
  const secret = (options.env ?? process.env).TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true };
  if (!token || token.length > 2048)
    return { ok: false, reason: 'missing-token' };

  const fetchImpl = options.fetchImpl ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    if (!response.ok) return { ok: false, reason: 'unavailable' };
    const payload = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      'error-codes'?: string[];
    };
    if (payload.success === true)
      return { ok: true, hostname: payload.hostname };
    return {
      ok: false,
      reason: 'rejected',
      codes: payload['error-codes'] ?? [],
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

function passSecret(env: Env): string | null {
  return env.TURNSTILE_SECRET_KEY?.trim() || null;
}

function sign(issuedAt: number, secret: string): string {
  return createHmac('sha256', `${secret}:human-pass`)
    .update(String(issuedAt))
    .digest('base64url');
}

/** A cookie value proving a challenge was passed at `issuedAt`. */
export function createHumanPass(
  secret: string,
  issuedAt: number = Date.now(),
): string {
  return `${issuedAt}.${sign(issuedAt, secret)}`;
}

export function isHumanPassValid(
  value: string | null | undefined,
  secret: string,
  now: number = Date.now(),
): boolean {
  if (!value) return false;
  const [issuedRaw, signature] = value.split('.');
  const issuedAt = Number(issuedRaw);
  if (!Number.isFinite(issuedAt) || !signature) return false;
  if (issuedAt > now + 60_000) return false;
  if (now - issuedAt > HUMAN_PASS_MAX_AGE_SECONDS * 1000) return false;
  const expected = Buffer.from(sign(issuedAt, secret));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export function humanPassCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: HUMAN_PASS_MAX_AGE_SECONDS,
    path: '/',
  };
}

/**
 * For AI routes: null when Turnstile is off or the visitor holds a valid
 * pass; otherwise the 403 that tells the client to run the widget.
 */
export function enforceHumanCheck(
  request: Request,
  env: Env = process.env,
): NextResponse | null {
  if (!isTurnstileEnabled(env)) return null;
  const secret = passSecret(env)!;
  if (isHumanPassValid(readCookie(request, HUMAN_PASS_COOKIE), secret))
    return null;
  return NextResponse.json(
    { error: HUMAN_CHECK_REQUIRED_MESSAGE, code: HUMAN_CHECK_REQUIRED_CODE },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** The IP Cloudflare should compare the token against, when known. */
export function clientIpForTurnstile(request: Request): string | undefined {
  const identifier = getClientIdentifier(request);
  if (!identifier.startsWith('ip:') || identifier === 'ip:anonymous')
    return undefined;
  return identifier.slice(3);
}
