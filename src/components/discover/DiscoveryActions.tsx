'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Compass, Shuffle, Sparkles, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DiscoverSection } from './DiscoverSection';
import { fadeInUp, transitions } from '@/lib/motion';
import type { SpotifyTrackItem } from '@/lib/validation/api-schemas';

/**
 * The three deliberate discovery actions from sections 36, 37, and 38.
 *
 * They sit above the editorial sections because they are things the visitor
 * chooses to do, not content that loads on arrival. Each one costs several
 * model calls and several Spotify searches, so nothing here runs until it is
 * asked for.
 *
 * One result region rather than three. Showing every action's result at once
 * would put three competing lists on the page, and section 20 asks for roughly
 * one primary focus per screen.
 *
 * Section 38 is deliberately plain. No roulette, no spinning artwork, no slot
 * machine: a button, then the reasoning and the real track.
 */

interface ResultGroup {
  title: string;
  description: string;
  tracks: SpotifyTrackItem[];
}

interface NormalizedResult {
  heading: string;
  /** The honest reason when MUSE cannot make the claim the action implies. */
  unavailable?: string;
  /** Where the move started from, for section 36. */
  startingPoint?: string;
  explanation?: string;
  groups: ResultGroup[];
}

type ActionRequest =
  | { kind: 'somewhere-else' }
  | { kind: 'surprise' }
  | { kind: 'artist'; artist: string };

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '{}' : JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!res.ok) {
    throw new Error(
      typeof payload.error === 'string' && payload.error.length > 0
        ? payload.error
        : 'MUSE could not complete that request.'
    );
  }

  return payload;
}

function asGroups(value: unknown): ResultGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const group = entry as Partial<ResultGroup>;
      return {
        title: typeof group.title === 'string' ? group.title : '',
        description:
          typeof group.description === 'string' ? group.description : '',
        tracks: Array.isArray(group.tracks)
          ? (group.tracks as SpotifyTrackItem[])
          : [],
      };
    })
    .filter((group) => group.tracks.length > 0);
}

async function runAction(request: ActionRequest): Promise<NormalizedResult> {
  if (request.kind === 'somewhere-else') {
    const data = await postJson('/api/discover/somewhere-else');

    if (data.available === false) {
      return {
        heading: 'Somewhere else',
        unavailable: String(data.reason ?? ''),
        groups: [],
      };
    }

    return {
      heading: 'Somewhere else',
      startingPoint:
        typeof data.startingPoint === 'string' ? data.startingPoint : undefined,
      explanation:
        typeof data.explanation === 'string' ? data.explanation : undefined,
      groups: asGroups(data.steps),
    };
  }

  if (request.kind === 'surprise') {
    const data = await postJson('/api/discover/surprise');

    if (data.available === false) {
      return {
        heading: 'Surprise me',
        unavailable: String(data.reason ?? ''),
        groups: [],
      };
    }

    const tracks = Array.isArray(data.tracks)
      ? (data.tracks as SpotifyTrackItem[])
      : [];

    return {
      heading: 'Surprise me',
      explanation:
        typeof data.explanation === 'string' ? data.explanation : undefined,
      groups:
        tracks.length > 0
          ? [{ title: 'Outside your rotation', description: '', tracks }]
          : [],
    };
  }

  const data = await postJson('/api/discover/artist', {
    artist: request.artist,
  });

  return {
    heading: typeof data.artist === 'string' ? data.artist : 'Artist',
    groups: asGroups(data.angles),
  };
}

const ACTION_LABELS: Record<ActionRequest['kind'], string> = {
  'somewhere-else': 'Planning a route out of your rotation',
  surprise: 'Looking for something unexpected',
  artist: 'Finding angles on that artist',
};

interface DiscoveryActionsProps {
  /** Real top artists from Spotify, so the picker never offers an invented name. */
  topArtists: string[];
}

