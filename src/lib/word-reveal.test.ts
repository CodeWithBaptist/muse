import { describe, expect, it } from 'vitest';
import {
  WORD_REVEAL_FADE_MS,
  WORD_REVEAL_MAX_TOTAL_MS,
  WORD_REVEAL_STEP_MS,
  countWords,
  planWordReveal,
  tokenizeWords,
} from './word-reveal';

describe('word reveal plan', () => {
  it('reveals one word per step for short replies', () => {
    const plan = planWordReveal(12);
    expect(plan).toEqual({
      stepMs: WORD_REVEAL_STEP_MS,
      fadeMs: WORD_REVEAL_FADE_MS,
      chunk: 1,
    });
  });

  it('scales the chunk size so a long reply still finishes near 1.5 seconds', () => {
    const words = 90;
    const plan = planWordReveal(words);
    const steps = Math.ceil(words / plan.chunk);
    const total = steps * plan.stepMs;

    expect(plan.chunk).toBeGreaterThan(1);
    expect(total).toBeLessThanOrEqual(WORD_REVEAL_MAX_TOTAL_MS + plan.stepMs);
  });

  it('handles empty text without dividing by zero', () => {
    expect(planWordReveal(0).chunk).toBe(1);
  });

  it('keeps words and whitespace so revealed text stays selectable', () => {
    const parts = tokenizeWords('Midnight signals  in the dark.');
    expect(countWords(parts)).toBe(5);
    expect(parts.map((part) => part.token).join('')).toBe(
      'Midnight signals  in the dark.',
    );
    expect(parts.filter((part) => part.isWord).map((part) => part.wordIndex)).toEqual(
      [0, 1, 2, 3, 4],
    );
  });
});
