'use client';

import { useRevealOnce } from '@/hooks/use-reveal-once';
import { SpotifyPrimaryAction } from './SpotifyPrimaryAction';
import { ClosingBandCanvas } from './ClosingBandCanvas';

/**
 * The closing band.
 *
 * The living logo sits in a 240px canvas anchored to the bottom, behind the text,
 * with a plain fade at the two edges. It is the second and last canvas on the
 * page, and it shares the one beat loop with the hero.
 */
export interface ClosingBandProps {
  /** Decided on the server by the page; see SpotifyPrimaryAction. */
  spotifyLoginAvailable?: boolean;
}

export function ClosingBand({ spotifyLoginAvailable = true }: ClosingBandProps) {
  const [revealRef, revealArmed] = useRevealOnce<HTMLDivElement>();

  return (
    <section
      aria-labelledby="closing-heading"
      className="relative overflow-hidden px-5 pb-28 pt-24 sm:px-6 sm:pb-32"
    >
      <ClosingBandCanvas />

      <div
        ref={revealRef}
        data-armed={revealArmed ? 'true' : 'false'}
        className="muse-reveal relative z-10 mx-auto max-w-2xl space-y-6 text-center"
      >
        <p className="type-section-label">Ready when you are</p>
        <h2
          id="closing-heading"
          className="type-display text-[clamp(28px,5vw,48px)] text-balance"
        >
          Start with a feeling.
        </h2>
        <div className="pt-2">
          <SpotifyPrimaryAction
            actionAttribute="data-muse-closing-action"
            available={spotifyLoginAvailable}
          />
        </div>
      </div>
    </section>
  );
}
