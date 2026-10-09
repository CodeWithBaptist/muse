'use client';

import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Surface } from '@/components/ui/Surface';
import { LASTFM_USERNAME_PATTERN } from '@/lib/taste/lastfm-username';
import { readSpotifyExportFiles } from '@/lib/taste/read-export';
import type { TasteSnapshot } from '@/lib/taste/types';

/**
 * The two ways a visitor brings their listening in, neither needing an
 * account. Last.fm goes through the server because the API key lives
 * there; the Spotify export never leaves the device. Both end in the same
 * snapshot, handed up to the page to keep.
 */

export interface TasteSourcesProps {
  lastfmEnabled: boolean;
  onImported: (snapshot: TasteSnapshot, note: string) => void;
}

const numberFormat = new Intl.NumberFormat('en-NG');

function monthYear(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return new Intl.DateTimeFormat('en-NG', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function LastfmForm({
  enabled,
  onImported,
}: {
  enabled: boolean;
  onImported: TasteSourcesProps['onImported'];
}) {
  const inputId = React.useId();
  const messageId = React.useId();
  const [username, setUsername] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = username.trim();
  const valid = LASTFM_USERNAME_PATTERN.test(trimmed);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/taste/lastfm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        snapshot?: TasteSnapshot;
        error?: string;
      } | null;
      if (!response.ok || !body?.snapshot) {
        setError(body?.error ?? 'Last.fm could not be reached right now.');
        return;
      }
      const count = body.snapshot.topArtists.length;
      onImported(
        body.snapshot,
        count > 0
          ? `Read ${count} top artists and your recent plays from Last.fm.`
          : 'Last.fm knows that profile but it has no plays in the last six months yet.',
      );
      setUsername('');
    } catch {
      setError(
        'Could not reach MUSE to ask Last.fm. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Import from Last.fm"
      data-testid="lastfm-form"
    >
      <label htmlFor={inputId} className="type-section-label block pb-2">
        Last.fm username
      </label>
      <p className="pb-3 text-sm text-text-secondary">
        Public profiles only. Last.fm is free and can scrobble from Spotify,
        Apple Music, YouTube Music and more, so one username carries your
        listening anywhere.
      </p>
      {enabled ? (
        <>
          <div className="flex gap-2">
            <Input
              id={inputId}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Your Last.fm handle"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="text"
              aria-describedby={error ? messageId : undefined}
              aria-invalid={error ? true : undefined}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="secondary"
              loading={busy}
              disabled={!valid}
            >
              {busy ? 'Fetching' : 'Fetch listening'}
            </Button>
          </div>
          <p
            id={messageId}
            role="alert"
            className="min-h-5 pt-2 text-sm text-danger"
          >
            {error ?? ''}
          </p>
        </>
      ) : (
        <p className="text-sm text-text-muted" data-testid="lastfm-off">
          Last.fm import is not switched on for this MUSE yet.
        </p>
      )}
    </form>
  );
}

function ExportPicker({
  onImported,
}: {
  onImported: TasteSourcesProps['onImported'];
}) {
  const inputId = React.useId();
  const messageId = React.useId();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  const handleFiles = async (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;
    setBusy(true);
    setFailed(false);
    setMessage('Reading on this device. A large export takes a moment.');
    try {
      const result = await readSpotifyExportFiles(files);
      const skipped =
        result.skipped.length > 0
          ? ` Skipped ${result.skipped.map((file) => `${file.name} (${file.reason})`).join(', ')}.`
          : '';
      if (!result.snapshot) {
        setFailed(true);
        setMessage(
          `No streaming history found in what you picked.${skipped} Choose the ZIP Spotify sent, or the StreamingHistory JSON files inside it.`,
        );
        return;
      }
      const range = result.snapshot.range
        ? `, ${monthYear(result.snapshot.range.from)} to ${monthYear(result.snapshot.range.to)}`
        : '';
      const note = `Read ${numberFormat.format(result.snapshot.plays ?? 0)} plays from ${result.filesRead} ${
        result.filesRead === 1 ? 'file' : 'files'
      }${range}. Nothing was uploaded.${skipped}`;
      setMessage(note);
      onImported(result.snapshot, note);
    } catch {
      setFailed(true);
      setMessage('That file could not be read on this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="export-picker">
      <label htmlFor={inputId} className="type-section-label block pb-2">
        Spotify data export
      </label>
      <p className="pb-3 text-sm text-text-secondary">
        Ask Spotify for your data at spotify.com/account/privacy. The ZIP
        arrives by email in a few days. Pick that ZIP here, or the
        StreamingHistory JSON files inside it. It is read on this device and
        never uploaded.
      </p>
      <input
        id={inputId}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        multiple
        disabled={busy}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
        aria-describedby={message ? messageId : undefined}
        className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-text-primary hover:file:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <p
        id={messageId}
        role="status"
        aria-live="polite"
        className={`min-h-5 pt-2 text-sm ${failed ? 'text-danger' : 'text-text-secondary'}`}
      >
        {message ?? ''}
      </p>
    </div>
  );
}

export function TasteSources({ lastfmEnabled, onImported }: TasteSourcesProps) {
  return (
    <Surface variant="raised" className="space-y-8 rounded-2xl p-6 sm:p-8">
      <LastfmForm enabled={lastfmEnabled} onImported={onImported} />
      <div className="border-t border-border-subtle" />
      <ExportPicker onImported={onImported} />
    </Surface>
  );
}
