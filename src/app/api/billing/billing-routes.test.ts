import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const limits = vi.hoisted(() => ({ enforce: vi.fn(async () => null) }));
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => limits.enforce(...(args as [])),
}));

import { POST as checkout } from './checkout/route';
import { POST as webhook } from './webhook/route';
import { GET as status } from './status/route';

const SECRET = 'sk_test_1111111111111111111111111111111111111111';
const ORIGIN = 'https://muse.example';

function post(
  path: string,
  body: string,
  headers: Record<string, string> = {},
) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body,
  });
}

describe('billing routes behind PAYMENTS_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    limits.enforce.mockClear();
  });

  it('answers 503 PAYMENTS_DISABLED everywhere while the flag is off, and never calls Paystack', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('PAYMENTS_ENABLED', 'false');
    vi.stubEnv('PAYSTACK_SECRET_KEY', SECRET);

    const checkoutResponse = await checkout(
      post(
        '/api/billing/checkout',
        JSON.stringify({ email: 'ada@example.com', plan: 'plus' }),
      ),
    );
    expect(checkoutResponse.status).toBe(503);
    expect(await checkoutResponse.json()).toMatchObject({
      code: 'PAYMENTS_DISABLED',
    });

    const webhookResponse = await webhook(post('/api/billing/webhook', '{}'));
    expect(webhookResponse.status).toBe(503);

    const statusBody = await status().json();
    expect(statusBody.status).toMatchObject({
      enabled: false,
      configured: true,
      live: false,
    });
    expect(JSON.stringify(statusBody)).not.toContain(SECRET);
    expect(fetcher).not.toHaveBeenCalled();
    expect(limits.enforce).not.toHaveBeenCalled();
  });

  it('refuses checkout without a price even when the flag and key are on', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('PAYMENTS_ENABLED', 'true');
    vi.stubEnv('PAYSTACK_SECRET_KEY', SECRET);

    const bad = await checkout(
      post('/api/billing/checkout', JSON.stringify({ email: 'nope' })),
    );
    expect(bad.status).toBe(400);

    const free = await checkout(
      post(
        '/api/billing/checkout',
        JSON.stringify({ email: 'ada@example.com', plan: 'free' }),
      ),
    );
    expect(free.status).toBe(400);

    const plus = await checkout(
      post(
        '/api/billing/checkout',
        JSON.stringify({ email: 'ada@example.com', plan: 'plus' }),
      ),
    );
    expect(plus.status).toBe(503);
    expect(await plus.json()).toMatchObject({ code: 'PRICE_NOT_SET' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('says so when the flag is on but the key is missing', async () => {
    vi.stubEnv('PAYMENTS_ENABLED', 'true');
    vi.stubEnv('PAYSTACK_SECRET_KEY', '');
    const response = await checkout(
      post(
        '/api/billing/checkout',
        JSON.stringify({ email: 'ada@example.com', plan: 'plus' }),
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'PAYMENTS_NOT_CONFIGURED',
    });
  });

  it('checks the webhook signature on the raw body before reading anything', async () => {
    vi.stubEnv('PAYMENTS_ENABLED', 'true');
    vi.stubEnv('PAYSTACK_SECRET_KEY', SECRET);
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference: 'muse_x' },
    });
    const signature = createHmac('sha512', SECRET).update(body).digest('hex');

    const unsigned = await webhook(post('/api/billing/webhook', body));
    expect(unsigned.status).toBe(401);

    const tampered = await webhook(
      post('/api/billing/webhook', body.replace('muse_x', 'muse_y'), {
        'x-paystack-signature': signature,
      }),
    );
    expect(tampered.status).toBe(401);

    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const signed = await webhook(
      post('/api/billing/webhook', body, { 'x-paystack-signature': signature }),
    );
    expect(signed.status).toBe(200);
    expect(await signed.json()).toEqual({ received: true, handled: false });
    expect(info.mock.calls.flat().join(' ')).not.toContain('@');
    info.mockRestore();
  });
});
