/**
 * Sample data for the landing page.
 *
 * This is the only scripted simulation in the product: it never contacts
 * Spotify or OpenAI, no playlist is created, and the preview labels itself
 * "Sample" on screen. The demo drives the real chat components with these
 * values, and every control inside it is inert.
 *
 * The track rows are invented placeholders with the same shape as a real track,
 * so the sample never presents a real catalogue as its own output.
 */

export interface SampleTrack {
  id: string;
  name: string;
  artist: string;
  durationMs: number;
  /** The one line reason the demo shows when the row is inspected. */
  reason: string;
}

/** The prompt the demo types into the input. */
export const SAMPLE_PROMPT = 'Give me something for a late night drive';

/** Shown in the input before the sequence starts, so the window is never empty. */
export const SAMPLE_INPUT_PLACEHOLDER = 'What are we listening to?';

/** The hint above the input before the sequence starts. */
export const SAMPLE_HINT = 'Tell me the mood, sound, artist, or moment.';

/** The reply body. Short, so the word by word reveal stays quick. */
export const SAMPLE_REPLY =
  'Got you. I kept it mellow, rhythmic, and a little atmospheric.';

/** The two scripted thinking lines, in the wording the real indicator uses. */
export const SAMPLE_THINKING_LINES = [
  'Understanding your vibe',
  'Finding something that fits',
] as const;

export const SAMPLE_PLAYLIST_NAME = 'Late Night Lagos';

/**
 * Where the demo's Open in Spotify control would point. The control is inert in
 * the demo and renders as a plain span, so this URL is never followed.
 */
export const SAMPLE_SPOTIFY_URL = 'https://open.spotify.com/';

/**
 * Three example rows. The ids are not Spotify track ids, so the real TrackRow
 * never renders a track link for them: the demo has no reachable links at all.
 */
export const SAMPLE_TRACKS: readonly SampleTrack[] = [
  {
    id: 'sample-nightdrive',
    name: 'Nightdrive',
    artist: 'Ayo Blue',
    durationMs: 224_000,
    reason: 'Slower and warmer, like your late night listening.',
  },
  {
    id: 'sample-slow-motion',
    name: 'Slow Motion',
    artist: 'Temi Waves',
    durationMs: 197_000,
    reason: 'A steady mid tempo groove that keeps the mood low.',
  },
  {
    id: 'sample-harmattan',
    name: 'Harmattan',
    artist: 'Kola and the Night',
    durationMs: 243_000,
    reason: 'Airy pads under a soft rhythm, for the end of the drive.',
  },
];

export interface LandingSample {
  prompt: string;
  inputPlaceholder: string;
  hint: string;
  reply: string;
  thinkingLines: readonly string[];
  playlistName: string;
  spotifyUrl: string;
  tracks: readonly SampleTrack[];
}

export const LANDING_SAMPLE: LandingSample = {
  prompt: SAMPLE_PROMPT,
  inputPlaceholder: SAMPLE_INPUT_PLACEHOLDER,
  hint: SAMPLE_HINT,
  reply: SAMPLE_REPLY,
  thinkingLines: SAMPLE_THINKING_LINES,
  playlistName: SAMPLE_PLAYLIST_NAME,
  spotifyUrl: SAMPLE_SPOTIFY_URL,
  tracks: SAMPLE_TRACKS,
};

/**
 * The phrases the rolling word cycles through. They are examples of what a
 * request can sound like, not claims about a catalogue.
 */
export const ROLLING_PHRASES: readonly string[] = [
  'a late night drive',
  'songs like Brent Faiyaz',
  'something completely new',
  'a 2am Afrobeats mix',
  'music to lock in',
  'slow mornings',
];
