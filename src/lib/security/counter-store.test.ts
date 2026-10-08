import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbExecute = vi.fn();

vi.mock('@/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockDbExecute(...args),
  },
}));

import {
  createPostgresCounterStore,
  createUpstashCounterStore,
  getCounterStore,
  isUpstashConfigured,
  resetCounterStoresForTests,
  type RedisLike,
} from './counter-store';

/** In-memory Redis that understands exactly the two scripts the store sends. */
function fakeRedis(now: () => number) {
  const values = new Map<string, { count: number; expiresAt: number }>();
  const calls: Array<{ keys: string[]; args: (string | number)[] }> = [];
  const redis: RedisLike = {
    async eval(script, keys, args) {
      calls.push({ keys, args });
      const key = keys[0];
      const entry = values.get(key);
      const live = entry && entry.expiresAt > now() ? entry : undefined;
      if (script.includes('INCRBY')) {
        const amount = Number(args[0]);
        const next = live
          ? { ...live, count: live.count + amount }
          : { count: amount, expiresAt: Number(args[1]) };
        values.set(key, next);
        return [next.count, next.expiresAt - now()] as never;
      }
      if (!live) return [0, -2] as never;
      return [live.count, live.expiresAt - now()] as never;
    },
  };
  return { redis, calls, values };
}

describe('Upstash counter store', () => {
  let current = 1_000_000;
  const now = () => current;

  beforeEach(() => {
    current = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('counts inside a window that starts at the first hit and keeps its end', async () => {
    const { redis, calls } = fakeRedis(now);
    const store = createUpstashCounterStore(redis);

    const first = await store.increment('ai:chat:ip:1', 1, {
      windowMs: 60_000,
    });
    expect(first.count).toBe(1);
    expect(first.resetAt.getTime()).toBe(1_060_000);

    current += 10_000;
    const second = await store.increment('ai:chat:ip:1', 1, {
      windowMs: 60_000,
    });
    expect(second.count).toBe(2);
    expect(second.resetAt.getTime()).toBe(1_060_000);

    expect(calls[0].keys).toEqual(['muse:counter:ai:chat:ip:1']);
  });

  it('starts over once the window has passed', async () => {
    const { redis } = fakeRedis(now);
    const store = createUpstashCounterStore(redis);
    await store.increment('k', 1, { windowMs: 1_000 });
    current += 2_000;
    const hit = await store.increment('k', 1, { windowMs: 1_000 });
    expect(hit.count).toBe(1);
  });

  it('supports a fixed window end and amounts larger than one', async () => {
    const { redis } = fakeRedis(now);
    const store = createUpstashCounterStore(redis);
    const resetAt = new Date(1_500_000);
    const hit = await store.increment('budget', 250, { resetAt });
    expect(hit.count).toBe(250);
    expect(hit.resetAt.getTime()).toBe(1_500_000);
    const peeked = await store.peek('budget');
    expect(peeked).toEqual({ count: 250, resetAt });
  });

  it('peeks null when nothing is counted yet', async () => {
    const { redis } = fakeRedis(now);
    const store = createUpstashCounterStore(redis);
    expect(await store.peek('nothing')).toBeNull();
  });
});

describe('Postgres counter store', () => {
  beforeEach(() => {
    mockDbExecute.mockReset();
    resetCounterStoresForTests();
  });

  it('upserts atomically and reads the row the database returns', async () => {
    const resetAt = new Date(Date.now() + 30_000).toISOString();
    mockDbExecute.mockResolvedValue({
      rows: [{ count: '3', reset_at: resetAt }],
    });
    const store = createPostgresCounterStore();

    const hit = await store.increment('ai:chat:ip:2', 1, { windowMs: 60_000 });
    expect(hit).toEqual({ count: 3, resetAt: new Date(resetAt) });
    // CREATE TABLE IF NOT EXISTS once, then the upsert.
    expect(mockDbExecute).toHaveBeenCalledTimes(2);

    await store.increment('ai:chat:ip:2', 1, { windowMs: 60_000 });
    expect(mockDbExecute).toHaveBeenCalledTimes(3);
  });

  it('peeks the live row only', async () => {
    mockDbExecute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const store = createPostgresCounterStore();
    expect(await store.peek('budget')).toBeNull();
  });

  it('throws when the upsert returns nothing, so callers can decide what to do', async () => {
    mockDbExecute.mockResolvedValue({ rows: [] });
    const store = createPostgresCounterStore();
    await expect(store.increment('k', 1, { windowMs: 1 })).rejects.toThrow(
      'Counter upsert returned no row',
    );
  });
});

describe('store selection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    resetCounterStoresForTests();
  });

  it('uses Postgres unless both Upstash variables are present', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(isUpstashConfigured()).toBe(false);
    expect((await getCounterStore()).name).toBe('postgres');

    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    expect(isUpstashConfigured()).toBe(false);

    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    expect(isUpstashConfigured()).toBe(true);
    expect((await getCounterStore()).name).toBe('upstash');
  });
});
