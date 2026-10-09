'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import { TASTE_SOURCE_LABELS, type TasteSnapshot } from '@/lib/taste/types';

/**
 * What MUSE holds about the visitor's listening, shown plainly so there is
 * no mystery about what the profile and the chat are built from, with the
 * one control that removes it.
 */

export interface TasteSnapshotCardProps {
  snapshot: TasteSnapshot;
  onWrite: () => void;
  onClear: () => void;
  writing: boolean;
  /** True once a profile has been written from this snapshot. */
  written: boolean;
}

const numberFormat = new Intl.NumberFormat('en-NG');

export function TasteSnapshotCard({
  snapshot,
  onWrite,
  onClear,
  writing,
  written,
}: TasteSnapshotCardProps) {
  const artists = snapshot.topArtists.slice(0, 8);
  const tracks = snapshot.topTracks.slice(0, 5);
  const recent = snapshot.recentTracks.slice(0, 5);

  return (
    <Surface
      variant="raised"
      className="space-y-6 rounded-2xl p-6 sm:p-8"
      data-testid="taste-snapshot"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="type-section-label !text-text-primary">
            Your listening
          </h2>
          <p className="text-sm text-text-secondary">
            {snapshot.label}
            {snapshot.plays
              ? `, ${numberFormat.format(snapshot.plays)} plays counted`
              : ''}
            {snapshot.range
              ? `, ${snapshot.range.from} to ${snapshot.range.to}`
              : ''}
          </p>
          {snapshot.source === 'lastfm' && snapshot.sourceUrl ? (
            <p className="text-xs text-text-muted">
              Listening data from{' '}
              <a
                href={snapshot.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                Last.fm
              </a>
              .
            </p>
          ) : (
            <p className="text-xs text-text-muted">
              Read from your {TASTE_SOURCE_LABELS[snapshot.source]} on this
              device. Kept here only.
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Remove from this device
        </Button>
      </div>

      {artists.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
            Top artists
          </span>
          <ul className="flex flex-wrap gap-2">
            {artists.map((artist) => (
              <li
                key={artist.name}
                className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-primary"
              >
                {artist.name}
                {artist.plays > 0 ? (
                  <span className="text-text-muted">
                    {' '}
                    {numberFormat.format(artist.plays)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {tracks.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Most played
            </span>
            <ol className="space-y-1 text-sm">
              {tracks.map((track) => (
                <li
                  key={`${track.artist}-${track.title}`}
                  className="text-text-secondary"
                >
                  <span className="text-text-primary">{track.title}</span> by{' '}
                  {track.artist}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {recent.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Recent plays
            </span>
            <ol className="space-y-1 text-sm">
              {recent.map((track) => (
                <li
                  key={`${track.artist}-${track.title}`}
                  className="text-text-secondary"
                >
                  <span className="text-text-primary">{track.title}</span> by{' '}
                  {track.artist}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
        <Button variant="primary" onClick={onWrite} loading={writing}>
          {writing
            ? 'Writing'
            : written
              ? 'Write it again'
              : 'Write my profile'}
        </Button>
        <p className="text-xs text-text-muted">
          The summary above is sent to MUSE for this, then forgotten. Chat uses
          it too.
        </p>
      </div>
    </Surface>
  );
}
