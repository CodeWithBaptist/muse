import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The budget guard must count per Lagos day, stop at either budget, answer
 * with the friendly resting message, and never take MUSE down when the
 * counter store itself is unavailable.
 */

const store = vi.hoisted(() => ({
  counters: new Map<string, { count: number; resetAt: Date }>(),
  failing: false,
  increment: vi.fn(),
  peek: vi.fn(),
}));

vi.mock('@/lib/security/counter-store', () => ({
  withCounterStore: async (operation: (s: unknown) => Promise<unknown>) => {
    if (store.failing) throw new Error('store down');
    return operation({
      name: 'postgres',
      increment: async (
        key: string,
        amount: number,
        window: { resetAt: Date },
      ) => {
        store.increment(key, amount, window);
        const entry = store.counters.get(key);
        const next = entry
          ? { ...entry, count: entry.count + amount }
          : { count: amount, resetAt: window.resetAt };
        store.counters.set(key, next);
        return next;
      },
      peek: async (key: string) => {
        store.peek(key);
        return store.counters.get(key) ?? null;
      },
    });
  },
}));

import {
  AI_RESTING_CODE,
  AI_RESTING_MESSAGE,
  aiRestingResponse,
  budgetDayKey,
  DEFAULT_DAILY_REQUEST_BUDGET,
  DEFAULT_DAILY_TOKEN_BUDGET,
  enforceAiBudget,
  getAiBudgetConfig,
  nextBudgetReset,
  readAiBudgetUsage,
  recordAiTokens,
  reserveAiRequest,
} from './budget';

const originalEnv = { ...process.env };

describe('Lagos day boundaries', () => {
  it('rolls the day over at midnight West Africa Time, not UTC', () => {
    // 23:30 UTC on 1 March is already 00:30 on 2 March in Lagos.
    const lateUtc = new Date('2026-03-01T23:30:00Z');
    expect(budgetDayKey(lateUtc)).toBe('2026-03-02');
    expect(nextBudgetReset(lateUtc).toISOString()).toBe(
      '2026-03-02T23:00:00.000Z',
    );

    const morning = new Date('2026-03-01T09:00:00Z');
    expect(budgetDayKey(morning)).toBe('2026-03-01');
    expect(nextBudgetReset(morning).toISOString()).toBe(
      '2026-03-01T23:00:00.000Z',
    );
  });
});

describe('budget configuration', () => {
  it('defaults, reads the environment, and treats zero as no limit', () => {
    expect(getAiBudgetConfig({})).toEqual({
      requests: DEFAULT_DAILY_REQUEST_BUDGET,
      tokens: DEFAULT_DAILY_TOKEN_BUDGET,
    });
    expect(
      getAiBudgetConfig({
        AI_DAILY_BUDGET_REQUESTS: '10',
        AI_DAILY_BUDGET_TOKENS: '0',
      }),
    ).toEqual({
      requests: 10,
      tokens: 0,
    });
    expect(
      getAiBudgetConfig({ AI_DAILY_BUDGET_REQUESTS: 'many' }).requests,
    ).toBe(DEFAULT_DAILY_REQUEST_BUDGET);
  });
});

describe('reserveAiRequest', () => {
  beforeEach(() => {
    store.counters.clear();
    store.failing = false;
    store.increment.mockClear();
    store.peek.mockClear();
    process.env.AI_DAILY_BUDGET_REQUESTS = '2';
    process.env.AI_DAILY_BUDGET_TOKENS = '1000';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('allows calls up to the request budget and then rests until the Lagos reset', async () => {
    const now = new Date('2026-03-01T09:00:00Z');
    expect(await reserveAiRequest(now)).toEqual({ ok: true });
    expect(await reserveAiRequest(now)).toEqual({ ok: true });
    const third = await reserveAiRequest(now);
    expect(third).toEqual({
      ok: false,
      reason: 'requests',
      resetsAt: new Date('2026-03-01T23:00:00Z'),
    });
    expect(store.increment).toHaveBeenCalledWith(
      'ai:budget:2026-03-01:requests',
      1,
      {
        resetAt: new Date('2026-03-01T23:00:00Z'),
      },
    );
  });

  it('rests once recorded tokens reach the token budget', async () => {
    const now = new Date('2026-03-01T09:00:00Z');
    await recordAiTokens(400, now);
    await recordAiTokens(600, now);
    expect(store.counters.get('ai:budget:2026-03-01:tokens')?.count).toBe(1000);
    expect(await reserveAiRequest(now)).toMatchObject({
      ok: false,
      reason: 'tokens',
    });
  });

  it('ignores token usage that is not a positive number', async () => {
    await recordAiTokens(0);
    await recordAiTokens(Number.NaN);
    await recordAiTokens(-5);
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('skips the store entirely when both budgets are disabled', async () => {
    process.env.AI_DAILY_BUDGET_REQUESTS = '0';
    process.env.AI_DAILY_BUDGET_TOKENS = '0';
    expect(await reserveAiRequest()).toEqual({ ok: true });
    expect(store.increment).not.toHaveBeenCalled();
  });

  it('allows the call and warns when the counter store is unreachable', async () => {
    store.failing = true;
    expect(await reserveAiRequest()).toEqual({ ok: true });
    await recordAiTokens(10);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(await readAiBudgetUsage()).toBeNull();
  });

  it('reports usage for an operator', async () => {
    const now = new Date('2026-03-01T09:00:00Z');
    await reserveAiRequest(now);
    await recordAiTokens(42, now);
    expect(await readAiBudgetUsage(now)).toEqual({
      day: '2026-03-01',
      requests: 1,
      tokens: 42,
      budget: { requests: 2, tokens: 1000 },
      resetsAt: new Date('2026-03-01T23:00:00Z'),
    });
  });
});

describe('resting response', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    store.counters.clear();
  });

  it('is a 503 with Retry-After and the friendly message', async () => {
    const resetsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const response = aiRestingResponse({
      ok: false,
      reason: 'requests',
      resetsAt,
    });
    expect(response.status).toBe(503);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(7000);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      error: AI_RESTING_MESSAGE,
      code: AI_RESTING_CODE,
      resetsAt: resetsAt.toISOString(),
    });
    expect(AI_RESTING_MESSAGE).toBe('MUSE is resting, try again soon.');
  });

  it('enforceAiBudget returns null while there is budget and the response when not', async () => {
    process.env.AI_DAILY_BUDGET_REQUESTS = '1';
    process.env.AI_DAILY_BUDGET_TOKENS = '0';
    expect(await enforceAiBudget()).toBeNull();
    const resting = await enforceAiBudget();
    expect(resting?.status).toBe(503);
  });
});
