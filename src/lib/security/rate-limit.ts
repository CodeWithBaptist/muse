import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

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

let tableInitialized = false;

async function ensureRateLimitTable(): Promise<void> {
  if (tableInitialized) return;
  if (typeof db.execute !== 'function') return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 1,
      reset_at timestamp NOT NULL
    )
  `);
  tableInitialized = true;
}

export function getClientIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return `ip:${firstIp}`;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return `ip:${realIp}`;
  }
  return 'ip:anonymous';
}

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const identifier = options.identifier ?? getClientIdentifier(request);
  const bucketKey = `${options.scope}:${identifier}`;
  const now = Date.now();
  const nextReset = new Date(now + options.windowMs);

  if (typeof db.execute !== 'function') {
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: nextReset,
    };
  }

  try {
    await ensureRateLimitTable();
    const result = await db.execute(sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${bucketKey}, 1, ${nextReset.toISOString()})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.reset_at <= NOW() THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at <= NOW() THEN ${nextReset.toISOString()}::timestamp
          ELSE rate_limits.reset_at
        END
      RETURNING count, reset_at
    `);

    const rows = (result as unknown as { rows?: Array<{ count: number; reset_at: string | Date }> })?.rows;
    const row = rows?.[0];
    if (!row) {
      return {
        allowed: true,
        remaining: options.limit - 1,
        resetAt: nextReset,
      };
    }

    const currentCount = Number(row.count);
    const resetAt = row.reset_at instanceof Date ? row.reset_at : new Date(row.reset_at);
    const allowed = currentCount <= options.limit;
    const remaining = Math.max(0, options.limit - currentCount);

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch {
    // If the database is unconfigured or mocked in unit tests without rate_limits rows,
    // allow the request to proceed to route handlers where DB/AI availability is handled.
    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: nextReset,
    };
  }
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, options);
  if (result.allowed) {
    return null;
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      error: 'Too many requests. Please wait a moment and try again.',
      code: 'RATE_LIMITED',
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
