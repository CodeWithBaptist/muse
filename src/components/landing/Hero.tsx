'use client';

import { useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/ui/Logo';
import { heroBeatStyle } from '@/lib/hero-entrance';
import Link from 'next/link';
import { RidgelineCanvas } from './RidgelineCanvas';

export function Hero() {
  const { authenticated } = useAuth();
  const shouldReduceMotion = useReducedMotion() ?? false;
  const contentRef = useRef<HTMLDivElement | null>(null);

  const scrollToHowItWorks = () => {
    const el = document.getElementById('how-it-works');
    if (el) {
      el.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden">
      <RidgelineCanvas
        contentRef={contentRef}
        className="muse-hero-enter muse-hero-enter-ridge"
        style={heroBeatStyle('ridge')}
      />

      <div
        ref={contentRef}
        className="relative z-10 max-w-4xl mx-auto text-center space-y-8"
      >
        <div className="flex justify-center overflow-hidden">
          <div className="muse-hero-rise" style={heroBeatStyle('wordmark')}>
            <Logo variant="wordmark" size={240} className="md:w-[480px] md:h-auto" />
          </div>
        </div>

        <div className="muse-hero-enter space-y-6" style={heroBeatStyle('heading')}>
          <h1 className="type-display text-[clamp(40px,7vw,80px)] text-balance">
            Your music,<br />understood.
          </h1>
          <p className="max-w-2xl mx-auto text-text-secondary text-lg md:text-xl font-medium text-balance leading-relaxed">
            Discover music, build playlists, and explore your taste through conversation.
          </p>
        </div>

        <div
          className="muse-hero-enter flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          style={heroBeatStyle('actions')}
        >
          {authenticated ? (
            <Link
              href="/chat"
              className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-background transition-colors hover:bg-accent/90 focus-ring"
            >
              Go to Chat
            </Link>
          ) : (
            <Button
              onClick={() => {
                window.location.href = '/api/auth/spotify';
              }}
              variant="primary"
            >
              Connect Spotify
            </Button>
          )}
          <Button variant="outline" onClick={scrollToHowItWorks}>
            See how it works
          </Button>
        </div>
      </div>
    </section>
  );
}
