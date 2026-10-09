import { z } from 'zod';
import { jsonCompletionText, sanitizePromptInput } from './provider';
import { playlistSystemPrompt } from './muse-prompt';
import { TASTE_PROMPT_GUIDANCE, formatTasteForPrompt } from './taste-context';
import type { TasteSnapshot } from '@/lib/taste/types';
import {
  DEFAULT_CHAT_PREFERENCES,
  type ChatPreferences,
} from '@/lib/chat-preferences';

/**
 * The no-login recommendation engine.
 *
 * The model answers with a strict JSON playlist: eight to twelve real songs,
 * each with a title, an artist, one sentence on why it fits, and a region
 * tag. Nothing here needs a Spotify token. The parser is deliberately
 * forgiving about shape (field aliases, a list cut short by the token cap,
 * stray prose around the JSON) and strict about content (no track without
 * both a title and an artist, no duplicates, never more than twelve).
 */

export const REGION_TAGS = ['Nigeria', 'Africa', 'Global'] as const;
export type RegionTag = (typeof REGION_TAGS)[number];

export const PLAYLIST_MIN_TRACKS = 8;
export const PLAYLIST_MAX_TRACKS = 12;

export const RecommendedTrackSchema = z.object({
  /** Stable key derived from artist and title; the same song gets the same id. */
  id: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  artist: z.string().trim().min(1).max(160),
  why: z.string().trim().min(1).max(280),
  region: z.enum(REGION_TAGS),
});
export type RecommendedTrack = z.infer<typeof RecommendedTrackSchema>;

export const PlaylistAnswerSchema = z.object({
  intro: z.string().trim().min(1).max(600),
  title: z.string().trim().min(1).max(80),
  tracks: z.array(RecommendedTrackSchema).min(1).max(PLAYLIST_MAX_TRACKS),
});
export type PlaylistAnswer = z.infer<typeof PlaylistAnswerSchema>;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export type PlaylistParseResult =
  | { ok: true; value: PlaylistAnswer; short: boolean }
  | { ok: false; reason: 'no-json' | 'no-tracks' };

const DEFAULT_INTRO = 'Here is a list for that.';
const DEFAULT_TITLE = 'MUSE mix';

/* ------------------------------------------------------------------ */
/* Normalisation helpers                                               */
/* ------------------------------------------------------------------ */

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const text = asText(source[key]);
    if (text) return text;
  }
  return '';
}

function artistText(source: Record<string, unknown>): string {
  const single = firstText(source, [
    'artist',
    'by',
    'performer',
    'artist_name',
    'artistName',
  ]);
  if (single) return single;
  const list = source.artists;
  if (Array.isArray(list)) {
    const names = list
      .map((entry) =>
        entry && typeof entry === 'object'
          ? asText((entry as Record<string, unknown>).name)
          : asText(entry),
      )
      .filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return '';
}

const NIGERIA_WORDS = /\b(nigeria|nigerian|naija|ng|lagos|9ja)\b/i;
const AFRICA_WORDS =
  /\b(africa|african|west africa|east africa|south africa|southern africa|ghana|ghanaian|kenya|kenyan|tanzania|tanzanian|south african|sa|amapiano|diaspora)\b/i;

/** Maps whatever the model wrote into one of the three region tags. */
export function normaliseRegion(value: unknown): RegionTag {
  const text = asText(value);
  if (!text) return 'Global';
  if (/^nigeria$/i.test(text)) return 'Nigeria';
  if (/^africa$/i.test(text)) return 'Africa';
  if (/^global$/i.test(text)) return 'Global';
  if (NIGERIA_WORDS.test(text)) return 'Nigeria';
  if (AFRICA_WORDS.test(text)) return 'Africa';
  return 'Global';
}

/** Keeps the first sentence so "why this" stays one line on a phone. */
export function oneSentence(text: string, max = 280): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^.*?[.!?](?=\s|$)/);
  const sentence = match ? match[0] : cleaned;
  return sentence.length > max
    ? `${sentence.slice(0, max - 1).trimEnd()}...`
    : sentence;
}

