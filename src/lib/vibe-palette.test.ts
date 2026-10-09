import { describe, expect, it } from 'vitest';
import { DEFAULT_VIBE_PALETTE, paletteForVibe } from './vibe-palette';

describe('paletteForVibe', () => {
  it('maps every starter chip to a named palette', () => {
    const chips = [
      ['Detty December', 'carnival'],
      ['Lagos traffic', 'traffic'],
      ['Owambe', 'owambe'],
      ['Sunday rice and stew', 'sunday'],
      ['Late-night drive on the Third Mainland', 'night drive'],
      ['Campus read-and-cram', 'study'],
      ['Morning devotion', 'devotion'],
      ['Gym grind', 'grind'],
      ['Heartbreak but make it danceable', 'heartbreak'],
    ];
    for (const [chip, name] of chips) {
      expect(paletteForVibe(chip).name, chip).toBe(name);
    }
  });

  it('falls back to the brand palette and keeps the lime somewhere in most moods', () => {
    expect(paletteForVibe('')).toBe(DEFAULT_VIBE_PALETTE);
    expect(paletteForVibe(null)).toBe(DEFAULT_VIBE_PALETTE);
    expect(paletteForVibe('something with no known words').name).toBe('muse');
    expect(paletteForVibe('Amapiano for a Friday').name).toBe('piano');
    for (const text of ['gym grind', 'campus cram', 'owambe']) {
      const palette = paletteForVibe(text);
      expect([palette.a, palette.b, palette.c]).toContain('#A8E85C');
    }
  });

  it('keeps energy inside 0 to 1 and colours as six digit hex', () => {
    for (const text of [
      'party',
      'sad',
      'drive',
      'study',
      'gym',
      'chill',
      'anything',
    ]) {
      const palette = paletteForVibe(text);
      expect(palette.energy).toBeGreaterThanOrEqual(0);
      expect(palette.energy).toBeLessThanOrEqual(1);
      for (const colour of [palette.a, palette.b, palette.c]) {
        expect(colour).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});
