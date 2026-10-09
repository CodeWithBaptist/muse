'use client';

import { cn } from '@/lib/utils';
import { useMagnetic } from '@/hooks/use-magnetic';
import { useRipple } from '@/hooks/use-ripple';
import { RippleLayer } from '@/components/ui/RippleLayer';
import { tapHaptic } from '@/lib/haptics';
import { playSound } from '@/lib/ui-sound';

/**
 * The starting points on an empty chat. Each chip sends its own label as the
 * message; the prompt knows what these Lagos moments mean, so no hidden
 * rewritten prompt is needed and the visitor sees exactly what was asked.
 * Chips rise in turn, ripple where they are pressed, lean toward a mouse,
 * and give one short buzz on phones that support it.
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

interface VibeChipProps {
  vibe: string;
  index: number;
  disabled?: boolean;
  onPick: (vibe: string) => void;
}

function VibeChip({ vibe, index, disabled, onPick }: VibeChipProps) {
  const { ripples, spawn } = useRipple();
  const magnetic = useMagnetic();
  return (
    <li
      className="muse-rise muse-decorative"
      style={{ '--muse-rise-index': index } as React.CSSProperties}
    >
      <button
        type="button"
        data-vibe-chip
        disabled={disabled}
        onPointerDown={spawn}
        onPointerMove={magnetic.onPointerMove}
        onPointerLeave={magnetic.onPointerLeave}
        onClick={() => {
          tapHaptic();
          playSound('tap');
          onPick(vibe);
        }}
        className="muse-magnetic relative inline-flex min-h-11 items-center overflow-hidden rounded-full border border-border-subtle bg-surface px-4 text-sm font-semibold text-text-secondary hover:border-accent/50 hover:text-text-primary focus-ring disabled:opacity-50"
      >
        <span className="relative z-[1]">{vibe}</span>
        <RippleLayer ripples={ripples} />
      </button>
    </li>
  );
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
        {VIBE_CHIPS.map((vibe, index) => (
          <VibeChip
            key={vibe}
            vibe={vibe}
            index={index}
            disabled={disabled}
            onPick={onPick}
          />
        ))}
      </ul>
    </div>
  );
}
