'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  LANDING_PIECE_VIEWBOX_HEIGHT,
  LANDING_PIECE_VIEWBOX_Y,
  LANDING_WORDMARK_DOT,
  LANDING_WORDMARK_LETTERS,
  landingPieceRatio,
  type LandingWordmarkPiece,
} from '@/lib/landing-wordmark';

/**
 * The small landing mark.
 *
 * It renders the same copied path data the hero wordmark uses, so the header
 * mark, the hero wordmark, and the closing band are one shape at three sizes.
 * The dot sits in its own span so it can pulse on the shared beat without the
 * letters moving, and the piece height is an inline variable so one component
 * serves every size on the page.
 */

function PieceSvg({ piece }: { piece: LandingWordmarkPiece }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`${piece.x} ${LANDING_PIECE_VIEWBOX_Y} ${piece.width} ${LANDING_PIECE_VIEWBOX_HEIGHT}`}
      data-piece={piece.id}
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

export interface LandingMarkProps {
  /** Height of one wordmark piece, in CSS pixels. */
  pieceHeight?: number;
  /** The element the shared loop scales on the beat. */
  pulseRef?: React.Ref<HTMLSpanElement | null>;
  className?: string;
}

export function LandingMark({
  pieceHeight = 18,
  pulseRef,
  className,
}: LandingMarkProps) {
  return (
    <span
      role="img"
      aria-label="muse"
      className={cn('muse-wordmark inline-flex items-end', className)}
      style={
        {
          '--muse-wordmark-piece-height': `${pieceHeight}px`,
        } as React.CSSProperties
      }
    >
      {LANDING_WORDMARK_LETTERS.map((piece) => (
        <span key={piece.id} className="inline-block">
          <PieceSvg piece={piece} />
        </span>
      ))}
      <span className="inline-block">
        <span
          ref={pulseRef}
          data-testid="landing-mark-dot"
          className="muse-dot-pulse inline-block"
        >
          <PieceSvg piece={LANDING_WORDMARK_DOT} />
        </span>
      </span>
    </span>
  );
}
