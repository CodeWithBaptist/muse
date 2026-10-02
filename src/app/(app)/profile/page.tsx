'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { User, Activity, Sparkles, Brain } from 'lucide-react';

export default function ProfilePage() {
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['profile-insights'],
    queryFn: async () => {
      const res = await fetch('/api/me/profile');
      if (!res.ok) throw new Error('Failed to fetch profile insights');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-12">
        <h1 className="type-page-title">Profile</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-64 bg-surface rounded-2xl animate-pulse border border-border-subtle" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Profile</h1>
        <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent">
          <p className="type-body text-text-secondary">Unable to load your musical DNA.</p>
          <p className="text-xs text-text-muted">Ensure your Spotify account and AI configuration are active.</p>
        </Surface>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-12 pb-32">
      <h1 className="type-page-title">Profile</h1>

      <motion.div 
        variants={staggerContainer(0.1)}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 gap-8"
      >
        {/* Musical Identity */}
        <motion.div variants={fadeInUp}>
          <Surface variant="raised" className="p-8 h-full space-y-6 flex flex-col justify-between rounded-2xl">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <User size={20} className="text-accent" />
                <h2 className="type-section-label !text-text-primary">Musical Identity</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Dominant Genre</span>
                  <p className="type-body font-semibold">{insights.identity.dominantGenre}</p>
                </div>
                <p className="type-body text-text-secondary leading-relaxed">
                  {insights.identity.tasteSummary}
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-border-subtle">
              <p className="text-[10px] text-text-muted font-medium uppercase tracking-tighter italic">
                Focusing on: {insights.identity.eraPreference}
              </p>
            </div>
          </Surface>
        </motion.div>

        {/* Current Vibe */}
        <motion.div variants={fadeInUp}>
          <Surface variant="raised" className="p-8 h-full space-y-6 flex flex-col justify-between rounded-2xl">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-accent" />
                <h2 className="type-section-label !text-text-primary">Current Vibe</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Inferred Mood</span>
                  <p className="type-body font-semibold">{insights.vibe.inferredMood}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Inferred Energy</span>
                  <p className="type-body font-semibold">{insights.vibe.inferredEnergy}</p>
                </div>
              </div>
              <p className="type-body text-text-secondary leading-relaxed">
                {insights.vibe.description}
              </p>
            </div>
            <div className="pt-4 border-t border-border-subtle">
               <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                 Derived from recent listening
               </p>
            </div>
          </Surface>
        </motion.div>

        {/* Discovery DNA */}
        <motion.div variants={fadeInUp}>
          <Surface variant="raised" className="p-8 h-full space-y-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-accent" />
              <h2 className="type-section-label !text-text-primary">Discovery DNA</h2>
            </div>
            <div className="space-y-4">
              <p className="type-body font-semibold">{insights.discovery.habit}</p>
              <p className="type-body text-text-secondary leading-relaxed">
                {insights.discovery.recommendation}
              </p>
            </div>
          </Surface>
        </motion.div>

        {/* AI Memory Status */}
        <motion.div variants={fadeInUp}>
          <Surface variant="raised" className="p-8 h-full space-y-6 border-dashed opacity-80 rounded-2xl">
            <div className="flex items-center gap-3">
              <Brain size={20} className="text-text-muted" />
              <h2 className="type-section-label">AI Memory</h2>
            </div>
            <div className="space-y-4">
              <p className="type-body text-text-muted leading-relaxed">
                MUSE is currently observing your taste. Your preferences will appear here as you continue to interact.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border-subtle">
                <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Learning active</span>
              </div>
            </div>
          </Surface>
        </motion.div>
      </motion.div>
    </div>
  );
}
