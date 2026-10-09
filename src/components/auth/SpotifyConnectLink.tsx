'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';
import { DEFAULT_AFTER_LOGIN } from '@/lib/auth-flow';
import { cn } from '@/lib/utils';
import {
  SPOTIFY_UNAVAILABLE_EXPLANATION,
  SPOTIFY_UNAVAILABLE_LABEL,
} from './spotify-connect-copy';

/**
 * Builds the URL that starts the Spotify sign-in, carrying the in-app path to
 * return to. The route validates the path again before trusting it.
 */
export function spotifyConnectHref(next?: string | null): string {
  if (!next || next === DEFAULT_AFTER_LOGIN) return '/api/auth/spotify';
  return `/api/auth/spotify?${new URLSearchParams({ next }).toString()}`;
}

export interface SpotifyConnectLinkProps {
  /** Whether the server can complete a Spotify sign-in. Decided server side. */
  available: boolean;
  /** In-app path to return to after Spotify, already validated by the page. */
  next?: string | null;
  /** Id of a visible element that explains the unavailable state. */
  unavailableDescriptionId?: string;
  className?: string;
}

/**
 * The one action on the login page.
 *
 * It is a real link to the auth route, so it works before any script runs and
 * reads as navigation to assistive technology. When the server cannot
 * complete a sign-in the action is disabled and says so; it never sends
 * anyone to an error response. A visitor who is already signed in gets the
 * way into the app instead.
 */
export function SpotifyConnectLink({
  available,
  next,
  unavailableDescriptionId,
  className,
}: SpotifyConnectLinkProps) {
  const { authenticated } = useAuth();
  const fallbackDescriptionId = React.useId();

  if (authenticated) {
    return (
      <Link
        href={next ?? DEFAULT_AFTER_LOGIN}
        className={cn(
          buttonVariants({ variant: 'primary', size: 'lg' }),
          className,
        )}
      >
        Continue to MUSE
      </Link>
    );
  }

  if (!available) {
    const describedBy = unavailableDescriptionId ?? fallbackDescriptionId;
    return (
      <>
        <Button
          variant="primary"
          size="lg"
          className={className}
          disabled
          aria-describedby={describedBy}
          data-spotify-login="unavailable"
        >
          {SPOTIFY_UNAVAILABLE_LABEL}
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
    <a
      href={spotifyConnectHref(next)}
      data-spotify-login="available"
      className={cn(
        buttonVariants({ variant: 'primary', size: 'lg' }),
        className,
      )}
    >
      Continue with Spotify
    </a>
  );
}
