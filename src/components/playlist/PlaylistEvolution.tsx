'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TrackRow, type Track } from '@/components/chat/TrackRow';
import { fadeInUp, transitions } from '@/lib/motion';
import {
  EVOLUTION_INTENTS,
  EVOLUTION_INTENT_LABELS,
  type EvolutionIntent,
} from '@/lib/validation/api-schemas';

/**
 * Section 34. The four offers that appear after a playlist exists.
 *
 * Every offer produces a preview and stops there. Nothing is written to MUSE or
 * to Spotify until the visitor confirms, and the confirm control is the only way
 * this component can cause a write. The split is enforced server side too: the
 * preview handler has no write path at all.
 *
 * The result of confirming is reported exactly as it happened, including the
 * case where the tracks landed in MUSE but Spotify refused them, because those
 * two genuinely can disagree and collapsing them into one success would hide a
 * real failure.
 */

interface PreviewTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { images?: { url?: string }[] };
  duration_ms?: number;
}

interface PreviewResponse {
  preview: {
    intent: EvolutionIntent;
    explanation: string;
    tracks: PreviewTrack[];
    skippedDuplicates: number;
  };
  existingTrackCount: number;
}

interface ConfirmResponse {
  addedCount: number;
  unresolvedTrackIds: string[];
  spotifyUpdated: boolean;
  spotifyStatus: number | null;
  inSpotify: boolean;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      typeof payload.error === 'string' && payload.error.length > 0
        ? payload.error
        : 'That did not work.'
    );
  }

  return payload as T;
}

interface PlaylistEvolutionProps {
  playlistId: string;
  /** True when this playlist has already been created in Spotify. */
  inSpotify: boolean;
  onPlaylistChanged: () => void;
}

export function PlaylistEvolution({
  playlistId,
  inSpotify,
  onPlaylistChanged,
}: PlaylistEvolutionProps) {
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [outcome, setOutcome] = React.useState<ConfirmResponse | null>(null);

  const evolve = useMutation({
    mutationFn: (intent: EvolutionIntent) =>
      postJson<PreviewResponse>(`/api/playlists/${playlistId}/evolve`, {
        intent,
      }),
    onSuccess: (data) => {
      setPreview(data);
      setOutcome(null);
    },
  });

  const confirm = useMutation({
    mutationFn: (trackIds: string[]) =>
      postJson<ConfirmResponse>(
        `/api/playlists/${playlistId}/evolve/confirm`,
        { trackIds }
      ),
    onSuccess: (data) => {
      setOutcome(data);
      setPreview(null);
      onPlaylistChanged();
    },
  });

  const busy = evolve.isPending || confirm.isPending;
  const proposedTracks = preview?.preview.tracks ?? [];

  return (
    <div className="border-t border-border-subtle pt-4">
      <p className="type-section-label mb-3 text-text-muted">Evolve</p>

      <div className="flex flex-wrap gap-2">
        {EVOLUTION_INTENTS.map((intent) => (
          <Button
            key={intent}
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => evolve.mutate(intent)}
            data-testid={`evolve-${intent}`}
          >
            {EVOLUTION_INTENT_LABELS[intent]}
          </Button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {evolve.isPending && (
          <motion.p
            key="evolving"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="status"
            className="mt-4 flex items-center gap-2 text-xs text-text-secondary"
          >
            <Sparkles size={12} className="text-accent" />
            Looking for tracks that would fit. Nothing has changed yet.
          </motion.p>
        )}

        {evolve.isError && !evolve.isPending && (
          <motion.p
            key="evolve-error"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="alert"
            className="mt-4 text-xs text-text-muted"
          >
            {(evolve.error as Error).message}
          </motion.p>
        )}

        {preview && !busy && (
          <motion.div
            key="preview"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            className="mt-4 space-y-4"
            data-testid="evolve-preview"
          >
            <p className="max-w-2xl text-sm leading-relaxed text-text-primary">
              {preview.preview.explanation}
            </p>

            {proposedTracks.length === 0 ? (
              <p className="text-xs text-text-muted">
                MUSE found nothing on Spotify it could add to this playlist.
                {preview.preview.skippedDuplicates > 0
                  ? ` ${preview.preview.skippedDuplicates} of the results were already in it.`
                  : ''}
              </p>
            ) : (
              <>
                <div role="list" aria-label="Proposed additions">
                  {proposedTracks.map((track, index) => (
                    <TrackRow
                      key={track.id}
                      track={track as Track}
                      index={index}
                      listItem
                    />
                  ))}
                </div>

                <p className="text-xs text-text-muted">
                  {proposedTracks.length} proposed. Nothing has been added yet.
                  {preview.preview.skippedDuplicates > 0
                    ? ` ${preview.preview.skippedDuplicates} results were skipped because this playlist already has them.`
                    : ''}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      confirm.mutate(proposedTracks.map((track) => track.id))
                    }
                    data-testid="evolve-confirm"
                  >
                    {inSpotify ? 'Add to playlist and Spotify' : 'Add to playlist'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setPreview(null)}
                  >
                    Discard preview
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {confirm.isError && !busy && (
          <motion.p
            key="confirm-error"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="alert"
            className="mt-4 text-xs text-red-400"
          >
            {(confirm.error as Error).message}
          </motion.p>
        )}

        {outcome && !busy && (
          <motion.div
            key="outcome"
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={transitions.standard}
            role="status"
            className="mt-4 space-y-1 text-xs"
            data-testid="evolve-outcome"
          >
            <p className="font-semibold text-text-primary">
              Added {outcome.addedCount}{' '}
              {outcome.addedCount === 1 ? 'track' : 'tracks'}.
            </p>

            {outcome.inSpotify && outcome.spotifyUpdated && (
              <p className="text-text-secondary">
                The playlist in Spotify was updated too.
              </p>
            )}

            {outcome.inSpotify && !outcome.spotifyUpdated && (
              <p className="text-text-secondary">
                These tracks are in your MUSE playlist, but Spotify did not
                accept the change
                {outcome.spotifyStatus !== null
                  ? ` and returned status ${outcome.spotifyStatus}`
                  : ''}
                . The playlist in Spotify is unchanged.
              </p>
            )}

            {outcome.unresolvedTrackIds.length > 0 && (
              <p className="text-text-muted">
                {outcome.unresolvedTrackIds.length} proposed{' '}
                {outcome.unresolvedTrackIds.length === 1 ? 'track' : 'tracks'}{' '}
                could not be confirmed on Spotify and were not added.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
