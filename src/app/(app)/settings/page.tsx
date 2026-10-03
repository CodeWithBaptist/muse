'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Check,
  ExternalLink,
  LogOut,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
  User,
} from 'lucide-react';
import type { UserPreferencesData } from '@/lib/validation/api-schemas';

export default function SettingsPage() {
  const { user, authenticated, logout } = useAuth();
  const queryClient = useQueryClient();

  const [draftOverrides, setDraftOverrides] = React.useState<{
    discoveryStyle?: 'balanced' | 'deep_cuts' | 'familiar';
    playlistLength?: '10' | '15' | '20';
    explicitContent?: 'allow' | 'clean';
    favoriteGenres?: string;
  }>({});

  const [saveState, setSaveState] = React.useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [clearState, setClearState] = React.useState<
    'idle' | 'clearing' | 'cleared' | 'error'
  >('idle');

  const { data: aiStatus } = useQuery<{
    connected: boolean;
    message: string;
  }>({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const res = await fetch('/api/ai/status');
      return res.json();
    },
    retry: false,
  });

  const { data: preferencesData, isLoading: isLoadingPrefs } =
    useQuery<UserPreferencesData>({
      queryKey: ['user-preferences'],
      queryFn: async () => {
        const res = await fetch('/api/preferences');
        if (!res.ok) throw new Error('Unable to load preferences');
        return res.json();
      },
      retry: false,
    });

  const discoveryStyle =
    draftOverrides.discoveryStyle ??
    preferencesData?.discoveryStyle ??
    'balanced';
  const playlistLength =
    draftOverrides.playlistLength ?? preferencesData?.playlistLength ?? '15';
  const explicitContent =
    draftOverrides.explicitContent ??
    preferencesData?.explicitContent ??
    'allow';
  const favoriteGenres =
    draftOverrides.favoriteGenres ?? preferencesData?.favoriteGenres ?? '';

  const setDiscoveryStyle = (val: 'balanced' | 'deep_cuts' | 'familiar') =>
    setDraftOverrides((prev) => ({ ...prev, discoveryStyle: val }));
  const setPlaylistLength = (val: '10' | '15' | '20') =>
    setDraftOverrides((prev) => ({ ...prev, playlistLength: val }));
  const setExplicitContent = (val: 'allow' | 'clean') =>
    setDraftOverrides((prev) => ({ ...prev, explicitContent: val }));
  const setFavoriteGenres = (val: string) =>
    setDraftOverrides((prev) => ({ ...prev, favoriteGenres: val }));

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveState('saving');
    try {
      const res = await fetch('/api/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discoveryStyle,
          playlistLength,
          explicitContent,
          favoriteGenres: favoriteGenres.trim(),
        }),
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      setSaveState('saved');
      await queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
      await queryClient.invalidateQueries({ queryKey: ['profile-insights'] });
    } catch {
      setSaveState('error');
    }
  };

  const handleClearConversations = async () => {
    setClearState('clearing');
    try {
      const res = await fetch('/api/chat', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear conversations');
      setClearState('cleared');
    } catch {
      setClearState('error');
    }
  };

  return (
    <div className="p-8 space-y-10 pb-32 max-w-3xl">
      <div className="space-y-2">
        <h1 className="type-page-title">Settings</h1>
        <p className="type-caption">
          Manage your Spotify connection, recommendation preferences, and saved
          data.
        </p>
      </div>

      {/* Account & Connections */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <User size={16} className="text-accent" />
          <h2 className="type-section-label !text-text-primary">
            Account and Connections
          </h2>
        </div>

        <Surface variant="raised" className="p-6 space-y-6 rounded-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  Spotify Account
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
                    authenticated
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-surface border-border-strong text-text-muted'
                  )}
                >
                  {authenticated ? 'Connected' : 'Not connected'}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {authenticated && user
                  ? `${user.displayName} (${user.email})`
                  : 'Connect your Spotify account to enable personalized discovery and playlist export.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.location.href = '/api/auth/spotify';
                }}
              >
                <RefreshCw size={13} className="mr-1.5" />
                {authenticated ? 'Reconnect Spotify' : 'Connect Spotify'}
              </Button>
              {authenticated && (
                <Button size="sm" variant="ghost" onClick={logout}>
                  <LogOut size={13} className="mr-1.5" />
                  Log out
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  AI Curation Engine
                </span>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border',
                    aiStatus?.connected
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-surface border-border-strong text-text-muted'
                  )}
                >
                  {aiStatus?.connected ? 'Connected' : 'Not connected yet'}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                {aiStatus?.connected
                  ? 'OpenAI provider is configured for natural language curation.'
                  : 'Set OPENAI_API_KEY in your environment variables to enable AI curation.'}
              </p>
            </div>
          </div>
        </Surface>
      </section>

      {/* Recommendation Preferences */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-accent" />
          <h2 className="type-section-label !text-text-primary">
            Recommendation Preferences
          </h2>
        </div>

        <Surface variant="raised" className="p-6 rounded-xl">
          <form onSubmit={handleSavePreferences} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block">
                Discovery Style
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'balanced' as const,
                    label: 'Balanced',
                    desc: 'Mix of familiar artists and new discoveries',
                  },
                  {
                    id: 'deep_cuts' as const,
                    label: 'Deep cuts',
                    desc: 'Prioritize lesser-known tracks and B-sides',
                  },
                  {
                    id: 'familiar' as const,
                    label: 'Familiar taste',
                    desc: 'Stay close to your top artists and genres',
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setDiscoveryStyle(opt.id);
                      setSaveState('idle');
                    }}
                    className={cn(
                      'p-3 rounded-lg border text-left transition-colors space-y-1',
                      discoveryStyle === opt.id
                        ? 'border-accent bg-accent/[0.06]'
                        : 'border-border-subtle bg-background hover:border-border-strong'
                    )}
                  >
                    <div className="text-xs font-semibold text-text-primary">
                      {opt.label}
                    </div>
                    <div className="text-[11px] text-text-secondary leading-snug">
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block">
                  Default Playlist Length
                </label>
                <div className="flex gap-2">
                  {(['10', '15', '20'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => {
                        setPlaylistLength(len);
                        setSaveState('idle');
                      }}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-md border text-xs font-semibold transition-colors',
                        playlistLength === len
                          ? 'border-accent bg-accent/[0.08] text-accent'
                          : 'border-border-subtle bg-background text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {len} tracks
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block">
                  Explicit Content
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'allow' as const, label: 'Allow explicit' },
                    { id: 'clean' as const, label: 'Prefer clean' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setExplicitContent(opt.id);
                        setSaveState('idle');
                      }}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-md border text-xs font-semibold transition-colors',
                        explicitContent === opt.id
                          ? 'border-accent bg-accent/[0.08] text-accent'
                          : 'border-border-subtle bg-background text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="favorite-genres-input"
                className="text-xs font-semibold uppercase tracking-wider text-text-muted block"
              >
                Priority Genres or Artists
              </label>
              <input
                id="favorite-genres-input"
                type="text"
                value={favoriteGenres}
                onChange={(e) => {
                  setFavoriteGenres(e.target.value);
                  setSaveState('idle');
                }}
                placeholder="Example: neo-soul, UK jazz, Kaytranada,Little Simz"
                maxLength={200}
                className="w-full bg-background border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-border-subtle">
              <div className="text-xs text-text-secondary">
                {saveState === 'saved' && (
                  <span className="text-accent font-medium inline-flex items-center gap-1.5">
                    <Check size={14} />
                    Preferences saved
                  </span>
                )}
                {saveState === 'error' && (
                  <span className="text-red-400 font-medium">
                    Unable to save preferences right now.
                  </span>
                )}
              </div>

              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isLoadingPrefs || saveState === 'saving'}
              >
                {saveState === 'saving' ? 'Saving...' : 'Save Preferences'}
              </Button>
            </div>
          </form>
        </Surface>
      </section>

      {/* Data & Privacy */}
      <section id="privacy" className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-accent" />
          <h2 className="type-section-label !text-text-primary">
            Data and Privacy
          </h2>
        </div>

        <Surface variant="raised" className="p-6 space-y-6 rounded-xl">
          <div className="space-y-2 text-xs text-text-secondary leading-relaxed">
            <p>
              MUSE accesses your Spotify profile, listening history, and saved
              library solely to generate recommendations and export playlists you
              create. OAuth access and refresh tokens are encrypted at rest with
              AES-256-GCM.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border-subtle">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text-primary">
                Conversation History
              </div>
              <p className="text-xs text-text-secondary">
                {clearState === 'cleared'
                  ? 'All saved conversations have been deleted.'
                  : 'Remove all saved chat conversations and track recommendations from MUSE.'}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              disabled={clearState === 'clearing' || clearState === 'cleared'}
              onClick={handleClearConversations}
            >
              <Trash2 size={13} className="mr-1.5" />
              {clearState === 'clearing'
                ? 'Clearing...'
                : clearState === 'cleared'
                  ? 'History Cleared'
                  : 'Clear Conversation History'}
            </Button>
          </div>

          <div className="flex flex-wrap gap-6 pt-4 border-t border-border-subtle text-xs text-text-secondary">
            <a
              href="https://www.spotify.com/account/apps/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
            >
              <span>Manage Spotify App Access</span>
              <ExternalLink size={12} />
            </a>
            <a
              href="https://www.spotify.com/legal/privacy-policy/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-text-primary transition-colors"
            >
              <span>Spotify Privacy Policy</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </Surface>
      </section>
    </div>
  );
}
