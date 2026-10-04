"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getSpotifyTrackUri } from "@/lib/spotify-playback";
import {
  PlaybackControlInputSchema,
  PlaybackStartResponseSchema,
  PlaybackStatusResponseSchema,
  UserPreferencesResponseSchema,
} from "@/lib/validation/api-schemas";

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

export type PlaybackAvailability =
  | "checking"
  | "ready"
  | "premium-required"
  | "reconnect-required"
  | "disconnected"
  | "unavailable";
export type PlaybackMode = "spotify" | null;
export type PlaybackAction = "spotify" | null;
export type PlaybackPreference = "muse" | "spotify";

type PlaybackErrorCode =
  | "PREMIUM_REQUIRED"
  | "SPOTIFY_RECONNECT_REQUIRED"
  | "SPOTIFY_DISCONNECTED"
  | "NO_ACTIVE_DEVICE";

interface NowPlayingContextValue {
  selectedTrack: InspectedTrack | null;
  activeTrack: InspectedTrack | null;
  availability: PlaybackAvailability;
  playbackPreference: PlaybackPreference;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackMode: PlaybackMode;
  playbackNotice: string | null;
  selectTrack: (track: InspectedTrack) => void;
  clearTrack: () => void;
  getPlaybackAction: (track: InspectedTrack) => PlaybackAction;
  playTrack: (track: InspectedTrack) => Promise<void>;
  togglePlayback: () => Promise<void>;
  isTrackPlaying: (trackId: string) => boolean;
  isTrackBuffering: (trackId: string) => boolean;
}

const NowPlayingContext = React.createContext<NowPlayingContextValue>({
  selectedTrack: null,
  activeTrack: null,
  availability: "checking",
  playbackPreference: "muse",
  isPlaying: false,
  isBuffering: false,
  playbackMode: null,
  playbackNotice: null,
  selectTrack: () => {},
  clearTrack: () => {},
  getPlaybackAction: () => null,
  playTrack: async () => {},
  togglePlayback: async () => {},
  isTrackPlaying: () => false,
  isTrackBuffering: () => false,
});

function getApiCode(payload: unknown): PlaybackErrorCode | null {
  if (typeof payload !== "object" || payload === null || !("code" in payload)) {
    return null;
  }
  const code = payload.code;
  return typeof code === "string" &&
    [
      "PREMIUM_REQUIRED",
      "SPOTIFY_RECONNECT_REQUIRED",
      "SPOTIFY_DISCONNECTED",
      "NO_ACTIVE_DEVICE",
    ].includes(code)
    ? (code as PlaybackErrorCode)
    : null;
}

