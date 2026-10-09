'use client';

import * as React from 'react';
import { motion, HTMLMotionProps, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';
import { spring } from '@/lib/motion';
import { EqualizerBars } from '@/components/motion/EqualizerBars';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

/*
 * Every size clears the 40px minimum pointer target. Text stays at 14px or
 * above so labels remain readable at the small size.
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm gap-2',
  md: 'h-11 px-6 text-sm gap-2',
  lg: 'h-12 px-8 text-base gap-2.5',
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent-primary text-accent-contrast hover:bg-accent-primary/90',
  secondary:
    'bg-surface text-text-primary border border-border-subtle hover:border-border-strong',
  ghost:
    'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface',
  outline:
    'bg-transparent border border-border-strong text-text-primary hover:bg-surface',
};

export interface ButtonVariantOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/**
 * Class list for anything that should look like a button, including links.
 * Keeps anchors and buttons visually identical without duplicating classes.
 */
export function buttonVariants({
  variant = 'primary',
  size = 'md',
  className,
}: ButtonVariantOptions = {}): string {
  return cn(
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md font-semibold transition-colors focus-ring select-none',
    'disabled:opacity-50 disabled:pointer-events-none',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export interface ButtonProps extends Omit<
  HTMLMotionProps<'button'>,
  'children'
> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Marks the button busy: it is disabled, announced as busy, and shows the
   * equalizer beside the label. Only set this while real work is in flight.
   */
  loading?: boolean;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      type = 'button',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const shouldReduceMotion = useReducedMotion() ?? false;
    const isDisabled = disabled || loading;
    const canLift = !shouldReduceMotion && !isDisabled;

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        whileHover={canLift ? { scale: 1.02, y: -1 } : undefined}
        whileTap={canLift ? { scale: 0.98, y: 0 } : undefined}
        transition={spring}
        className={buttonVariants({ variant, size, className })}
        {...props}
      >
        {loading ? (
          <EqualizerBars
            bars={3}
            height={12}
            tone={variant === 'primary' ? 'dark' : 'accent'}
            playing
          />
        ) : null}
        {children}
      </motion.button>
    );
  },
);

Button.displayName = 'Button';
