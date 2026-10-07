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
});
