'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Activity, Compass, Sliders, User } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import type { ProfileInsightsData } from '@/lib/validation/api-schemas';

/** "Your taste in words": the written profile, whichever source it came from. */

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
  '30': '30 tracks',
  '40': '40 tracks',
  allow: 'Allow explicit tracks',
  clean: 'Prefer clean tracks',
};

export interface InsightCardsProps {
  insights: ProfileInsightsData;
  /** What the words were written from, shown under the vibe card. */
  sourceLabel: string;
  /** Account preferences exist only for signed-in testers. */
  showPreferences: boolean;
}

export function InsightCards({
  insights,
  sourceLabel,
  showPreferences,
}: InsightCardsProps) {
  const savedPreferences = Array.isArray(insights.preferences)
    ? insights.preferences
    : [];

  return (
    <motion.div
      variants={staggerContainer(0.1)}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 gap-8 md:grid-cols-2"
      data-testid="insight-cards"
    >
      <motion.div variants={fadeInUp}>
        <Surface
          variant="raised"
          className="flex h-full flex-col justify-between space-y-6 rounded-2xl p-6 sm:p-8"
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
              <p className="type-body leading-relaxed text-text-secondary">
                {insights.identity.tasteSummary}
              </p>
            </div>
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="text-[10px] font-medium uppercase italic tracking-tighter text-text-muted">
              Focusing on: {insights.identity.eraPreference}
            </p>
          </div>
        </Surface>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Surface
          variant="raised"
          className="flex h-full flex-col justify-between space-y-6 rounded-2xl p-6 sm:p-8"
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
            <p className="type-body leading-relaxed text-text-secondary">
              {insights.vibe.description}
            </p>
          </div>
          <div className="border-t border-border-subtle pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Written from {sourceLabel}
            </p>
          </div>
        </Surface>
      </motion.div>

      <motion.div variants={fadeInUp}>
        <Surface
          variant="raised"
          className="h-full space-y-6 rounded-2xl p-6 sm:p-8"
        >
          <div className="flex items-center gap-3">
            <Compass size={20} className="text-accent" />
            <h2 className="type-section-label !text-text-primary">
              Discovery DNA
            </h2>
          </div>
          <div className="space-y-4">
            <p className="type-body font-semibold">
              {insights.discovery.habit}
            </p>
            <p className="type-body leading-relaxed text-text-secondary">
              {insights.discovery.recommendation}
            </p>
          </div>
        </Surface>
      </motion.div>

      {showPreferences ? (
        <motion.div variants={fadeInUp}>
          <Surface
            variant="raised"
            className="flex h-full flex-col justify-between space-y-6 rounded-2xl p-6 sm:p-8"
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
                      className="flex flex-col justify-between gap-1 border-b border-border-subtle pb-2 text-xs last:border-0 sm:flex-row sm:items-center"
                    >
                      <dt className="font-medium text-text-muted">
                        {PREF_LABELS[pref.key] || pref.key}
                      </dt>
                      <dd className="font-semibold text-text-primary">
                        {PREF_VALUES[pref.value] || pref.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="type-body leading-relaxed text-text-secondary">
                  No explicit recommendation preferences saved yet. Configure
                  your discovery style, playlist length, and genre priorities in
                  Settings.
                </p>
              )}
            </div>

            <div className="border-t border-border-subtle pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                {savedPreferences.length > 0
                  ? `${savedPreferences.length} explicit preferences stored`
                  : 'Using default balanced curation'}
              </p>
            </div>
          </Surface>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