export function trackKey(artist: string, title: string): string {
  const fold = (value: string) =>
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(feat|ft|featuring)\b.*$/i, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-');
  return `${fold(artist)}--${fold(title)}`;
}

function normaliseTrack(raw: unknown): RecommendedTrack | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const source = raw as Record<string, unknown>;
  const title = firstText(source, [
    'title',
    'name',
    'song',
    'track',
    'track_name',
    'trackName',
  ]);
  const artist = artistText(source);
  if (!title || !artist) return null;
  const whyRaw = firstText(source, [
    'why',
    'why_this',
    'whyThis',
    'reason',
    'note',
    'because',
  ]);
  const why = oneSentence(whyRaw || 'Fits the request.');
  return {
    id: trackKey(artist, title),
    title: title.slice(0, 160),
    artist: artist.slice(0, 160),
    why,
    region: normaliseRegion(source.region ?? source.tag ?? source.origin),
  };
}

function findTrackArray(root: Record<string, unknown>): unknown[] {
  for (const key of [
    'tracks',
    'songs',
    'playlist',
    'recommendations',
    'items',
    'list',
  ]) {
    const candidate = root[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = findTrackArray(candidate as Record<string, unknown>);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* JSON recovery                                                       */
/* ------------------------------------------------------------------ */

function stripFences(text: string): string {
  return text.replace(/```(?:json)?/gi, '').trim();
}

function parseJsonLoosely(text: string): unknown | undefined {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to the outermost braces.
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Pulls every complete `{...}` object out of text that is not valid JSON as
 * a whole, which is what a list cut off by the token cap looks like. Strings
 * are tracked so braces inside a title do not confuse the scan.
 */
export function salvageObjects(text: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            found.push(parsed as Record<string, unknown>);
          }
        } catch {
          // Not a complete object after all; keep scanning.
        }
        start = -1;
      } else if (depth < 0) {
        depth = 0;
        start = -1;
      }
    }
  }
  return found;
}

function salvageFromText(text: string): {
  intro: string;
  title: string;
  tracks: unknown[];
} {
  const inner = stripFences(text);
  const intro = inner.match(/"intro"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? '';
  const title =
    inner.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"tracks"/)?.[1] ?? '';
  // Objects nested inside the top level object; the outer one never closed.
  const afterTracks = inner.indexOf('"tracks"');
  const body = afterTracks >= 0 ? inner.slice(afterTracks) : inner;
  return {
    intro: unescapeJson(intro),
    title: unescapeJson(title),
    tracks: salvageObjects(body),
  };
}

function unescapeJson(text: string): string {
  if (!text) return '';
  try {
    return JSON.parse(`"${text}"`) as string;
  } catch {
    return text;
  }
}

/* ------------------------------------------------------------------ */
/* Public parsing entry point                                          */
/* ------------------------------------------------------------------ */

export function parsePlaylistAnswer(raw: string): PlaylistParseResult {
  if (typeof raw !== 'string' || !raw.trim())
    return { ok: false, reason: 'no-json' };

  let intro = '';
  let title = '';
  let rawTracks: unknown[] = [];

  const parsed = parseJsonLoosely(raw);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const root = parsed as Record<string, unknown>;
    intro = firstText(root, ['intro', 'message', 'summary', 'description']);
    title = firstText(root, ['title', 'name', 'playlist_name', 'playlistName']);
    rawTracks = findTrackArray(root);
  } else if (Array.isArray(parsed)) {
    rawTracks = parsed;
  } else {
    const salvaged = salvageFromText(raw);
    intro = salvaged.intro;
    title = salvaged.title;
    rawTracks = salvaged.tracks;
    if (rawTracks.length === 0) return { ok: false, reason: 'no-json' };
  }

  const seen = new Set<string>();
  const tracks: RecommendedTrack[] = [];
  for (const entry of rawTracks) {
    const track = normaliseTrack(entry);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length >= PLAYLIST_MAX_TRACKS) break;
  }
  if (tracks.length === 0) return { ok: false, reason: 'no-tracks' };

  const value = PlaylistAnswerSchema.parse({
    intro: sanitizePromptInput(intro, 600) || DEFAULT_INTRO,
    title: sanitizePromptInput(title, 80) || DEFAULT_TITLE,
    tracks,
  });
  return { ok: true, value, short: tracks.length < PLAYLIST_MIN_TRACKS };
}

/* ------------------------------------------------------------------ */
/* Prompting                                                           */
/* ------------------------------------------------------------------ */

/** The system prompt for the default preferences; kept for callers and tests. */
export const PLAYLIST_SYSTEM_PROMPT = playlistSystemPrompt(
  DEFAULT_CHAT_PREFERENCES,
);

export function buildPlaylistPrompt(
  userMessage: string,
  history: ChatTurn[] = [],
  preferences: ChatPreferences = DEFAULT_CHAT_PREFERENCES,
  taste: TasteSnapshot | null = null,
): string {
  const safeMessage = sanitizePromptInput(userMessage, 500);
  const tasteBlock = formatTasteForPrompt(taste);
  const turns = history
    .slice(-6)
    .map(
      (turn) =>
        `${turn.role === 'user' ? 'Visitor' : 'MUSE'}: ${sanitizePromptInput(turn.content, 300)}`,
    )
    .join('\n');

  return [
    tasteBlock,
    turns ? `<conversation>\n${turns}\n</conversation>` : '',
    `<user_message>${safeMessage}</user_message>`,
    '',
    `Build a playlist of ${PLAYLIST_MIN_TRACKS} to ${PLAYLIST_MAX_TRACKS} real songs for this request.`,
    tasteBlock ? TASTE_PROMPT_GUIDANCE : '',
    preferences.scope === 'nigeria'
      ? 'Lead with Nigerian music unless the request clearly asks for something else.'
      : 'Pick from anywhere in the world; no regional lean.',
    'For each song give: "title", "artist", "why" (one short sentence on why it fits this request), and "region".',
    '"region" must be exactly one of "Nigeria" (Nigerian artist or record), "Africa" (from elsewhere in Africa or its diaspora), or "Global" (everything else).',
    'Also give "intro" (one or two warm sentences introducing the list, no song names) and "title" (a short playlist name, under 40 characters).',
    'Return exactly this JSON shape:',
    '{"intro": string, "title": string, "tracks": [{"title": string, "artist": string, "why": string, "region": "Nigeria" | "Africa" | "Global"}]}',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

export interface BuildPlaylistOptions {
  /** Injected in tests; defaults to the provider. */
  complete?: (prompt: string, system: string) => Promise<string>;
  preferences?: ChatPreferences;
  /** The visitor's listening, when they brought it; shapes the picks. */
  taste?: TasteSnapshot | null;
}

export interface BuiltPlaylist extends PlaylistAnswer {
  /** True when the model returned fewer than the minimum after all attempts. */
  short: boolean;
}

/**
 * Asks the model once, and once more only if the first answer had no usable
 * tracks at all. Throws a plain Error when both attempts fail so the route
 * can answer honestly instead of showing an empty list.
 */
export async function buildOpenPlaylist(
  userMessage: string,
  history: ChatTurn[] = [],
  options: BuildPlaylistOptions = {},
): Promise<BuiltPlaylist> {
  const complete =
    options.complete ??
    ((prompt: string, system: string) =>
      jsonCompletionText(prompt, system, { temperature: 0.8 }));

  const preferences = options.preferences ?? DEFAULT_CHAT_PREFERENCES;
  const system = playlistSystemPrompt(preferences);
  const prompt = buildPlaylistPrompt(
    userMessage,
    history,
    preferences,
    options.taste ?? null,
  );
  const first = parsePlaylistAnswer(await complete(prompt, system));
  if (first.ok) return { ...first.value, short: first.short };

  const retryPrompt = `${prompt}\n\nThe previous answer was not valid JSON in that shape. Return only the JSON object.`;
  const second = parsePlaylistAnswer(await complete(retryPrompt, system));
  if (second.ok) return { ...second.value, short: second.short };

  throw new Error(`Playlist answer unusable: ${second.reason}`);
}
