'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Logo } from '@/components/ui/Logo';

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

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-20 bg-surface/30">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-bold">How MUSE works</h2>
          <p className="text-text-secondary max-w-xl mx-auto type-body">
            A simple, intelligent flow designed to get you to your next favorite
            song faster.
          </p>
        </div>

        <motion.div
          variants={staggerContainer(0.1)}
          initial="initial"
          whileInView="animate"
          viewport={{ once: false, amount: 0.2 }}
          className="grid md:grid-cols-4 gap-8"
        >
          {STEPS.map((step, i) => (
            <motion.div key={i} variants={fadeInUp} className="space-y-4">
              <div className="text-accent text-sm font-semibold tabular-nums">
                0{i + 1}
              </div>
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="type-caption leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export function Features() {
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
        <div className="space-y-8">
          <h2 className="text-4xl font-semibold leading-tight">
            Designed for the <br /> modern listener.
          </h2>
          <ul className="grid grid-cols-1 gap-4">
            {FEATURES.map((feature, i) => (
              <li
                key={i}
                className="flex items-center gap-3 type-body text-text-secondary"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="aspect-square bg-surface border border-border-strong rounded-2xl flex items-center justify-center p-12">
          <div className="text-center space-y-4">
            <Logo variant="mark" size={80} className="mx-auto" />
            <p className="text-sm text-text-muted italic">MUSE Intelligence</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const [activeNote, setActiveNote] = React.useState<
    'privacy' | 'terms' | null
  >(null);

  return (
    <footer className="px-6 py-12 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <Logo variant="wordmark" size={100} />
          <div className="flex gap-8 type-caption">
            <button
              type="button"
              aria-expanded={activeNote === 'privacy'}
              onClick={() =>
                setActiveNote((prev) =>
                  prev === 'privacy' ? null : 'privacy'
                )
              }
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button
              type="button"
              aria-expanded={activeNote === 'terms'}
              onClick={() =>
                setActiveNote((prev) => (prev === 'terms' ? null : 'terms'))
              }
              className="hover:text-text-primary transition-colors cursor-pointer"
            >
              Terms
            </button>
            <a
              href="https://www.spotify.com/legal/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              Spotify Policy
            </a>
          </div>
          <div className="type-caption opacity-50">
            &copy; 2026 MUSE. Built for music.
          </div>
        </div>

        {activeNote === 'privacy' && (
          <div
            data-testid="footer-privacy-note"
            className="p-4 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary leading-relaxed"
          >
            <strong className="text-text-primary font-semibold">
              Data and Privacy:{' '}
            </strong>
            MUSE connects to your Spotify account via OAuth to read listening
            context and export playlists you create. OAuth tokens are encrypted
            at rest with AES-256-GCM. You can clear saved conversation history
            in Settings or revoke app access anytime in your Spotify account.
          </div>
        )}

        {activeNote === 'terms' && (
          <div
            data-testid="footer-terms-note"
            className="p-4 rounded-lg bg-surface border border-border-subtle text-xs text-text-secondary leading-relaxed"
          >
            <strong className="text-text-primary font-semibold">
              Service Usage:{' '}
            </strong>
            MUSE is an AI music companion powered by the Spotify Web API and
            OpenAI. Track metadata and playback remain subject to your Spotify
            account agreement.
          </div>
        )}
      </div>
    </footer>
  );
}
