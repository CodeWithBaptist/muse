import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { HERO_WORDMARK_PIECES } from '@/components/landing/HeroWordmark';
import { LANDING_WORDMARK_PIECES } from '@/lib/landing-wordmark';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * The landing quality checklist, encoded as checks so it cannot regress:
 * decorative canvases behind the content, a first paint that needs no
 * hydration, one attention animation per section, an honest and inert sample
 * preview, no glow or blur or shadow or decorative gradient, token colours
 * only, an accessible first tab stop, and transform plus opacity only.
 */

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

const LANDING_SOURCES = [
  'src/components/landing/SiteHeader.tsx',
  'src/components/landing/Hero.tsx',
  'src/components/landing/HeroWordmark.tsx',
  'src/components/landing/LandingMark.tsx',
  'src/components/landing/SpotifyPrimaryAction.tsx',
  'src/components/landing/RecordGroovesCanvas.tsx',
  'src/components/landing/ProductPreview.tsx',
  'src/components/landing/HowItWorks.tsx',
  'src/components/landing/WhatItDoes.tsx',
  'src/components/landing/ClosingBand.tsx',
  'src/components/landing/ClosingBandCanvas.tsx',
  'src/components/landing/SiteFooter.tsx',
  'src/lib/beat-clock.ts',
  'src/lib/landing-canvas.ts',
  'src/lib/landing-preview.ts',
  'src/lib/landing-sample.ts',
  'src/lib/landing-rolling.ts',
  'src/lib/landing-steps.ts',
  'src/lib/landing-scroll.ts',
  'src/lib/landing-wordmark.ts',
  'src/lib/hero-entrance.ts',
  'src/hooks/use-reveal-once.ts',
  'src/hooks/use-brand-dot-pulse.ts',
];

const HERO_KEYFRAMES = [
  '@keyframes muse-hero-letter',
  '@keyframes muse-hero-dot',
  '@keyframes muse-hero-line',
  '@keyframes muse-hero-fade',
  '@keyframes muse-equalizer-bar',
];

const CANVAS_SOURCES = [
  'src/components/landing/RecordGroovesCanvas.tsx',
  'src/components/landing/ClosingBandCanvas.tsx',
];

