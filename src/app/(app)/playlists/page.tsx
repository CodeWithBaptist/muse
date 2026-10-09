'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { TrackRow, type Track } from '@/components/chat/TrackRow';
import { CreateInSpotifyButton } from '@/components/playlist/CreateInSpotifyButton';
import type { PlaylistExportTrackMeta } from '@/lib/playlist-export';
import { motion } from 'motion/react';
import { fadeIn, fadeInUp, staggerContainer, transitions } from '@/lib/motion';
import {
  Music2,
  ExternalLink,
  Trash2,
  Check,
  Edit3,
  PlusSquare,
  Disc,
  Link2Off,
} from 'lucide-react';

interface MusePlaylist {
  id: string;
  name: string;
  description: string | null;
  spotifyPlaylistId: string | null;
  spotifyUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tracks: Track[];
}

interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  tracks?: { total: number };
  images?: Array<{ url: string }>;
  external_urls?: { spotify?: string };
}

export default function PlaylistsPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [actionError, setActionError] = React.useState<string | null>(null);

  const {
    data: museData,
    isLoading: isLoadingMuse,
    error: museError,
  } = useQuery<{ playlists: MusePlaylist[] }>({
    queryKey: ['muse-playlists'],
    queryFn: async () => {
      const res = await fetch('/api/playlists');
      if (!res.ok) throw new Error('Unable to load MUSE playlists');
      return res.json();
    },
    retry: false,
  });

  const {
    data: spotifyData,
    isLoading: isLoadingSpotify,
    error: spotifyError,
  } = useQuery<{ items?: SpotifyPlaylistSummary[] }>({
    queryKey: ['music', 'playlists', 'summary'],
    queryFn: async () => {
      const res = await fetch('/api/music?type=playlists&limit=12');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error || 'Unable to load Spotify playlists') as Error & {
          status?: number;
          code?: string;
        };
        err.status = res.status;
        err.code = body.code;
        throw err;
      }
      return res.json();
    },
    retry: false,
  });

  const startEditing = (playlist: MusePlaylist) => {
    setEditingId(playlist.id);
    setEditName(playlist.name);
    setEditDescription(playlist.description || '');
    setActionError(null);
  };

  const handleSaveEdit = async (playlistId: string) => {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    setActionError(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: editDescription.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to update playlist details');
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ['muse-playlists'] });
    } catch (e: unknown) {
      setActionError(
        e instanceof Error ? e.message : 'Unable to update playlist.'
      );
    }
  };

  const handleRemoveTrack = async (playlistId: string, trackId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeTrackId: trackId }),
      });
      if (!res.ok) throw new Error('Failed to remove track');
      await queryClient.invalidateQueries({ queryKey: ['muse-playlists'] });
    } catch (e: unknown) {
      setActionError(
        e instanceof Error ? e.message : 'Unable to remove track.'
      );
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete playlist');
      await queryClient.invalidateQueries({ queryKey: ['muse-playlists'] });
    } catch (e: unknown) {
      setActionError(
        e instanceof Error ? e.message : 'Unable to delete playlist.'
      );
    }
  };

  const playlistTrackUris = (playlist: MusePlaylist): string[] =>
    playlist.tracks
      .map(
        (t) =>
          t.uri ||
          (t.id ? `spotify:track:${t.id.replace(/^spotify:track:/, '')}` : null),
      )
      .filter((u): u is string => Boolean(u));

  const playlistTrackMeta = (
    playlist: MusePlaylist,
  ): PlaylistExportTrackMeta[] =>
    playlist.tracks.map((t) => ({
      id: t.id,
      title: t.name,
      artist: Array.isArray(t.artists)
        ? t.artists.map((a) => a.name).join(', ')
        : t.artists,
      albumArtUrl: t.album?.images?.[0]?.url || t.albumArtUrl || null,
      durationMs: t.duration_ms ?? 180_000,
    }));

  const musePlaylists = museData?.playlists ?? [];
  const spotifyPlaylists = spotifyData?.items ?? [];

  return (
    <div className="p-4 space-y-12 pb-32 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="type-page-title">Playlists</h1>
          <p className="type-caption">
            Review, edit, and export playlists curated with MUSE, or browse your
            connected Spotify playlists.
          </p>
        </div>
        <Link
          href="/chat"
          className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-semibold text-background transition-colors hover:bg-accent/90 focus-ring"
        >
          <PlusSquare size={15} className="mr-2" aria-hidden="true" />
          New Playlist in Chat
        </Link>
      </div>

      {actionError && (
        <Surface
          role="alert"
          aria-live="assertive"
          className="rounded-lg border-danger/40 bg-danger/[0.04] p-4"
        >
          <p className="text-xs font-medium text-danger">{actionError}</p>
        </Surface>
      )}

      {/* MUSE Curated Playlists */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="type-section-label">MUSE Curated Playlists</h2>
          <span className="text-xs text-text-muted tabular-nums">
            {musePlaylists.length} saved
          </span>
        </div>

        {isLoadingMuse ? (
          <div aria-busy="true" className="space-y-4">
            <p role="status" className="sr-only">
              Loading saved MUSE playlists.
            </p>
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-36 rounded-xl border border-border-subtle bg-surface"
              />
            ))}
          </div>
        ) : museError ? (
          <Surface
            role="alert"
            className="space-y-2 rounded-xl border-dashed border-border-strong bg-transparent p-6 sm:p-8 text-center"
          >
            <p className="text-sm font-semibold text-text-primary">
              Unable to load saved MUSE playlists
            </p>
            <p className="text-xs text-text-muted">
              {(museError as Error).message}
            </p>
          </Surface>
        ) : musePlaylists.length === 0 ? (
          <Surface
            data-testid="empty-muse-playlists"
            className="p-6 sm:p-10 text-center space-y-4 border-dashed border-border-strong bg-transparent rounded-2xl"
          >
            <Music2 size={32} className="text-text-muted mx-auto" />
            <div className="space-y-1 max-w-md mx-auto">
              <p className="text-sm font-semibold text-text-primary">
                No MUSE playlists saved yet
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Ask MUSE in Chat to build a playlist for any mood, activity, or
                artist combination. You can edit the title, remove tracks, and
                export directly to Spotify.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/chat"
                className="inline-flex h-9 items-center justify-center rounded-md border border-border-strong px-4 text-xs font-semibold text-text-primary transition-colors hover:bg-surface focus-ring"
              >
                Build a playlist in Chat
              </Link>
            </div>
          </Surface>
        ) : (
          <motion.div
            variants={staggerContainer(0.06)}
            initial="initial"
            animate="animate"
            className="space-y-6"
          >
            {musePlaylists.map((playlist) => {
              const isEditing = editingId === playlist.id;
              return (
                <motion.div
                  key={playlist.id}
                  variants={fadeInUp}
                  transition={transitions.standard}
                >
                  <Surface
                    variant="raised"
                    data-testid="muse-playlist-card"
                    className="p-4 sm:p-6 space-y-6 rounded-xl border-border-subtle"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        {isEditing ? (
                          <div className="space-y-3 max-w-lg">
                            <input
                              aria-label="Edit playlist name"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-background border border-border-strong rounded px-3 py-1.5 text-base font-bold text-text-primary focus:outline-none focus:border-accent"
                            />
                            <textarea
                              aria-label="Edit playlist description"
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              className="w-full bg-background border border-border-strong rounded px-3 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent resize-none h-14"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleSaveEdit(playlist.id)}
                              >
                                <Check size={14} className="mr-1.5" />
                                Save changes
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-lg font-bold text-text-primary">
                                {playlist.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-surface border border-border-subtle text-text-muted">
                                {playlist.spotifyPlaylistId
                                  ? 'Exported to Spotify'
                                  : 'Draft'}
                              </span>
                            </div>
                            {playlist.description && (
                              <p className="text-xs text-text-secondary leading-relaxed">
                                {playlist.description}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(playlist)}
                          >
                            <Edit3 size={14} className="mr-1.5" />
                            Edit
                          </Button>
                        )}

                        {playlist.spotifyUrl ? (
                          <a
                            href={playlist.spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-background text-xs font-semibold hover:opacity-90 transition-opacity"
                          >
                            <span>Open in Spotify</span>
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          <CreateInSpotifyButton
                            size="sm"
                            name={playlist.name}
                            description={playlist.description || 'Created with MUSE'}
                            playlistId={playlist.id}
                            trackUris={playlistTrackUris(playlist)}
                            tracks={playlistTrackMeta(playlist)}
                            disabled={playlist.tracks.length === 0}
                            onResult={() => {
                              void queryClient.invalidateQueries({
                                queryKey: ['muse-playlists'],
                              });
                            }}
                          />
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePlaylist(playlist.id)}
                          aria-label={`Delete playlist ${playlist.name}`}
                          title="Delete playlist"
                          className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-background transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {playlist.tracks.length > 0 && (
                      <div className="border-t border-border-subtle pt-4 space-y-1">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                          {playlist.tracks.length} Tracks
                        </div>
                        <div
                          role="list"
                          aria-label={`Tracks in ${playlist.name}`}
                        >
                          {playlist.tracks.map((track, idx) => (
                            <TrackRow
                              key={`${playlist.id}-${track.id}-${idx}`}
                              track={track}
                              index={idx}
                              onRemove={(trackId) =>
                                handleRemoveTrack(playlist.id, trackId)
                              }
                              listItem
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </Surface>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* Connected Spotify Playlists */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="type-section-label">Your Spotify Playlists</h2>
        </div>

        {isLoadingSpotify ? (
          <div
            aria-busy="true"
            className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-6"
          >
            <p role="status" className="sr-only">
              Loading Spotify playlists.
            </p>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-square bg-surface rounded-lg" />
                <div className="h-4 bg-surface rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : spotifyError ? (
          <Surface
            role="alert"
            className="space-y-3 rounded-xl border-dashed border-border-strong bg-transparent p-6 sm:p-8 text-center"
          >
            <Link2Off size={20} className="text-text-muted mx-auto" />
            <p className="text-xs text-text-secondary">
              Connect or refresh your Spotify session to browse your existing
              Spotify playlists here.
            </p>
          </Surface>
        ) : spotifyPlaylists.length === 0 ? (
          <p className="text-xs text-text-muted">
            No playlists found in your Spotify library.
          </p>
        ) : (
          <motion.div
            variants={ fadeIn }
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6"
          >
            {spotifyPlaylists.map((item) => {
              const image = item.images?.[0]?.url;
              const url =
                item.external_urls?.spotify ||
                (item.id
                  ? `https://open.spotify.com/playlist/${encodeURIComponent(item.id)}`
                  : null);

              return (
                <div key={item.id} className="group space-y-3">
                  <div className="aspect-square bg-surface border border-border-subtle rounded-lg overflow-hidden">
                    {image ? (
                      <img
                        src={image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                        <Disc size={36} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {item.tracks?.total ?? 0} tracks
                      </p>
                    </div>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${item.name} in Spotify`}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors shrink-0"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </section>
    </div>
  );
}