export function NowPlayingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authenticated, isLoading: authLoading } = useAuth();
  const playbackStatusQuery = useQuery({
    queryKey: ["spotify-playback-status"],
    queryFn: async () => {
      const response = await fetch("/api/playback/status", {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);
      return PlaybackStatusResponseSchema.parse(payload);
    },
    enabled: authenticated && !authLoading,
    retry: false,
    staleTime: 60_000,
  });
  const userPreferencesQuery = useQuery({
    queryKey: ["user-preferences"],
    queryFn: async () => {
      const response = await fetch("/api/preferences", { cache: "no-store" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error("Unable to load playback preference");
      return UserPreferencesResponseSchema.parse(payload);
    },
    enabled: authenticated && !authLoading,
    retry: false,
    staleTime: 60_000,
  });

  const [selectedTrack, setSelectedTrack] =
    React.useState<InspectedTrack | null>(null);
  const [activeTrack, setActiveTrack] = React.useState<InspectedTrack | null>(
    null,
  );
  const [playbackOverride, setPlaybackOverride] =
    React.useState<PlaybackAvailability | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isBuffering, setIsBuffering] = React.useState(false);
  const [playbackMode, setPlaybackMode] = React.useState<PlaybackMode>(null);
  const [playbackNotice, setPlaybackNotice] = React.useState<string | null>(
    null,
  );

  const playbackPreference =
    userPreferencesQuery.data?.playbackPreference ?? "muse";
  const baseAvailability: PlaybackAvailability = authLoading
    ? "checking"
    : !authenticated
      ? "disconnected"
      : playbackStatusQuery.isLoading
        ? "checking"
        : (playbackStatusQuery.data?.availability ?? "unavailable");
  const availability = playbackOverride ?? baseAvailability;

  const selectTrack = React.useCallback((track: InspectedTrack) => {
    setSelectedTrack(track);
    setPlaybackNotice(null);
  }, []);

  const clearTrack = React.useCallback(() => {
    setSelectedTrack(null);
    setPlaybackNotice(null);
  }, []);

  const getPlaybackAction = React.useCallback(
    (track: InspectedTrack): PlaybackAction => {
      const currentTrackIsActive =
        activeTrack?.id === track.id && playbackMode !== null;
      if (playbackPreference === "spotify" && !currentTrackIsActive) {
        return null;
      }
      return availability === "ready" ? "spotify" : null;
    },
    [activeTrack?.id, availability, playbackMode, playbackPreference],
  );

  const handlePlaybackError = React.useCallback(
    (code: PlaybackErrorCode | null) => {
      if (code === "PREMIUM_REQUIRED") {
        setPlaybackOverride("premium-required");
        setPlaybackNotice(
          "An eligible Spotify Premium subscription is required for playback.",
        );
      } else if (
        code === "SPOTIFY_RECONNECT_REQUIRED" ||
        code === "SPOTIFY_DISCONNECTED"
      ) {
        setPlaybackOverride(
          code === "SPOTIFY_DISCONNECTED"
            ? "disconnected"
            : "reconnect-required",
        );
        setPlaybackNotice("Reconnect Spotify to enable playback in MUSE.");
      } else if (code === "NO_ACTIVE_DEVICE") {
        setPlaybackNotice("Open Spotify on an active device, then try again.");
      } else {
        setPlaybackNotice(
          "Playback is unavailable here. Open this track in Spotify.",
        );
      }
    },
    [],
  );

  const playTrack = React.useCallback(
    async (track: InspectedTrack) => {
      selectTrack(track);
      const action = getPlaybackAction(track);
      if (action !== "spotify") {
        setPlaybackNotice(
          availability === "reconnect-required"
            ? "Reconnect Spotify to enable playback in MUSE."
            : availability === "premium-required"
              ? "An eligible Spotify Premium subscription is required for playback."
              : availability === "disconnected"
                ? "Connect Spotify to play from MUSE."
                : "Playback is unavailable here. Open this track in Spotify.",
        );
        return;
      }

      const trackUri = getSpotifyTrackUri(track);
      if (!trackUri) {
        setPlaybackNotice(
          "This track cannot be played from MUSE. Open it in Spotify.",
        );
        return;
      }

      setPlaybackOverride(null);
      setIsBuffering(true);
      setPlaybackNotice(null);
      try {
        const response = await fetch("/api/playback/play", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackUri }),
        });
        const payload: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          !PlaybackStartResponseSchema.safeParse(payload).success
        ) {
          handlePlaybackError(getApiCode(payload));
          return;
        }

        setActiveTrack(track);
        setPlaybackMode("spotify");
        setIsPlaying(true);
        setPlaybackNotice("Playing on your active Spotify device.");
      } catch {
        setPlaybackNotice(
          "Playback is unavailable right now. Open this track in Spotify.",
        );
      } finally {
        setIsBuffering(false);
      }
    },
    [availability, getPlaybackAction, handlePlaybackError, selectTrack],
  );

  const togglePlayback = React.useCallback(async () => {
    if (!activeTrack || playbackMode !== "spotify") {
      const track = selectedTrack ?? activeTrack;
      if (track) await playTrack(track);
      return;
    }

    const action = isPlaying ? "pause" : "resume";
    const parsedAction = PlaybackControlInputSchema.safeParse({ action });
    if (!parsedAction.success) return;

    setIsBuffering(true);
    setPlaybackNotice(null);
    try {
      const response = await fetch("/api/playback/control", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedAction.data),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !PlaybackStartResponseSchema.safeParse(payload).success
      ) {
        handlePlaybackError(getApiCode(payload));
        return;
      }

      setIsPlaying(action === "resume");
      setPlaybackNotice(
        action === "resume"
          ? "Playing on your active Spotify device."
          : "Paused on Spotify. Resume here or in Spotify.",
      );
    } catch {
      setPlaybackNotice("Spotify playback is unavailable right now.");
    } finally {
      setIsBuffering(false);
    }
  }, [
    activeTrack,
    handlePlaybackError,
    isPlaying,
    playTrack,
    playbackMode,
    selectedTrack,
  ]);

  const isTrackPlaying = React.useCallback(
    (trackId: string) => isPlaying && activeTrack?.id === trackId,
    [activeTrack?.id, isPlaying],
  );
  const isTrackBuffering = React.useCallback(
    (trackId: string) => isBuffering && selectedTrack?.id === trackId,
    [isBuffering, selectedTrack?.id],
  );

  const value = React.useMemo(
    () => ({
      selectedTrack,
      activeTrack,
      availability,
      playbackPreference,
      isPlaying,
      isBuffering,
      playbackMode,
      playbackNotice,
      selectTrack,
      clearTrack,
      getPlaybackAction,
      playTrack,
      togglePlayback,
      isTrackPlaying,
      isTrackBuffering,
    }),
    [
      selectedTrack,
      activeTrack,
      availability,
      playbackPreference,
      isPlaying,
      isBuffering,
      playbackMode,
      playbackNotice,
      selectTrack,
      clearTrack,
      getPlaybackAction,
      playTrack,
      togglePlayback,
      isTrackPlaying,
      isTrackBuffering,
    ],
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
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getSpotifyTrackUrl(trackId?: string): string | null {
  if (!trackId) return null;
  const cleanId = trackId.replace(/^spotify:track:/, "").trim();
  if (!/^[A-Za-z0-9]{22}$/.test(cleanId)) return null;
  return `https://open.spotify.com/track/${encodeURIComponent(cleanId)}`;
}
