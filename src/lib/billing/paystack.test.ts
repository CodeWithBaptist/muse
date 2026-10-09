import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  PAYSTACK_API,
  PaystackError,
  initializeTransaction,
  makeReference,
  verifyTransaction,
  webhookSignatureMatches,
} from './paystack';
import { PLANS, formatNaira, isPlanId, nairaToKobo } from './plans';
import { billingStatus, paymentsEnabled } from './config';

const SECRET = 'sk_test_0000000000000000000000000000000000000000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Paystack client', () => {
  it('starts a transaction in kobo and returns the hosted page', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: 'https://checkout.paystack.com/abc123',
          access_code: 'abc123',
          reference: 'muse_ref_1',
        },
      }),
    );
    const result = await initializeTransaction(
      {
        email: 'ada@example.com',
        amountKobo: nairaToKobo(1500),
        reference: 'muse_ref_1',
        callbackUrl: 'https://muse.example/plus/return',
        metadata: { plan: 'plus' },
      },
      SECRET,
      fetcher as unknown as typeof fetch,
    );
    expect(result.authorizationUrl).toBe(
      'https://checkout.paystack.com/abc123',
    );
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${PAYSTACK_API}/transaction/initialize`);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${SECRET}`,
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      email: 'ada@example.com',
      amount: 150000,
      currency: 'NGN',
      reference: 'muse_ref_1',
      callback_url: 'https://muse.example/plus/return',
      metadata: { plan: 'plus' },
    });
  });

  it('reads a verification and never invents a status', async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        status: true,
        data: {
          status: 'success',
          reference: 'muse_ref_1',
          amount: 150000,
          currency: 'NGN',
          paid_at: '2026-10-09T10:00:00.000Z',
          customer: { email: 'ada@example.com' },
        },
      }),
    );
    const verified = await verifyTransaction(
      'muse_ref_1',
      SECRET,
      fetcher as unknown as typeof fetch,
    );
    expect(verified).toEqual({
      status: 'success',
      reference: 'muse_ref_1',
      amountKobo: 150000,
      currency: 'NGN',
      customerEmail: 'ada@example.com',
      paidAt: '2026-10-09T10:00:00.000Z',
    });

    const odd = vi.fn(async () =>
      jsonResponse({ status: true, data: { status: 'reversed' } }),
    );
    expect(
      (await verifyTransaction('x', SECRET, odd as unknown as typeof fetch))
        .status,
    ).toBe('unknown');
  });

  it('turns Paystack failures and outages into one error type without the key', async () => {
    const failing = vi.fn(async () =>
      jsonResponse({ status: false, message: 'Invalid key' }, 401),
    );
    await expect(
      verifyTransaction('x', SECRET, failing as unknown as typeof fetch),
    ).rejects.toMatchObject({
      name: 'PaystackError',
      httpStatus: 401,
      message: 'Invalid key',
    });

    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    const error = await verifyTransaction(
      'x',
      SECRET,
      down as unknown as typeof fetch,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaystackError);
    expect(String((error as Error).message)).not.toContain(SECRET);
  });

  it('checks webhook signatures in constant time against the raw body', () => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'muse_ref_1' },
    });
    const signature = createHmac('sha512', SECRET).update(body).digest('hex');
    expect(webhookSignatureMatches(body, signature, SECRET)).toBe(true);
    expect(webhookSignatureMatches(body, signature.toUpperCase(), SECRET)).toBe(
      true,
    );
    expect(webhookSignatureMatches(body + ' ', signature, SECRET)).toBe(false);
    expect(webhookSignatureMatches(body, null, SECRET)).toBe(false);
    expect(webhookSignatureMatches(body, 'short', SECRET)).toBe(false);
    expect(webhookSignatureMatches(body, signature, 'sk_test_other')).toBe(
      false,
    );
  });

  it('makes references Paystack accepts', () => {
    const reference = makeReference();
    expect(reference).toMatch(/^muse_[a-z0-9]+_[0-9a-f]{24}$/);
    expect(makeReference()).not.toBe(reference);
  });
});

describe('plans and the flag', () => {
  it('is off unless PAYMENTS_ENABLED is exactly "true", and the status carries no key', () => {
    expect(paymentsEnabled({})).toBe(false);
    expect(paymentsEnabled({ PAYMENTS_ENABLED: '1' })).toBe(false);
    expect(paymentsEnabled({ PAYMENTS_ENABLED: 'true' })).toBe(true);
    const status = billingStatus({
      PAYMENTS_ENABLED: 'true',
      PAYSTACK_SECRET_KEY: 'sk_live_abc',
    });
    expect(status).toEqual({
      enabled: true,
      configured: true,
      provider: 'paystack',
      currency: 'NGN',
      live: true,
    });
    expect(JSON.stringify(status)).not.toContain('sk_live_abc');
    expect(billingStatus({}).configured).toBe(false);
  });

  it("keeps Free at today's behaviour and Plus without a price until the owner sets one", () => {
    expect(PLANS.free.priceNgnMonthly).toBe(0);
    expect(PLANS.free.limits.songsPerList).toBe(12);
    expect(PLANS.plus.priceNgnMonthly).toBeNull();
    expect(formatNaira(PLANS.plus.priceNgnMonthly)).toBe(
      'price to be announced',
    );
    expect(formatNaira(1500)).toBe('NGN 1,500');
    expect(nairaToKobo(1500)).toBe(150000);
    expect(isPlanId('plus')).toBe(true);
    expect(isPlanId('gold')).toBe(false);
  });

  it('describes no Plus benefit in terms of Spotify', () => {
    const text = JSON.stringify(PLANS.plus).toLowerCase();
    expect(text).not.toContain('spotify');
  });
});
