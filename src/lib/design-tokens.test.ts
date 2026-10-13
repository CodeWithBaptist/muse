import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, meetsAA } from './color';
import {
  colorVariables,
  colors,
  durations,
  layout,
  lightColors,
  radii,
  vibeTintVariables,
  vibeTints,
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

  it('mirrors the light theme block too, and keeps its text readable', () => {
    const start = css.search(/html\[data-theme=["']light["']\]/);
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('}', start));
    for (const [token, variable] of Object.entries(colorVariables)) {
      const match = block.match(new RegExp(`${variable}:\\s*([^;]+);`));
      expect(match?.[1].trim().toLowerCase()).toBe(
        lightColors[token as keyof typeof lightColors].toLowerCase(),
      );
    }
    expect(
      contrastRatio(lightColors.textMuted, lightColors.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.textSecondary, lightColors.surface),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.accent, lightColors.background),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.background, lightColors.accent),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.accentPrimary, lightColors.accentContrast),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.accentContrast, lightColors.accentPrimary),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightColors.accentBoundary, lightColors.background),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(lightColors.textFaint, lightColors.background),
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps every vibe wash aligned with its lime CSS token', () => {
    for (const [name, variable] of Object.entries(vibeTintVariables)) {
      expect(cssValue(variable).toLowerCase()).toBe(
        vibeTints[name as keyof typeof vibeTints].toLowerCase(),
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

  it('keeps links, primary actions, and danger within AA contrast', () => {
    expect(meetsAA(colors.accent, colors.background, 'text')).toBe(true);
    expect(meetsAA(colors.accent, colors.surface, 'text')).toBe(true);
    expect(meetsAA(colors.background, colors.accent, 'text')).toBe(true);
    expect(meetsAA(colors.accentContrast, colors.accentPrimary, 'text')).toBe(
      true,
    );
    expect(meetsAA(colors.danger, colors.background, 'text')).toBe(true);
    expect(meetsAA(colors.danger, colors.surface, 'text')).toBe(true);
  });

  it('keeps accent edges and primary fills above the non-text minimum', () => {
    expect(contrastRatio(colors.accent, colors.background)).toBeGreaterThan(3);
    expect(contrastRatio(colors.accent, colors.surface)).toBeGreaterThan(3);
    expect(
      contrastRatio(colors.accentPrimary, colors.background),
    ).toBeGreaterThan(3);
    expect(contrastRatio(colors.accentPrimary, colors.surface)).toBeGreaterThan(
      3,
    );
  });
});

/** Alpha-composite token colors as the existing tint and opacity utilities do. */
function composite(foreground: string, background: string, alpha: number) {
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const fg = channels(foreground);
  const bg = channels(background);
  return (
    '#' +
    fg
      .map((value, i) =>
        Math.round(value * alpha + bg[i] * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

describe('accent states in both themes', () => {
  for (const [theme, palette] of Object.entries({
    dark: colors,
    light: lightColors,
  })) {
    for (const surface of [palette.background, palette.surface]) {
      it(`${theme} on ${surface}: text, selection, focus and filled controls pass AA`, () => {
        expect(contrastRatio(palette.accent, surface)).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrastRatio(palette.background, palette.accent),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(palette.accentBoundary, surface),
        ).toBeGreaterThanOrEqual(3);
        expect(
          contrastRatio(palette.accentContrast, palette.accentPrimary),
        ).toBeGreaterThanOrEqual(4.5);
        const hover = composite(palette.accentPrimary, surface, 0.9);
        // A lime fill on paper needs the explicit olive perimeter, including opacity hover.
        const hoverBoundary = composite(palette.accentBoundary, surface, 0.9);
        expect(contrastRatio(hoverBoundary, surface)).toBeGreaterThanOrEqual(3);
        expect(
          contrastRatio(palette.accentContrast, hover),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(composite(palette.accentContrast, surface, 0.9), hover),
        ).toBeGreaterThanOrEqual(4.5);
      });

      it(`${theme} on ${surface}: tinted badges and reduced-opacity labels stay readable`, () => {
        // Covers active rows (15%), badges (10%), messages (5%) and list surfaces (2%).
        for (const alpha of [0.02, 0.05, 0.08, 0.1, 0.15]) {
          const tint = composite(palette.accent, surface, alpha);
          expect(contrastRatio(palette.accent, tint)).toBeGreaterThanOrEqual(
            4.5,
          );
          expect(
            contrastRatio(palette.textPrimary, tint),
          ).toBeGreaterThanOrEqual(4.5);
        }
        expect(
          contrastRatio(composite(palette.accent, surface, 0.8), surface),
        ).toBeGreaterThanOrEqual(4.5);
        for (const tint of Object.values(vibeTints)) {
          const wash = composite(tint, surface, theme === 'dark' ? 0.09 : 0.07);
          expect(contrastRatio(palette.accent, wash)).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      });
    }
  }
});

describe('light lime fill boundaries', () => {
  it('keeps lime out of light text and uses contrasting borders around lime controls', () => {
    expect(lightColors.accentPrimary).toBe(colors.accentPrimary);
    expect(lightColors.accentContrast).toBe('#0B0B0C');
    expect(lightColors.accent).not.toBe(lightColors.accentPrimary);
    for (const surface of [lightColors.background, lightColors.surface]) {
      expect(
        contrastRatio(lightColors.accentBoundary, surface),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(lightColors.accentBoundary, lightColors.accentPrimary),
      ).toBeGreaterThanOrEqual(3);
    }
    for (const file of [
      '../components/ui/Button.tsx',
      '../components/landing/StartAction.tsx',
      '../components/shell/PlaybackButton.tsx',
      '../components/playlist/CreateInSpotifyButton.tsx',
      '../components/chat/ChatInput.tsx',
      '../app/(app)/playlists/page.tsx',
    ]) {
      const source = readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).toContain(
        'border border-accent-boundary bg-accent-primary',
      );
      expect(source).toContain('text-accent-contrast');
    }
  });
});

it('checks all body and large-text roles on both surfaces in both themes', () => {
  for (const palette of [colors, lightColors]) {
    for (const surface of [palette.background, palette.surface]) {
      for (const role of [
        'textPrimary',
        'textSecondary',
        'textMuted',
        'danger',
      ] as const) {
        expect(contrastRatio(palette[role], surface)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
      expect(contrastRatio(palette.textFaint, surface)).toBeGreaterThanOrEqual(
        3,
      );
    }
  }
});
