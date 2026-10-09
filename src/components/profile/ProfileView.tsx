'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, Link2Off, RefreshCw } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { HumanCheckCard } from '@/components/security/HumanCheckCard';
import { useAuth } from '@/hooks/use-auth';
import { useTaste } from '@/hooks/use-taste';
import type { TasteSnapshot } from '@/lib/taste/types';
import type { ProfileInsightsData } from '@/lib/validation/api-schemas';
import { TasteSources } from './TasteSources';
import { TasteSnapshotCard } from './TasteSnapshotCard';
import { InsightCards } from './InsightCards';

/**
 * The profile page for everyone. A visitor brings their listening from
 * Last.fm or a Spotify export, keeps it on the device, and asks MUSE to
 * write it up. A signed-in tester can still write it from the Spotify
 * account they connected; nobody else ever needs one.
 */

export interface ProfileViewProps {
  lastfmEnabled: boolean;
}

type WriteSource =
  { kind: 'snapshot'; snapshot: TasteSnapshot } | { kind: 'spotify' };

interface WriteResult {
  insights: ProfileInsightsData;
  sourceLabel: string;
  fromAccount: boolean;
}

interface WriteError extends Error {
  code?: string;
  status?: number;
}

async function readError(response: Response): Promise<WriteError> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
  };
  const error: WriteError = new Error(
    body.error || 'MUSE could not write your profile right now.',
  );
  error.code = body.code;
  error.status = response.status;
  return error;
}

async function writeProfile(source: WriteSource): Promise<WriteResult> {
  if (source.kind === 'snapshot') {
    const response = await fetch('/api/taste/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot: source.snapshot }),
    });
    if (!response.ok) throw await readError(response);
    return {
      insights: (await response.json()) as ProfileInsightsData,
      sourceLabel: source.snapshot.label,
      fromAccount: false,
    };
  }
  const response = await fetch('/api/me/profile');
  if (!response.ok) throw await readError(response);
  return {
    insights: (await response.json()) as ProfileInsightsData,
    sourceLabel: 'your connected Spotify account',
    fromAccount: true,
  };
}

function errorKind(error: WriteError | null) {
  if (!error) return null;
  if (error.code === 'AI_NOT_CONNECTED') return 'ai_not_connected';
  if (error.code === 'HUMAN_CHECK_REQUIRED') return 'human_check';
  if (error.code === 'AI_RESTING') return 'resting';
  if (error.code === 'RATE_LIMITED' || error.status === 429)
    return 'rate_limited';
  if (
    error.status === 401 ||
    error.code === 'SPOTIFY_RECONNECT_REQUIRED' ||
    error.code === 'SPOTIFY_DISCONNECTED'
  ) {
    return 'spotify_disconnected';
  }
  return 'other';
}

