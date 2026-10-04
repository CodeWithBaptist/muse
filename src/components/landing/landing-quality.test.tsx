import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';

vi.mock('motion/react', async () => {
  const { motionMock } = await import('@/test/motion-mock');
  return motionMock;
});

/**
 * The ten point quality checklist for the landing page, encoded as checks so it
 * cannot regress: decorative canvas, first paint without hydration, one
 * attention animation, an honest scripted preview, no fake results, reduced
 * motion in CSS, no glow or blur or shadow or gradient, token colours only,
 * accessible first tab stop, and transform plus opacity only.
 */

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

const LANDING_SOURCES = [
  'src/components/landing/Hero.tsx',
  'src/components/landing/ProductPreview.tsx',
  'src/components/landing/LandingSections.tsx',
  'src/components/landing/RidgelineCanvas.tsx',
  'src/components/landing/hero-canvas-draw.ts',
  'src/lib/hero-entrance.ts',
  'src/lib/preview-timeline.ts',
];

describe('landing quality checklist', () => {
  it('1. keeps the hero canvas decorative and never lazy loaded', () => {
    render(<HomePage />);

    const canvases = document.querySelectorAll('canvas');
    expect(canvases).toHaveLength(1);

    const canvas = canvases[0];
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.className).toContain('pointer-events-none');
    expect(canvas.className).toContain('absolute inset-0');
    expect(document.querySelector('img[loading="lazy"]')).toBeNull();
  });

  it('2. paints the hero text without waiting for hydration', () => {
    render(<HomePage />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.style.opacity).toBe('');

    const heroItems = document.querySelectorAll('.muse-hero-enter');
    expect(heroItems.length).toBeGreaterThanOrEqual(3);
    for (const item of heroItems) {
      expect((item as HTMLElement).style.opacity).toBe('');
      expect((item as HTMLElement).style.animationDelay).not.toBe('');
    }
  });

  it('3. runs one attention animation and reveals sections once', () => {
    const sections = read('src/components/landing/LandingSections.tsx');
    expect(sections).toContain('once: true');
    expect(sections).not.toContain('once: false');

    const preview = read('src/components/landing/ProductPreview.tsx');
    expect(preview).toContain('IntersectionObserver');
    expect(preview).toContain('prefers-reduced-motion');
    expect(preview).toContain("node.dataset.play = 'armed'");
  });

  it('4. labels the scripted preview as illustrative and inert', () => {
    render(<HomePage />);

    expect(screen.getByText('Illustrative preview')).toBeDefined();
    expect(
      screen.getByText(/does not contact Spotify or OpenAI/i),
    ).toBeDefined();
    expect(
      screen.getByText(/Nothing here contacts Spotify or OpenAI/i),
    ).toBeDefined();

    const control = screen.getByTestId('create-in-spotify');
    expect(control.getAttribute('data-status')).toBe('idle');

    const primary = screen.getByTestId('create-in-spotify-primary');
    expect(primary.tagName).toBe('BUTTON');
    expect((primary as HTMLButtonElement).disabled).toBe(true);

    // The animated conversation is decorative, so it is not exposed as content.
    expect(
      screen.queryByRole('list', { name: /sample recommended tracks/i }),
    ).toBeNull();
  });

  it('5. never shows a fake create result on the landing page', () => {
    render(<HomePage />);

    expect(document.querySelector('[data-success="true"]')).toBeNull();
    expect(document.querySelector('[data-status="error"]')).toBeNull();
    expect(document.querySelector('[data-status="partial"]')).toBeNull();

    // The success and failure labels only exist as hidden width sizers.
    const created = screen.getByText('Playlist created.');
    expect(created.getAttribute('aria-hidden')).toBe('true');
    expect(created.className).toContain('invisible');
  });

  it('6. handles reduced motion in CSS for every landing animation', () => {
    const css = read('src/app/globals.css');
    const reducedMotion = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce)'),
    );

    expect(reducedMotion).toContain('.muse-hero-enter');
    expect(reducedMotion).toContain('.muse-hero-rise');
    expect(reducedMotion).toContain('.muse-preview [data-preview-item]');
    expect(reducedMotion).toContain('.muse-equalizer-bar');
    expect(reducedMotion).toContain('.muse-check-path');
    expect(reducedMotion).toContain('::view-transition-group(*)');
  });

  it('7. uses no glow, blur, gradient, or shadow on the landing surface', () => {
    const forbidden = [
      'shadow-',
      'drop-shadow',
      'blur-',
      'backdrop-',
      'bg-gradient',
      'glow',
      'parallax',
    ];

    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      for (const token of forbidden) {
        expect(contents.includes(token), `${source} contains ${token}`).toBe(false);
      }
    }
  });

  it('8. uses the design tokens for colour and never a near miss', () => {
    const css = read('src/app/globals.css');
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));
    expect(theme).toContain('#0B0B0C');
    expect(theme).toContain('#F2F1ED');
    expect(theme).toContain('#A8E85C');

    for (const source of LANDING_SOURCES) {
      const contents = read(source);
      expect(/#[0-9a-fA-F]{6}\b/.test(contents), `${source} hardcodes a colour`).toBe(
        false,
      );
    }

    // The canvas fallback palette has to match the tokens exactly.
    const ridgeline = read('src/lib/ridgeline.ts');
    expect(ridgeline).toContain("background: '#0B0B0C'");
    expect(ridgeline).toContain("ink: '#F2F1ED'");
    expect(ridgeline).toContain("accent: '#A8E85C'");
  });

  it('9. keeps the first tab stop and the hero actions reachable', () => {
    render(<HomePage />);

    const focusable = document.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0] as HTMLAnchorElement;
    expect(first.tagName).toBe('A');
    expect(first.getAttribute('href')).toBe('#main-content');

    expect(screen.getByRole('button', { name: /connect spotify/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /see how it works/i })).toBeDefined();

    // The example control is inert, so it can never take focus in the demo.
    const primary = screen.getByTestId('create-in-spotify-primary');
    expect((primary as HTMLButtonElement).disabled).toBe(true);
  });

  it('10. animates transform and opacity only, so nothing shifts layout', () => {
    const css = read('src/app/globals.css');

    for (const keyframe of [
      '@keyframes muse-hero-enter',
      '@keyframes muse-hero-rise',
      '@keyframes muse-preview-enter',
      '@keyframes muse-preview-thinking',
      '@keyframes muse-equalizer-bar',
    ]) {
      const start = css.indexOf(keyframe);
      expect(start, `${keyframe} is missing`).toBeGreaterThan(-1);
      const block = css.slice(start, css.indexOf('}', css.indexOf('100%', start)) + 1);
      for (const property of ['width:', 'height:', 'top:', 'left:', 'margin', 'filter:']) {
        expect(block.includes(property), `${keyframe} animates ${property}`).toBe(false);
      }
    }
  });
});
