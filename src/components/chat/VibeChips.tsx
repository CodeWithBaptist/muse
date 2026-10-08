'use client';

import { cn } from '@/lib/utils';

/**
 * The starting points on an empty chat. Each chip sends its own label as the
 * message; the prompt knows what these Lagos moments mean, so no hidden
 * rewritten prompt is needed and the visitor sees exactly what was asked.
 */
export const VIBE_CHIPS: readonly string[] = [
  'Detty December',
  'Lagos traffic',
  'Owambe',
  'Sunday rice and stew',
  'Late-night drive on the Third Mainland',
  'Campus read-and-cram',
  'Morning devotion',
  'Gym grind',
  'Heartbreak but make it danceable',
];

export interface VibeChipsProps {
  onPick: (vibe: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VibeChips({ onPick, disabled, className }: VibeChipsProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <p className="type-section-label">Try a vibe</p>
      <ul
        role="list"
        aria-label="Vibes to start from"
        className="flex flex-wrap gap-2"
      >
        {VIBE_CHIPS.map((vibe) => (
          <li key={vibe}>
            <button
              type="button"
              data-vibe-chip
              disabled={disabled}
              onClick={() => onPick(vibe)}
              className="inline-flex min-h-11 items-center rounded-full border border-border-subtle bg-surface px-4 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/50 hover:text-text-primary focus-ring disabled:opacity-50"
            >
              {vibe}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
