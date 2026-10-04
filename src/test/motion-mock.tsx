import * as React from 'react';

/**
 * Shared motion/react mock for the landing tests.
 *
 * Landing sections render Motion components, but the checks only care about
 * markup, focus order, and the scripted preview states, so the mock strips the
 * animation props and renders plain elements. Inline styles are kept, because
 * the hero entrance checks read them.
 */

export function stripMotionProps(props: Record<string, unknown>) {
  const {
    initial,
    animate,
    exit,
    variants,
    transition,
    whileHover,
    whileTap,
    whileInView,
    viewport,
    layout,
    layoutId,
    custom,
    onAnimationStart,
    onAnimationComplete,
    ...domProps
  } = props;
  void initial;
  void animate;
  void exit;
  void variants;
  void transition;
  void whileHover;
  void whileTap;
  void whileInView;
  void viewport;
  void layout;
  void layoutId;
  void custom;
  void onAnimationStart;
  void onAnimationComplete;
  return domProps;
}

const componentCache = new Map<
  string,
  React.ComponentType<Record<string, unknown>>
>();

function createMotionComponent(tag: string) {
  const cached = componentCache.get(tag);
  if (cached) return cached;

  const Component = ({ children, ...props }: Record<string, unknown>) =>
    React.createElement(tag, stripMotionProps(props), children as React.ReactNode);
  Component.displayName = `motion.${tag}`;

  componentCache.set(tag, Component);
  return Component;
}

export const motion = new Proxy(
  {},
  {
    get: (_target, key) => {
      if (typeof key !== 'string') return undefined;
      return createMotionComponent(key);
    },
  },
) as Record<string, React.ComponentType<Record<string, unknown>>>;

export function AnimatePresence({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function MotionConfig({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export const useReducedMotion = () => false;

export const motionMock = {
  motion,
  AnimatePresence,
  MotionConfig,
  useReducedMotion,
};
