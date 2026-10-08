'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/Button';
import {
  HERO_ACTIONS_START_MS,
  HERO_SUBTEXT_START_MS,
  heroFadeStyle,
  heroHeadlineStyle,
} from '@/lib/hero-entrance';
import { scrollToLandingSection } from '@/lib/landing-scroll';
import { HeroWordmark } from './HeroWordmark';
import { RecordGroovesCanvas } from './RecordGroovesCanvas';
import { AuthNotice } from '@/components/auth/AuthNotice';
import { StartAction } from './StartAction';

/**
 * The hero.
 *
 * The record canvas sits behind everything with pointer events off, the content
 * keeps its own stacking order, and the entrance is CSS driven so the text is
 * visible without JavaScript. The canvas measures the content block through
 * `contentRef` so it can dim the lime that would cross the text, and it scales
 * the wordmark dot through `pulseRef` from the one shared beat loop.
 *
 * The primary action opens the chat for everyone. `authError` is decided on
 * the server by the page, so a failed tester sign-in is still explained right
 * where it started.
 */
export interface HeroProps {
  authError?: string;
}

export function Hero({ authError }: HeroProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dotRef = useRef<HTMLSpanElement | null>(null);

  const scrollToHowItWorks = () => {
    scrollToLandingSection('how-it-works');
  };

  return (
    <section className="muse-hero relative flex min-h-[calc(100svh-var(--muse-header-height))] flex-col items-center justify-center overflow-hidden px-6 py-20">
      <RecordGroovesCanvas contentRef={contentRef} pulseRef={dotRef} />

      <div
        ref={contentRef}
        className="relative z-10 mx-auto w-full max-w-4xl space-y-8 text-center"
      >
        <div className="flex justify-center">
          <HeroWordmark pulseRef={dotRef} />
        </div>

        <div className="space-y-6">
          <h1 className="type-display text-[clamp(40px,7vw,80px)] text-balance">
            <span className="muse-hero-mask block overflow-hidden pt-[0.12em] -mt-[0.12em] pb-[0.16em] -mb-[0.16em]">
              <span className="muse-hero-line block" style={heroHeadlineStyle(0)}>
                Your music,
              </span>
            </span>
            <span className="muse-hero-mask block overflow-hidden pt-[0.12em] -mt-[0.12em] pb-[0.16em] -mb-[0.16em]">
              <span className="muse-hero-line block" style={heroHeadlineStyle(1)}>
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
          <StartAction actionAttribute="data-muse-hero-action" />
          <Button
            data-muse-hero-action
            variant="outline"
            onClick={scrollToHowItWorks}
          >
            See how it works
          </Button>
        </div>

        {authError ? (
          <AuthNotice
            code={authError}
            className="muse-hero-fade"
          />
        ) : null}
      </div>
    </section>
  );
}
