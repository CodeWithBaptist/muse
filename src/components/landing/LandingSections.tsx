'use client';

import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { Logo } from '@/components/ui/Logo';

const STEPS = [
  {
    title: 'Describe the vibe',
    description: 'Tell MUSE what you want to hear using natural language. No need for complex filters.',
  },
  {
    title: 'MUSE understands',
    description: 'Our AI analyzes your request and searches through millions of tracks on Spotify.',
  },
  {
    title: 'Expert curation',
    description: 'Receive personalized recommendations with clear explanations for each choice.',
  },
  {
    title: 'Build & sync',
    description: 'Create and sync playlists directly to your Spotify account with one click.',
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-20 bg-surface/30">
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="space-y-4 text-center">
          <h2 className="text-3xl font-bold">How MUSE works</h2>
          <p className="text-text-secondary max-w-xl mx-auto type-body">
            A simple, intelligent flow designed to get you to your next favorite song faster.
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
              <div className="text-accent text-sm font-semibold tabular-nums">0{i + 1}</div>
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="type-caption leading-relaxed">
                {step.description}
              </p>
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
              <li key={i} className="flex items-center gap-3 type-body text-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="aspect-square bg-gradient-to-br from-surface to-background border border-border-strong rounded-2xl flex items-center justify-center p-12">
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
  return (
    <footer className="px-6 py-12 border-t border-border-subtle">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <Logo variant="wordmark" size={100} />
        <div className="flex gap-8 type-caption">
          <a href="#" className="hover:text-text-primary transition-colors">Privacy</a>
          <a href="#" className="hover:text-text-primary transition-colors">Terms</a>
          <a href="#" className="hover:text-text-primary transition-colors">Spotify Policy</a>
        </div>
        <div className="type-caption opacity-50">
          &copy; 2026 MUSE. Built for music.
        </div>
      </div>
    </footer>
  );
}
