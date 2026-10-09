'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { BadgeCheck, CircleHelp } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { fadeInUp, transitions } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { RegionTag } from '@/lib/ai/playlist-engine';
import { searchLinksFor } from '@/lib/catalogue/search-links';
import type { ListedTrack, TrackVerification } from '@/lib/catalogue/types';
import { PlaylistActions } from './PlaylistActions';
import { TrackLinks } from './TrackLinks';
import { VinylDisc } from './VinylDisc';
import { WordReveal } from './WordReveal';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/use-auth';
import { useTilt } from '@/hooks/use-tilt';
import { useEffectsLevel } from '@/hooks/use-ui-prefs';
import { useVibe } from '@/hooks/use-vibe';
import { BeatVisualizer } from '@/components/motion/BeatVisualizer';
import { claimCelebration } from '@/lib/celebrate-store';
import { playSound } from '@/lib/ui-sound';
import { paletteForVibe } from '@/lib/vibe-palette';

/** The arrival burst, fetched only when a fresh playlist lands under full effects. */
const NotesBurst = dynamic(() => import('@/components/motion/NotesBurst'), {
  ssr: false,
});

/** Tester-only Spotify export, loaded only for signed-in testers so guests never download it. */
const SpotifyListExport = dynamic(
  () =>
    import('@/components/playlist/SpotifyListExport').then(
      (m) => m.SpotifyListExport,
    ),
  { ssr: false },
);

/**
 * The list MUSE builds: title, artist, one line on why, a region tag, and
 * what the catalogue check found. Verified picks link to the catalogue
 * entry; unverified picks say so and offer search links instead of being
 * hidden, because a missing catalogue entry is not proof a song is wrong.
 */

const REGION_STYLES: Record<RegionTag, string> = {
  Nigeria: 'border-accent/40 bg-accent/10 text-accent',
  Africa: 'border-border-strong bg-surface text-text-primary',
  Global: 'border-border-subtle bg-transparent text-text-secondary',
};

const SOURCE_LABELS = { deezer: 'Deezer', itunes: 'Apple Music' } as const;

/** The services offered under an unverified pick; Audiomack and Boomplay lead. */
const UNVERIFIED_SEARCH_SERVICES = [
  'audiomack',
  'boomplay',
  'youtube-music',
] as const;

export function RegionBadge({ region }: { region: RegionTag }) {
  return (
    <span
      data-region={region}
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-[10px] font-semibold uppercase tracking-wider',
        REGION_STYLES[region],
      )}
    >
      {region}
    </span>
  );
}

function unverifiedExplanation(verification: TrackVerification): string {
  switch (verification.reason) {
    case 'title_not_found':
      return 'The artist is in the catalogues, this title was not found there.';
    case 'lookup_failed':
      return 'The catalogue check did not finish for this one.';
    default:
      return 'Not found in the catalogues MUSE checks.';
  }
}

export function VerificationBadge({
  verification,
}: {
  verification: TrackVerification;
}) {
  if (verification.status === 'verified') {
    const label = `Verified on ${SOURCE_LABELS[verification.source ?? 'deezer']}`;
    const inner = (
      <>
        <BadgeCheck size={12} aria-hidden="true" />
        <span>{label}</span>
      </>
    );
    const className =
      'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-border-subtle px-2 text-[10px] font-semibold text-text-secondary';
    return verification.url ? (
      <a
        href={verification.url}
        target="_blank"
        rel="noopener noreferrer"
        data-verification="verified"
        className={cn(
          className,
          'hover:border-accent/50 hover:text-text-primary focus-ring',
        )}
      >
        {inner}
      </a>
    ) : (
      <span data-verification="verified" className={className}>
        {inner}
      </span>
    );
  }
  return (
    <span
      data-verification="unverified"
      title={unverifiedExplanation(verification)}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-dashed border-border-strong px-2 text-[10px] font-semibold text-text-secondary"
    >
      <CircleHelp size={12} aria-hidden="true" />
      <span>Unverified</span>
    </span>
  );
}

function UnverifiedHelp({
  track,
}: {
  track: ListedTrack & { verification: TrackVerification };
}) {
  const links = searchLinksFor(track, UNVERIFIED_SEARCH_SERVICES);
  return (
    <p
      className="text-xs leading-relaxed text-text-muted"
      data-testid="unverified-help"
    >
      {unverifiedExplanation(track.verification)} <span>Search it on </span>
      {links.map((link, index) => (
        <React.Fragment key={link.service}>
          {index > 0 ? (index === links.length - 1 ? ' or ' : ', ') : ''}
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-text-secondary underline-offset-2 hover:text-text-primary hover:underline focus-ring"
          >
            {link.label}
          </a>
        </React.Fragment>
      ))}
      .
    </p>
  );
}

