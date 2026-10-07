import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from './color';
import {
  colorVariables,
  colors,
  durations,
  layout,
  radii,
} from './design-tokens';

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');

function cssValue(variable: string): string {
  const match = css.match(new RegExp(`${variable}:\\s*([^;]+);`));
  if (!match) throw new Error(`${variable} is not declared in globals.css`);
  return match[1].trim();
}

describe('design tokens', () => {
  it('mirrors every color declared in globals.css', () => {
    for (const [token, variable] of Object.entries(colorVariables)) {
      expect(cssValue(variable).toLowerCase()).toBe(
        colors[token as keyof typeof colors].toLowerCase(),
      );
    }
  });

  it('mirrors the radius, duration, and layout tokens', () => {
    expect(cssValue('--radius-xs')).toBe(`${radii.xs}px`);
    expect(cssValue('--radius-sm')).toBe(`${radii.sm}px`);
    expect(cssValue('--radius-md')).toBe(`${radii.md}px`);
    expect(cssValue('--radius-lg')).toBe(`${radii.lg}px`);

    expect(cssValue('--duration-instant')).toBe(`${durations.instant}ms`);
    expect(cssValue('--duration-fast')).toBe(`${durations.fast}ms`);
    expect(cssValue('--duration-base')).toBe(`${durations.base}ms`);
    expect(cssValue('--duration-slow')).toBe(`${durations.slow}ms`);
    expect(cssValue('--duration-scene')).toBe(`${durations.scene}ms`);

    expect(cssValue('--muse-header-height')).toBe(`${layout.headerHeight}px`);
    expect(cssValue('--muse-sidebar-width')).toBe(`${layout.sidebarWidth}px`);
    expect(cssValue('--muse-now-playing-width')).toBe(
      `${layout.nowPlayingWidth}px`,
    );
    expect(cssValue('--muse-topbar-height')).toBe(`${layout.topbarHeight}px`);
    expect(cssValue('--muse-bottom-nav-height')).toBe(
      `${layout.bottomNavHeight}px`,
    );
  });

  it('keeps the theme static so unused tokens still reach the browser', () => {
    expect(css).toMatch(/@theme\s+static\s*\{/);
  });

  it('keeps control radii within the 2px to 6px range', () => {
    expect(radii.xs).toBeGreaterThanOrEqual(2);
    expect(radii.md).toBeLessThanOrEqual(6);
  });
});

describe('palette contrast', () => {
  it('keeps every small-text tone at AA on both backgrounds', () => {
    for (const token of [
      'textPrimary',
      'textSecondary',
      'textMuted',
    ] as const) {
      expect(meetsAA(colors[token], colors.background, 'text')).toBe(true);
      expect(meetsAA(colors[token], colors.surface, 'text')).toBe(true);
    }
  });

  it('keeps the faint tone usable for large text and UI parts', () => {
    expect(meetsAA(colors.textFaint, colors.background, 'large-text')).toBe(
      true,
    );
    expect(meetsAA(colors.textFaint, colors.surface, 'ui')).toBe(true);
  });

  it('keeps accent and danger readable as text and as fills', () => {
    expect(meetsAA(colors.accent, colors.background, 'text')).toBe(true);
    expect(meetsAA(colors.danger, colors.background, 'text')).toBe(true);
    expect(meetsAA(colors.danger, colors.surface, 'text')).toBe(true);
    // Primary button: background text on the accent fill.
    expect(meetsAA(colors.background, colors.accent, 'text')).toBe(true);
  });

  it('keeps the focus edge at the non-text minimum on both backgrounds', () => {
    // Hairline borders are decorative. Identification of a focused field
    // relies on the accent edge, which must meet the 3:1 UI minimum.
    expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThan(3);
    expect(contrastRatio(colors.accent, colors.surface)).toBeGreaterThan(3);
  });
});
