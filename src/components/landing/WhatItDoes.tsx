'use client';

import * as React from 'react';
import { revealStyle, useRevealOnce, CAPABILITY_STAGGER_MS } from '@/hooks/use-reveal-once';
import { prefersReducedMotion } from '@/lib/landing-scroll';
import { ROLLING_PHRASES } from '@/lib/landing-sample';
import {
  ROLL_INTERVAL_MS,
  rollingOffset,
  rollingPosition,
  rollingResetDelay,
  rollingShouldReset,
} from '@/lib/landing-rolling';

const CAPABILITIES = [
  {
    title: 'Natural language discovery',
    description: 'Describe a moment and get real tracks, not a genre list.',
  },
  {
    title: 'Why this',
    description: 'Each recommendation comes with a one-line reason.',
  },
  {
    title: 'Playlists in Spotify',
    description: 'Turn a conversation into a playlist in your own account.',
  },
  {
    title: 'Your taste in words',
    description: 'A profile written from your top artists, top tracks, and recent plays.',
  },
] as const;

/** The rolling column, with the first phrase repeated so the loop is seamless. */
const ROLL_COLUMN = [...ROLLING_PHRASES, ROLLING_PHRASES[0]];

/**
 * What it does.
 *
 * One very large line rolls through the phrases like a slot machine, in a window
 * one line tall. The animated column is decorative, and a visually hidden
 * sentence carries every phrase for a screen reader. The roll pauses when the
 * tab is hidden or the section is offscreen, and reduced motion shows the first
 * phrase and nothing else.
 */
export function WhatItDoes() {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const [position, setPosition] = React.useState(0);
  const [instant, setInstant] = React.useState(false);
  const stepRef = React.useRef(0);
  const [listRef, listArmed] = useRevealOnce<HTMLUListElement>();

  React.useEffect(() => {
    if (prefersReducedMotion()) return;
    if (typeof IntersectionObserver !== 'function') return;
    const node = sectionRef.current;
    if (!node) return;

    const controller = new AbortController();
    const { signal } = controller;
    const count = ROLLING_PHRASES.length;

    let intervalId = 0;
    let resetId = 0;
    let frameId = 0;
    let running = false;
    let inView = false;

    const clearReset = () => {
      if (resetId !== 0) {
        window.clearTimeout(resetId);
        resetId = 0;
      }
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const stop = () => {
      running = false;
      if (intervalId !== 0) {
        window.clearInterval(intervalId);
        intervalId = 0;
      }
      clearReset();
    };

    const advance = () => {
      stepRef.current += 1;
      const next = rollingPosition(stepRef.current, count);
      setInstant(false);
      setPosition(next);

      if (!rollingShouldReset(next, count)) return;
      clearReset();
      resetId = window.setTimeout(() => {
        // Jump back to the first phrase with the transition off, then put it
        // back on before the next roll.
        setInstant(true);
        setPosition(0);
        stepRef.current = 0;
        frameId = window.requestAnimationFrame(() => {
          frameId = window.requestAnimationFrame(() => setInstant(false));
        });
      }, rollingResetDelay());
    };

    const start = () => {
      if (running || !inView || document.hidden) return;
      running = true;
      intervalId = window.setInterval(advance, ROLL_INTERVAL_MS);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        inView = entry.isIntersecting;
        if (inView) start();
        else stop();
      },
      { threshold: 0.2 },
    );
    observer.observe(node);

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibilityChange, { signal });

    return () => {
      stop();
      observer.disconnect();
      controller.abort();
    };
  }, []);

  return (
    <section
      id="what-it-does"
      ref={sectionRef}
      aria-labelledby="what-it-does-heading"
      className="scroll-mt-24 border-t border-border-subtle px-5 py-20 sm:px-6 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl space-y-4">
          <p className="type-section-label">What it does</p>
          <h2
            id="what-it-does-heading"
            className="type-display text-[clamp(28px,5vw,48px)] text-balance"
          >
            Ask for anything. It listens.
          </h2>
        </div>

        <div className="mt-14 space-y-4">
          <p className="type-section-label">Try asking for</p>

          <div
            className="muse-roll-window type-display text-[clamp(36px,8vw,84px)]"
            style={{ height: '1em' }}
            data-testid="rolling-window"
          >
            <div
              aria-hidden="true"
              data-instant={instant ? 'true' : 'false'}
              data-testid="rolling-column"
              data-position={position}
              className="muse-roll-column"
              style={{
                transform: `translate3d(0, ${rollingOffset(position)}em, 0)`,
              }}
            >
              {ROLL_COLUMN.map((phrase, index) => (
                <span
                  key={`${index}-${phrase}`}
                  className="muse-roll-phrase text-balance"
                >
                  {phrase}
                </span>
              ))}
            </div>
          </div>

          <p className="sr-only">
            Try asking for: {ROLLING_PHRASES.join(', ')}.
          </p>
        </div>

        <ul
          ref={listRef}
          data-armed={listArmed ? 'true' : 'false'}
          className="muse-reveal mt-16 grid gap-x-12 md:grid-cols-2"
        >
          {CAPABILITIES.map((capability, index) => (
            <li
              key={capability.title}
              className="border-t border-border-subtle py-6"
              style={revealStyle(index * CAPABILITY_STAGGER_MS)}
            >
              <h3 className="text-base font-semibold text-text-primary">
                {capability.title}
              </h3>
              <p className="type-body mt-2 text-text-secondary">
                {capability.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
