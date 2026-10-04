import { describe, expect, it } from 'vitest';
import {
  HERO_ACTIONS_START_MS,
  HERO_DOT_SETTLE_MS,
  HERO_DOT_START_MS,
  HERO_HEADLINE_STAGGER_MS,
  HERO_HEADLINE_START_MS,
  HERO_LETTER_STAGGER_MS,
  HERO_SUBTEXT_START_MS,
  heroDotStyle,
  heroHeadlineStyle,
  heroLetterStyle,
  heroSequenceMs,
} from './hero-entrance';

describe('hero entrance choreography', () => {
  it('stagger the wordmark letters 85ms apart', () => {
    expect(heroLetterStyle(0)).toEqual({ '--muse-hero-delay': '0ms' });
    expect(heroLetterStyle(1)).toEqual({ '--muse-hero-delay': '85ms' });
    expect(heroLetterStyle(3)).toEqual({ '--muse-hero-delay': '255ms' });
    expect(HERO_LETTER_STAGGER_MS).toBe(85);
  });

  it('drops the dot after the letters have started', () => {
    expect(heroDotStyle()).toEqual({
      '--muse-hero-delay': `${HERO_DOT_START_MS}ms`,
    });
    expect(HERO_DOT_START_MS).toBeGreaterThan(HERO_LETTER_STAGGER_MS * 3);
    expect(HERO_DOT_SETTLE_MS).toBe(1420);
  });

  it('starts the masked headline lines at 900ms, 110ms apart', () => {
    expect(heroHeadlineStyle(0)).toEqual({
      '--muse-hero-delay': '900ms',
    });
    expect(heroHeadlineStyle(1)).toEqual({
      '--muse-hero-delay': '1010ms',
    });
    expect(HERO_HEADLINE_START_MS).toBe(900);
    expect(HERO_HEADLINE_STAGGER_MS).toBe(110);
  });

  it('runs subtext then actions, and settles under 2.3s', () => {
    expect(HERO_SUBTEXT_START_MS).toBe(1400);
    expect(HERO_ACTIONS_START_MS).toBe(1600);
    expect(heroSequenceMs()).toBe(2120);
    expect(heroSequenceMs()).toBeLessThan(2300);
    expect(HERO_SUBTEXT_START_MS).toBeLessThan(HERO_ACTIONS_START_MS);
  });
});
