'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Shared field styling. The focus edge comes from the base stylesheet
 * (accent border plus a 1px accent shadow), so fields never carry the
 * floating ring used by buttons and links.
 */
export const fieldClasses = cn(
  'w-full rounded-md border border-border-subtle bg-surface text-sm text-text-primary',
  'placeholder:text-text-muted transition-colors hover:border-border-strong',
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border-subtle',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:shadow-[0_0_0_1px_var(--color-danger)]',
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClasses,
          'h-11 px-4 file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
