'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  heroDotStyle,
  heroLetterStyle,
  type HeroLetterId,
} from '@/lib/hero-entrance';
import {
  LANDING_PIECE_VIEWBOX_HEIGHT,
  LANDING_PIECE_VIEWBOX_Y,
  LANDING_WORDMARK_PIECES,
  landingPieceRatio,
  type LandingWordmarkPiece,
} from '@/lib/landing-wordmark';

/**
 * The hero wordmark.
 *
 * This is a separate component from the shared Logo on purpose: the hero has to
 * animate the m, the u, the s, the e, and the dot independently, and the shared
 * Logo may not change. The path data lives in src/lib/landing-wordmark.ts, a
 * verbatim copy of src/assets/brand/muse-wordmark.svg, so the shapes stay
 * identical to the brand mark. Each piece gets its own tightly cropped viewBox
 * so a transform on a piece is measured in CSS pixels, the same on every screen
 * size.
 *
 * Colours come from the design tokens, and the animation only touches
 * transform and opacity.
 */

/**
 * The pieces come from the landing copy of the brand path data, shared with the
 * header mark and the closing band canvas. `HERO_WORDMARK_PIECES` stays the
 * export name the tests and the hero read.
 */
export type WordmarkPiece = LandingWordmarkPiece;

export type HeroWordmarkPieceId = HeroLetterId | 'dot';

export const HERO_WORDMARK_PIECES: readonly WordmarkPiece[] =
  LANDING_WORDMARK_PIECES;

function PieceSvg({ piece }: { piece: WordmarkPiece }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`${piece.x} ${LANDING_PIECE_VIEWBOX_Y} ${piece.width} ${LANDING_PIECE_VIEWBOX_HEIGHT}`}
      className="muse-wordmark-piece block"
      style={
        {
          '--muse-wordmark-piece-ratio': String(landingPieceRatio(piece)),
        } as React.CSSProperties
      }
    >
      <path
        d={piece.d}
        style={{
          fill:
            piece.tone === 'accent'
              ? 'var(--color-accent)'
              : 'var(--color-text-primary)',
        }}
      />
    </svg>
  );
}

export interface HeroWordmarkProps {
  /** The pulse target: the loop scales this element on the shared beat. */
  pulseRef?: React.Ref<HTMLSpanElement | null>;
  className?: string;
}

export function HeroWordmark({ pulseRef, className }: HeroWordmarkProps) {
  const letters = HERO_WORDMARK_PIECES.filter(
    (piece) => piece.id !== 'dot',
  ) as readonly WordmarkPiece[];
  const dot = HERO_WORDMARK_PIECES.find((piece) => piece.id === 'dot');

  return (
    <span
      role="img"
      aria-label="muse"
      className={cn('muse-wordmark inline-flex items-end', className)}
    >
      {letters.map((piece, index) => (
        <span
          key={piece.id}
          data-hero-piece={piece.id}
          className="muse-hero-letter inline-block"
          style={heroLetterStyle(index)}
        >
          <PieceSvg piece={piece} />
        </span>
      ))}

      {dot ? (
        <span
          data-hero-piece="dot"
          className="muse-hero-dot-drop inline-block"
          style={heroDotStyle()}
        >
          <span
            ref={pulseRef}
            data-testid="hero-wordmark-dot"
            className="muse-dot-pulse inline-block"
          >
            <PieceSvg piece={dot} />
          </span>
        </span>
      ) : null}
    </span>
  );
}
