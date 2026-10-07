'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';

/**
 * The primary landing action, shared by the header and the hero.
 *
 * Signed in visitors get the link to the app, everyone else gets the Spotify
 * connection. The behaviour, the labels, and the hover and pressed effects are
 * exactly the ones the landing already had: this only stops the header and the
 * hero from drifting apart.
 */

export interface SpotifyPrimaryActionProps {
  /** Attribute that lifts the nearby canvas on hover, focus, and touch. */
  actionAttribute?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function SpotifyPrimaryAction({
  actionAttribute,
  size = 'md',
  className,
}: SpotifyPrimaryActionProps) {
  const { authenticated } = useAuth();
  const marker: Record<string, string> = actionAttribute ? { [actionAttribute]: '' } : {};

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
