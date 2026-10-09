import { cn } from '@/lib/utils';

/**
 * A small record for a track row. Cover art, when a catalogue returned one,
 * sits on the label; otherwise the label is plain. The disc rolls in with
 * its row and turns while the row is hovered or focused, all in CSS on
 * transform, and stands still under Lite and reduced motion.
 */

export interface VinylDiscProps {
  artworkUrl?: string;
  index: number;
  className?: string;
}

export function VinylDisc({ artworkUrl, index, className }: VinylDiscProps) {
  return (
    <span
      aria-hidden="true"
      data-testid="vinyl-disc"
      className={cn(
        'muse-vinyl muse-decorative block h-10 w-10 shrink-0',
        className,
      )}
      style={{ '--muse-rise-index': index } as React.CSSProperties}
    >
      <span className="muse-vinyl-disc muse-decorative">
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="muse-vinyl-art"
          />
        ) : (
          <span className="muse-vinyl-label" />
        )}
        <span className="muse-vinyl-hole" />
      </span>
    </span>
  );
}
