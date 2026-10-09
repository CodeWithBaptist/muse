import type { Ripple } from '@/hooks/use-ripple';

/** Draws the ripples from useRipple. The parent must be positioned and clip overflow. */
export function RippleLayer({ ripples }: { ripples: Ripple[] }) {
  if (ripples.length === 0) return null;
  return (
    <span aria-hidden="true" className="muse-ripple-layer">
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          data-testid="ripple"
          className="muse-ripple muse-decorative"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </span>
  );
}
