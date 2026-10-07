'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';
import { DataControls } from '@/components/settings/DataControls';
import { MemoryManager } from '@/components/settings/MemoryManager';
import { SpotifyConnectionPanel } from '@/components/settings/SpotifyConnectionPanel';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Check,
  ExternalLink,
  Shield,
  Sliders,
  Trash2,
  User
} from 'lucide-react';
import type { UserPreferencesData } from '@/lib/validation/api-schemas';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const [draftOverrides, setDraftOverrides] = React.useState<{
    discoveryStyle?: 'balanced' | 'deep_cuts' | 'familiar';
    playlistLength?: '10' | '15' | '20';
    explicitContent?: 'allow' | 'clean';
    favoriteGenres?: string;
    playbackPreference?: 'muse' | 'spotify';
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
    retry: false
  });

  const { data: preferencesData, isLoading: isLoadingPrefs } =
    useQuery<UserPreferencesData>({
      queryKey: ['user-preferences'],
      queryFn: async () => {
        const res = await fetch('/api/preferences');
        if (!res.ok) throw new Error('Unable to load preferences');
        return res.json();
      },
      retry: false
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
  const playbackPreference =
    draftOverrides.playbackPreference ??
    preferencesData?.playbackPreference ??
    'muse';

  const setDiscoveryStyle = (val: 'balanced' | 'deep_cuts' | 'familiar') =>
    setDraftOverrides((prev) => ({ ...prev, discoveryStyle: val }));
  const setPlaylistLength = (val: '10' | '15' | '20') =>
    setDraftOverrides((prev) => ({ ...prev, playlistLength: val }));
  const setExplicitContent = (val: 'allow' | 'clean') =>
    setDraftOverrides((prev) => ({ ...prev, explicitContent: val }));
  const setFavoriteGenres = (val: string) =>
    setDraftOverrides((prev) => ({ ...prev, favoriteGenres: val }));
  const setPlaybackPreference = (val: 'muse' | 'spotify') =>
    setDraftOverrides((prev) => ({ ...prev, playbackPreference: val }));

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
          playbackPreference
        })
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
          <SpotifyConnectionPanel user={user} onLogout={() => void logout()} />

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
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Discovery Style
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'balanced' as const,
                    label: 'Balanced',
                    desc: 'Mix of familiar artists and new discoveries'
                  },
                  {
                    id: 'deep_cuts' as const,
                    label: 'Deep cuts',
                    desc: 'Prioritize lesser-known tracks and B-sides'
                  },
                  {
                    id: 'familiar' as const,
                    label: 'Familiar taste',
                    desc: 'Stay close to your top artists and genres'
                  }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={discoveryStyle === opt.id}
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
            </fieldset>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Default Playlist Length
                </legend>
                <div className="flex gap-2">
                  {(['10', '15', '20'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      aria-pressed={playlistLength === len}
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
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Explicit Content
                </legend>
                <div className="flex gap-2">
                  {[
                    { id: 'allow' as const, label: 'Allow explicit' },
                    { id: 'clean' as const, label: 'Prefer clean' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={explicitContent === opt.id}
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
              </fieldset>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Playback Preference
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: 'muse' as const,
                    label: 'Control Spotify from MUSE',
                    description:
                      'Use MUSE controls to play on your active Spotify device. Spotify Premium may be required.'
                  },
                  {
                    id: 'spotify' as const,
                    label: 'Open in Spotify',
                    description:
                      'Use Spotify links instead of starting playback in MUSE.'
                  }
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={playbackPreference === option.id}
                    onClick={() => {
                      setPlaybackPreference(option.id);
                      setSaveState('idle');
                    }}
                    className={cn(
                      'p-3 rounded-md border text-left transition-colors space-y-1',
                      playbackPreference === option.id
                        ? 'border-accent bg-accent/[0.06]'
                        : 'border-border-subtle bg-background hover:border-border-strong'
                    )}
                  >
                    <span className="block text-xs font-semibold text-text-primary">
                      {option.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-text-secondary">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Applies to newly selected tracks. Playback already in progress
                remains controllable.
              </p>
            </fieldset>

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
                  <span
                    role="status"
                    aria-live="polite"
                    className="inline-flex items-center gap-1.5 font-medium text-accent"
                  >
                    <Check size={14} aria-hidden="true" />
                    Preferences saved
                  </span>
                )}
                {saveState === 'error' && (
                  <span role="alert" className="font-medium text-red-400">
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

      <MemoryManager />

      {/* Data & Privacy */}
      <section id="privacy" className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-accent" />
          <h2 className="type-section-label !text-text-primary">
            Data and Privacy
          </h2>
        </div>

        <Surface variant="raised" className="p-6 space-y-6 rounded-xl">
          <div className="space-y-3 text-xs leading-relaxed text-text-secondary">
            <p>
              Chat and recommendation requests send the text you enter to
              OpenAI. For conversational replies, MUSE also sends up to nine
              earlier messages from that conversation, for up to ten messages
              total. Recommendation, Discover, and Profile Insights requests
              also send selected Spotify data, including top artists, top tracks, artist genres,
              recently played track names, and track metadata returned by
              Spotify search. Saved explicit memory preferences may also be
              included in MUSE AI requests.
            </p>
            <div className="space-y-2 rounded-md border border-border-strong bg-background p-4">
              <p className="font-semibold text-text-primary">
                Spotify policy review needed
              </p>
              <p>
                Spotify&apos;s current Developer Policy says not to use Spotify
                Platform or any Spotify Content to train or otherwise ingest
                Spotify Content into a machine-learning or AI model. It also
                says not to analyze Spotify Content or the Spotify Service for
                any purpose, including building user profiles. MUSE sends
                listening-derived data to OpenAI
                and uses listening history for Profile Insights and personalized
                recommendations, so these
                flows appear to conflict with those restrictions. A disclosure
                or user consent does not resolve the policy issue. The Developer
                Terms also contain a separate AI restriction and a conditional
                third-party processor provision. That provision does not appear
                to override the separate AI restriction. Disconnect clears
                cached Spotify data, meaning tokens, recommendations, profile
                insights, conversations and messages, and playlists MUSE
                created. It retains Spotify ID, email, display name, and avatar
                for account identity, and it also retains the preferences and
                memories you saved yourself and your active MUSE session. The
                privacy policy lists these exactly. That retention needs review
                under the disconnection deletion requirement. The Start/Resume and Pause
                Playback API references say those endpoints work only for
                Spotify Premium accounts and warn that the Spotify Platform
                cannot be used for commercial streaming integrations. MUSE sends
                playback commands to Spotify and does not stream audio itself.
                Whether this use or any commercial plans fit that restriction
                needs review. These features are not represented as compliant.
              </p>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <a
                  href="https://developer.spotify.com/policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent hover:text-text-primary"
                >
                  <span>Read Spotify Developer Policy</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://developer.spotify.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent hover:text-text-primary"
                >
                  <span>Read Spotify Developer Terms</span>
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent hover:text-text-primary"
                >
                  <span>Review Spotify playback API requirements</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <p>
              OAuth tokens are encrypted at rest. Conversation history is stored
              separately from AI memory. Memory entries are structured
              preferences with a source, confidence, and update time. Review the
              Privacy placeholder before treating it as a complete privacy
              notice.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border-subtle">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-text-primary">
                Conversation History
              </div>
              <p role="status" aria-live="polite" className="text-xs text-text-secondary">
                {clearState === 'clearing'
                  ? 'Clearing saved conversation history.'
                  : clearState === 'cleared'
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

          {clearState === 'error' && (
            <p role="alert" className="text-xs text-red-400">
              Unable to clear conversation history right now.
            </p>
          )}

          <DataControls />

          <div className="flex flex-wrap gap-6 pt-4 border-t border-border-subtle text-xs text-text-secondary">
            <a
              href="/privacy"
              className="hover:text-text-primary transition-colors"
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="hover:text-text-primary transition-colors"
            >
              Terms
            </a>
            <a
              href="/spotify-attribution"
              className="hover:text-text-primary transition-colors"
            >
              Spotify attribution
            </a>
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
