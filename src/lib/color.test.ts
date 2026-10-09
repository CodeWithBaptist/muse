import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  formatRatio,
  meetsAA,
  parseHex,
  relativeLuminance,
} from './color';

describe('color utilities', () => {
  it('parses 6 digit and 3 digit hex colors', () => {
    expect(parseHex('#A8E85C')).toEqual({ r: 168, g: 232, b: 92 });
    expect(parseHex('fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('rejects malformed colors', () => {
    expect(() => parseHex('#12')).toThrow();
    expect(() => parseHex('lime')).toThrow();
  });

  it('computes WCAG luminance at the extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('computes the 21:1 black on white ratio regardless of order', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });

  it('applies the AA thresholds per use', () => {
    // 3.7:1 fails for small text but passes for large text and UI parts.
    expect(meetsAA('#6B6B73', '#0B0B0C', 'text')).toBe(false);
    expect(meetsAA('#6B6B73', '#0B0B0C', 'large-text')).toBe(true);
    expect(meetsAA('#6B6B73', '#0B0B0C', 'ui')).toBe(true);
  });

  it('formats ratios to one decimal', () => {
    expect(formatRatio(5.3721)).toBe('5.4:1');
    expect(formatRatio(21)).toBe('21.0:1');
  });
});
