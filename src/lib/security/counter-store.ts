import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * Fixed-window counters shared by the per-IP rate limiter and the daily AI
 * budget guard.
 *
 * Two stores implement the same contract. Upstash Redis is used when
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set: one REST call,
 * no connection pool, works on Vercel functions. Otherwise the existing
 * Postgres rate_limits table is used, so nothing new has to be provisioned
 * for the app to stay protected.
 *
 * Both increments are atomic: Redis through a small Lua script, Postgres
 * through a single INSERT ... ON CONFLICT statement.
 */

export interface CounterHit {
  /** Value of the counter after this increment, inside the current window. */
  count: number;
  /** When the current window ends and the counter starts again from zero. */
  resetAt: Date;
}

export type CounterWindow =
  /** The window starts at the first hit and lasts this long. */
  | { windowMs: number }
  /** The window ends at a fixed moment, for example midnight in Lagos. */
  | { resetAt: Date };

export interface CounterStore {
  readonly name: 'upstash' | 'postgres';
  increment(
    key: string,
    amount: number,
    window: CounterWindow,
  ): Promise<CounterHit>;
  /** Reads a counter without changing it. Null when there is no live window. */
  peek(key: string): Promise<CounterHit | null>;
}

/** The subset of the Upstash client the store needs; tests inject a fake. */
export interface RedisLike {
  eval<TData = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<TData>;
}

const KEY_PREFIX = 'muse:counter:';

function windowEndMs(window: CounterWindow, now: number): number {
  return 'resetAt' in window ? window.resetAt.getTime() : now + window.windowMs;
}

/*
 * INCRBY, then attach the expiry only when this call created the key, so a
 * busy window keeps its original end. Returns the count and the remaining
 * time to live in milliseconds.
 */
const INCREMENT_SCRIPT = `
local count = redis.call('INCRBY', KEYS[1], tonumber(ARGV[1]))
if count == tonumber(ARGV[1]) then
  redis.call('PEXPIREAT', KEYS[1], tonumber(ARGV[2]))
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

const PEEK_SCRIPT = `
local value = redis.call('GET', KEYS[1])
if not value then
  return { 0, -2 }
end
return { tonumber(value), redis.call('PTTL', KEYS[1]) }
`;

export function createUpstashCounterStore(redis: RedisLike): CounterStore {
  return {
    name: 'upstash',
    async increment(key, amount, window) {
      const now = Date.now();
      const endMs = windowEndMs(window, now);
      const [count, ttl] = await redis.eval<[number, number]>(
        INCREMENT_SCRIPT,
        [KEY_PREFIX + key],
        [amount, endMs],
      );
      const resetAt = ttl > 0 ? new Date(now + ttl) : new Date(endMs);
      return { count: Number(count), resetAt };
    },
    async peek(key) {
      const now = Date.now();
      const [count, ttl] = await redis.eval<[number, number]>(
        PEEK_SCRIPT,
        [KEY_PREFIX + key],
        [],
      );
      if (ttl <= 0) return null;
      return { count: Number(count), resetAt: new Date(now + ttl) };
    },
  };
}

let tableInitialized = false;

async function ensureRateLimitTable(): Promise<void> {
  if (tableInitialized) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rate_limits (
      key text PRIMARY KEY,
      count integer NOT NULL DEFAULT 1,
      reset_at timestamp NOT NULL
    )
  `);
  tableInitialized = true;
}

type CounterRow = { count: number | string; reset_at: string | Date };

function rowsOf(result: unknown): CounterRow[] | undefined {
  return (result as { rows?: CounterRow[] } | undefined)?.rows;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export class CounterStoreUnavailableError extends Error {
  constructor(message = 'No counter store is available') {
    super(message);
    this.name = 'CounterStoreUnavailableError';
  }
}

export function createPostgresCounterStore(): CounterStore {
  return {
    name: 'postgres',
    async increment(key, amount, window) {
      if (typeof db.execute !== 'function')
        throw new CounterStoreUnavailableError();
      const now = Date.now();
      const endIso = new Date(windowEndMs(window, now)).toISOString();
      await ensureRateLimitTable();
      const result = await db.execute(sql`
        INSERT INTO rate_limits (key, count, reset_at)
        VALUES (${key}, ${amount}, ${endIso}::timestamp)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN rate_limits.reset_at <= NOW() THEN ${amount}
            ELSE rate_limits.count + ${amount}
          END,
          reset_at = CASE
            WHEN rate_limits.reset_at <= NOW() THEN ${endIso}::timestamp
            ELSE rate_limits.reset_at
          END
        RETURNING count, reset_at
      `);
      const row = rowsOf(result)?.[0];
      if (!row)
        throw new CounterStoreUnavailableError(
          'Counter upsert returned no row',
        );
      return { count: Number(row.count), resetAt: toDate(row.reset_at) };
    },
    async peek(key) {
      if (typeof db.execute !== 'function')
        throw new CounterStoreUnavailableError();
      await ensureRateLimitTable();
      const result = await db.execute(sql`
        SELECT count, reset_at FROM rate_limits
        WHERE key = ${key} AND reset_at > NOW()
      `);
      const row = rowsOf(result)?.[0];
      if (!row) return null;
      return { count: Number(row.count), resetAt: toDate(row.reset_at) };
    },
  };
}

export function isUpstashConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() && env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

let upstashStore: CounterStore | null = null;
let postgresStore: CounterStore | null = null;

async function loadUpstashStore(): Promise<CounterStore> {
  if (upstashStore) return upstashStore;
  // Loaded on demand so deployments without Upstash never pay for the client.
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!.trim(),
    token: process.env.UPSTASH_REDIS_REST_TOKEN!.trim(),
  });
  upstashStore = createUpstashCounterStore(redis);
  return upstashStore;
}

export function getPostgresCounterStore(): CounterStore {
  postgresStore ??= createPostgresCounterStore();
  return postgresStore;
}

/** Upstash when configured, otherwise Postgres. */
export async function getCounterStore(): Promise<CounterStore> {
  if (isUpstashConfigured()) return loadUpstashStore();
  return getPostgresCounterStore();
}

/**
 * Runs `operation` against the preferred store and, when Upstash fails, once
 * more against Postgres. Throws only when every available store failed, so
 * callers decide between failing open and failing closed.
 */
export async function withCounterStore<T>(
  operation: (store: CounterStore) => Promise<T>,
): Promise<T> {
  const store = await getCounterStore();
  try {
    return await operation(store);
  } catch (error) {
    if (store.name !== 'upstash') throw error;
    console.warn('Upstash counter store failed; falling back to Postgres.', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return operation(getPostgresCounterStore());
  }
}

/** Test hook: forget cached clients so a new environment is picked up. */
export function resetCounterStoresForTests(): void {
  upstashStore = null;
  postgresStore = null;
  tableInitialized = false;
}
