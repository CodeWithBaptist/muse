import { z } from 'zod';

export interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

export interface SpotifyArtistSummary {
  id?: string;
  name: string;
  genres?: string[];
  images?: SpotifyImage[];
}

export interface SpotifyAlbumSummary {
  id?: string;
  name: string;
  images?: SpotifyImage[];
}

export interface SpotifyTrackItem {
  id: string;
  name: string;
  uri?: string;
  artists: SpotifyArtistSummary[];
  album?: SpotifyAlbumSummary;
  albumArtUrl?: string;
  duration_ms?: number;
  reason?: string;
}

export const ChatPostInputSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Content is required')
    .max(2000, 'Message is too long'),
  conversationId: z.string().uuid().optional(),
});

export const ChatIdParamSchema = z.object({
  id: z.string().uuid('Invalid conversation ID'),
});

export const MusicQueryInputSchema = z.object({
  type: z
    .enum([
      'recent',
      'top-tracks',
      'top-artists',
      'saved-tracks',
      'saved-albums',
      'playlists',
    ])
    .default('recent'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  timeRange: z
    .enum(['short_term', 'medium_term', 'long_term'])
    .default('medium_term'),
});

export const MusicSearchQueryInputSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Query parameter "q" is required')
    .max(200, 'Search query is too long'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const PlaylistTrackMetaSchema = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  albumArtUrl: z.string().trim().max(500).nullable().optional(),
  durationMs: z.number().int().min(0).max(3_600_000).default(180_000),
});

export const PlaylistExportInputSchema = z.object({
  playlistId: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Playlist name is required')
    .max(100, 'Playlist name is too long'),
  description: z
    .string()
    .trim()
    .max(300, 'Description is too long')
    .optional(),
  trackUris: z
    .array(
      z
        .string()
        .trim()
        .regex(/^spotify:track:[A-Za-z0-9]{22}$/, 'Invalid Spotify track URI')
    )
    .min(1, 'At least one track URI is required')
    .max(100, 'Maximum 100 tracks per export'),
  tracks: z.array(PlaylistTrackMetaSchema).max(100).optional(),
});

export const PlaylistCreateDraftInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Playlist name is required')
    .max(100, 'Playlist name is too long'),
  description: z
    .string()
    .trim()
    .max(300, 'Description is too long')
    .optional(),
  tracks: z.array(PlaylistTrackMetaSchema).max(100).default([]),
});

export const PlaylistIdParamSchema = z.object({
  id: z.string().uuid('Invalid playlist ID'),
});

export const PlaylistUpdateInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Playlist name cannot be empty')
    .max(100, 'Playlist name is too long')
    .optional(),
  description: z
    .string()
    .trim()
    .max(300, 'Description is too long')
    .optional(),
  removeTrackId: z.string().trim().min(1).max(120).optional(),
});

export const UserPreferencesInputSchema = z.object({
  discoveryStyle: z
    .enum(['balanced', 'deep_cuts', 'familiar'])
    .default('balanced'),
  playlistLength: z.enum(['10', '15', '20']).default('15'),
  explicitContent: z.enum(['allow', 'clean']).default('allow'),
  favoriteGenres: z.string().trim().max(200).default(''),
});

export const UserPreferencesResponseSchema = UserPreferencesInputSchema.extend({
  updatedAt: z.string().nullable().optional(),
});

export const SpotifyCallbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
});

export const AiStatusResponseSchema = z.object({
  connected: z.boolean(),
  code: z.enum(['AI_CONNECTED', 'AI_NOT_CONNECTED']),
  message: z.string(),
});

export const MeResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z
    .object({
      displayName: z.string(),
      email: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .optional(),
});

export const LogoutResponseSchema = z.object({
  success: z.boolean(),
});

export const ChatPostResponseSchema = z.object({
  conversationId: z.string(),
  role: z.literal('assistant'),
  content: z.string(),
  tracks: z.array(z.record(z.string(), z.unknown())).optional(),
  isPlaylistSuggestion: z.boolean().optional(),
});

export const DiscoverSectionSchema = z.object({
  title: z.string(),
  description: z.string(),
  tracks: z.array(z.record(z.string(), z.unknown())),
});

export const DiscoverResponseSchema = z.object({
  sections: z.array(DiscoverSectionSchema),
});

export const ProfileInsightsResponseSchema = z.object({
  identity: z.object({
    dominantGenre: z.string(),
    tasteSummary: z.string(),
    eraPreference: z.string(),
  }),
  vibe: z.object({
    inferredMood: z.string(),
    inferredEnergy: z.string(),
    description: z.string(),
  }),
  discovery: z.object({
    habit: z.string(),
    recommendation: z.string(),
  }),
  preferences: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
        source: z.string(),
      })
    )
    .optional(),
});

export type DiscoverSectionData = z.infer<typeof DiscoverSectionSchema>;
export type ProfileInsightsData = z.infer<typeof ProfileInsightsResponseSchema>;
export type UserPreferencesData = z.infer<typeof UserPreferencesResponseSchema>;
