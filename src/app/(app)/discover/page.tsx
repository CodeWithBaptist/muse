'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiscoverSection } from '@/components/discover/DiscoverSection';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { isAiNotConnectedMessage } from '@/hooks/use-chat';
import { motion } from 'motion/react';
import { staggerContainer } from '@/lib/motion';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';
import { Sparkles, Link2Off, RefreshCw, Compass } from 'lucide-react';

interface ApiError extends Error {
  code?: string;
  status?: number;
}

export default function DiscoverPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['discover'],
    queryFn: async () => {
      const res = await fetch('/api/discover');
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ApiError = new Error(
          errBody.error || 'Failed to fetch discover content'
        );
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
                <div
                  key={j}
                  className="w-48 aspect-square bg-surface rounded-lg animate-pulse"
                />
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
          <h2 className="text-lg font-bold text-text-primary">
            AI is not connected yet
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Set{' '}
            <code className="font-mono text-xs text-text-primary">
              OPENAI_API_KEY
            </code>{' '}
            in your environment variables to unlock AI-curated discovery
            sections tailored to your taste.
          </p>
        </Surface>
      </div>
    );
  }

  const apiError = error as ApiError | null;
  const isSpotifyDisconnected =
    apiError?.status === 401 ||
    apiError?.code === 'SPOTIFY_RECONNECT_REQUIRED' ||
    apiError?.code === 'SPOTIFY_DISCONNECTED';

  if (isSpotifyDisconnected) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Discover</h1>
        <Surface
          data-testid="discover-spotify-disconnected"
          className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl"
        >
          <div className="w-10 h-10 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto">
            <Link2Off size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            Spotify connection required
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Reconnect your Spotify account so MUSE can analyze your listening
            history and curate personalized discovery sections.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = '/api/auth/spotify';
              }}
            >
              Reconnect Spotify
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Discover</h1>
        <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl">
          <p className="text-text-primary font-semibold">
            Unable to curate recommendations right now
          </p>
          <p className="text-xs text-text-muted">
            {(error as Error).message}
          </p>
          <div className="pt-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw size={14} className="mr-2" />
              Try again
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  const sections: Array<{
    title: string;
    description: string;
    tracks: SpotifyTrackItem[];
  }> = (data?.sections || []).filter(
    (s: { tracks?: SpotifyTrackItem[] }) =>
      Array.isArray(s.tracks) && s.tracks.length > 0
  );

  if (sections.length === 0) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Discover</h1>
        <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl">
          <Compass size={28} className="text-text-muted mx-auto" />
          <p className="text-sm font-semibold text-text-primary">
            No discovery sections available yet
          </p>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Listen to a few tracks on Spotify or start a conversation in Chat,
            then refresh Discover.
          </p>
          <div className="pt-2">
            <Button variant="outline" onClick={() => refetch()}>
              Refresh Discover
            </Button>
          </div>
        </Surface>
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
        {sections.map((section, i) => (
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
