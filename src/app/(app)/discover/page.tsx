'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiscoverSection } from '@/components/discover/DiscoverSection';
import { Surface } from '@/components/ui/Surface';
import { isAiNotConnectedMessage } from '@/hooks/use-chat';
import { motion } from 'motion/react';
import { staggerContainer } from '@/lib/motion';
import { Sparkles } from 'lucide-react';

interface ApiError extends Error {
  code?: string;
  status?: number;
}

export default function DiscoverPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discover'],
    queryFn: async () => {
      const res = await fetch('/api/discover');
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ApiError = new Error(errBody.error || 'Failed to fetch discover content');
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
        <h1 className="type-page-title">Discover</h1>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-6">
            <div className="h-8 bg-surface rounded w-1/4 animate-pulse" />
            <div className="flex gap-6 overflow-hidden">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="w-48 aspect-square bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const aiDisconnected =
    data?.aiConnected === false || isAiNotConnectedMessage(error);

  if (aiDisconnected) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Discover</h1>
        <Surface
          data-testid="ai-not-connected-state"
          className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl"
        >
          <div className="w-10 h-10 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto">
            <Sparkles size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">AI is not connected yet</h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Set <code className="font-mono text-xs text-text-primary">OPENAI_API_KEY</code> in your environment variables to unlock AI-curated discovery sections tailored to your taste.
          </p>
        </Surface>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 py-20 text-center space-y-4">
        <h1 className="type-page-title mb-8">Discover</h1>
        <p className="text-text-secondary font-medium">Unable to curate recommendations right now.</p>
        <p className="text-xs text-text-muted">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-16 pb-32">
      <h1 className="type-page-title">Discover</h1>

      <motion.div
        variants={staggerContainer(0.1)}
        initial="initial"
        animate="animate"
        className="space-y-16"
      >
        {data?.sections?.map((section: any, i: number) => (
          <DiscoverSection 
            key={i} 
            title={section.title} 
            description={section.description} 
            tracks={section.tracks} 
          />
        ))}
      </motion.div>
    </div>
  );
}
