'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { isAiNotConnectedMessage } from '@/hooks/use-chat';
import { motion } from 'motion/react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { User, Activity, Sparkles, Brain } from 'lucide-react';

interface ApiError extends Error {
  code?: string;
  status?: number;
}

export default function ProfilePage() {
  const { data: insights, isLoading, error } = useQuery({
    queryKey: ['profile-insights'],
    queryFn: async () => {
      const res = await fetch('/api/me/profile');
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ApiError = new Error(errBody.error || 'Failed to fetch profile insights');
        err.code = errBody.code;
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    retry: false,
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

  const aiDisconnected =
    insights?.aiConnected === false || isAiNotConnectedMessage(error);

  if (aiDisconnected) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Profile</h1>
        <Surface
          data-testid="ai-not-connected-state"
          className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl"
        >
          <div className="w-10 h-10 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto">
            <Sparkles size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">AI is not connected yet</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Set <code className="font-mono text-xs text-text-primary">OPENAI_API_KEY</code> in your environment variables to generate AI taste insights and musical DNA analysis.
          </p>
        </Surface>
      </div>
    );
  }

  if (error || !insights?.identity || !insights?.vibe || !insights?.discovery) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Profile</h1>
        <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent">
          <p className="type-body text-text-secondary">Unable to load your musical DNA.</p>
          <p className="text-xs text-text-muted">
            {(error as Error | null)?.message || 'Ensure your Spotify account and AI configuration are active.'}
          </p>
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
