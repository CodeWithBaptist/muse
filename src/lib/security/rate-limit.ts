import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { withCounterStore } from './counter-store';

/**
 * Per-client, fixed-window rate limiting for API routes.
 *
 * Counters live in Upstash Redis when it is configured and in the Postgres
 * rate_limits table otherwise (see counter-store.ts). When no store can be
 * reached the request is allowed through and the failure is logged: the AI
 * routes still have the daily budget guard behind this check, and refusing
 * every visitor because a counter was unreachable would be the worse outcome.
 */

export interface RateLimitOptions {
  scope: string;
  limit: number;
  windowMs: number;
  identifier?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export const RATE_LIMITED_CODE = 'RATE_LIMITED' as const;
export const RATE_LIMITED_MESSAGE =
  'Too many requests. Please wait a moment and try again.';

/** The visitor's IP as the proxy reports it, or null when nothing reported one. */
export function clientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  return realIp || null;
}

/**
 * Counter keys never hold the raw address. The IP is hashed with the
 * server's ENCRYPTION_KEY as a pepper when one is set, so the stored key
 * cannot be turned back into an address by anyone who reads the store, and
 * two deployments with different keys do not share identifiers.
 */
export function hashClientIp(
  ip: string,
  pepper = process.env.ENCRYPTION_KEY ?? '',
): string {
  return createHash('sha256')
    .update(`${pepper}:${ip}`)
    .digest('base64url')
    .slice(0, 24);
}

export function getClientIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  const ip = clientIp(request);
  return ip ? `ip:${hashClientIp(ip)}` : 'ip:anonymous';
}

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const identifier = options.identifier ?? getClientIdentifier(request);
  const bucketKey = `${options.scope}:${identifier}`;
  const fallbackReset = new Date(Date.now() + options.windowMs);

  try {
    const hit = await withCounterStore((store) =>
      store.increment(bucketKey, 1, { windowMs: options.windowMs }),
    );
    return {
      allowed: hit.count <= options.limit,
      remaining: Math.max(0, options.limit - hit.count),
      resetAt: hit.resetAt,
    };
  } catch (error) {
    // Unit tests mock the database without rate_limits rows; production only
    // lands here when both stores are down, which is worth a log line.
    if (process.env.NODE_ENV === 'production') {
      console.warn('Rate limit store unavailable; allowing request.', {
        scope: options.scope,
        errorType: error instanceof Error ? error.name : typeof error,
      });
    }
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: fallbackReset,
    };
  }
}

export function retryAfterSeconds(resetAt: Date, now = Date.now()): number {
  return Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, options);
  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      error: RATE_LIMITED_MESSAGE,
      code: RATE_LIMITED_CODE,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds(result.resetAt)),
      },
    },
  );
}
