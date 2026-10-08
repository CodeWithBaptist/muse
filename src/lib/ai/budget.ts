import { NextResponse } from 'next/server';
import { withCounterStore } from '@/lib/security/counter-store';

/**
 * Daily AI budget guard.
 *
 * Two counters per Lagos day (West Africa Time, UTC+1, no daylight saving):
 * how many AI calls were made and how many tokens they used. Before a route
 * calls the model it reserves one request; when either counter is past its
 * budget the route answers with a friendly "MUSE is resting" message instead
 * of failing or quietly running up a bill. Token usage is recorded after each
 * completion from the figures the provider reports.
 *
 * Budgets come from the environment so they can be tuned without a deploy:
 *   AI_DAILY_BUDGET_REQUESTS  calls per day   (default 1500, 0 disables)
 *   AI_DAILY_BUDGET_TOKENS    tokens per day  (default 2,000,000, 0 disables)
 *
 * When the counter store is unreachable the guard allows the call and logs,
 * matching the rate limiter: a short store outage should not switch MUSE off.
 */

export const AI_RESTING_CODE = 'AI_RESTING' as const;
export const AI_RESTING_MESSAGE = 'MUSE is resting, try again soon.';

export const DEFAULT_DAILY_REQUEST_BUDGET = 1500;
export const DEFAULT_DAILY_TOKEN_BUDGET = 2_000_000;

export const BUDGET_TIME_ZONE = 'Africa/Lagos';
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export interface AiBudgetConfig {
  /** 0 means "no limit" for that counter. */
  requests: number;
  tokens: number;
}

function readBudget(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function getAiBudgetConfig(
  env: Record<string, string | undefined> = process.env,
): AiBudgetConfig {
  return {
    requests: readBudget(
      env.AI_DAILY_BUDGET_REQUESTS,
      DEFAULT_DAILY_REQUEST_BUDGET,
    ),
    tokens: readBudget(env.AI_DAILY_BUDGET_TOKENS, DEFAULT_DAILY_TOKEN_BUDGET),
  };
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUDGET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Lagos, as YYYY-MM-DD. */
export function budgetDayKey(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

/** Midnight in Lagos after `now`, when both counters start again. */
export function nextBudgetReset(now: Date = new Date()): Date {
  const [year, month, day] = budgetDayKey(now).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1) - LAGOS_OFFSET_MS);
}

function requestKey(day: string): string {
  return `ai:budget:${day}:requests`;
}

function tokenKey(day: string): string {
  return `ai:budget:${day}:tokens`;
}

export type BudgetDecision =
  { ok: true } | { ok: false; reason: 'requests' | 'tokens'; resetsAt: Date };

/**
 * Counts one AI request against today's budget and says whether it may run.
 * Call this after the per-IP rate limit and before the first model call.
 */
export async function reserveAiRequest(
  now: Date = new Date(),
): Promise<BudgetDecision> {
  const config = getAiBudgetConfig();
  if (config.requests === 0 && config.tokens === 0) return { ok: true };

  const day = budgetDayKey(now);
  const resetsAt = nextBudgetReset(now);

  try {
    const [requests, tokens] = await withCounterStore(async (store) => {
      const requestHit = await store.increment(requestKey(day), 1, {
        resetAt: resetsAt,
      });
      const tokenHit =
        config.tokens > 0 ? await store.peek(tokenKey(day)) : null;
      return [requestHit.count, tokenHit?.count ?? 0] as const;
    });

    if (config.requests > 0 && requests > config.requests) {
      return { ok: false, reason: 'requests', resetsAt };
    }
    if (config.tokens > 0 && tokens >= config.tokens) {
      return { ok: false, reason: 'tokens', resetsAt };
    }
    return { ok: true };
  } catch (error) {
    console.warn('AI budget store unavailable; allowing request.', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return { ok: true };
  }
}

/**
 * Adds the tokens a completion used to today's counter. Never throws: a
 * missed record must not fail an answer that has already been generated.
 */
export async function recordAiTokens(
  totalTokens: number,
  now: Date = new Date(),
): Promise<void> {
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return;
  const config = getAiBudgetConfig();
  if (config.tokens === 0) return;
  try {
    await withCounterStore((store) =>
      store.increment(tokenKey(budgetDayKey(now)), Math.round(totalTokens), {
        resetAt: nextBudgetReset(now),
      }),
    );
  } catch (error) {
    console.warn('Could not record AI token usage.', {
      errorType: error instanceof Error ? error.name : typeof error,
    });
  }
}

/** Today's counters, for an operator status endpoint. Null when unreadable. */
export async function readAiBudgetUsage(now: Date = new Date()): Promise<{
  day: string;
  requests: number;
  tokens: number;
  budget: AiBudgetConfig;
  resetsAt: Date;
} | null> {
  const day = budgetDayKey(now);
  try {
    const [requests, tokens] = await withCounterStore(async (store) => {
      const r = await store.peek(requestKey(day));
      const t = await store.peek(tokenKey(day));
      return [r?.count ?? 0, t?.count ?? 0] as const;
    });
    return {
      day,
      requests,
      tokens,
      budget: getAiBudgetConfig(),
      resetsAt: nextBudgetReset(now),
    };
  } catch {
    return null;
  }
}

/**
 * The response every AI route sends when the budget is spent. 503 with
 * Retry-After tells clients and crawlers this is temporary and not their
 * fault; the body carries the friendly message the UI shows as is.
 */
export function aiRestingResponse(
  decision: Extract<BudgetDecision, { ok: false }>,
): NextResponse {
  const retryAfterSeconds = Math.max(
    60,
    Math.ceil((decision.resetsAt.getTime() - Date.now()) / 1000),
  );
  return NextResponse.json(
    {
      error: AI_RESTING_MESSAGE,
      code: AI_RESTING_CODE,
      resetsAt: decision.resetsAt.toISOString(),
    },
    {
      status: 503,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** Convenience for routes: a response to return, or null to carry on. */
export async function enforceAiBudget(): Promise<NextResponse | null> {
  const decision = await reserveAiRequest();
  return decision.ok ? null : aiRestingResponse(decision);
}
