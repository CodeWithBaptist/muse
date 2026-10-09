import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PrivacyPage from './privacy/page';
import TermsPage from './terms/page';
import SpotifyAttributionPage from './spotify-attribution/page';

const PAGES = [
  {
    name: 'Privacy Policy',
    Page: PrivacyPage,
    source: 'src/app/privacy/page.tsx',
  },
  {
    name: 'Terms of Service',
    Page: TermsPage,
    source: 'src/app/terms/page.tsx',
  },
  {
    name: 'Spotify Attribution',
    Page: SpotifyAttributionPage,
    source: 'src/app/spotify-attribution/page.tsx',
  },
];

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('legal pages', () => {
  for (const { name, Page, source } of PAGES) {
    it(`${name}: is labelled as a draft, explains itself, and links home`, () => {
      render(<Page />);
      expect(screen.getByRole('heading', { level: 1, name })).toBeDefined();
      expect(screen.getByText('Draft for review')).toBeDefined();
      expect(screen.getByRole('note').textContent).toContain(
        'has not been reviewed by a lawyer',
      );
      expect(
        screen.getAllByRole('link', { name: 'Back to MUSE' }).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByRole('heading', { name: 'Before this is published' }),
      ).toBeDefined();
    });

    it(`${name}: contains no unfilled prompts beyond the marked placeholders`, () => {
      render(<Page />);
      const text = document.body.textContent ?? '';
      const marked = document.querySelectorAll(
        '[data-legal-placeholder]',
      ).length;
      const brackets = (text.match(/\[/g) ?? []).length;
      // Every square bracket on the page belongs to a marked placeholder.
      expect(brackets).toBe(marked);
      expect(text).not.toContain('Placeholder for review');
      expect(text).not.toContain('Lorem');
    });

    it(`${name}: uses no em or en dashes and no emoji`, () => {
      const contents = read(source);
      expect(contents).not.toMatch(/[\u2013\u2014]/);
      expect(contents).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }

  it('privacy policy lists every Spotify scope the app requests', () => {
    const scopesSource = read('src/lib/spotify.ts');
    const scopes = [...scopesSource.matchAll(/'([a-z-]+)'/g)]
      .map((match) => match[1])
      .filter((value) => value.includes('-'));
    expect(scopes.length).toBeGreaterThan(0);

    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';
    for (const scope of scopes) {
      expect(text, `privacy page is missing scope ${scope}`).toContain(scope);
    }
  });

  it('privacy policy names the session cookie and its lifetime from the code', () => {
    const session = read('src/lib/session.ts');
    expect(session).toContain("SESSION_COOKIE_NAME = 'muse_session'");
    expect(session).toContain('SESSION_EXPIRY_DAYS = 30');

    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('muse_session');
    expect(text).toContain('30 days');
  });

  it('privacy policy names the operator, the contact, the NDPA, and every browser storage key from the code', () => {
    const keys = [
      ['src/lib/guest-chat-store.ts', /GUEST_CHAT_STORAGE_KEY = '([^']+)'/],
      [
        'src/lib/chat-preferences-store.ts',
        /CHAT_PREFERENCES_STORAGE_KEY = '([^']+)'/,
      ],
      ['src/lib/ui-prefs.ts', /UI_PREFS_STORAGE_KEY = '([^']+)'/],
      ['src/lib/taste/store.ts', /TASTE_STORAGE_KEY = '([^']+)'/],
    ] as const;
    render(<PrivacyPage />);
    const text = document.body.textContent ?? '';
    for (const [file, pattern] of keys) {
      const key = read(file).match(pattern)?.[1];
      expect(key, `${file} storage key not found`).toBeTruthy();
      expect(text, `privacy page is missing ${key}`).toContain(key as string);
    }
    expect(text).toContain('MUSE, operated by Baptist Arowomutin');
    expect(text).toContain('barowomutin@gmail.com');
    expect(text).toContain('Nigeria Data Protection Act 2023');
    expect(text).toContain('Deezer');
    expect(text).toContain('iTunes Search API');
    expect(text).toContain('Last.fm');
    expect(text).toContain('one-way hash');
    expect(text).toContain('New chat');
    expect(text).toContain('Remove from this device');
    expect(text).toContain('muse_human');
    expect(text).toContain('muse_tester');
    expect(text).not.toContain('Operator name');
  });

  it('terms and attribution describe the public product without Spotify as a requirement', () => {
    render(<TermsPage />);
    const terms = document.body.textContent ?? '';
    expect(terms).toContain('You do not need an account');
    expect(terms).toContain('not open');
    expect(terms).toContain('no paid feature will require a Spotify account');
    expect(terms).not.toContain('You need a Spotify account');
    document.body.innerHTML = '';

    render(<SpotifyAttributionPage />);
    const attribution = document.body.textContent ?? '';
    expect(attribution).toContain('not needed to use MUSE');
    expect(attribution).toContain('not affiliated with, endorsed by');
    expect(attribution).toContain('Deezer');
    expect(attribution).toContain('Audiomack');
  });
});