export interface RecommendationListProps {
  tracks: ListedTrack[];
  title?: string;
  /** True when MUSE returned fewer songs than it aims for. */
  short?: boolean;
  /** Picks left out because no catalogue knew the artist. */
  dropped?: number;
}

interface RecommendationRowProps {
  track: ListedTrack;
  index: number;
}

function RecommendationRow({ track, index }: RecommendationRowProps) {
  const tilt = useTilt();
  return (
    <motion.li
      data-testid="recommendation-row"
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      transition={{
        ...transitions.standard,
        delay: Math.min(index * 0.04, 0.4),
      }}
      className="group"
    >
      <div
        className="muse-tilt flex gap-4 px-5 py-3.5"
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
      >
        <span className="w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums text-text-muted">
          {index + 1}
        </span>
        <VinylDisc
          artworkUrl={track.verification?.artworkUrl}
          index={index}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-text-primary">
              {track.title}
            </span>
            <span className="text-xs font-medium text-text-secondary">
              {track.artist}
            </span>
            <RegionBadge region={track.region} />
            {track.verification ? (
              <VerificationBadge verification={track.verification} />
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-text-secondary">
            <WordReveal
              text={track.why}
              startDelayMs={Math.min(index, 8) * 140}
            />
          </p>
          {track.verification?.status === 'unverified' ? (
            <UnverifiedHelp
              track={{ ...track, verification: track.verification }}
            />
          ) : null}
          <TrackLinks track={track} className="pt-1" />
        </div>
      </div>
    </motion.li>
  );
}

/**
 * Plays the arrival burst and chime once for a list that just came back from
 * MUSE. Claiming happens a frame after mount so history restores stay quiet
 * and the check never runs during render.
 */
function useArrival(): [boolean, () => void] {
  const [burst, setBurst] = React.useState(false);
  const effects = useEffectsLevel();
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!claimCelebration()) return;
      playSound('arrive');
      if (effects === 'full') setBurst(true);
    });
    return () => window.cancelAnimationFrame(frame);
    // Runs once per mount on purpose: an arrival is a moment, not a state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const done = React.useCallback(() => setBurst(false), []);
  return [burst, done];
}

export function RecommendationList({
  tracks,
  title,
  short,
  dropped = 0,
}: RecommendationListProps) {
  const headingId = React.useId();
  const { authenticated } = useAuth();
  const [burst, finishBurst] = useArrival();
  const palette = paletteForVibe(useVibe());
  if (tracks.length === 0) return null;

  const checked = tracks.some((track) => track.verification);
  const verifiedCount = tracks.filter(
    (track) => track.verification?.status === 'verified',
  ).length;

  return (
    <Surface
      variant="raised"
      data-testid="recommendation-list"
      data-arrival={burst ? 'burst' : 'quiet'}
      aria-labelledby={headingId}
      className="overflow-hidden border-accent/20 bg-accent/[0.02]"
    >
      <div className="flex items-start gap-4 border-b border-border-subtle px-5 py-4">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface">
          <BeatVisualizer />
          {burst ? (
            <NotesBurst
              colours={[palette.a, palette.b, palette.c, '#A8E85C']}
              onDone={finishBurst}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id={headingId}
            className="truncate text-base font-bold text-text-primary"
          >
            {title || 'MUSE mix'}
          </h3>
          <p className="text-xs font-medium text-text-secondary">
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
            {checked ? `, ${verifiedCount} verified` : ''}
            {short ? ', only the ones MUSE was sure about' : ''}
          </p>
        </div>
      </div>

      <ol
        role="list"
        aria-label={title || 'Recommended songs'}
        className="divide-y divide-border-subtle"
      >
        {tracks.map((track, index) => (
          <RecommendationRow key={track.id} track={track} index={index} />
        ))}
      </ol>

      <div className="space-y-3 border-t border-border-subtle px-5 py-3">
        <PlaylistActions title={title || 'MUSE mix'} tracks={tracks} />
        {authenticated ? (
          <SpotifyListExport title={title || 'MUSE mix'} tracks={tracks} />
        ) : null}
      </div>

      <p className="border-t border-border-subtle px-5 py-3 text-xs leading-relaxed text-text-muted">
        {checked
          ? 'Picked by MUSE, then checked against Deezer and the Apple iTunes Search API. MUSE is not affiliated with or endorsed by Deezer or Apple.'
          : 'Picked by MUSE from what it knows. These were not checked against a music catalogue, so a title or credit may be off.'}
        {dropped > 0
          ? ` ${dropped} ${dropped === 1 ? 'pick was' : 'picks were'} left out because no catalogue lists the artist.`
          : ''}
      </p>
    </Surface>
  );
}
