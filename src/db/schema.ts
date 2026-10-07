import { pgTable, text, timestamp, uuid, integer, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  spotifyId: text("spotify_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const spotifyAccounts = pgTable("spotify_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token").notNull(), // Encrypted
  expiresAt: timestamp("expires_at").notNull(),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const musicProfiles = pgTable("music_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  topArtists: jsonb("top_artists").$type<string[]>().default([]),
  topGenres: jsonb("top_genres").$type<string[]>().default([]),
  preferredMoods: jsonb("preferred_moods").$type<string[]>().default([]),
  preferredEnergy: text("preferred_energy"), // Inferred
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Section 41. Taste at a point in time.
//
// music_profiles holds one row per user and is overwritten, so it cannot answer
// "how has this changed". A snapshot is the only record of what Spotify reported
// on a given day, and the values are stored verbatim rather than summarised, so
// a later comparison is between two real observations and not between two
// interpretations of them.
export const musicProfileSnapshots = pgTable(
  "music_profile_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topArtists: jsonb("top_artists").$type<string[]>().notNull().default([]),
    topGenres: jsonb("top_genres").$type<string[]>().notNull().default([]),
    // Which Spotify time range was asked for, because a long_term snapshot and a
    // medium_term one are not comparable and must never be diffed against
    // each other.
    timeRange: text("time_range").notNull(),
    capturedAt: timestamp("captured_at").notNull().defaultNow(),
  },
  (table) => [
    index("music_profile_snapshots_user_captured_idx").on(
      table.userId,
      table.capturedAt
    ),
  ],
);

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull().default("New Conversation"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  spotifyPlaylistId: text("spotify_playlist_id"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playlistTracks = pgTable("playlist_tracks", {
  id: uuid("id").primaryKey().defaultRandom(),
  playlistId: uuid("playlist_id").notNull().references(() => playlists.id, { onDelete: 'cascade' }),
  spotifyTrackId: text("spotify_track_id").notNull(),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  albumArtUrl: text("album_art_url"),
  durationMs: integer("duration_ms").notNull(),
});

export const recommendations = pgTable("recommendations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: 'set null' }),
  spotifyTrackId: text("spotify_track_id").notNull(),
  reason: text("reason"),
  // Denormalised track metadata, mirroring playlist_tracks. A refinement turn
  // re-evaluates the rows the user is currently looking at and keeps the ones
  // that still fit, so re-rendering them must not depend on another Spotify
  // call. There is no verified batch resolver, and adding one MUSE has not
  // checked against the current documentation is not worth it for this.
  // Nullable, because rows written before these columns existed have no
  // metadata; a survivor without metadata is treated as not renderable.
  title: text("title"),
  artist: text("artist"),
  albumName: text("album_name"),
  albumArtUrl: text("album_art_url"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const preferences = pgTable("preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  confidence: integer("confidence").notNull().default(100),
  source: text("source").notNull(), // e.g., 'explicit', 'inferred'
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    confidence: integer("confidence").notNull().default(100),
    source: text("source").notNull().default("explicit"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("memories_user_key_idx").on(table.userId, table.key)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  resetAt: timestamp("reset_at").notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type MusicProfile = typeof musicProfiles.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Playlist = typeof playlists.$inferSelect;
export type PlaylistTrack = typeof playlistTracks.$inferSelect;
export type Recommendation = typeof recommendations.$inferSelect;
export type Preference = typeof preferences.$inferSelect;

export type Memory = typeof memories.$inferSelect;
