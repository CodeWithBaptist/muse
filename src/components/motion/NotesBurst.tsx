'use client';

import * as React from 'react';

/**
 * A short burst of music notes and dots from one point, for the moment a
 * playlist lands. Pure CSS motion: each particle gets its own direction and
 * spin through custom properties and animates transform and opacity only.
 * The notes are inline SVG, never emoji, so they render the same everywhere.
 * Loaded lazily and only under full effects; it unmounts itself when done.
 */

export interface NotesBurstProps {
  /** Palette for the particles; the brand lime is always included. */
  colours?: readonly string[];
  count?: number;
  onDone?: () => void;
}

const BURST_MS = 1100;

function NoteGlyph() {
  // A single quaver, drawn as one path.
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10 3v11.2A3.6 3.6 0 1 0 12 17.5V7.6l6-1.6v5.2a3.6 3.6 0 1 0 2 3.3V3l-10 2.7V3z" />
    </svg>
  );
}

interface Particle {
  id: number;
  kind: 'note' | 'dot';
  colour: string;
  dx: number;
  dy: number;
  rotate: number;
  delayMs: number;
  scale: number;
}

function makeParticles(
  count: number,
  colours: readonly string[],
  seed: number,
): Particle[] {
  // A tiny deterministic generator so a burst looks random but tests can read it.
  let state = seed || 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  return Array.from({ length: count }, (_, id) => {
    const angle = (id / count) * Math.PI * 2 + random() * 0.6;
    const distance = 56 + random() * 72;
    return {
      id,
      kind: id % 3 === 0 ? 'dot' : 'note',
      colour: colours[id % colours.length],
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance - 24),
      rotate: Math.round(random() * 240 - 120),
      delayMs: Math.round(random() * 90),
      scale: 0.7 + random() * 0.6,
    };
  });
}

export function NotesBurst({
  colours = ['#A8E85C'],
  count = 14,
  onDone,
}: NotesBurstProps) {
  const particles = React.useMemo(
    () =>
      makeParticles(
        count,
        colours.length ? colours : ['#A8E85C'],
        count * 7919,
      ),
    [colours, count],
  );

  React.useEffect(() => {
    if (!onDone) return;
    const timer = window.setTimeout(onDone, BURST_MS + 150);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <span aria-hidden="true" data-testid="notes-burst" className="muse-burst">
      {particles.map((particle) => (
        <span
          key={particle.id}
          data-kind={particle.kind}
          className="muse-burst-particle muse-decorative"
          style={
            {
              color: particle.colour,
              '--burst-dx': `${particle.dx}px`,
              '--burst-dy': `${particle.dy}px`,
              '--burst-rotate': `${particle.rotate}deg`,
              '--burst-scale': particle.scale,
              animationDelay: `${particle.delayMs}ms`,
            } as React.CSSProperties
          }
        >
          {particle.kind === 'note' ? (
            <NoteGlyph />
          ) : (
            <span className="muse-burst-dot" />
          )}
        </span>
      ))}
    </span>
  );
}

export default NotesBurst;
