'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTaste } from '@/hooks/use-taste';

/**
 * One line under the vibes that says whether MUSE is leaning on the
 * visitor's own listening, and where to bring it in or change it. Reads
 * the snapshot on the device; nothing is fetched.
 */
export function TasteHint() {
  const { snapshot } = useTaste();
  return (
    <p className="text-sm text-text-muted" data-testid="taste-hint">
      {snapshot ? (
        <>
          Leaning on your listening from {snapshot.label}.{' '}
          <Link
            href="/profile"
            className="font-semibold text-text-secondary hover:text-accent"
          >
            Change it on Profile
          </Link>
          .
        </>
      ) : (
        <>
          Bring your listening from Last.fm or a Spotify data export on the{' '}
          <Link
            href="/profile"
            className="font-semibold text-text-secondary hover:text-accent"
          >
            Profile page
          </Link>{' '}
          and MUSE leans on it.
        </>
      )}
    </p>
  );
}
