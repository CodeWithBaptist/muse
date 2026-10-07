'use client';

import * as React from 'react';
import { HERO_DOT_PULSE_SCALE } from '@/lib/hero-entrance';
import { useBrandDotPulse } from '@/hooks/use-brand-dot-pulse';
import {
  LANDING_TOP_FRAGMENT,
  landingNavClickHandler,
  landingTopClickHandler,
} from '@/lib/landing-scroll';
import { LandingMark } from './LandingMark';
import { SpotifyPrimaryAction } from './SpotifyPrimaryAction';

/** The nav links, and the sections they scroll to. */
export const LANDING_NAV: ReadonlyArray<{ label: string; id: string }> = [
  { label: 'See it work', id: 'see-it-work' },
  { label: 'How it works', id: 'how-it-works' },
  { label: 'What it does', id: 'what-it-does' },
];

/**
 * The landing header.
 *
 * Solid background with a hairline underneath and no blur, so it stays readable
 * over the hero record. The mark on the left pulses its lime dot on the shared
 * beat, the nav links scroll smoothly unless motion is reduced, and the primary
 * action on the right is the same control the hero uses. The links drop out
 * below 760px, where the page reads as one column anyway.
 */
export function SiteHeader() {
  const dotRef = React.useRef<HTMLSpanElement | null>(null);
  useBrandDotPulse(dotRef, HERO_DOT_PULSE_SCALE);

  return (
    <header className="muse-header sticky top-0 z-40 border-b border-border-subtle bg-background">
      <div className="mx-auto flex h-[var(--muse-header-height)] max-w-6xl items-center justify-between gap-6 px-5 sm:px-6">
        <a
          href={LANDING_TOP_FRAGMENT}
          onClick={landingTopClickHandler()}
          aria-label="MUSE, back to the top"
          className="rounded-sm focus-ring"
        >
          <LandingMark pieceHeight={18} pulseRef={dotRef} />
        </a>

        <nav
          aria-label="Landing"
          className="hidden items-center gap-7 min-[760px]:flex"
        >
          {LANDING_NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={landingNavClickHandler(item.id)}
              className="type-caption rounded-sm text-text-secondary transition-colors hover:text-text-primary focus-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <SpotifyPrimaryAction size="sm" />
      </div>
    </header>
  );
}
