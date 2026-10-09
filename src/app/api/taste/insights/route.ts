import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { enforceHumanCheck } from '@/lib/security/turnstile';
import { enforceAiBudget } from '@/lib/ai/budget';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import { orchestrateSnapshotInsights } from '@/lib/ai/taste-insights';
import { TasteSnapshotSchema, tasteHasContent } from '@/lib/taste/types';

export const runtime = 'nodejs';

/**
 * "Your taste in words" for anyone: the browser posts the snapshot it holds
 * and gets the written profile back. The snapshot is read for this request
 * only. Same protections as the chat: same origin, per-IP rate limit, the
 * human check when it is on, and the daily AI budget.
 */

const InputSchema = z.object({ snapshot: TasteSnapshotSchema });

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const rateLimited = await enforceRateLimit(request, {
    scope: 'ai:profile',
    limit: 15,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const humanCheck = enforceHumanCheck(request);
  if (humanCheck) return humanCheck;

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error: AI_NOT_CONNECTED_MESSAGE,
        code: AI_NOT_CONNECTED_CODE,
        aiConnected: false,
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
  if (!parsed.success || !tasteHasContent(parsed.data.snapshot)) {
    return NextResponse.json(
      {
        error:
          'A listening snapshot with at least one artist or song is required.',
      },
      { status: 400 },
    );
  }

  // Counted after validation so malformed probes never spend the budget.
  const resting = await enforceAiBudget();
  if (resting) return resting;

  try {
    const insights = await orchestrateSnapshotInsights(parsed.data.snapshot);
    return NextResponse.json(insights);
  } catch (error) {
    if (isAINotConnectedError(error)) {
      return NextResponse.json(
        {
          error: AI_NOT_CONNECTED_MESSAGE,
          code: AI_NOT_CONNECTED_CODE,
          aiConnected: false,
        },
        { status: 503 },
      );
    }
    console.error('Taste insights failed:', error);
    return NextResponse.json(
      {
        error:
          'MUSE could not write your profile right now. Try again in a moment.',
      },
      { status: 500 },
    );
  }
}
