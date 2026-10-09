import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cookieJar: new Map<
    string,
    { value: string; options: Record<string, unknown> }
  >(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mocks.cookieJar.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) =>
      mocks.cookieJar.set(name, { value, options }),
  })),
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
}));

import { POST } from './route';
import { verifyTesterPass } from '@/lib/testers';

const KEY = 'a-long-enough-tester-key-123';

function post(body: unknown) {
  return new Request('http://localhost/api/tester', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      Host: 'localhost',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/tester', () => {
  beforeEach(() => {
    mocks.cookieJar.clear();
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    process.env.TESTER_KEY = KEY;
  });

  it('sets the tester pass cookie for the right key', async () => {
    const response = await POST(post({ key: KEY }));
    expect(response.status).toBe(200);
    const cookie = mocks.cookieJar.get('muse_tester');
    expect(cookie).toBeDefined();
    expect(verifyTesterPass(cookie!.value)).toBe(true);
    expect(cookie!.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('refuses a wrong key, a malformed body, and sets nothing', async () => {
    expect((await POST(post({ key: 'wrong' }))).status).toBe(403);
    expect((await POST(post({}))).status).toBe(403);
    expect(mocks.cookieJar.size).toBe(0);
  });

  it('is disabled when no tester key is configured, even for an empty key', async () => {
    delete process.env.TESTER_KEY;
    const response = await POST(post({ key: '' }));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('TESTER_ACCESS_DISABLED');
  });

  it('is rate limited tightly', async () => {
    mocks.enforceRateLimit.mockResolvedValue(
      new Response('slow down', { status: 429 }),
    );
    const response = await POST(post({ key: KEY }));
    expect(response.status).toBe(429);
    expect(mocks.enforceRateLimit.mock.calls[0][1]).toMatchObject({
      scope: 'security:tester',
      limit: 5,
    });
  });
});
