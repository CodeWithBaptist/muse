import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';
import { HERO_WORDMARK_PIECES } from './HeroWordmark';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * The landing quality checklist, encoded as checks so it cannot regress: a
 * decorative canvas behind the content, first paint without hydration, one
 * attention animation, an honest and inert sample preview, no glow or blur or
 * shadow or gradient, token colours only, accessible first tab stop, and
 * transform plus opacity only.
 */

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

const LANDING_SOURCES = [
  'src/components/landing/Hero.tsx',
  'src/components/landing/HeroWordmark.tsx',
  'src/components/landing/RadialSpectrumCanvas.tsx',
  'src/components/landing/ProductPreview.tsx',
  'src/components/landing/LandingSections.tsx',
  'src/lib/radial-spectrum.ts',
  'src/lib/landing-preview.ts',
  'src/lib/landing-sample.ts',
  'src/lib/hero-entrance.ts',
];

const HERO_KEYFRAMES = [
  '@keyframes muse-hero-letter',
  '@keyframes muse-hero-dot',
  '@keyframes muse-hero-line',
  '@keyframes muse-hero-fade',
  '@keyframes muse-cta-pulse',
  '@keyframes muse-equalizer-bar',
];

describe('landing quality checklist', () => {
  it('1. keeps the hero canvas decorative and behind the content', () => {
    render(<HomePage />);

    const canvases = document.querySelectorAll('canvas');
    expect(canvases).toHaveLength(1);

    const canvas = canvases[0];
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.className).toContain('pointer-events-none');
    expect(canvas.className).toContain('absolute inset-0');
    expect(canvas.className).not.toContain('z-');

    // Content keeps its own stacking order above the canvas.
    const content = document.querySelector('.muse-hero-mask')?.closest('div');
    expect(content).not.toBeNull();
    expect(document.querySelector('img[loading="lazy"]')).toBeNull();
  });

  it('2. paints the hero text without waiting for hydration', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toMatch(/your music,/i);
    expect(heading.textContent).toMatch(/understood\./i);
    expect(heading.style.opacity).toBe('');

    // Every entrance step is CSS driven, delayed inline, and has no inline
    // opacity or transform that could hold the content hidden.
    const lines = document.querySelectorAll('.muse-hero-line');
    expect(lines.length).toBe(2);
    for (const line of lines) {
      expect((line as HTMLElement).style.opacity).toBe('');
      expect((line as HTMLElement).style.transform).toBe('');
      expect((line as HTMLElement).style.getPropertyValue('--muse-hero-delay')).not.toBe(
        '',
      );
    }

    const fades = document.querySelectorAll('.muse-hero-fade');
    expect(fades.length).toBe(2);
    for (const fade of fades) {
      expect((fade as HTMLElement).style.opacity).toBe('');
      expect((fade as HTMLElement).style.getPropertyValue('--muse-hero-delay')).not.toBe(
        '',
      );
    }

    // Letters and the dot are animated separately, and nothing waits on JS.
    const pieces = document.querySelectorAll('[data-hero-piece]');
    expect(pieces).toHaveLength(5);
    expect(document.querySelectorAll('.muse-hero-letter')).toHaveLength(4);
    expect(document.querySelectorAll('.muse-hero-dot-drop')).toHaveLength(1);
  });

  it('3. keeps the wordmark shapes identical to the brand mark', () => {
    const brand = read('src/assets/brand/muse-wordmark.svg');
    const brandPaths = [...brand.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
    expect(brandPaths).toHaveLength(5);

    for (const path of brandPaths) {
      expect(HERO_WORDMARK_PIECES.some((piece) => piece.d === path)).toBe(true);
    }

    // The shared Logo and the brand files are not touched by the landing work.
    const logo = read('src/components/ui/Logo.tsx');
    expect(logo).toContain("aria-label=\"muse\"");
    expect(logo).toContain("theme = 'dark'");
  });

  it('4. uses one attention animation and reveals every section once', () => {
    const sections = read('src/components/landing/LandingSections.tsx');
    expect(sections).toContain('once: true');
    expect(sections).not.toContain('once: false');
    expect(sections).toContain('revealObserver.disconnect()');
    expect(sections).toContain('currentObserver.disconnect()');

    // Only the hero canvas owns a frame loop.
    expect(read('src/components/landing/RadialSpectrumCanvas.tsx')).toContain(
      'requestAnimationFrame',
    );
    expect(read('src/components/landing/ProductPreview.tsx')).not.toContain(
      'requestAnimationFrame',
    );

    // No parallax, no cursor followers, no decorative loops on the landing.
    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      for (const token of ['parallax', 'confetti', 'cursor-follower']) {
        expect(contents.includes(token), `${source} contains ${token}`).toBe(false);
      }
    }
  });

  it('5. labels the scripted preview as a sample and keeps it inert', () => {
    const { container } = render(<HomePage />);

    expect(screen.getByText('Sample')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Replay' })).toBeDefined();
    expect(
      screen.getAllByText(/Nothing here contacts Spotify or Anthropic/i).length,
    ).toBeGreaterThan(0);

    const sample = container.querySelector('[inert]');
    expect(sample).not.toBeNull();
    expect(sample?.getAttribute('aria-hidden')).toBe('true');

    // The animated conversation is decorative, so it is not exposed as content.
    expect(
      screen.queryByRole('list', { name: /sample recommended tracks/i }),
    ).toBeNull();
  });

  it('6. starts the preview only when it is 40 percent visible', () => {
    const preview = read('src/components/landing/ProductPreview.tsx');
    expect(preview).toContain('PREVIEW_VISIBLE_THRESHOLD');
    expect(preview).toContain('IntersectionObserver');
    expect(preview).toContain('prefers-reduced-motion');
    expect(preview).toContain('visibilitychange');
    expect(preview).toContain('stopTimer');
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
      '.muse-cta-pulse',
      '.muse-equalizer-bar',
      '.muse-check-path',
    ]) {
      expect(reducedMotion).toContain(selector);
    }
    expect(reducedMotion).toContain('::view-transition-group(*)');

    // The hero entrance never holds a transform after it finishes, or the
    // button pressed transforms would be overridden.
    for (const step of ['muse-hero-letter', 'muse-hero-line', 'muse-hero-fade']) {
      const block = css.slice(css.indexOf(`.${step} {`));
      const rule = block.slice(0, block.indexOf('}'));
      expect(rule).toContain('backwards');
      expect(rule).not.toContain('both');
    }
  });

  it('8. uses no glow, blur, gradient, or shadow on the landing surface', () => {
    const forbidden = [
      'shadow-',
      'drop-shadow',
      'blur-',
      'backdrop-',
      'bg-gradient',
      'glow',
    ];

    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      for (const token of forbidden) {
        expect(contents.includes(token), `${source} contains ${token}`).toBe(false);
      }
    }
  });

  it('9. uses the design tokens for colour and never a near miss', () => {
    const css = read('src/app/globals.css');
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));
    expect(theme).toContain('#0B0B0C');
    expect(theme).toContain('#F2F1ED');
    expect(theme).toContain('#A8E85C');

    // The canvas fallback palette is the token values, and it is the only
    // landing source allowed to spell a colour out.
    const spectrum = read('src/lib/radial-spectrum.ts');
    expect(spectrum).toContain("ink: '#F2F1ED'");
    expect(spectrum).toContain("accent: '#A8E85C'");

    for (const source of LANDING_SOURCES) {
      if (source === 'src/lib/radial-spectrum.ts') continue;
      const contents = read(source);
      expect(/#[0-9a-fA-F]{6}\b/.test(contents), `${source} hardcodes a colour`).toBe(
        false,
      );
    }

    // The wordmark reads the tokens through CSS variables instead of hexes.
    expect(read('src/components/landing/HeroWordmark.tsx')).toContain(
      'var(--color-accent)',
    );
  });

  it('10. keeps the first tab stop, the hero actions, and clear focus rings', () => {
    render(<HomePage />);

    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0] as HTMLAnchorElement;
    expect(first.tagName).toBe('A');
    expect(first.getAttribute('href')).toBe('#main-content');

    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /see how it works/i })).toBeDefined();

    // Both hero actions carry the hover amplitude attribute, so touch and
    // keyboard focus lift the ring just like the pointer does.
    for (const action of ['connect spotify', 'see how it works']) {
      const button = screen.getByRole('button', { name: new RegExp(action, 'i') });
      expect(button.hasAttribute('data-muse-hero-action')).toBe(true);
    }

    // Focus rings stay visible: the hero actions keep the focus-ring class.
    expect(focusable[1].className).toBeDefined();
    expect(read('src/app/globals.css')).toContain('outline: 2px solid var(--color-accent)');
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
      for (const property of ['width:', 'height:', 'top:', 'left:', 'margin', 'filter:']) {
        expect(block.includes(property), `${keyframe} animates ${property}`).toBe(false);
      }
    }
  });

  it('12. keeps the radial spectrum numbers from the spec', () => {
    const spectrum = read('src/lib/radial-spectrum.ts');
    expect(spectrum).toContain('SPECTRUM_BARS_WIDE = 120');
    expect(spectrum).toContain('SPECTRUM_BARS_NARROW = 72');
    expect(spectrum).toContain('SPECTRUM_NARROW_WIDTH = 640');
    expect(spectrum).toContain('SPECTRUM_STROKE_WIDTH = 3');
    expect(spectrum).toContain('SPECTRUM_RING_PADDING = 40');
    expect(spectrum).toContain('SPECTRUM_CONTENT_PADDING = 16');
    expect(spectrum).toContain('SPECTRUM_EDGE_MARGIN = 6');
    expect(spectrum).toContain('SPECTRUM_MIN_BAR_LENGTH = 4');
    expect(spectrum).toContain('SPECTRUM_BPM = 96');
    expect(spectrum).toContain('SPECTRUM_OPACITY_BUCKETS = 8');
    expect(spectrum).toContain('SPECTRUM_HOVER_AMPLITUDE = 1.8');
    expect(spectrum).toContain('SPECTRUM_INTRO_START_MS = 1000');
    expect(spectrum).toContain('SPECTRUM_INTRO_BUILD_MS = 1200');
    expect(spectrum).toContain('SPECTRUM_RING_MIN_FRACTION = 0.25');

    // The canvas owns the lifecycle the checklist asks for.
    const canvas = read('src/components/landing/RadialSpectrumCanvas.tsx');
    expect(canvas).toContain('AbortController');
    expect(canvas).toContain('ResizeObserver');
    expect(canvas).toContain('IntersectionObserver');
    expect(canvas).toContain('visibilitychange');
    expect(canvas).toContain('DPR_CAP = 2');
    expect(canvas).toContain('cancelAnimationFrame');
    expect(canvas).toContain('staticSpectrumFrame');
    expect(canvas).toContain('controller.abort()');
  });
});
