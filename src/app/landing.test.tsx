import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import HomePage from './page';
import { LandingPage } from '@/components/landing/LandingPage';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Landing Page', () => {
  it('renders the MUSE brand wordmark and hero heading', () => {
    render(<LandingPage />);
    const logos = screen.getAllByRole('img', { name: /muse/i });
    expect(logos.length).toBeGreaterThan(0);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /your music,\s*understood\./i,
    });
    expect(heading).toBeDefined();
    expect(heading.tagName).toBe('H1');
  });

  it('opens the chat from the header, the hero, and the closing band without an account', () => {
    render(<LandingPage />);
    // Header, hero, and closing band all carry the same primary action.
    const links = screen.getAllByRole('link', { name: 'Start' });
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/chat');
    }
    expect(screen.queryByRole('button', { name: /connect spotify/i })).toBeNull();
  });

  it('links the header nav to the three landing sections', () => {
    render(<LandingPage />);

    for (const id of ['see-it-work', 'how-it-works', 'what-it-does']) {
      expect(document.getElementById(id), `#${id} is missing`).not.toBeNull();
    }
    expect(screen.getByRole('link', { name: 'See it work' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'How it works' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'What it does' })).toBeDefined();
  });

  it('renders the whole page as HTML, so nothing needs JavaScript to be seen', () => {
    const html = renderToString(<LandingPage />);

    for (const content of [
      'Your music,',
      'understood.',
      'Discover music, build playlists',
      '>Start<',
      'See how it works',
      'See it work',
      'Say the vibe. Get the playlist.',
      'Four steps. No filters.',
      'Ask for anything. It listens.',
      'Try asking for',
      'a late night drive',
      'slow mornings',
      'Natural language discovery',
      'Your taste in words',
      'Ready when you are',
      'Start with a feeling.',
      'Sample',
      'Replay',
      'Copied',
      'Audiomack',
      // The window is never empty before the sequence starts.
      'Tell me the mood, sound, artist, or moment.',
      'What are we listening to?',
    ]) {
      expect(html, `the server render is missing ${content}`).toContain(content);
    }

    // The sample conversation is complete in the first paint.
    expect(html).toContain('data-preview-phase="playing"');
    expect(html).not.toContain('opacity:0');

    // No step of the hero entrance hides its text behind an inline style.
    for (const selector of ['muse-hero-line', 'muse-hero-fade', 'muse-hero-letter']) {
      const blocks = html.split(`class="${selector}`);
      for (const block of blocks.slice(1)) {
        const style = block.slice(0, block.indexOf('>'));
        expect(style).not.toContain('opacity');
        expect(style).not.toContain('transform');
      }
    }

    // The dot and the four letters are separate pieces in the markup.
    expect(html).toContain('data-hero-piece="dot"');
    expect(html.match(/data-hero-piece="/g)).toHaveLength(5);
  });

  it('hydrates the server markup without a mismatch', async () => {
    const html = renderToString(<LandingPage />);
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args.map((value) => String(value)).join(' '));
    });
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      errors.push(args.map((value) => String(value)).join(' '));
    });

    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => {
      root = hydrateRoot(container, <LandingPage />);
    });

    const hydrationIssues = errors.filter((message) =>
      /hydrat|did not match|server rendered/i.test(message),
    );
    expect(hydrationIssues).toEqual([]);

    await act(async () => {
      root?.unmount();
    });
    container.remove();
  });

  it('gives the visitor two ways back to the top from the footer', () => {
    render(<LandingPage />);

    const mark = screen.getByRole('link', { name: 'MUSE, back to the top of the page' });
    const back = screen.getByTestId('back-to-top');

    // `#top` needs no element to exist, so both work with no JavaScript at all.
    expect(mark.getAttribute('href')).toBe('#top');
    expect(back.getAttribute('href')).toBe('#top');
    expect(back.textContent).toContain('Back to top');

    // Both keep a visible focus ring, and the control stays small.
    expect(mark.className).toContain('focus-ring');
    expect(back.className).toContain('focus-ring');
    expect(back.querySelector('svg')?.getAttribute('width')).toBe('12');
  });

  it('still reads as a complete page with both canvases removed', () => {
    // No 2D context at all, which is what the removal test simulates: every
    // section keeps its content and nothing depends on the drawing.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<LandingPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /your music,\s*understood\./i,
      }),
    ).toBeDefined();
    expect(document.querySelectorAll('canvas')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Start' })).toHaveLength(3);
    expect(screen.getByRole('button', { name: /see how it works/i })).toBeDefined();
    expect(document.querySelectorAll('[data-hero-piece]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-step]')).toHaveLength(4);
    expect(screen.getByText('Sample')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: 'Start with a feeling.' }),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { name: 'Ask for anything. It listens.' }),
    ).toBeDefined();
  });
});

describe('HomePage server wiring', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('offers the same Start link whether or not Spotify is configured', async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
    delete process.env.SPOTIFY_REDIRECT_URI;
    delete process.env.ENCRYPTION_KEY;

    const { unmount } = render(await HomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole('link', { name: 'Start' })).toHaveLength(3);
    expect(screen.queryByText(/Spotify sign-in is not configured/)).toBeNull();
    unmount();

    process.env.SPOTIFY_CLIENT_ID = 'id';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
    process.env.SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3000/api/auth/spotify/callback';
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

    render(await HomePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole('link', { name: 'Start' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /connect spotify/i })).toBeNull();
    expect(document.querySelector('[data-auth-notice]')).toBeNull();
  });

  it('explains a failed sign-in when the auth routes redirect back with a code', async () => {
    render(await HomePage({ searchParams: Promise.resolve({ error: 'token_exchange_failed' }) }));

    const notice = document.querySelector('[data-auth-notice="token_exchange_failed"]');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.textContent).toContain('MUSE could not finish connecting to Spotify.');
    expect(notice?.textContent).toContain('Nothing was saved.');
  });

  it('ignores error values that are not auth codes', async () => {
    render(
      await HomePage({ searchParams: Promise.resolve({ error: '<img src=x onerror=alert(1)>' }) }),
    );
    expect(document.querySelector('[data-auth-notice]')).toBeNull();
  });
});
