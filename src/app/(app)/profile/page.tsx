'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { isAiNotConnectedMessage } from '@/hooks/use-chat';
import { motion } from 'motion/react';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import {
  User,
  Activity,
  Sparkles,
  Sliders,
  Link2Off,
  RefreshCw,
} from 'lucide-react';

interface ApiError extends Error {
  code?: string;
  status?: number;
}

const PREF_LABELS: Record<string, string> = {
  discoveryStyle: 'Discovery Style',
  playlistLength: 'Default Playlist Length',
  explicitContent: 'Explicit Content',
  favoriteGenres: 'Favorite Genres',
};

const PREF_VALUES: Record<string, string> = {
  balanced: 'Balanced mix of familiar and new',
  deep_cuts: 'Deep cuts and lesser-known tracks',
  familiar: 'Close to core listening taste',
  '10': '10 tracks',
  '15': '15 tracks',
  '20': '20 tracks',
  allow: 'Allow explicit tracks',
  clean: 'Prefer clean tracks',
};

export default function ProfilePage() {
  const {
    data: insights,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['profile-insights'],
    queryFn: async () => {
      const res = await fetch('/api/me/profile');
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const err: ApiError = new Error(
          errBody.error || 'Failed to fetch profile insights'
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
      <div aria-busy="true" className="p-8 space-y-12">
        <h1 className="type-page-title">Profile</h1>
        <p role="status" className="sr-only">
          Loading profile insights.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-border-subtle bg-surface"
            />
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
          <h2 className="text-lg font-bold text-text-primary">
            AI is not connected yet
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Set{' '}
            <code className="font-mono text-xs text-text-primary">
              OPENAI_API_KEY
            </code>{' '}
            in your environment variables to generate AI taste insights and
            musical DNA analysis.
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
        <h1 className="type-page-title">Profile</h1>
        <Surface
          data-testid="profile-spotify-disconnected"
          className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl"
        >
          <div className="w-10 h-10 rounded-full bg-surface border border-border-subtle flex items-center justify-center mx-auto">
            <Link2Off size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            Spotify connection required
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            Reconnect your Spotify account so MUSE can analyze your top artists,
            top tracks, and recent listening.
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

  if (error || !insights?.identity || !insights?.vibe || !insights?.discovery) {
    return (
      <div className="p-8 space-y-8">
        <h1 className="type-page-title">Profile</h1>
        <Surface className="p-12 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl max-w-2xl">
          <p className="type-body text-text-primary font-semibold">
            Unable to load your musical DNA
          </p>
          <p className="text-xs text-text-muted">
            {(error as Error | null)?.message ||
              'Ensure your Spotify account and AI configuration are active.'}
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

  const savedPreferences: Array<{
    key: string;
    value: string;
    source: string;
  }> = Array.isArray(insights.preferences) ? insights.preferences : [];

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
          <Surface
            variant="raised"
            className="p-8 h-full space-y-6 flex flex-col justify-between rounded-2xl"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <User size={20} className="text-accent" />
                <h2 className="type-section-label !text-text-primary">
                  Musical Identity
                </h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Dominant Genre
                  </span>
                  <p className="type-body font-semibold">
                    {insights.identity.dominantGenre}
                  </p>
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
          <Surface
            variant="raised"
            className="p-8 h-full space-y-6 flex flex-col justify-between rounded-2xl"
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Activity size={20} className="text-accent" />
                <h2 className="type-section-label !text-text-primary">
                  Current Vibe
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Inferred Mood
                  </span>
                  <p className="type-body font-semibold">
                    {insights.vibe.inferredMood}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    Inferred Energy
                  </span>
                  <p className="type-body font-semibold">
                    {insights.vibe.inferredEnergy}
                  </p>
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
              <h2 className="type-section-label !text-text-primary">
                Discovery DNA
              </h2>
            </div>
            <div className="space-y-4">
              <p className="type-body font-semibold">
                {insights.discovery.habit}
              </p>
              <p className="type-body text-text-secondary leading-relaxed">
                {insights.discovery.recommendation}
              </p>
            </div>
          </Surface>
        </motion.div>

        {/* Saved Taste Preferences */}
        <motion.div variants={fadeInUp}>
          <Surface
            variant="raised"
            className="p-8 h-full space-y-6 flex flex-col justify-between rounded-2xl"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sliders size={20} className="text-accent" />
                  <h2 className="type-section-label !text-text-primary">
                    Saved Preferences
                  </h2>
                </div>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Configure
                </Link>
              </div>

              {savedPreferences.length > 0 ? (
                <dl className="space-y-3 pt-2">
                  {savedPreferences.map((pref) => (
                    <div
                      key={pref.key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs border-b border-border-subtle pb-2 last:border-0"
                    >
                      <dt className="text-text-muted font-medium">
                        {PREF_LABELS[pref.key] || pref.key}
                      </dt>
                      <dd className="text-text-primary font-semibold">
                        {PREF_VALUES[pref.value] || pref.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="type-body text-text-secondary leading-relaxed">
                  No explicit recommendation preferences saved yet. Configure
                  your discovery style, playlist length, and genre priorities in
                  Settings.
                </p>
              )}
            </div>

            <div className="pt-4 border-t border-border-subtle">
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                {savedPreferences.length > 0
                  ? `${savedPreferences.length} explicit preferences stored`
                  : 'Using default balanced curation'}
              </p>
            </div>
          </Surface>
        </motion.div>
      </motion.div>
    </div>
  );
}
