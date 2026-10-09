import { describe, expect, it } from 'vitest';
import {
  isTesterEmail,
  isTesterKey,
  signTesterPass,
  spotifyAccessMode,
  testerEmails,
  verifyTesterPass,
} from './testers';

const KEY = 'a-long-enough-tester-key-123';

describe('tester access rules', () => {
  it('is hidden with nothing configured, key mode with a key, allowlist mode with only emails', () => {
    expect(spotifyAccessMode({})).toBe('hidden');
    expect(spotifyAccessMode({ TESTER_KEY: 'short' })).toBe('hidden');
    expect(spotifyAccessMode({ TESTER_KEY: KEY })).toBe('key');
    expect(spotifyAccessMode({ SPOTIFY_TESTER_EMAILS: 'a@b.ng' })).toBe(
      'allowlist',
    );
    expect(
      spotifyAccessMode({ TESTER_KEY: KEY, SPOTIFY_TESTER_EMAILS: 'a@b.ng' }),
    ).toBe('key');
  });

  it('reads the email list loosely and compares case-insensitively', () => {
    const env = {
      SPOTIFY_TESTER_EMAILS:
        ' Ada@Example.com, tunde@lagos.ng ,, not-an-email ',
    };
    expect(testerEmails(env)).toEqual(['ada@example.com', 'tunde@lagos.ng']);
    expect(isTesterEmail('ADA@example.com', env)).toBe(true);
    expect(isTesterEmail('someone@else.com', env)).toBe(false);
    expect(isTesterEmail(undefined, env)).toBe(false);
  });

  it('accepts only the exact key, never when none is configured', () => {
    expect(isTesterKey(KEY, { TESTER_KEY: KEY })).toBe(true);
    expect(isTesterKey(` ${KEY} `, { TESTER_KEY: KEY })).toBe(true);
    expect(isTesterKey(`${KEY}x`, { TESTER_KEY: KEY })).toBe(false);
    expect(isTesterKey(KEY, {})).toBe(false);
    expect(isTesterKey(42, { TESTER_KEY: KEY })).toBe(false);
  });

  it('signs a pass that verifies with the same key, expires, and rejects tampering', () => {
    const env = { TESTER_KEY: KEY };
    const now = 1_700_000_000_000;
    const pass = signTesterPass(now, env)!;
    expect(verifyTesterPass(pass, env, now + 1000)).toBe(true);
    expect(
      verifyTesterPass(pass, { TESTER_KEY: `${KEY}-other` }, now + 1000),
    ).toBe(false);
    expect(verifyTesterPass(`${pass}x`, env, now + 1000)).toBe(false);
    expect(verifyTesterPass(pass, env, now + 31 * 24 * 60 * 60 * 1000)).toBe(
      false,
    );
    expect(verifyTesterPass(undefined, env, now)).toBe(false);
    expect(signTesterPass(now, {})).toBeNull();
  });
});
