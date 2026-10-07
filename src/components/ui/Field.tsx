'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-sm font-semibold text-text-secondary',
        className,
      )}
      {...props}
    />
  ),
);

Label.displayName = 'Label';

/** Attributes a Field hands to its control so the label, hint, and error are wired up. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  label: React.ReactNode;
  /** Short guidance under the control. Hidden while an error is shown. */
  hint?: React.ReactNode;
  /** Validation message. Announced politely and shown in the danger tone. */
  error?: React.ReactNode;
  required?: boolean;
  /** Override the generated id when the control must have a known id. */
  id?: string;
  className?: string;
  children: (control: FieldControlProps) => React.ReactNode;
}

/**
 * Label, control, hint, and error as one unit. The control receives its id and
 * aria wiring through the render function, so any input can be used:
 *
 *   <Field label="Playlist name" error={error}>
 *     {(control) => <Input {...control} value={name} onChange={...} />}
 *   </Field>
 */
export function Field({
  label,
  hint,
  error,
  required,
  id,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const hasError = Boolean(error);

  const describedBy =
    [hasError ? errorId : null, hint && !hasError ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const control: FieldControlProps = {
    id: controlId,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(hasError ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={controlId}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-text-muted">
            *
          </span>
        ) : null}
      </Label>
      {children(control)}
      {hasError ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
