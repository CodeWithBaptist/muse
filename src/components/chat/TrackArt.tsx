import { cn } from '@/lib/utils';

/**
 * Cover art for a track row when a catalogue returned one. Without art the
 * tile shows the first letter of the title in the display face, so the row
 * keeps its shape and nothing pretends to be a record sleeve.
 */
export interface TrackArtProps {
  title: string;
  artworkUrl?: string;
  className?: string;
}

export function TrackArt({ title, artworkUrl, className }: TrackArtProps) {
  const base =
    'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-subtle bg-surface';
  if (artworkUrl) {
    return (
      <img
        src={artworkUrl}
        alt=""
        loading="lazy"
        decoding="async"
        width={40}
        height={40}
        data-testid="track-art"
        className={cn(base, 'object-cover', className)}
      />
    );
  }
  const initial = title.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      data-testid="track-art-initial"
      className={cn(
        base,
        'font-display text-base text-text-secondary',
        className,
      )}
    >
      {initial}
    </span>
  );
}