describe('landing quality checklist', () => {
  it('1. keeps both canvases decorative, behind the content, and unclickable', () => {
    render(<HomePage />);

    const canvases = [...document.querySelectorAll('canvas')];
    expect(canvases).toHaveLength(2);

    for (const canvas of canvases) {
      expect(canvas.getAttribute('aria-hidden')).toBe('true');
      expect(canvas.className).toContain('pointer-events-none');
      expect(canvas.className).toContain('absolute');
      // No stacking class on a canvas: the text carries its own z-index.
      expect(canvas.className).not.toContain('z-');
    }

    // The hero content sits above its canvas on its own stacking order.
    const content = document.querySelector('.muse-hero > div');
    expect(content?.className).toContain('relative');
    expect(content?.className).toContain('z-10');

    // The hero is positioned and clipped, with the canvas inside it.
    const hero = document.querySelector('.muse-hero') as HTMLElement;
    expect(hero.className).toContain('relative');
    expect(hero.className).toContain('overflow-hidden');
    expect(hero.className).toContain('min-h-[calc(100svh-var(--muse-header-height))]');

    expect(document.querySelector('img[loading="lazy"]')).toBeNull();
  });

  it('2. paints the hero text without waiting for hydration', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/your music,/i);
    expect(heading.textContent).toMatch(/understood\./i);
    expect(heading.style.opacity).toBe('');

    // Every entrance step is CSS driven, delayed inline, and carries no inline
    // opacity or transform that could hold the content hidden.
    const lines = document.querySelectorAll('.muse-hero-line');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect((line as HTMLElement).style.opacity).toBe('');
      expect((line as HTMLElement).style.transform).toBe('');
      expect(
        (line as HTMLElement).style.getPropertyValue('--muse-hero-delay'),
      ).not.toBe('');
    }

    const fades = document.querySelectorAll('.muse-hero-fade');
    expect(fades).toHaveLength(2);
    for (const fade of fades) {
      expect((fade as HTMLElement).style.opacity).toBe('');
      expect(
        (fade as HTMLElement).style.getPropertyValue('--muse-hero-delay'),
      ).not.toBe('');
    }

    // Letters and the dot are animated separately, and nothing waits on JS.
    expect(document.querySelectorAll('[data-hero-piece]')).toHaveLength(5);
    expect(document.querySelectorAll('.muse-hero-letter')).toHaveLength(4);
    expect(document.querySelectorAll('.muse-hero-dot-drop')).toHaveLength(1);

    // No real content is hidden by an inline style at first paint. The step
    // visuals are aria-hidden decoration whose scripts start from a blank frame,
    // so they are out of scope here; the server render check in landing.test.tsx
    // covers them without JavaScript.
    const hidden = [...document.querySelectorAll<HTMLElement>('[style]')].filter(
      (element) =>
        element.style.opacity === '0' &&
        !element.closest('[aria-hidden="true"]'),
    );
    expect(hidden).toEqual([]);
  });

  it('3. keeps the wordmark shapes identical to the brand mark', () => {
    const brand = read('src/assets/brand/muse-wordmark.svg');
    const brandPaths = [...brand.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
    expect(brandPaths).toHaveLength(5);

    for (const brandPath of brandPaths) {
      expect(HERO_WORDMARK_PIECES.some((piece) => piece.d === brandPath)).toBe(true);
      expect(
        LANDING_WORDMARK_PIECES.some((piece) => piece.d === brandPath),
      ).toBe(true);
    }

    // The shared Logo and the brand files are not touched by the landing work.
    const logo = read('src/components/ui/Logo.tsx');
    expect(logo).toContain('aria-label="muse"');
    expect(logo).toContain("theme = 'dark'");
    expect(read('src/lib/landing-wordmark.ts')).not.toContain(
      '@/components/ui/Logo',
    );
  });

  it('4. runs one shared loop and one attention animation per section', () => {
    // One clock, two canvas subscribers, and nothing else asking for frames.
    const clock = read('src/lib/beat-clock.ts');
    expect(clock).toContain('requestAnimationFrame');
    expect(clock).toContain('BEAT_BPM = 96');
    expect(clock).toContain('BEAT_MS = 60_000 / BEAT_BPM');
    expect(clock).toContain('BEAT_DECAY = 5.5');
    expect(clock).toContain('document.hidden');

    for (const source of CANVAS_SOURCES) {
      const contents = read(source);
      expect(contents).toContain('subscribeBeat');
      expect(contents).not.toContain('requestAnimationFrame(');
      expect(contents).toContain('IntersectionObserver');
      expect(contents).toContain('ResizeObserver');
      expect(contents).toContain('DPR_CAP = 2');
    }

    // The demo and the rail run on timers, never on their own frame loop.
    expect(read('src/components/landing/ProductPreview.tsx')).not.toContain(
      'requestAnimationFrame',
    );
    expect(read('src/components/landing/HowItWorks.tsx')).not.toContain(
      'requestAnimationFrame',
    );

    // The rolling word is the only interval outside the demo and the steps.
    expect(read('src/components/landing/WhatItDoes.tsx')).toContain('setInterval');

    // Reveals happen once, and never re-run on the way back up.
    const reveal = read('src/hooks/use-reveal-once.ts');
    expect(reveal).toContain('observer.disconnect()');
    expect(reveal).toContain('REVEAL_THRESHOLD = 0.2');
    expect(reveal).toContain('REVEAL_DISTANCE_PX = 14');
    expect(reveal).toContain('REVEAL_DURATION_MS = 700');

    // No parallax, no scroll jacking, no cursor followers, no decorative loops.
    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      for (const token of [
        'parallax',
        'confetti',
        'cursor-follower',
        'scrollY',
        'onScroll',
      ]) {
        expect(contents.includes(token), `${source} contains ${token}`).toBe(false);
      }
    }
  });

  it('5. labels the scripted preview, keeps it inert, and never leaves it empty', () => {
    const { container } = render(<HomePage />);

    expect(screen.getByText('Sample')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDefined();
    expect(
      screen.getAllByText(/Nothing here contacts Spotify or OpenAI/i).length,
    ).toBeGreaterThan(0);

    // The hint and the placeholder are in the first paint, before the sequence.
    expect(
      screen.getAllByText('Tell me the mood, sound, artist, or moment.').length,
    ).toBeGreaterThan(0);
    const input = container.querySelector(
      '[data-testid="sample-input"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.getAttribute('placeholder')).toBe('What are we listening to?');
    expect(input.readOnly).toBe(true);

    // Everything inside the window is inert and hidden from assistive tech.
    const sample = container.querySelector('[inert]');
    expect(sample).not.toBeNull();
    expect(sample?.getAttribute('aria-hidden')).toBe('true');

    // The animated conversation is decorative, so it is not exposed as a list.
    expect(screen.queryByRole('list', { name: /sample recommended tracks/i })).toBeNull();
  });

  it('6. starts the preview only when it is 40 percent visible', () => {
    const preview = read('src/components/landing/ProductPreview.tsx');
    expect(preview).toContain('PREVIEW_VISIBLE_THRESHOLD');
    expect(preview).toContain('IntersectionObserver');
    expect(preview).toContain('prefers-reduced-motion');
    expect(preview).toContain('visibilitychange');
    expect(preview).toContain('stopTimer');
    expect(preview).toContain('armObserver?.disconnect()');
    expect(preview).toContain('observer?.disconnect()');
    expect(read('src/lib/landing-preview.ts')).toContain(
      'PREVIEW_VISIBLE_THRESHOLD = 0.4',
    );
  });

  it('7. handles reduced motion for every landing animation', () => {
    const css = read('src/app/globals.css');
    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    for (const selector of [
      '.muse-hero-letter',
      '.muse-hero-dot-drop',
      '.muse-hero-line',
      '.muse-hero-fade',
      '.muse-dot-pulse',
      '.muse-reveal',
      '.muse-roll-column',
      '.muse-equalizer-bar',
      '.muse-check-path',
    ]) {
      expect(reducedMotion).toContain(selector);
    }
    expect(reducedMotion).toContain('scroll-behavior: auto');

    // Every canvas and every script has a reduced motion branch, either through
    // the media query directly or through the one shared helper that reads it.
    for (const source of [
      ...CANVAS_SOURCES,
      'src/components/landing/ProductPreview.tsx',
      'src/components/landing/HowItWorks.tsx',
      'src/components/landing/WhatItDoes.tsx',
      'src/hooks/use-brand-dot-pulse.ts',
      'src/hooks/use-reveal-once.ts',
      'src/lib/landing-scroll.ts',
    ]) {
      const contents = read(source);
      expect(
        contents.includes('prefers-reduced-motion') ||
          contents.includes('prefersReducedMotion'),
        `${source} has no reduced motion branch`,
      ).toBe(true);
    }

    // The hero entrance never holds a transform after it finishes, or the
    // button pressed transforms would be overridden.
    for (const step of ['muse-hero-letter', 'muse-hero-line', 'muse-hero-fade']) {
      const block = css.slice(css.indexOf(`.${step} {`));
      const rule = block.slice(0, block.indexOf('}'));
      expect(rule).toContain('backwards');
      expect(rule).not.toContain('both');
    }
  });

  it('8. uses no glow, blur, decorative gradient, or shadow on the landing', () => {
    const forbidden = [
      'shadow-',
      'drop-shadow',
      'blur-',
      'backdrop-',
      'bg-gradient',
      'from-',
      'glow',
    ];

    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      for (const token of forbidden) {
        expect(contents.includes(token), `${source} contains ${token}`).toBe(false);
      }
    }

    // The one gradient on the page is the plain edge fade on the closing band.
    const canvas = read('src/lib/landing-canvas.ts');
    expect(canvas).toContain('BAND_EDGE_FADE = 0.2');
    expect(canvas).toContain('destination-out');
    for (const source of LANDING_SOURCES) {
      if (source === 'src/lib/landing-canvas.ts') continue;
      expect(read(source)).not.toContain('createLinearGradient');
    }
  });

  it('9. uses the design tokens for colour and never a near miss', () => {
    const css = read('src/app/globals.css');
    const theme = css.slice(
      css.indexOf('@theme'),
      css.indexOf('}', css.indexOf('@theme')),
    );
    expect(theme).toContain('#0B0B0C');
    expect(theme).toContain('#F2F1ED');
    expect(theme).toContain('#A8E85C');

    // The canvas fallback palette is the token values, and it is the only
    // landing source allowed to spell a colour out.
    const canvasMath = read('src/lib/landing-canvas.ts');
    expect(canvasMath).toContain("ink: '#F2F1ED'");
    expect(canvasMath).toContain("accent: '#A8E85C'");

    for (const source of LANDING_SOURCES) {
      if (source === 'src/lib/landing-canvas.ts') continue;
      const contents = read(source);
      expect(
        /#[0-9a-fA-F]{6}\b/.test(contents),
        `${source} hardcodes a colour`,
      ).toBe(false);
    }

    // The wordmarks read the tokens through CSS variables instead of hexes.
    expect(read('src/components/landing/HeroWordmark.tsx')).toContain(
      'var(--color-accent)',
    );
    expect(read('src/components/landing/LandingMark.tsx')).toContain(
      'var(--color-accent)',
    );
  });

  it('10. keeps the first tab stop, the focus rings, and the hover attributes', () => {
    render(<HomePage />);

    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0] as HTMLAnchorElement;
    expect(first.tagName).toBe('A');
    expect(first.getAttribute('href')).toBe('#main-content');

    const connect = screen.getAllByRole('button', { name: /connect spotify/i });
    expect(connect.length).toBe(3);
    expect(screen.getByRole('button', { name: /see how it works/i })).toBeDefined();

    // Both hero actions carry the hover attribute, so touch and keyboard focus
    // lift the record just like the pointer does.
    const hero = document.querySelector('.muse-hero') as HTMLElement;
    expect(
      hero.querySelectorAll('[data-muse-hero-action]').length,
    ).toBe(2);
    // The closing action drives the closing band energy.
    expect(
      document.querySelectorAll('[data-muse-closing-action]').length,
    ).toBe(1);

    // Focus rings stay visible everywhere.
    const css = read('src/app/globals.css');
    expect(css).toContain('outline: 2px solid var(--color-accent)');
    expect(css).toContain(':focus-visible');
  });

  it('11. animates transform and opacity only, so nothing shifts layout', () => {
    const css = read('src/app/globals.css');

    for (const keyframe of HERO_KEYFRAMES) {
      const start = css.indexOf(keyframe);
      expect(start, `${keyframe} is missing`).toBeGreaterThan(-1);
      const open = css.indexOf('{', start);
      let depth = 0;
      let end = open;
      for (let index = open; index < css.length; index += 1) {
        if (css[index] === '{') depth += 1;
        if (css[index] === '}') {
          depth -= 1;
          if (depth === 0) {
            end = index;
            break;
          }
        }
      }
      const block = css.slice(start, end + 1);
      for (const property of [
        'width:',
        'height:',
        'top:',
        'left:',
        'margin',
        'filter:',
      ]) {
        expect(block.includes(property), `${keyframe} animates ${property}`).toBe(
          false,
        );
      }
    }

    // The rail and the rolling column are transforms, the reveal is both.
    expect(css).toContain('.muse-rail-fill');
    expect(css).toContain('transform-origin: top center');
    expect(css).toContain('.muse-roll-column');
  });

  it('12. keeps the record grooves and the living logo to spec', () => {
    const canvas = read('src/lib/landing-canvas.ts');

    // Grooves.
    expect(canvas).toContain('GROOVE_INNER_RADIUS = 70');
    expect(canvas).toContain('GROOVE_OUTER_CAP = 560');
    expect(canvas).toContain('GROOVE_STEP = 13');
    expect(canvas).toContain('GROOVE_STEP_NARROW = 16');
    expect(canvas).toContain('GROOVE_NARROW_WIDTH = 640');
    expect(canvas).toContain('GROOVE_SEGMENTS = 96');
    expect(canvas).toContain('GROOVE_WAVE_AMPLITUDE = 2.4');
    expect(canvas).toContain('GROOVE_RADIUS_SCALE = 380');
    expect(canvas).toContain('GROOVE_DISTORTION_CAP = 1.8');

    // Needle.
    expect(canvas).toContain('NEEDLE_FIRST_INDEX = 3');
    expect(canvas).toContain('NEEDLE_LAST_INDEX = 8');
    expect(canvas).toContain('NEEDLE_INDEX_OFFSET = 0.12');
    expect(canvas).toContain('NEEDLE_SPAN = 1.1');
    expect(canvas).toContain('NEEDLE_WIDTH = 2');
    expect(canvas).toContain('NEEDLE_OPACITY_BASE = 0.7');
    expect(canvas).toContain('NEEDLE_OPACITY_STEP = 0.08');
    expect(canvas).toContain('NEEDLE_SPEED = 0.0007');
    expect(canvas).toContain('HERO_CONTENT_PADDING = 12');
    expect(canvas).toContain('HERO_DIM_FACTOR = 0.35');

    // Hover energy.
    expect(canvas).toContain('HOVER_ENERGY_TARGET = 2.2');
    expect(canvas).toContain('HOVER_ENERGY_EASE = 0.06');

    // Closing band.
    expect(canvas).toContain('BAND_HEIGHT = 240');
    expect(canvas).toContain('BAND_MAX_LOGO_WIDTH = 820');
    expect(canvas).toContain('BAND_LOGO_WIDTH_FRACTION = 0.82');
    expect(canvas).toContain('BAND_LOGO_VERTICAL_MARGIN = 36');
    expect(canvas).toContain('BAND_BAR_PITCH = 4.6');
    expect(canvas).toContain('BAND_BAR_WIDTH = 1.3');
    expect(canvas).toContain('BAND_BAR_MAX_HEIGHT = 38');
    expect(canvas).toContain('BAND_BAR_GAIN = 0.95');
    expect(canvas).toContain('BAND_PLAYHEAD_PERIOD_MS = 12000');
    expect(canvas).toContain('BAND_CURSOR_RADIUS = 18');
    expect(canvas).toContain('BAND_CURSOR_LIFT = 0.3');

    // The wordmark geometry the band draws from.
    const wordmark = read('src/lib/landing-wordmark.ts');
    expect(wordmark).toContain('LANDING_WORDMARK_WIDTH = 274');
    expect(wordmark).toContain('LANDING_WORDMARK_HEIGHT = 54');
  });

  it('13. keeps the demo and the sections to the scripted copy', () => {
    const sample = read('src/lib/landing-sample.ts');
    expect(sample).toContain('Give me something for a late night drive');
    expect(sample).toContain(
      'Got you. I kept it mellow, rhythmic, and a little atmospheric.',
    );
    expect(sample).toContain('Late Night Lagos');
    expect(sample).toContain('What are we listening to?');
    expect(sample).toContain('Tell me the mood, sound, artist, or moment.');

    const preview = read('src/lib/landing-preview.ts');
    expect(preview).toContain('PREVIEW_PROMPT_CHAR_MS = 42');
    expect(preview).toContain('PREVIEW_THINKING_LINE_MS = 1000');
    expect(preview).toContain('PREVIEW_REPLY_WORD_MS = 55');
    expect(preview).toContain('PREVIEW_ROW_STAGGER_MS = 50');

    const rail = read('src/components/landing/HowItWorks.tsx');
    expect(rail).toContain('late night Afrobeats but chill');
    expect(rail).toContain('Found 20 tracks');
    expect(rail).toContain(
      'Why this: slower and warmer, like your late night listening.',
    );

    const rolling = read('src/lib/landing-sample.ts');
    for (const phrase of [
      'a late night drive',
      'songs like Brent Faiyaz',
      'something completely new',
      'a 2am Afrobeats mix',
      'music to lock in',
      'slow mornings',
    ]) {
      expect(rolling).toContain(phrase);
    }
  });

  it('14. only claims what is built today', () => {
    render(<HomePage />);
    const text = document.body.textContent ?? '';

    for (const removed of [
      'Cross-platform sync',
      'Cross platform sync',
      'Intelligent music memory',
      'Deep genre exploration',
      'millions of tracks',
      'MUSE Intelligence',
      'Designed for the',
    ]) {
      expect(text, `the page still claims ${removed}`).not.toContain(removed);
    }

    // No invented numbers, testimonials, or legal text on the landing.
    for (const invented of ['testimonial', 'as seen in', 'trusted by', 'users worldwide']) {
      expect(text.toLowerCase()).not.toContain(invented);
    }
  });

  it('15. adds no dependencies and only imports from the app', () => {
    const allowed = new Set([
      'react',
      'next/link',
      'motion/react',
      'lucide-react',
      '@tanstack/react-query',
    ]);

    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      const imports = [...contents.matchAll(/from '([^']+)'/g)].map(
        (match) => match[1],
      );
      for (const specifier of imports) {
        if (specifier.startsWith('@/') || specifier.startsWith('.')) continue;
        expect(allowed.has(specifier), `${source} imports ${specifier}`).toBe(true);
      }
    }
  });
});
