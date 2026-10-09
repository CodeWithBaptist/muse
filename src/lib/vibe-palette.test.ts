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

  it('falls back to the brand tint and gives every mood one six digit colour', () => {
    expect(paletteForVibe('')).toBe(DEFAULT_VIBE_PALETTE);
    expect(paletteForVibe(null)).toBe(DEFAULT_VIBE_PALETTE);
    expect(paletteForVibe('something with no known words').name).toBe('muse');
    expect(paletteForVibe('Amapiano for a Friday').name).toBe('piano');
    for (const text of [
      'party',
      'sad',
      'drive',
      'study',
      'gym',
      'chill',
      'anything',
    ]) {
      expect(paletteForVibe(text).tint).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
