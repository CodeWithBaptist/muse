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

  it('renders enabled Spotify connection buttons for unauthenticated visitors', () => {
    render(<HomePage />);
    // Header, hero, and closing band all carry the same primary action.
    const buttons = screen.getAllByRole('button', {
      name: /connect spotify/i,
    }) as HTMLButtonElement[];
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button.disabled).toBe(false);
    }
  });

  it('links the header nav to the three landing sections', () => {
    render(<HomePage />);

    for (const id of ['see-it-work', 'how-it-works', 'what-it-does']) {
      expect(document.getElementById(id), `#${id} is missing`).not.toBeNull();
    }
    expect(screen.getByRole('link', { name: 'See it work' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'How it works' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'What it does' })).toBeDefined();
  });

  it('renders the whole page as HTML, so nothing needs JavaScript to be seen', () => {
    const html = renderToString(<HomePage />);

    for (const content of [
      'Your music,',
      'understood.',
      'Discover music, build playlists',
      'Connect Spotify',
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
      'Playlist created.',
      'Open in Spotify',
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

  it('still reads as a complete page with both canvases removed', () => {
    // No 2D context at all, which is what the removal test simulates: every
    // section keeps its content and nothing depends on the drawing.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /your music,\s*understood\./i,
      }),
    ).toBeDefined();
    expect(document.querySelectorAll('canvas')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /connect spotify/i })).toHaveLength(3);
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
