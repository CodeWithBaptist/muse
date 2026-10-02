'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-accent text-background hover:bg-accent/90',
      secondary: 'bg-surface text-text-primary border border-border-subtle hover:border-border-strong',
      ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface',
      outline: 'bg-transparent border border-border-strong text-text-primary hover:bg-surface',
    };

    const sizes = {
      sm: 'h-9 px-4 text-xs',
      md: 'h-11 px-6 text-sm font-medium',
      lg: 'h-13 px-8 text-base font-semibold',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 25
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-md transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none font-semibold',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
