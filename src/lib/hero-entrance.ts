import type { CSSProperties } from 'react';

/**
 * Hero entrance choreography.
 *
 * The hero runs its entrance in CSS rather than through Motion so the content
 * paints as soon as the stylesheet is parsed, instead of waiting for hydration.
 * Every step uses `animation-fill-mode: backwards`, never `both`: backwards
 * applies the first keyframe while a step waits for its delay, and it holds
 * nothing after the step ends, so the buttons keep their pressed transforms.
 *
 * The pieces are the m, the u, the s, the e, and the dot of the wordmark, then
 * the two headline lines, the subtext, and the two actions. The whole sequence
 * settles well under 2.3 seconds. The canvas ring, and the beat pulse on the
 * dot, are the only parts driven by the animation loop.
 */

export type HeroLetterId = 'm' | 'u' | 's' | 'e';

export const HERO_LETTER_STAGGER_MS = 85;
export const HERO_LETTER_MS = 760;
export const HERO_LETTER_RISE_PX = 34;

export const HERO_DOT_START_MS = 420;
export const HERO_DOT_MS = 1000;
export const HERO_DOT_DROP_PX = 120;
export const HERO_DOT_BOUNCE_PX = 16;
/** When the dot has landed and settled, and the beat pulse may take over. */
export const HERO_DOT_SETTLE_MS = HERO_DOT_START_MS + HERO_DOT_MS;

export const HERO_HEADLINE_START_MS = 900;
export const HERO_HEADLINE_STAGGER_MS = 110;
export const HERO_HEADLINE_MS = 700;

export const HERO_SUBTEXT_START_MS = 1400;
export const HERO_ACTIONS_START_MS = 1600;
export const HERO_FADE_MS = 520;

/** How far the wordmark letters and the hero text travel, in CSS pixels. */
export const HERO_FADE_DISTANCE_PX = 12;

export const HERO_SEQUENCE_MS = HERO_ACTIONS_START_MS + HERO_FADE_MS;

/** The dot pulses up to this scale on each beat, from HERO_DOT_SETTLE_MS on. */
export const HERO_DOT_PULSE_SCALE = 0.17;

export function heroLetterDelayMs(index: number): number {
  return Math.max(0, index) * HERO_LETTER_STAGGER_MS;
}

export function heroHeadlineDelayMs(index: number): number {
  return HERO_HEADLINE_START_MS + Math.max(0, index) * HERO_HEADLINE_STAGGER_MS;
}

function delayStyle(delayMs: number): CSSProperties {
  return { '--muse-hero-delay': `${Math.round(delayMs)}ms` } as CSSProperties;
}

/** Inline delay for a wordmark letter. */
export function heroLetterStyle(index: number): CSSProperties {
  return delayStyle(heroLetterDelayMs(index));
}

/** Inline delay for the wordmark dot. */
export function heroDotStyle(): CSSProperties {
  return delayStyle(HERO_DOT_START_MS);
}

/** Inline delay for one masked headline line. */
export function heroHeadlineStyle(index: number): CSSProperties {
  return delayStyle(heroHeadlineDelayMs(index));
}

/** Inline delay for the subtext or the actions. */
export function heroFadeStyle(delayMs: number): CSSProperties {
  return delayStyle(delayMs);
}

/** When the last step of the sequence finishes, in milliseconds. */
export function heroSequenceMs(): number {
  return HERO_SEQUENCE_MS;
}
