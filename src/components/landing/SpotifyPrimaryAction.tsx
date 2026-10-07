'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';

/**
 * The primary landing action, shared by the header, the hero, and the closing
 * band.
 *
 * Signed in visitors get the link to the app. Everyone else gets the Spotify
 * connection, but only when the server has the credentials to complete it.
 * When it does not, the button is rendered disabled with a plain explanation
 * instead of sending the visitor to an error response.
 */

export const SPOTIFY_UNAVAILABLE_LABEL = 'Spotify connection unavailable';
/** The header is narrow on phones; the explanation is still attached in full. */
export const SPOTIFY_UNAVAILABLE_LABEL_COMPACT = 'Spotify unavailable';
export const SPOTIFY_UNAVAILABLE_EXPLANATION =
  'Spotify sign-in is not configured for this deployment yet, so nothing can be connected right now.';

export interface SpotifyPrimaryActionProps {
  /** Attribute that lifts the nearby canvas on hover, focus, and touch. */
  actionAttribute?: string;
  size?: 'sm' | 'md';
  className?: string;
  /**
   * Whether the server can complete a Spotify sign-in. Decided on the server
   * from the environment and passed down, so the page never guesses.
   */
  available?: boolean;
  /**
   * Id of a visible element that explains the unavailable state. When omitted,
   * the explanation is attached to the button itself for assistive technology.
   */
  unavailableDescriptionId?: string;
}

export function SpotifyPrimaryAction({
  actionAttribute,
  size = 'md',
  className,
  available = true,
  unavailableDescriptionId,
}: SpotifyPrimaryActionProps) {
  const { authenticated } = useAuth();
  const fallbackDescriptionId = React.useId();
  const marker: Record<string, string> = actionAttribute
    ? { [actionAttribute]: '' }
    : {};

  if (authenticated) {
    return (
      <Link
        href="/chat"
        {...marker}
        className={
          className ??
          (size === 'sm'
            ? 'inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-semibold text-background transition-colors hover:bg-accent/90 focus-ring'
            : 'inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent/90 focus-ring')
        }
      >
        Go to Chat
      </Link>
    );
  }

  if (!available) {
    const describedBy = unavailableDescriptionId ?? fallbackDescriptionId;
    return (
      <>
        <Button
          variant="primary"
          size={size}
          className={className}
          disabled
          aria-describedby={describedBy}
          data-spotify-login="unavailable"
        >
          {size === 'sm'
            ? SPOTIFY_UNAVAILABLE_LABEL_COMPACT
            : SPOTIFY_UNAVAILABLE_LABEL}
        </Button>
        {unavailableDescriptionId ? null : (
          <span id={fallbackDescriptionId} className="sr-only">
            {SPOTIFY_UNAVAILABLE_EXPLANATION}
          </span>
        )}
      </>
    );
  }

  return (
    <Button
      {...marker}
      variant="primary"
      size={size}
      className={className}
      onClick={() => {
        window.location.href = '/api/auth/spotify';
      }}
    >
      Connect Spotify
    </Button>
  );
}
