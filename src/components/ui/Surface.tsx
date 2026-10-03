'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/motion';

interface SurfaceProps extends HTMLMotionProps<'div'> {
  variant?: 'base' | 'raised' | 'flat';
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, variant = 'base', ...props }, ref) => {
    const variants = {
      base: 'bg-background border border-border-subtle',
      raised: 'bg-surface border border-border-subtle shadow-lg',
      flat: 'bg-surface',
    };

    return (
      <motion.div
        ref={ref}
        transition={{
          duration: transitions.standard.duration,
          ease: transitions.standard.ease as any,
        }}
        className={cn('rounded-md', variants[variant], className)}
        {...props}
      />
    );
  }
);

Surface.displayName = 'Surface';
