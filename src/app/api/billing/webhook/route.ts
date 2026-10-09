import { NextResponse } from 'next/server';
import {
  BILLING_MESSAGES,
  paymentsEnabled,
  paystackSecretKey,
  type BillingErrorCode,
} from '@/lib/billing/config';
import { webhookSignatureMatches } from '@/lib/billing/paystack';

export const runtime = 'nodejs';

/**
 * Paystack calls this with every event for the account. The raw body is
 * checked against x-paystack-signature before anything is parsed; a bad
 * signature is a 401 and nothing else happens. While PAYMENTS_ENABLED is
 * off the route answers 503, so a stray delivery during setup does nothing.
 *
 * TODO(billing): on charge.success, verify the reference with
 * verifyTransaction (never trust the webhook body alone), record the plan
 * for the email with the period end, and handle subscription.disable and
 * invoice.payment_failed by ending the plan at the period end. Keep this
 * idempotent: Paystack retries until it sees a 200.
 */

const HANDLED_EVENTS = new Set([
  'charge.success',
  'subscription.create',
  'subscription.disable',
  'invoice.payment_failed',
]);

function refuse(code: BillingErrorCode, status: number) {
  return NextResponse.json({ error: BILLING_MESSAGES[code], code }, { status });
}

export async function POST(request: Request) {
  if (!paymentsEnabled()) return refuse('PAYMENTS_DISABLED', 503);
  const secretKey = paystackSecretKey();
  if (!secretKey) return refuse('PAYMENTS_NOT_CONFIGURED', 503);

  const rawBody = await request.text();
  if (
    !webhookSignatureMatches(
      rawBody,
      request.headers.get('x-paystack-signature'),
      secretKey,
    )
  ) {
    return refuse('INVALID_SIGNATURE', 401);
  }

  let event: { event?: string; data?: { reference?: string } } = {};
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json(
      { error: 'Invalid webhook body.' },
      { status: 400 },
    );
  }

  const name = typeof event.event === 'string' ? event.event : 'unknown';
  if (HANDLED_EVENTS.has(name)) {
    // Event names and references are not personal data; emails and amounts are not logged.
    console.info(
      `[billing] ${name} ${event.data?.reference ?? ''} received, no handler yet`.trim(),
    );
  }

  // Always 200 for a well-formed, well-signed event, or Paystack keeps retrying.
  return NextResponse.json({ received: true, handled: false });
}
