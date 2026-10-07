import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import HomePage from './page';
import { afterEach, describe, it, expect, vi } from 'vitest';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Landing Page', () => {
  it('renders the MUSE brand wordmark and hero heading', () => {
    render(<HomePage />);
    const logos = screen.getAllByRole('img', { name: /muse/i });
    expect(logos.length).toBeGreaterThan(0);

    const heading = screen.getByRole('heading', {
      level: 1,
      name: /your music,\s*understood\./i,
    });
    expect(heading).toBeDefined();
    expect(heading.tagName).toBe('H1');
  });

  it('disables and labels the connection action when Spotify is not configured', () => {
    // The test environment sets no Spotify credentials, which is the case the
    // landing page has to be honest about: a visitor must never be sent to a
    // bare JSON error by an action that looks functional.
    render(<HomePage />);

    const button = screen.getByRole('button', {
      name: /connect spotify/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(
      'hero-spotify-unavailable',
    );
    expect(
      screen.getByText('Spotify connection is not configured yet.'),
    ).toBeDefined();
  });

  it('enables the connection action once Spotify is configured', () => {
    vi.stubEnv('SPOTIFY_CLIENT_ID', 'placeholder-client-id');
    vi.stubEnv(
      'SPOTIFY_REDIRECT_URI',
      'http://127.0.0.1:3000/api/auth/spotify/callback',
    );

    render(<HomePage />);

    const button = screen.getByRole('button', {
      name: /connect spotify/i,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(
      screen.queryByText('Spotify connection is not configured yet.'),
    ).toBeNull();
  });

  it('renders the whole page as HTML, so nothing needs JavaScript to be seen', () => {
    const html = renderToString(<HomePage />);

    for (const content of [
      'Your music,',
      'understood.',
      'Discover music, build playlists',
      'Connect Spotify',
      'See how it works',
      'How MUSE works',
      'Designed for the',
      'MUSE Intelligence',
      'Sample',
      'Replay',
      'Playlist created.',
      'Open in Spotify',
    ]) {
      expect(html, `the server render is missing ${content}`).toContain(content);
    }

    // The sample conversation is complete in the first paint, and no step of
    // the entrance hides its text behind an inline opacity.
    expect(html).toContain('data-preview-phase="open"');
    expect(html).not.toContain('opacity:0');
    expect(html).not.toContain('transform:translate');

    // The dot and the four letters are separate pieces in the markup.
    expect(html).toContain('data-hero-piece="dot"');
    expect(html.match(/data-hero-piece="/g)).toHaveLength(5);
  });

  it('hydrates the server markup without a mismatch', async () => {
    const html = renderToString(<HomePage />);
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
      root = hydrateRoot(container, <HomePage />);
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

  it('still reads as a complete page with the canvas removed', () => {
    // No 2D context at all, which is what the removal test simulates: the hero
    // keeps every piece of content and nothing depends on the drawing.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /your music,\s*understood\./i }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /see how it works/i })).toBeDefined();
    expect(document.querySelectorAll('[data-hero-piece]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-step]')).toHaveLength(4);
    expect(screen.getByText('Sample')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDefined();
  });
});
