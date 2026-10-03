import { Transition, Easing } from 'motion/react';

export const durations = {
  instant: 0.09,
  fast: 0.14,
  base: 0.22,
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
  spring: {
    ...spring,
  },
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
