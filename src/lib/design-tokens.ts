/**
 * TypeScript mirror of the design tokens declared in src/app/globals.css.
 *
 * The CSS is the source of truth for rendering. This mirror exists so that
 * the design system reference page and the token tests can read the same
 * values without parsing CSS at runtime. A unit test compares the two files,
 * so a change in one without the other fails the suite.
 */

export const colors = {
  background: '#0B0B0C',
  surface: '#111113',
  borderSubtle: '#232326',
  borderStrong: '#34343A',
  textPrimary: '#F2F1ED',
  textSecondary: '#A1A1A8',
  textMuted: '#85858C',
  textFaint: '#6B6B73',
  accent: '#A8E85C',
  danger: '#E8705F',
} as const;

export type ColorToken = keyof typeof colors;

/** CSS custom property name for each color token. */
export const colorVariables: Record<ColorToken, string> = {
  background: '--color-background',
  surface: '--color-surface',
  borderSubtle: '--color-border-subtle',
  borderStrong: '--color-border-strong',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  textMuted: '--color-text-muted',
  textFaint: '--color-text-faint',
  accent: '--color-accent',
  danger: '--color-danger',
};

export const fonts = {
  ui: '"Fredoka Variable", system-ui, sans-serif',
  display: '"Bagel Fat One", system-ui, sans-serif',
} as const;

/** Corner radii in pixels. Controls stay at md or below. */
export const radii = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
} as const;

/** Motion durations in milliseconds. */
export const durations = {
  instant: 90,
  fast: 140,
  base: 220,
  slow: 360,
  scene: 600,
} as const;

export const easings = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/** App shell dimensions in pixels. */
export const layout = {
  headerHeight: 64,
  sidebarWidth: 240,
  nowPlayingWidth: 280,
  topbarHeight: 64,
  bottomNavHeight: 64,
} as const;

/**
 * Breakpoints in pixels. These are Tailwind's defaults; the shell treats
 * anything below md as mobile, md to lg as tablet, and lg and up as desktop.
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** The 8px spacing grid, expressed in the Tailwind steps that land on it. */
export const spacingSteps = [2, 4, 6, 8, 10, 12, 16, 20, 24, 32] as const;

/** Minimum size of any pointer target, in pixels. */
export const MIN_TOUCH_TARGET = 40;
