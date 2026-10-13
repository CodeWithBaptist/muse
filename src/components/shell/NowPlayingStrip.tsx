'use client';

import { ExternalLink } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { getSpotifyTrackUrl, useNowPlaying } from '@/hooks/use-now-playing';
import { PlaybackButton } from './PlaybackButton';
import { TrackArtwork } from './TrackArtwork';

/**
 * The compact now-playing bar for every width below the xl rail: phones
 * (above the tabs) and laptops between the lg and xl breakpoints (under the
 * main area). It renders nothing until a track is selected or playing, so an
 * empty bar never takes space from the page.
 */

function artistLabel(track: { artists: { name: string }[] | string }) {
  return Array.isArray(track.artists)
    ? track.artists.map((artist) => artist.name).join(', ')
    : track.artists;
}

export function shortPlaybackNotice({
  playbackNotice,
  playbackPreference,
  availability,
  isActiveTrack,
}: {
  playbackNotice: string | null;
  playbackPreference: ReturnType<typeof useNowPlaying>['playbackPreference'];
  availability: ReturnType<typeof useNowPlaying>['availability'];
  isActiveTrack: boolean;
}): string | null {
  if (playbackNotice) return playbackNotice;
  if (playbackPreference === 'spotify' && !isActiveTrack) {
    return 'Your playback preference is Spotify. Open this track there to listen.';
  }
  if (availability === 'ready' && !isActiveTrack) {
    return 'Open Spotify on an active device to play from MUSE.';
  }
  if (availability === 'premium-required') {
    return 'Eligible Spotify Premium is required for playback here.';
  }
  if (availability === 'reconnect-required')
    return 'Reconnect Spotify for playback.';
  if (availability === 'unavailable')
    return 'Playback unavailable. Open in Spotify.';
  if (availability === 'disconnected')
    return 'Link Spotify for testing to play here.';
  return null;
}

export function NowPlayingStrip() {
  const {
    openDetails,
    selectedTrack,
    activeTrack,
    availability,
    playbackPreference,
    isPlaying,
    isBuffering,
    playbackMode,
    playbackNotice,
    getPlaybackAction,
    playTrack,
    togglePlayback,
    isTrackPlaying,
    isTrackBuffering,
  } = useNowPlaying();

  const track =
    isPlaying || isBuffering
      ? (activeTrack ?? selectedTrack)
      : (selectedTrack ?? activeTrack);

  if (!track) return null;

  const artistName = artistLabel(track);
  const artUrl = track.album?.images?.[0]?.url || track.albumArtUrl;
  const spotifyUrl = getSpotifyTrackUrl(track.id);
  const action = getPlaybackAction(track);
  const playing = isTrackPlaying(track.id);
  const busy = isTrackBuffering(track.id);
  const isActiveTrack = activeTrack?.id === track.id && playbackMode !== null;
  const notice = shortPlaybackNotice({
    playbackNotice,
    playbackPreference,
    availability,
    isActiveTrack,
  });

  const handlePlayback = () => {
    if (isActiveTrack) {
      void togglePlayback();
    } else {
      void playTrack(track);
    }
  };

  return (
    <aside
      aria-label="Now playing"
      data-testid="now-playing-strip"
      className="flex shrink-0 items-center gap-3 border-t border-border-subtle bg-background px-4 py-2 md:pb-[max(0.5rem,env(safe-area-inset-bottom))] xl:hidden"
    >
      <div
        aria-hidden={artUrl ? undefined : true}
        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-strong bg-surface"
      >
        {artUrl ? (
          <TrackArtwork src={artUrl} alt="" className="h-full w-full" />
        ) : (
          <Logo variant="mark" size={16} className="opacity-20" />
        )}
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus();
          openDetails();
        }}
        aria-label={`Show details for ${track.name}`}
        aria-haspopup="dialog"
        className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-ring"
      >
        <div className="truncate text-xs font-semibold text-text-primary">
          {track.name}
        </div>
        <div className="truncate text-[11px] text-text-secondary">
          {artistName}
        </div>
        {notice ? (
          <div
            role="status"
            aria-live="polite"
            title={notice}
            className="truncate text-[11px] leading-tight text-text-muted"
          >
            {notice}
          </div>
        ) : null}
      </button>

      {action ? (
        <PlaybackButton
          playing={playing}
          busy={busy}
          label={
            busy
              ? 'Starting playback'
              : playing
                ? `Pause ${track.name} on Spotify`
                : `Play ${track.name} on Spotify`
          }
          onClick={handlePlayback}
          className="h-11 w-11 shrink-0"
        />
      ) : null}

      {spotifyUrl ? (
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${track.name} in Spotify`}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary focus-ring"
        >
          <ExternalLink size={16} aria-hidden="true" />
        </a>
      ) : null}
    </aside>
  );
}
