import { describe, expect, it } from 'vitest';
import { ROLLING_PHRASES } from './landing-sample';
import {
  ROLL_DURATION_MS,
  ROLL_EASING,
  ROLL_INTERVAL_MS,
  rollingIsRepeat,
  rollingOffset,
  rollingPhraseIndex,
  rollingPosition,
  rollingPositionCount,
  rollingResetDelay,
  rollingShouldReset,
  rollingStepAt,
} from './landing-rolling';

const COUNT = ROLLING_PHRASES.length;

describe('rolling word timing', () => {
  it('rolls every 2.2 seconds over 600ms', () => {
    expect(ROLL_INTERVAL_MS).toBe(2200);
    expect(ROLL_DURATION_MS).toBe(600);
    expect(ROLL_EASING).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
    expect(rollingResetDelay()).toBe(ROLL_DURATION_MS);
  });

  it('steps once per interval', () => {
    expect(rollingStepAt(0)).toBe(0);
    expect(rollingStepAt(ROLL_INTERVAL_MS - 1)).toBe(0);
    expect(rollingStepAt(ROLL_INTERVAL_MS)).toBe(1);
    expect(rollingStepAt(ROLL_INTERVAL_MS * 3)).toBe(3);
    expect(rollingStepAt(-100)).toBe(0);
  });
});

describe('rolling word index and loop', () => {
  it('adds one repeated phrase to the column', () => {
    expect(COUNT).toBe(6);
    expect(rollingPositionCount(COUNT)).toBe(COUNT + 1);
    expect(rollingPositionCount(0)).toBe(1);
  });

  it('walks the phrases in order', () => {
    for (let step = 1; step <= COUNT; step += 1) {
      const position = rollingPosition(step, COUNT);
      expect(position).toBe(step % (COUNT + 1));
      expect(rollingPhraseIndex(position, COUNT)).toBe(
        ROLLING_PHRASES.indexOf(ROLLING_PHRASES[step % COUNT]),
      );
    }
  });

  it('lands on the repeated first phrase, then resets without moving', () => {
    const repeatStep = COUNT;
    const repeat = rollingPosition(repeatStep, COUNT);

    expect(repeat).toBe(COUNT);
    expect(rollingIsRepeat(repeat, COUNT)).toBe(true);
    expect(rollingShouldReset(repeat, COUNT)).toBe(true);
    // The repeated position shows the first phrase, so the jump back is silent.
    expect(rollingPhraseIndex(repeat, COUNT)).toBe(0);
    expect(ROLLING_PHRASES[rollingPhraseIndex(repeat, COUNT)]).toBe(
      ROLLING_PHRASES[0],
    );

    // After the reset the column starts again from the second phrase.
    const afterReset = rollingPosition(1, COUNT);
    expect(afterReset).toBe(1);
    expect(rollingPhraseIndex(afterReset, COUNT)).toBe(1);
    expect(rollingIsRepeat(afterReset, COUNT)).toBe(false);
  });

  it('never marks a real phrase as the repeat', () => {
    for (let step = 0; step < 60; step += 1) {
      const position = rollingPosition(step, COUNT);
      expect(rollingIsRepeat(position, COUNT)).toBe(position === COUNT);
    }
  });

  it('moves the column up by one line per position', () => {
    expect(rollingOffset(0)).toBe(0);
    expect(rollingOffset(1)).toBe(-1);
    expect(rollingOffset(COUNT)).toBe(-COUNT);
    expect(rollingOffset(-3)).toBe(0);
  });

  it('cycles forever without drifting', () => {
    const seen: number[] = [];
    for (let step = 0; step < (COUNT + 1) * 3; step += 1) {
      seen.push(rollingPosition(step, COUNT));
    }
    // Every cycle visits each position exactly once.
    expect(seen.slice(0, COUNT + 1)).toEqual(
      seen.slice(COUNT + 1, (COUNT + 1) * 2),
    );
  });

  it('handles a single phrase without dividing by zero', () => {
    expect(rollingPositionCount(1)).toBe(2);
    expect(rollingPosition(0, 1)).toBe(0);
    expect(rollingPosition(1, 1)).toBe(1);
    expect(rollingPosition(2, 1)).toBe(0);
    expect(rollingPhraseIndex(1, 1)).toBe(0);
  });
});
