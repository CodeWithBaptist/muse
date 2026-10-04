'use client';

import * as React from 'react';
import { headerItem, headerStagger } from '@/lib/motion';
import { artworkTransitionStyle } from '@/hooks/use-artwork-transition';
import { cn } from '@/lib/utils';

/**
 * Artwork that can take part in a shared element transition. Pass
 * `transitionActive` on both the source and the destination while the
 * transition runs so both carry the same `view-transition-name`.
 */
export interface SharedArtworkProps
  extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt: string;
  transitionActive?: boolean;
  transitionName?: string;
}

export function SharedArtwork({
  src,
  alt,
  transitionActive = false,
  transitionName,
  className,
  children,
  ...props
}: SharedArtworkProps) {
  return (
    <div
      data-testid="shared-artwork"
      style={artworkTransitionStyle(transitionActive, transitionName)}
      className={cn('overflow-hidden bg-surface', className)}
      {...props}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        children
      )}
    </div>
  );
}

/**
 * Destination header reveal: title, count, and actions fade up with a 60ms
 * stagger while the artwork travels.
 */
export const PLAYLIST_HEADER_STAGGER = headerStagger;
export const PLAYLIST_HEADER_ITEM = headerItem;
