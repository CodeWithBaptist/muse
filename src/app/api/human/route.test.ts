import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieJar: new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >(),
  enforceRateLimit: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    set: (name: string, value: string, options: Record<string, unknown>) =>
      mocks.cookieJar.set(name, { value, options }),
  })),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: mocks.enforceRateLimit,
  getClientIdentifier: () => 'ip:hashed',
  clientIp: () => '203.0.113.5',
}));

vi.mock('@/lib/security/turnstile', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/security/turnstile')
  >('@/lib/security/turnstile');
  return { ...actual, verifyTurnstileToken: mocks.verifyTurnstileToken };
});

import { GET, POST } from './route';
import { isHumanPassValid } from '@/lib/security/turnstile';

const originalEnv = { ...process.env };

function post(body: unknown): Request {
  return new Request('http://127.0.0.1:3000/api/human', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/human', () => {
  beforeEach(() => {
    mocks.cookieJar.clear();
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    mocks.verifyTurnstileToken.mockReset();
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reports that the check is off and sets nothing when Turnstile is not configured', async () => {
    await expect((await GET()).json()).resolves.toEqual({
      enabled: false,
      siteKey: null,
    });
    const response = await POST(post({ token: 'anything' }));
    await expect(response.json()).resolves.toEqual({
      ok: true,
      enabled: false,
    });
    expect(mocks.cookieJar.size).toBe(0);
    expect(mocks.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it('exchanges a genuine token for the human pass cookie', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';
    mocks.verifyTurnstileToken.mockResolvedValue({ ok: true });

    await expect((await GET()).json()).resolves.toEqual({
      enabled: true,
      siteKey: 'site-key',
    });
    const response = await POST(post({ token: 'cf-token' }));
    expect(response.status).toBe(200);
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith(
      'cf-token',
      '203.0.113.5',
    );

    const cookie = mocks.cookieJar.get('muse_human');
    expect(cookie?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7200,
      path: '/',
    });
    expect(isHumanPassValid(cookie?.value, 'secret-key')).toBe(true);
  });

  it('refuses a rejected token with 403 and an unreachable Cloudflare with 503', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret-key';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key';
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    mocks.verifyTurnstileToken.mockResolvedValueOnce({
      ok: false,
      reason: 'rejected',
      codes: [],
    });
    const rejected = await POST(post({ token: 'bad' }));
    expect(rejected.status).toBe(403);
    await expect(rejected.json()).resolves.toMatchObject({
      code: 'HUMAN_CHECK_FAILED',
    });

    mocks.verifyTurnstileToken.mockResolvedValueOnce({
      ok: false,
      reason: 'unavailable',
    });
    const down = await POST(post({ token: 'x' }));
    expect(down.status).toBe(503);
    expect(mocks.cookieJar.size).toBe(0);
  });

  it('lets the rate limiter answer first', async () => {
    const limited = new Response('slow down', { status: 429 });
    mocks.enforceRateLimit.mockResolvedValue(limited);
    expect(await POST(post({ token: 'x' }))).toBe(limited);
  });
});
