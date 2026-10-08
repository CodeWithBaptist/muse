import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clientIpForTurnstile,
  createHumanPass,
  enforceHumanCheck,
  HUMAN_CHECK_REQUIRED_CODE,
  HUMAN_PASS_COOKIE,
  HUMAN_PASS_MAX_AGE_SECONDS,
  isHumanPassValid,
  isTurnstileEnabled,
  readCookie,
  verifyTurnstileToken,
} from './turnstile';

const ENABLED = {
  TURNSTILE_SECRET_KEY: 'secret-key',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
};

describe('Turnstile configuration', () => {
  it('is only on when both keys are present', () => {
    expect(isTurnstileEnabled({})).toBe(false);
    expect(isTurnstileEnabled({ TURNSTILE_SECRET_KEY: 'x' })).toBe(false);
    expect(isTurnstileEnabled({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'y' })).toBe(
      false,
    );
    expect(isTurnstileEnabled(ENABLED)).toBe(true);
  });
});

describe('human pass cookie', () => {
  it('round-trips, rejects tampering, and expires after two hours', () => {
    const issuedAt = 1_700_000_000_000;
    const pass = createHumanPass('secret-key', issuedAt);
    expect(isHumanPassValid(pass, 'secret-key', issuedAt + 1000)).toBe(true);
    expect(isHumanPassValid(pass, 'other-secret', issuedAt + 1000)).toBe(false);
    expect(
      isHumanPassValid(
        `${issuedAt + 5}.${pass.split('.')[1]}`,
        'secret-key',
        issuedAt + 1000,
      ),
    ).toBe(false);
    expect(
      isHumanPassValid(
        pass,
        'secret-key',
        issuedAt + HUMAN_PASS_MAX_AGE_SECONDS * 1000 + 1,
      ),
    ).toBe(false);
    expect(isHumanPassValid('garbage', 'secret-key')).toBe(false);
    expect(isHumanPassValid(null, 'secret-key')).toBe(false);
  });

  it('reads a named cookie from the request header', () => {
    const request = new Request('http://127.0.0.1/', {
      headers: { cookie: 'a=1; muse_human=123.abc; b=2' },
    });
    expect(readCookie(request, HUMAN_PASS_COOKIE)).toBe('123.abc');
    expect(readCookie(request, 'missing')).toBeNull();
  });
});

describe('enforceHumanCheck', () => {
  it('does nothing when Turnstile is off', () => {
    const request = new Request('http://127.0.0.1/api/chat', {
      method: 'POST',
    });
    expect(enforceHumanCheck(request, {})).toBeNull();
  });

  it('asks for the check without a pass and lets a valid pass through', async () => {
    const bare = new Request('http://127.0.0.1/api/chat', { method: 'POST' });
    const denied = enforceHumanCheck(bare, ENABLED);
    expect(denied?.status).toBe(403);
    await expect(denied?.json()).resolves.toMatchObject({
      code: HUMAN_CHECK_REQUIRED_CODE,
    });

    const withPass = new Request('http://127.0.0.1/api/chat', {
      method: 'POST',
      headers: {
        cookie: `${HUMAN_PASS_COOKIE}=${createHumanPass('secret-key')}`,
      },
    });
    expect(enforceHumanCheck(withPass, ENABLED)).toBeNull();
  });
});

describe('verifyTurnstileToken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('skips verification entirely when no secret is configured', async () => {
    expect(await verifyTurnstileToken('token', undefined, { env: {} })).toEqual(
      { ok: true },
    );
  });

  it('posts the token and remote ip to Cloudflare and reads the verdict', async () => {
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = init?.body as URLSearchParams;
        expect(body.get('secret')).toBe('secret-key');
        expect(body.get('response')).toBe('tok');
        expect(body.get('remoteip')).toBe('203.0.113.9');
        return Response.json({ success: true, hostname: 'muse.example' });
      },
    );
    const result = await verifyTurnstileToken('tok', '203.0.113.9', {
      env: ENABLED,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: true, hostname: 'muse.example' });
  });

  it('distinguishes a rejected token from an unreachable service', async () => {
    const rejected = await verifyTurnstileToken('tok', undefined, {
      env: ENABLED,
      fetchImpl: (async () =>
        Response.json({
          success: false,
          'error-codes': ['invalid-input-response'],
        })) as typeof fetch,
    });
    expect(rejected).toEqual({
      ok: false,
      reason: 'rejected',
      codes: ['invalid-input-response'],
    });

    const down = await verifyTurnstileToken('tok', undefined, {
      env: ENABLED,
      fetchImpl: (async () => {
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    expect(down).toEqual({ ok: false, reason: 'unavailable' });

    expect(await verifyTurnstileToken('', undefined, { env: ENABLED })).toEqual(
      {
        ok: false,
        reason: 'missing-token',
      },
    );
  });

  it('passes the client ip through only when one is known', () => {
    expect(
      clientIpForTurnstile(
        new Request('http://127.0.0.1/', {
          headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
        }),
      ),
    ).toBe('198.51.100.4');
    expect(
      clientIpForTurnstile(new Request('http://127.0.0.1/')),
    ).toBeUndefined();
  });
});