export function ProfileView({ lastfmEnabled }: ProfileViewProps) {
  const { authenticated } = useAuth();
  const { snapshot, save, clear } = useTaste();
  const [importNote, setImportNote] = React.useState<string | null>(null);
  const write = useMutation<WriteResult, WriteError, WriteSource>({
    mutationFn: writeProfile,
  });
  // The last thing asked for, kept by the mutation itself so a retry after
  // the human check or an error repeats exactly that.
  const lastSource = write.variables ?? null;

  const run = (source: WriteSource) => {
    write.mutate(source);
  };

  const onImported = (imported: TasteSnapshot, note: string) => {
    save(imported);
    setImportNote(note);
    // One import, one profile: the visitor asked for exactly this.
    run({ kind: 'snapshot', snapshot: imported });
  };

  const onClear = () => {
    clear();
    setImportNote(null);
    write.reset();
  };

  const kind = errorKind(write.error);
  const result = write.data ?? null;

  return (
    <div className="space-y-10 p-6 pb-32 sm:p-8">
      <header className="space-y-3">
        <h1 className="type-page-title">Profile</h1>
        <p className="type-body max-w-2xl text-text-secondary">
          Your taste in words. Bring your listening and MUSE writes a short
          profile from it, then leans on it in chat. It stays on this device: a
          summary goes to MUSE only when it writes or builds something, and it
          is not stored.
        </p>
      </header>

      {snapshot ? (
        <TasteSnapshotCard
          snapshot={snapshot}
          onWrite={() => run({ kind: 'snapshot', snapshot })}
          onClear={onClear}
          writing={write.isPending && lastSource?.kind === 'snapshot'}
          written={Boolean(result && !result.fromAccount)}
        />
      ) : (
        <TasteSources lastfmEnabled={lastfmEnabled} onImported={onImported} />
      )}

      {importNote && snapshot ? (
        <p
          role="status"
          className="text-sm text-text-secondary"
          data-testid="import-note"
        >
          {importNote}
        </p>
      ) : null}

      {authenticated ? (
        <Surface className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-dashed border-border-strong bg-transparent p-6">
          <div className="space-y-1">
            <p className="type-body font-semibold text-text-primary">Testers</p>
            <p className="text-sm text-text-secondary">
              Write the profile from the Spotify account you connected instead.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => run({ kind: 'spotify' })}
            loading={write.isPending && lastSource?.kind === 'spotify'}
          >
            Write from my Spotify
          </Button>
        </Surface>
      ) : null}

      {snapshot ? (
        <details className="text-sm text-text-muted">
          <summary className="cursor-pointer font-semibold text-text-secondary">
            Bring different listening
          </summary>
          <div className="pt-4">
            <TasteSources
              lastfmEnabled={lastfmEnabled}
              onImported={onImported}
            />
          </div>
        </details>
      ) : null}

      {write.isPending ? (
        <p
          role="status"
          aria-busy="true"
          className="text-sm text-text-secondary"
        >
          Writing your profile.
        </p>
      ) : null}

      {kind === 'ai_not_connected' ? (
        <Surface
          data-testid="ai-not-connected-state"
          className="max-w-2xl space-y-4 rounded-2xl border-dashed border-border-strong bg-transparent p-10 text-center"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface">
            <KeyRound size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            AI is not connected yet
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
            Set{' '}
            <code className="font-mono text-xs text-text-primary">
              OPENAI_API_KEY
            </code>{' '}
            in the environment to let MUSE write profiles.
          </p>
        </Surface>
      ) : null}

      {kind === 'human_check' ? (
        <HumanCheckCard
          onVerified={() => {
            if (lastSource) run(lastSource);
          }}
        />
      ) : null}

      {kind === 'spotify_disconnected' ? (
        <Surface
          data-testid="profile-spotify-disconnected"
          className="max-w-2xl space-y-4 rounded-2xl border-dashed border-border-strong bg-transparent p-10 text-center"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface">
            <Link2Off size={18} className="text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-primary">
            Spotify connection required
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-text-secondary">
            Reconnect the Spotify account you use for testing, or bring your
            listening another way above.
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
      ) : null}

      {kind === 'resting' || kind === 'rate_limited' || kind === 'other' ? (
        <Surface
          role="alert"
          className="max-w-2xl space-y-4 rounded-2xl border-dashed border-border-strong bg-transparent p-8 text-center"
        >
          <p className="type-body font-semibold text-text-primary">
            {kind === 'resting'
              ? 'MUSE is resting, try again soon.'
              : kind === 'rate_limited'
                ? 'Too many requests for now. Give it a minute.'
                : 'Unable to write your profile'}
          </p>
          {kind === 'other' ? (
            <p className="text-xs text-text-muted">{write.error?.message}</p>
          ) : null}
          {lastSource ? (
            <div className="pt-2">
              <Button variant="outline" onClick={() => run(lastSource)}>
                <RefreshCw size={14} className="mr-2" />
                Try again
              </Button>
            </div>
          ) : null}
        </Surface>
      ) : null}

      {result ? (
        <InsightCards
          insights={result.insights}
          sourceLabel={result.sourceLabel}
          showPreferences={result.fromAccount}
        />
      ) : null}
    </div>
  );
}
