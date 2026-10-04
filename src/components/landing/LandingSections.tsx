'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Logo } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    title: 'Describe the vibe',
    description:
      'Tell MUSE what you want to hear using natural language. No need for complex filters.',
  },
  {
    title: 'MUSE understands',
    description:
      'Our AI analyzes your request and searches through millions of tracks on Spotify.',
  },
  {
    title: 'Expert curation',
    description:
      'Receive personalized recommendations with clear explanations for each choice.',
  },
  {
    title: 'Build & sync',
    description:
      'Create and sync playlists directly to your Spotify account with one click.',
  },
];

/** Step reveals are staggered 90ms apart when they enter together. */
export const STEP_REVEAL_STAGGER_MS = 90;

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * How MUSE works.
 *
 * Each step reveals once as it enters the viewport, then the step crossing the
 * middle of the screen brightens: the band observer marks the current step, and
 * a step never un-reveals when the page is scrolled back. The highlight is a
 * state change, not an animation, so it stays clear without motion.
 */
export function HowItWorks() {
  const stepRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [revealed, setRevealed] = React.useState<boolean[]>(() =>
    STEPS.map(() => false),
  );
  const [current, setCurrent] = React.useState(-1);

  React.useEffect(() => {
    const nodes = stepRefs.current.filter(
      (node): node is HTMLDivElement => Boolean(node),
    );
    if (nodes.length === 0) return;

    const revealAll = () =>
      setRevealed((previous) =>
        previous.every(Boolean) ? previous : STEPS.map(() => true),
      );

    const indexOf = (target: Element) =>
      nodes.findIndex((node) => node === target);

    if (typeof IntersectionObserver !== 'function') {
      // Without an observer the steps are simply visible.
      const handle = window.setTimeout(() => {
        revealAll();
        setCurrent(0);
      }, 0);
      return () => window.clearTimeout(handle);
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        setRevealed((previous) => {
          const next = [...previous];
          let changed = false;
          for (const entry of entries) {
            const index = indexOf(entry.target);
            if (index >= 0 && entry.isIntersecting && !next[index]) {
              next[index] = true;
              changed = true;
            }
          }
          return changed ? next : previous;
        });
      },
      { threshold: 0.45 },
    );

    // The band around the middle of the screen marks the current step.
    const currentObserver = new IntersectionObserver(
      (entries) => {
        const inside = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => indexOf(entry.target))
          .filter((index) => index >= 0);
        if (inside.length > 0) setCurrent(Math.min(...inside));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );

    nodes.forEach((node) => {
      revealObserver.observe(node);
      currentObserver.observe(node);
    });

    return () => {
      revealObserver.disconnect();
      currentObserver.disconnect();
    };
  }, []);

  return (
    <section
      id="how-it-works"
      className="px-6 py-20 bg-surface/30 scroll-mt-24"
    >
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-bold">How MUSE works</h2>
          <p className="text-text-secondary max-w-xl mx-auto type-body">
            A simple, intelligent flow designed to get you to your next favorite
            song faster.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {STEPS.map((step, i) => (
            <div
              key={i}
              ref={(node) => {
                stepRefs.current[i] = node;
              }}
              data-step={i}
              data-revealed={revealed[i] ? 'true' : 'false'}
              data-current={current === i ? 'true' : 'false'}
              className={cn(
                'muse-step space-y-4',
                revealed[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
              )}
              style={
                {
                  '--muse-step-delay': `${i * STEP_REVEAL_STAGGER_MS}ms`,
                } as React.CSSProperties
              }
            >
              <div className="text-accent text-sm font-semibold tabular-nums">
                0{i + 1}
              </div>
              <h3
                className={cn(
                  'font-semibold text-lg',
                  current === i ? 'text-text-primary' : 'text-text-secondary',
                )}
              >
                {step.title}
              </h3>
              <p className="type-caption leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const ctaRef = React.useRef<HTMLDivElement | null>(null);
  const [pulsing, setPulsing] = React.useState(false);

  React.useEffect(() => {
    const node = ctaRef.current;
    if (!node) return;
    if (typeof IntersectionObserver !== 'function') return;
    if (prefersReducedMotion()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPulsing(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const FEATURES = [
    'Natural language discovery',
    'Spotify playlist integration',
    'Personalized AI explanations',
    'Intelligent music memory',
    'Deep genre exploration',
    'Cross-platform sync',
  ];

  return (
    <section className="px-6 py-32">
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          variants={staggerContainer(0.04)}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.25 }}
          className="space-y-8"
        >
          <motion.h2
            variants={fadeInUp}
            className="text-4xl font-semibold leading-tight"
          >
            Designed for the <br /> modern listener.
          </motion.h2>
          <ul className="grid grid-cols-1 gap-4">
            {FEATURES.map((feature, i) => (
              <motion.li
                key={i}
                variants={fadeInUp}
                className="flex items-center gap-3 type-body text-text-secondary"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-medium">{feature}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.25 }}
          className="aspect-square bg-surface border border-border-strong rounded-2xl flex items-center justify-center p-12"
        >
          <div className="text-center space-y-4">
            <div
              ref={ctaRef}
              className={cn('inline-block', pulsing && 'muse-cta-pulse')}
            >
              <Logo variant="mark" size={80} className="mx-auto" />
            </div>
            <p className="text-sm text-text-muted italic">MUSE Intelligence</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="px-6 py-12 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo variant="wordmark" size={100} />
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-8 type-caption">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-text-primary transition-colors">
              Terms
            </Link>
            <Link href="/spotify-attribution" className="hover:text-text-primary transition-colors">
              Spotify attribution
            </Link>
          </nav>
          <div className="type-caption text-text-muted">
            &copy; 2026 MUSE. Built for music.
          </div>
        </div>
      </div>
    </footer>
  );
}
