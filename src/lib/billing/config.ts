/**
 * Billing is a scaffold behind one flag. With PAYMENTS_ENABLED anything but
 * "true", every billing route answers 503 PAYMENTS_DISABLED, nothing calls
 * Paystack, and the page says so. Keys are read on the server only.
 */

export type BillingErrorCode =
  | 'PAYMENTS_DISABLED'
  | 'PAYMENTS_NOT_CONFIGURED'
  | 'PRICE_NOT_SET'
  | 'PAYSTACK_UNAVAILABLE'
  | 'INVALID_SIGNATURE';

export const BILLING_MESSAGES: Record<BillingErrorCode, string> = {
  PAYMENTS_DISABLED: 'Plus is not open yet. Nothing is charged.',
  PAYMENTS_NOT_CONFIGURED:
    'Payments are switched on but the Paystack keys are missing.',
  PRICE_NOT_SET: 'The Plus price has not been set, so checkout cannot start.',
  PAYSTACK_UNAVAILABLE:
    'Paystack did not answer. Nothing was charged. Try again in a moment.',
  INVALID_SIGNATURE: 'The webhook signature did not match.',
};

type Env = Record<string, string | undefined>;

export function paymentsEnabled(env: Env = process.env): boolean {
  return env.PAYMENTS_ENABLED === 'true';
}

export function paystackSecretKey(env: Env = process.env): string | null {
  const key = env.PAYSTACK_SECRET_KEY?.trim();
  return key ? key : null;
}

export function paystackConfigured(env: Env = process.env): boolean {
  return paystackSecretKey(env) !== null;
}

export interface BillingStatus {
  enabled: boolean;
  configured: boolean;
  provider: 'paystack';
  currency: 'NGN';
  /** True only for live keys; test keys start with sk_test_. */
  live: boolean;
}

/** Safe to send to the browser: no key material, only whether things are on. */
export function billingStatus(env: Env = process.env): BillingStatus {
  const key = paystackSecretKey(env);
  return {
    enabled: paymentsEnabled(env),
    configured: key !== null,
    provider: 'paystack',
    currency: 'NGN',
    live: key?.startsWith('sk_live_') ?? false,
  };
}