export function DiscoveryActions({ topArtists }: DiscoveryActionsProps) {
  const [selectedArtist, setSelectedArtist] = React.useState('');

  const mutation = useMutation({
    mutationFn: runAction,
  });

  const result = mutation.data;
  const pendingLabel = mutation.isPending
    ? ACTION_LABELS[mutation.variables?.kind ?? 'surprise']
    : null;

  const hasArtists = topArtists.length > 0;
  const canExplore = hasArtists && selectedArtist.length > 0;

  return (
    <section aria-label="Discovery actions" className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-text-primary">
          Go looking for something
        </h2>
        <p className="type-caption font-medium">
          Three ways to leave what you already know you like.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-b border-border-subtle pb-6">
        <Button
          variant="outline"
          onClick={() => mutation.mutate({ kind: 'somewhere-else' })}
          disabled={mutation.isPending}
          data-testid="discover-somewhere-else"
        >
          <Compass size={14} className="mr-2" />
          Take me somewhere else
        </Button>

        <Button
          variant="outline"
          onClick={() => mutation.mutate({ kind: 'surprise' })}
          disabled={mutation.isPending}
          data-testid="discover-surprise"
        >
          <Shuffle size={14} className="mr-2" />
          Surprise me
        </Button>

        <div className="flex flex-wrap items-end gap-2">
          <label
            htmlFor="discover-artist"
            className="type-section-label text-text-muted"
          >
            Explore an artist
          </label>
          <select
            id="discover-artist"
            data-testid="discover-artist-select"
            value={selectedArtist}
            onChange={(event) => setSelectedArtist(event.target.value)}
            disabled={!hasArtists || mutation.isPending}
            className="h-11 min-w-[12rem] rounded-md border border-border-strong bg-surface px-3 text-sm text-text-primary focus-ring disabled:opacity-50"
          >
            <option value="">
              {hasArtists ? 'Choose an artist' : 'No top artists yet'}
            </option>
            {topArtists.map((artist) => (
              <option key={artist} value={artist}>
                {artist}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() =>
              mutation.mutate({ kind: 'artist', artist: selectedArtist })
            }
            disabled={!canExplore || mutation.isPending}
            data-testid="discover-explore-artist"
          >
            <UserRound size={14} className="mr-2" />
            Explore
          </Button>
        </div>
      </div>

      {!hasArtists && (
        <p className="text-xs text-text-muted">
          MUSE picks that list from your real top artists on Spotify. It is
          empty until there is listening history to read.
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {mutation.isPending && (
          <motion.div
            key="pending"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="status"
            className="flex items-center gap-3 text-sm text-text-secondary"
          >
            <Sparkles size={14} className="text-accent" />
            {pendingLabel}
          </motion.div>
        )}

        {mutation.isError && !mutation.isPending && (
          <motion.div
            key="error"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="alert"
            className="space-y-1 text-sm"
          >
            <p className="font-semibold text-text-primary">
              That did not work
            </p>
            <p className="text-xs text-text-muted">
              {(mutation.error as Error).message}
            </p>
          </motion.div>
        )}

        {result && !mutation.isPending && !mutation.isError && (
          <motion.div
            key="result"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            className="space-y-10"
            data-testid="discover-action-result"
          >
            <div className="space-y-2">
              <p className="type-section-label text-accent">{result.heading}</p>

              {result.startingPoint && (
                <p className="text-sm text-text-secondary">
                  Starting from {result.startingPoint}
                </p>
              )}

              {result.explanation && (
                <p className="max-w-2xl text-sm leading-relaxed text-text-primary">
                  {result.explanation}
                </p>
              )}

              {result.unavailable && (
                <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                  {result.unavailable}
                </p>
              )}

              {!result.unavailable && result.groups.length === 0 && (
                <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                  MUSE found nothing on Spotify it could stand behind for that.
                  Try again, or pick a different starting point.
                </p>
              )}
            </div>

            {result.groups.map((group) => (
              <DiscoverSection
                key={group.title}
                title={group.title}
                description={group.description}
                tracks={group.tracks}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
