import { describe, expect, it } from 'vitest';
import {
  PREVIEW_BEATS,
  PREVIEW_TRACK_STAGGER_MS,
  PREVIEW_TRACK_STAGGER_STEPS,
  previewBeatStyle,
  previewItemDelayMs,
  previewTotalMs,
  previewTrackDelayMs,
  previewTrackStyle,
} from './preview-timeline';

describe('landing preview timeline', () => {
  it('runs the prompt, thinking, reply, and action beats in order', () => {
    expect(PREVIEW_BEATS.map((beat) => beat.id)).toEqual([
      'prompt',
      'thinking',
      'reply',
      'action',
    ]);

    const starts = PREVIEW_BEATS.map((beat) => beat.startMs);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    expect(Math.min(...starts)).toBe(0);
  });

  it('crossfades the thinking beat into the reply', () => {
    const thinking = previewItemDelayMs('thinking');
    const reply = previewItemDelayMs('reply');

    expect(reply).toBeGreaterThan(thinking);
    expect(reply - thinking).toBeGreaterThanOrEqual(1500);
    expect(reply - thinking).toBeLessThan(1900);
  });

  it('reveals the rows after the reply and the example control last', () => {
    expect(previewTrackDelayMs(0)).toBeGreaterThan(previewItemDelayMs('reply'));
    expect(previewItemDelayMs('action')).toBeGreaterThan(
      previewTrackDelayMs(0) + PREVIEW_TRACK_STAGGER_MS,
    );
  });

  it('caps the row stagger so longer lists still land together', () => {
    expect(previewTrackDelayMs(0)).toBe(2900);
    expect(previewTrackDelayMs(1)).toBe(2960);
    expect(previewTrackDelayMs(7)).toBe(3320);
    expect(previewTrackDelayMs(40)).toBe(
      previewTrackDelayMs(PREVIEW_TRACK_STAGGER_STEPS - 1),
    );
    expect(previewTrackDelayMs(40)).toBeLessThan(previewTotalMs());
  });

  it('finishes the whole script in under five seconds', () => {
    expect(previewTotalMs()).toBe(4080);
    expect(previewTotalMs()).toBeLessThan(5000);
  });

  it('maps the beats onto inline animation timing', () => {
    expect(previewBeatStyle('thinking')).toEqual({
      animationDelay: '620ms',
      animationDuration: '1900ms',
    });
    expect(previewTrackStyle(2)).toEqual({
      animationDelay: '3020ms',
      animationDuration: '320ms',
    });
  });
});
