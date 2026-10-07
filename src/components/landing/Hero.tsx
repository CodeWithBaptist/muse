'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';
import {
  HERO_ACTIONS_START_MS,
  HERO_SUBTEXT_START_MS,
  heroFadeStyle,
  heroHeadlineStyle,
} from '@/lib/hero-entrance';
import { HeroWordmark } from './HeroWordmark';
import { RadialSpectrumCanvas } from './RadialSpectrumCanvas';

/**
 * The hero.
 *
 * The radial spectrum canvas sits behind everything, the content keeps its own
 * stacking order, and the entrance is CSS driven so the text is visible without
 * JavaScript. The canvas measures the content block through `contentRef` and
 * scales the wordmark dot through `dotRef`, so one loop drives both.
 */
export function Hero({ spotifyConfigured }: { spotifyConfigured: boolean }) {
  const { authenticated } = useAuth();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (!el) return;
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <RadialSpectrumCanvas contentRef={contentRef} pulseRef={dotRef} />

      <div
        ref={contentRef}
        className="relative z-10 max-w-4xl mx-auto text-center space-y-8"
      >
        <div className="flex justify-center">
          <HeroWordmark pulseRef={dotRef} />
        </div>

        <div className="space-y-6">
          <h1 className="type-display text-[clamp(40px,7vw,80px)] text-balance">
            <span className="muse-hero-mask block overflow-hidden pt-[0.12em] -mt-[0.12em] pb-[0.16em] -mb-[0.16em]">
              <span
                className="muse-hero-line block"
                style={heroHeadlineStyle(0)}
              >
                Your music,
              </span>
            </span>
            <span className="muse-hero-mask block overflow-hidden pt-[0.12em] -mt-[0.12em] pb-[0.16em] -mb-[0.16em]">
              <span
                className="muse-hero-line block"
                style={heroHeadlineStyle(1)}
              >
                understood.
              </span>
            </span>
          </h1>

          <p
            className="muse-hero-fade max-w-2xl mx-auto text-text-secondary text-lg md:text-xl font-medium text-balance leading-relaxed"
            style={heroFadeStyle(HERO_SUBTEXT_START_MS)}
          >
            Discover music, build playlists, and explore your taste through
            conversation.
          </p>
        </div>

        <div
          className="muse-hero-fade flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          style={heroFadeStyle(HERO_ACTIONS_START_MS)}
        >
          {authenticated ? (
            <Link
              href="/chat"
              data-muse-hero-action
              className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent/90 focus-ring"
            >
              Go to Chat
            </Link>
          ) : spotifyConfigured ? (
            <Button
              data-muse-hero-action
              onClick={() => {
                window.location.href = '/api/auth/spotify';
              }}
              variant="primary"
            >
              Connect Spotify
            </Button>
          ) : (
            // A disabled action rather than one that lands the visitor on a
            // bare JSON error. The button keeps its label so the state is
            // obvious, and it keeps the hero action hook so the spectrum
            // canvas treats both actions the same way.
            <Button
              data-muse-hero-action
              variant="primary"
              disabled
              aria-describedby="hero-spotify-unavailable"
            >
              Connect Spotify
            </Button>
          )}
          <Button data-muse-hero-action variant="outline" onClick={scrollToHowItWorks}>
            See how it works
          </Button>
        </div>

        {!authenticated && !spotifyConfigured && (
          // Deliberately not animated. This is a state notice, not content
          // arriving, and the trust fix adds no new landing motion.
          <p id="hero-spotify-unavailable" className="text-sm text-text-muted">
            Spotify connection is not configured yet.
          </p>
        )}
      </div>
    </section>
  );
}
