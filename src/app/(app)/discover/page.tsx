'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiscoverSection } from '@/components/discover/DiscoverSection';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/lib/motion';

export default function DiscoverPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['discover'],
    queryFn: async () => {
      const res = await fetch('/api/discover');
      if (!res.ok) throw new Error('Failed to fetch discover content');
      return res.json();
    },
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

  if (error) {
    return (
      <div className="p-8 py-20 text-center space-y-4">
        <h1 className="type-page-title mb-8">Discover</h1>
        <p className="text-text-secondary font-medium">Unable to curate recommendations right now.</p>
        <p className="text-xs text-text-muted">Make sure your Spotify and OpenAI credentials are set.</p>
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
