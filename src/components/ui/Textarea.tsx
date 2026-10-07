'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldClasses } from './Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Multi-line field with the shared field styling. It does not auto-grow; the
 * chat composer keeps its own sizing because it anchors to the viewport.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          fieldClasses,
          'min-h-11 resize-y px-4 py-3 leading-relaxed',
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
