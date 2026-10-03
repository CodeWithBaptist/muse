'use client';

import * as React from 'react';

export interface InspectedTrack {
  id: string;
  name: string;
  artists: { name: string }[] | string;
  album?: { name?: string; images?: { url: string }[] };
  albumArtUrl?: string;
  duration_ms?: number;
  reason?: string;
  uri?: string;
}

interface NowPlayingContextValue {
  selectedTrack: InspectedTrack | null;
  selectTrack: (track: InspectedTrack) => void;
  clearTrack: () => void;
}

const NowPlayingContext = React.createContext<NowPlayingContextValue>({
  selectedTrack: null,
  selectTrack: () => {},
  clearTrack: () => {},
});

export function NowPlayingProvider({ children }: { children: React.ReactNode }) {
  const [selectedTrack, setSelectedTrack] = React.useState<InspectedTrack | null>(null);

  const selectTrack = React.useCallback((track: InspectedTrack) => {
    setSelectedTrack(track);
  }, []);

  const clearTrack = React.useCallback(() => {
    setSelectedTrack(null);
  }, []);

  const value = React.useMemo(
    () => ({ selectedTrack, selectTrack, clearTrack }),
    [selectedTrack, selectTrack, clearTrack]
  );

  return (
    <NowPlayingContext.Provider value={value}>
      {children}
    </NowPlayingContext.Provider>
  );
}

export function useNowPlaying() {
  return React.useContext(NowPlayingContext);
}

export function formatTrackDuration(durationMs?: number): string | null {
  if (!durationMs || durationMs <= 0) return null;
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getSpotifyTrackUrl(trackId?: string): string | null {
  if (!trackId) return null;
  const cleanId = trackId.replace(/^spotify:track:/, '').trim();
  if (!cleanId) return null;
  return `https://open.spotify.com/track/${encodeURIComponent(cleanId)}`;
}
