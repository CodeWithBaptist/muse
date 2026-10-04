'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  PlaybackStatusResponseSchema,
  SpotifyConnectionResponseSchema,
} from '@/lib/validation/api-schemas';

interface SpotifyConnectionPanelProps {
  user: {
    displayName: string;
    email: string;
  } | null;
  onLogout: () => void;
}

export function SpotifyConnectionPanel({
  user,
  onLogout,
}: SpotifyConnectionPanelProps) {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [disconnectError, setDisconnectError] = React.useState<string | null>(
    null,
  );
  const [disconnectMessage, setDisconnectMessage] = React.useState<
    string | null
  >(null);

  const connectionQuery = useQuery({
    queryKey: ['spotify-connection'],
    queryFn: async () => {
      const response = await fetch('/api/me/spotify', { cache: 'no-store' });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error('Unable to check Spotify status');
      return SpotifyConnectionResponseSchema.parse(payload);
    },
    retry: false,
    staleTime: 15_000,
  });

  const playbackStatusQuery = useQuery({
    queryKey: ['spotify-playback-status'],
    queryFn: async () => {
      const response = await fetch('/api/playback/status', {
        cache: 'no-store',
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error('Unable to check Spotify playback status');
      return PlaybackStatusResponseSchema.parse(payload);
    },
    retry: false,
    staleTime: 15_000,
  });

  const availability = playbackStatusQuery.data?.availability;
  const connected = connectionQuery.data?.connected ?? false;
  const statusLabel = connectionQuery.isLoading
    ? 'Checking'
    : connectionQuery.isError
      ? 'Status unavailable'
      : !connected
        ? 'Not connected'
        : availability === 'reconnect-required'
          ? 'Reconnect required'
          : 'Connected';

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    setDisconnectMessage(null);

    try {
      const response = await fetch('/api/me/spotify', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to disconnect Spotify');

      queryClient.setQueryData(['spotify-connection'], { connected: false });
      queryClient.setQueryData(['spotify-playback-status'], {
        availability: 'disconnected',
      });
      [
        ['discover'],
        ['profile-insights'],
        ['muse-playlists'],
        ['music'],
      ].forEach((queryKey) => queryClient.removeQueries({ queryKey }));
      setConfirmDisconnect(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['spotify-connection'] }),
        queryClient.invalidateQueries({
          queryKey: ['spotify-playback-status'],
        }),
      ]);
      setDisconnectMessage(
        "MUSE's Spotify connection, Spotify-derived data, and chat history were cleared.",
      );
    } catch {
      setDisconnectError('Unable to disconnect Spotify right now.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border-subtle pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">
              Spotify Account
            </span>
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                connected
                  ? 'border-accent/30 bg-accent/10 text-accent'
                  : 'border-border-strong bg-surface text-text-muted',
              )}
            >
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            {connected && user
              ? `${user.displayName} (${user.email})`
              : 'Connect Spotify to use MUSE music features.'}
          </p>
          <p className="text-[11px] leading-relaxed text-text-muted">
            Disconnecting removes MUSE&apos;s saved tokens, Spotify-based
            profile insights, recommendations, playlist data, and chat history.
            Your explicit MUSE preferences, saved memories, and account identity
            remain. The account identity still includes your Spotify ID, display
            name, and email, so this flow needs review against Spotify&apos;s
            data deletion requirements. Revoke access separately from your
            Spotify account if needed.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              window.location.href = '/api/auth/spotify';
            }}
          >
            <RefreshCw size={13} className="mr-1.5" />
            {connected ? 'Reconnect Spotify' : 'Connect Spotify'}
          </Button>
          {(connected || connectionQuery.isError) && !confirmDisconnect && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDisconnectError(null);
                setConfirmDisconnect(true);
              }}
            >
              Disconnect
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onLogout}>
            <LogOut size={13} className="mr-1.5" />
            Log out
          </Button>
        </div>
      </div>

      {confirmDisconnect && (
        <div className="space-y-3 rounded-md border border-border-subtle bg-surface p-4">
          <p className="text-xs leading-relaxed text-text-secondary">
            Confirm disconnect to remove Spotify tokens and clear Spotify-based
            profile insights, recommendations, playlist data, and chat history.
            Explicit preferences and saved memories stay in MUSE.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={disconnecting}
              onClick={() => void handleDisconnect()}
            >
              {disconnecting ? 'Disconnecting...' : 'Confirm disconnect'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disconnecting}
              onClick={() => setConfirmDisconnect(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {connectionQuery.isError && (
        <p role="status" className="text-xs text-red-400">
          Spotify connection status could not be checked.
        </p>
      )}
      {connected && playbackStatusQuery.isError && (
        <p role="status" className="text-xs text-red-400">
          Spotify playback availability could not be checked.
        </p>
      )}
      {disconnectMessage && (
        <p role="status" className="text-xs text-accent">
          {disconnectMessage}
        </p>
      )}
      {disconnectError && (
        <p role="alert" className="text-xs text-red-400">
          {disconnectError}
        </p>
      )}

      <a
        href="https://www.spotify.com/account/apps/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
      >
        <span>Manage access at Spotify</span>
        <ExternalLink size={12} />
      </a>
    </div>
  );
}
