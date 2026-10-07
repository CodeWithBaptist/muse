import { describe, expect, it } from 'vitest';
import {
  STEP_BAND_ROOT_MARGIN,
  STEP_DIM_OPACITY,
  STEP_RAIL_TRANSITION_MS,
  activeStepIndex,
  markStepPlayed,
  railProgress,
  stepHasPlayed,
  stepIsActive,
  stepNumberIsAccent,
  stepOpacity,
} from './landing-steps';

describe('step activation', () => {
  it('watches the middle band of the viewport', () => {
    expect(STEP_BAND_ROOT_MARGIN).toBe('-42% 0px -42% 0px');
    expect(STEP_RAIL_TRANSITION_MS).toBe(600);
  });

  it('takes the first step crossing the band', () => {
    expect(activeStepIndex([2])).toBe(2);
    expect(activeStepIndex([3, 1, 2])).toBe(1);
    expect(activeStepIndex([0, 1])).toBe(0);
  });

  it('is nothing when no step crosses the band', () => {
    expect(activeStepIndex([])).toBe(-1);
    expect(activeStepIndex([-1, -4])).toBe(-1);
    expect(activeStepIndex([1.5])).toBe(-1);
  });
});

describe('step dimming', () => {
  it('dims the steps that are not active to 40 percent', () => {
    expect(STEP_DIM_OPACITY).toBe(0.4);
    expect(stepOpacity(1, 1)).toBe(1);
    expect(stepOpacity(1, 0)).toBe(0.4);
    expect(stepOpacity(1, 3)).toBe(0.4);
  });

  it('leaves everything at full strength while nothing is active', () => {
    for (let index = 0; index < 4; index += 1) {
      expect(stepOpacity(-1, index)).toBe(1);
      expect(stepIsActive(-1, index)).toBe(true);
    }
  });

  it('turns only the active number lime', () => {
    expect(stepNumberIsAccent(2, 2)).toBe(true);
    expect(stepNumberIsAccent(2, 1)).toBe(false);
    expect(stepNumberIsAccent(-1, 0)).toBe(false);
    expect(stepIsActive(2, 3)).toBe(false);
  });
});

describe('rail fill', () => {
  it('grows to the active step', () => {
    expect(railProgress(-1, 4)).toBe(0);
    expect(railProgress(0, 4)).toBe(0.25);
    expect(railProgress(1, 4)).toBe(0.5);
    expect(railProgress(3, 4)).toBe(1);
  });

  it('never overflows the rail', () => {
    expect(railProgress(9, 4)).toBe(1);
    expect(railProgress(0, 0)).toBe(0);
  });
});

describe('play once', () => {
  it('marks a step as played the first time it becomes active', () => {
    let played = [false, false, false, false];

    expect(stepHasPlayed(played, 1)).toBe(false);
    played = markStepPlayed(played, 1);
    expect(stepHasPlayed(played, 1)).toBe(true);
    expect(played).toEqual([false, true, false, false]);
  });

  it('keeps an earlier step played when the page scrolls back', () => {
    let played = markStepPlayed([false, false, false, false], 2);
    played = markStepPlayed(played, 0);
    expect(played).toEqual([true, false, true, false]);
  });

  it('ignores a negative activation', () => {
    const played = [false, false];
    expect(markStepPlayed(played, -1)).toEqual(played);
  });
});
