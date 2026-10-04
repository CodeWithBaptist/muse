import { describe, expect, it } from 'vitest';
import {
  HERO_CHOREOGRAPHY,
  heroBeat,
  heroBeatStyle,
  heroEntranceSettleMs,
} from './hero-entrance';

describe('hero entrance choreography', () => {
  it('covers the four hero beats in a fixed order', () => {
    expect(HERO_CHOREOGRAPHY.map((beat) => beat.id)).toEqual([
      'wordmark',
      'ridge',
      'heading',
      'actions',
    ]);
  });

  it('starts the hero content early enough for a fast first paint', () => {
    for (const beat of HERO_CHOREOGRAPHY) {
      expect(beat.start).toBeGreaterThanOrEqual(0);
      expect(beat.start).toBeLessThanOrEqual(0.25);
    }
  });

  it('overlaps the beats instead of waiting for each other', () => {
    const heading = heroBeat('heading');
    const wordmark = heroBeat('wordmark');
    const actions = heroBeat('actions');

    expect(heading.start).toBeLessThan(wordmark.start + wordmark.duration);
    expect(actions.start).toBeLessThan(heading.start + heading.duration);
    expect(actions.start).toBeGreaterThan(heading.start);
  });

  it('settles the whole hero within about 1.1s', () => {
    expect(heroEntranceSettleMs()).toBe(1100);
    expect(heroEntranceSettleMs()).toBeLessThan(1400);

    const last = HERO_CHOREOGRAPHY.reduce((latest, beat) =>
      beat.start + beat.duration > latest.start + latest.duration ? beat : latest,
    );
    expect(last.id).toBe('ridge');
  });

  it('maps each beat to inline animation timing', () => {
    expect(heroBeatStyle('heading')).toEqual({
      animationDelay: '120ms',
      animationDuration: '400ms',
    });
    expect(heroBeatStyle('ridge')).toEqual({
      animationDelay: '100ms',
      animationDuration: '1000ms',
    });
  });
});
