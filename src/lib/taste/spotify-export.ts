import { TASTE_LIST_LIMIT, type TasteSnapshot, type TasteTrack } from './types';

/**
 * Reads the streaming history files inside a Spotify data export and
 * reduces them to a taste snapshot. Pure functions, no DOM and no network,
 * so the browser runs them on the device and the tests run them as is.
 *
 * Two layouts exist. Account data ("Download your data", a few days):
 *   StreamingHistory_music_0.json
 *   [{ "endTime": "2024-01-05 14:23", "artistName": "Asake",
 *      "trackName": "Lonely At The Top", "msPlayed": 184000 }]
 * Extended streaming history (up to 30 days):
 *   Streaming_History_Audio_2023-2024_0.json or endsong_0.json
 *   [{ "ts": "2024-01-05T14:23:11Z", "ms_played": 184000,
 *      "master_metadata_track_name": "...",
 *      "master_metadata_album_artist_name": "...", ... }]
 * Podcast entries carry no track name in either layout and are skipped.
 * The extended layout also carries IP addresses and device strings; this
 * parser never reads those fields and nothing but the summary leaves the
 * parser.
 */

/** A play counts once it has run this long, the same rule Spotify uses. */
export const PLAY_THRESHOLD_MS = 30_000;

export interface StreamEntry {
  title: string;
  artist: string;
  playedAt: number | null;
  msPlayed: number;
}

/** File names worth opening inside an export ZIP. */
export const STREAMING_FILE_PATTERN =
  /(^|\/)(StreamingHistory_music_\d+|StreamingHistory\d*|Streaming_History_Audio[^/]*|endsong_\d+)\.json$/i;

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function asMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

function asTime(value: unknown): number | null {
  if (typeof value !== 'string' || value.length < 10) return null;
  // Account data writes "2024-01-05 14:23" without a zone; read it as UTC
  // so every entry sorts on the same clock.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}:00Z`
    : value;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Converts one decoded JSON document into stream entries; [] when it is not history. */
export function parseStreamingHistory(json: unknown): StreamEntry[] {
  if (!Array.isArray(json)) return [];
  const entries: StreamEntry[] = [];
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title =
      asText(row.trackName) ?? asText(row.master_metadata_track_name);
    const artist =
      asText(row.artistName) ?? asText(row.master_metadata_album_artist_name);
    if (!title || !artist) continue;
    entries.push({
      title,
      artist,
      playedAt: asTime(row.endTime) ?? asTime(row.ts),
      msPlayed: asMs(row.msPlayed) || asMs(row.ms_played),
    });
  }
  return entries;
}

function key(artist: string, title: string): string {
  return `${artist.toLowerCase()}\u0000${title.toLowerCase()}`;
}

function isoDay(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export interface StreamSummaryOptions {
  /** Shown as the snapshot label; defaults to the plain source name. */
  label?: string;
  now?: Date;
}

/** Ranks the entries into a snapshot. Null when nothing could be counted. */
export function summariseStreams(
  entries: StreamEntry[],
  options: StreamSummaryOptions = {},
): TasteSnapshot | null {
  if (entries.length === 0) return null;
  const counted = entries.filter(
    (entry) => entry.msPlayed >= PLAY_THRESHOLD_MS,
  );
  // Some exports only hold short plays; better a rough picture than none.
  const plays = counted.length > 0 ? counted : entries;

  const artists = new Map<
    string,
    { name: string; plays: number; ms: number }
  >();
  const tracks = new Map<
    string,
    { title: string; artist: string; plays: number; ms: number }
  >();
  let from = Number.POSITIVE_INFINITY;
  let to = Number.NEGATIVE_INFINITY;

  for (const entry of plays) {
    const artistKey = entry.artist.toLowerCase();
    const artist = artists.get(artistKey) ?? {
      name: entry.artist,
      plays: 0,
      ms: 0,
    };
    artist.plays += 1;
    artist.ms += entry.msPlayed;
    artists.set(artistKey, artist);

    const trackKey = key(entry.artist, entry.title);
    const track = tracks.get(trackKey) ?? {
      title: entry.title,
      artist: entry.artist,
      plays: 0,
      ms: 0,
    };
    track.plays += 1;
    track.ms += entry.msPlayed;
    tracks.set(trackKey, track);

    if (entry.playedAt !== null) {
      if (entry.playedAt < from) from = entry.playedAt;
      if (entry.playedAt > to) to = entry.playedAt;
    }
  }

  const byPlays = <T extends { plays: number; ms: number }>(a: T, b: T) =>
    b.plays - a.plays || b.ms - a.ms;

  const topArtists = [...artists.values()]
    .sort(byPlays)
    .slice(0, TASTE_LIST_LIMIT)
    .map(({ name, plays }) => ({ name, plays }));
  const topTracks = [...tracks.values()]
    .sort(byPlays)
    .slice(0, TASTE_LIST_LIMIT)
    .map(({ title, artist, plays }) => ({ title, artist, plays }));

  const recentTracks: TasteTrack[] = [];
  const seen = new Set<string>();
  const dated = plays
    .filter((entry) => entry.playedAt !== null)
    .sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
  for (const entry of dated) {
    const trackKey = key(entry.artist, entry.title);
    if (seen.has(trackKey)) continue;
    seen.add(trackKey);
    recentTracks.push({ title: entry.title, artist: entry.artist });
    if (recentTracks.length >= TASTE_LIST_LIMIT) break;
  }

  const hasRange = Number.isFinite(from) && Number.isFinite(to);
  return {
    source: 'spotify_export',
    label: options.label ?? 'Spotify data export',
    topArtists,
    topTracks,
    recentTracks,
    range: hasRange ? { from: isoDay(from), to: isoDay(to) } : undefined,
    plays: plays.length,
    capturedAt: (options.now ?? new Date()).toISOString(),
  };
}
