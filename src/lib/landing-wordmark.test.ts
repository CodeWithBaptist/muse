import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LANDING_PIECE_VIEWBOX_HEIGHT,
  LANDING_PIECE_VIEWBOX_Y,
  LANDING_WORDMARK_BASELINE,
  LANDING_WORDMARK_DOT,
  LANDING_WORDMARK_HEIGHT,
  LANDING_WORDMARK_LETTERS,
  LANDING_WORDMARK_PIECES,
  LANDING_WORDMARK_WIDTH,
  landingPieceRatio,
} from './landing-wordmark';

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

const brandPaths = () => {
  const brand = read('src/assets/brand/muse-wordmark.svg');
  return [...brand.matchAll(/d="([^"]+)"/g)].map((match) => match[1]);
};

describe('landing wordmark data', () => {
  it('copies the brand path data verbatim, so the shapes are identical', () => {
    const paths = brandPaths();
    expect(paths).toHaveLength(5);
    expect(LANDING_WORDMARK_PIECES).toHaveLength(5);

    for (const brandPath of paths) {
      expect(
        LANDING_WORDMARK_PIECES.some((piece) => piece.d === brandPath),
        `no landing piece matches ${brandPath.slice(0, 24)}`,
      ).toBe(true);
    }
    for (const piece of LANDING_WORDMARK_PIECES) {
      expect(paths).toContain(piece.d);
    }
  });

  it('leaves the shared Logo and the brand files alone', () => {
    const logo = read('src/components/ui/Logo.tsx');
    expect(logo).toContain('aria-label="muse"');
    // Since the light theme shipped the default follows the page tokens, and
    // the pinned dark colours stay available for surfaces that never change.
    expect(logo).toContain("theme = 'auto'");
    expect(logo).toContain("theme === 'dark'");
    // The landing module never imports the shared component.
    const landing = read('src/lib/landing-wordmark.ts');
    expect(landing).not.toContain('@/components/ui/Logo');
  });

  it('carries the geometry the canvases draw from', () => {
    expect(LANDING_WORDMARK_WIDTH).toBe(274);
    expect(LANDING_WORDMARK_HEIGHT).toBe(54);
    expect(LANDING_WORDMARK_BASELINE).toBe(0);
    expect(LANDING_PIECE_VIEWBOX_Y).toBe(-76);
    expect(LANDING_PIECE_VIEWBOX_HEIGHT).toBe(104);
  });

  it('splits the four ink letters from the accent dot', () => {
    expect(LANDING_WORDMARK_LETTERS).toHaveLength(4);
    expect(LANDING_WORDMARK_LETTERS.map((piece) => piece.id)).toEqual([
      'm',
      'u',
      's',
      'e',
    ]);
    expect(LANDING_WORDMARK_DOT.id).toBe('dot');
    expect(LANDING_WORDMARK_DOT.tone).toBe('accent');
  });

  it('gives each piece its own aspect ratio', () => {
    for (const piece of LANDING_WORDMARK_PIECES) {
      expect(piece.width).toBeGreaterThan(0);
      expect(landingPieceRatio(piece)).toBeCloseTo(
        piece.width / LANDING_PIECE_VIEWBOX_HEIGHT,
        10,
      );
    }
  });

  it('tiles across the full wordmark width', () => {
    const first = LANDING_WORDMARK_PIECES[0];
    const last = LANDING_WORDMARK_PIECES[LANDING_WORDMARK_PIECES.length - 1];
    expect(first.x).toBeLessThan(last.x);
    expect(last.x + last.width).toBeLessThanOrEqual(LANDING_WORDMARK_WIDTH);
  });
});
