import { Transition, Easing } from 'motion/react';

export const durations = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
  layer: 0.26,
  slow: 0.36,
  scene: 0.6,
};

export const easings = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  emphasized: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

// Critically damped spring with minimal overshoot
export const spring = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 30,
  mass: 1,
};

export const transitions = {
  standard: {
    duration: durations.base,
    ease: easings.standard,
  },
  emphasized: {
    duration: durations.slow,
    ease: easings.emphasized,
  },
  // Cross fades between stacked layers: 10px vertical offset, 260ms, emphasized ease.
  layer: {
    duration: durations.layer,
    ease: easings.emphasized,
  },
  spring: {
    ...spring,
  },
};

// Stacked layers cross fade with a 10px vertical offset. Used by the Create in
// Spotify button and any other control that swaps its label without resizing.
export const layerFade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

// Tile hover: a 3px lift and a 1.02 scale, never a larger zoom.
export const tileHover = {
  y: -3,
  scale: 1.02,
};

export const tileHoverTransition = {
  duration: durations.fast,
  ease: easings.standard,
};

// Playlist header during a shared element transition: the title, count, and
// actions fade up with a 60ms stagger while the artwork travels.
export const HEADER_STAGGER = 0.06;

export const headerStagger = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: HEADER_STAGGER,
    },
  },
};

export const headerItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.base,
      ease: easings.emphasized,
    },
  },
};

// Track rows rise in one by one: 8px, 50ms apart, capped so long lists reveal
// the first eight rows with a stagger and the rest together (under 400ms total).
export const TRACK_ROW_STAGGER = 0.05;
export const TRACK_ROW_STAGGER_STEPS = 8;

export function trackRowRevealDelay(index: number): number {
  const step = Math.min(Math.max(index, 0), TRACK_ROW_STAGGER_STEPS - 1);
  return step * TRACK_ROW_STAGGER;
}

export const trackRowReveal = {
  initial: { opacity: 0, y: 8 },
  animate: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: trackRowRevealDelay(index),
      duration: durations.base,
      ease: easings.emphasized,
    },
  }),
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitions.standard,
};

export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 12 },
  transition: transitions.standard,
};

export const staggerContainer = (staggerChildren = 0.04, delayChildren = 0) => ({
  animate: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});
