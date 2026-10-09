import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The thin Paystack client the checkout and webhook routes use. Server
 * only: it needs the secret key. Two calls and one check:
 *
 * - initializeTransaction: starts a payment and returns the hosted page
 *   URL the visitor is sent to (no card details ever touch MUSE).
 * - verifyTransaction: asks Paystack what happened to a reference.
 * - webhookSignatureMatches: HMAC SHA-512 of the raw body with the secret
 *   key, compared in constant time to the x-paystack-signature header.
 *
 * Never called while PAYMENTS_ENABLED is off. Timeouts are short because a
 * checkout that hangs is worse than one that says try again.
 */

export const PAYSTACK_API = 'https://api.paystack.co';
const TIMEOUT_MS = 8000;

export interface InitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface InitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export type TransactionStatus =
  'success' | 'failed' | 'abandoned' | 'pending' | 'unknown';

export interface VerifyResult {
  status: TransactionStatus;
  reference: string;
  amountKobo: number | null;
  currency: string | null;
  customerEmail: string | null;
  paidAt: string | null;
}

export class PaystackError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = 'PaystackError';
  }
}

type Fetcher = typeof fetch;

async function call<T>(
  path: string,
  init: RequestInit,
  secretKey: string,
  fetcher: Fetcher,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(`${PAYSTACK_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: T;
    } | null;
    if (!response.ok || !body?.status || body.data === undefined) {
      // The message from Paystack is safe to surface: it never echoes keys.
      throw new PaystackError(
        body?.message || `Paystack answered ${response.status}`,
        response.status,
      );
    }
    return body.data;
  } catch (error) {
    if (error instanceof PaystackError) throw error;
    throw new PaystackError(
      error instanceof Error && error.name === 'AbortError'
        ? 'Paystack timed out'
        : 'Paystack could not be reached',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function initializeTransaction(
  input: InitializeInput,
  secretKey: string,
  fetcher: Fetcher = fetch,
): Promise<InitializeResult> {
  const data = await call<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>(
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: 'NGN',
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata ?? {},
      }),
    },
    secretKey,
    fetcher,
  );
  return {
    authorizationUrl: data.authorization_url,
    accessCode: data.access_code,
    reference: data.reference,
  };
}

function asStatus(value: unknown): TransactionStatus {
  return value === 'success' ||
    value === 'failed' ||
    value === 'abandoned' ||
    value === 'pending'
    ? value
    : 'unknown';
}

export async function verifyTransaction(
  reference: string,
  secretKey: string,
  fetcher: Fetcher = fetch,
): Promise<VerifyResult> {
  const data = await call<{
    status?: string;
    reference?: string;
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    customer?: { email?: string };
  }>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: 'GET' },
    secretKey,
    fetcher,
  );
  return {
    status: asStatus(data.status),
    reference: data.reference ?? reference,
    amountKobo: typeof data.amount === 'number' ? data.amount : null,
    currency: data.currency ?? null,
    customerEmail: data.customer?.email ?? null,
    paidAt: data.paid_at ?? null,
  };
}

/** Constant-time check of x-paystack-signature against the raw request body. */
export function webhookSignatureMatches(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string,
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha512', secretKey)
    .update(rawBody, 'utf8')
    .digest('hex');
  const given = signatureHeader.trim().toLowerCase();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(
    Buffer.from(given, 'utf8'),
    Buffer.from(expected, 'utf8'),
  );
}

/** A reference Paystack accepts: letters, digits, dash, dot, underscore, equals. */
export function makeReference(prefix = 'muse'): string {
  const random = Array.from(
    crypto.getRandomValues(new Uint8Array(12)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}
