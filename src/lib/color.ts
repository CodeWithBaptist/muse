/**
 * WCAG 2.x relative luminance and contrast ratio for sRGB hex colors.
 *
 * Used by the design system reference page to display real contrast numbers,
 * and by the token tests to keep the palette honest about readability.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Expected a 3 or 6 digit hex color, received "${hex}"`);
  }

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two colors, from 1 to 21. Order does not matter. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastUse = 'text' | 'large-text' | 'ui';

/** Minimum WCAG AA contrast for a given use. */
export const AA_MINIMUM: Record<ContrastUse, number> = {
  text: 4.5,
  'large-text': 3,
  ui: 3,
};

export function meetsAA(
  foreground: string,
  background: string,
  use: ContrastUse = 'text',
): boolean {
  return contrastRatio(foreground, background) >= AA_MINIMUM[use];
}

export function formatRatio(ratio: number): string {
  return `${(Math.round(ratio * 10) / 10).toFixed(1)}:1`;
}
