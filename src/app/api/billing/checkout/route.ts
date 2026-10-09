import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  BILLING_MESSAGES,
  paymentsEnabled,
  paystackSecretKey,
  type BillingErrorCode,
} from '@/lib/billing/config';
import { PLANS, isPlanId, nairaToKobo } from '@/lib/billing/plans';
import {
  PaystackError,
  initializeTransaction,
  makeReference,
} from '@/lib/billing/paystack';

export const runtime = 'nodejs';

/**
 * Starts a Plus payment on Paystack's hosted page. Behind PAYMENTS_ENABLED:
 * while the flag is off this answers 503 PAYMENTS_DISABLED before reading
 * the body, so nothing can be charged by accident. Card details never
 * touch MUSE; the visitor is sent to Paystack and comes back to /plus with
 * a reference the webhook and the verify call confirm.
 *
 * TODO(billing): after a successful verify, record the plan against the
 * email (see entitlements.ts) and send the confirmation link.
 */

const InputSchema = z.object({
  email: z.string().trim().email().max(254),
  plan: z.string(),
});

function refuse(code: BillingErrorCode, status: number) {
  return NextResponse.json({ error: BILLING_MESSAGES[code], code }, { status });
}

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  if (!paymentsEnabled()) return refuse('PAYMENTS_DISABLED', 503);

  const rateLimited = await enforceRateLimit(request, {
    scope: 'billing:checkout',
    limit: 5,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  const secretKey = paystackSecretKey();
  if (!secretKey) return refuse('PAYMENTS_NOT_CONFIGURED', 503);

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
  if (
    !parsed.success ||
    !isPlanId(parsed.data.plan) ||
    parsed.data.plan === 'free'
  ) {
    return NextResponse.json(
      { error: 'An email address and a paid plan are required.' },
      { status: 400 },
    );
  }

  const plan = PLANS[parsed.data.plan];
  if (plan.priceNgnMonthly === null || plan.priceNgnMonthly <= 0) {
    return refuse('PRICE_NOT_SET', 503);
  }

  const origin = new URL(request.url).origin;
  try {
    const result = await initializeTransaction(
      {
        email: parsed.data.email,
        amountKobo: nairaToKobo(plan.priceNgnMonthly),
        reference: makeReference(),
        callbackUrl: `${origin}/plus?returned=1`,
        metadata: { plan: plan.id, product: 'muse-plus' },
      },
      secretKey,
    );
    return NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    });
  } catch (error) {
    if (error instanceof PaystackError)
      return refuse('PAYSTACK_UNAVAILABLE', 502);
    throw error;
  }
}
