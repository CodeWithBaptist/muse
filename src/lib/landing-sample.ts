/**
 * Sample data for the scripted landing demo.
 *
 * This is the only scripted simulation in the product: it never contacts
 * Spotify or OpenAI, no playlist is created, and the preview labels itself
 * "Sample" on screen. The demo drives the real chat components with these
 * values, and every control inside it is inert.
 */

export interface SampleTrack {
  id: string;
  name: string;
  artist: string;
  durationMs: number;
}

/** A prompt that reads like a real request, kept from the landing copy. */
export const SAMPLE_PROMPT = 'I want something like Brent Faiyaz but less sad.';

/** The reply body shown by the demo. Short, so the reveal stays quick. */
export const SAMPLE_REPLY =
  'A sample recommendation layout with example tracks and an example playlist action.';

/**
 * The two scripted thinking lines, in the same wording the real thinking
 * indicator uses for a plain request.
 */
export const SAMPLE_THINKING_LINES = [
  'Understanding your vibe',
  'Finding something that fits',
] as const;

export const SAMPLE_PLAYLIST_NAME = 'Late night drive';

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
  { id: 'sample-selfish', name: 'Selfish', artist: 'Brent Faiyaz', durationMs: 225_000 },
  { id: 'sample-trust', name: 'Trust', artist: 'Brent Faiyaz', durationMs: 192_000 },
  {
    id: 'sample-dead-man-walking',
    name: 'Dead Man Walking',
    artist: 'Brent Faiyaz',
    durationMs: 187_000,
  },
];

export interface LandingSample {
  prompt: string;
  reply: string;
  thinkingLines: readonly string[];
  playlistName: string;
  spotifyUrl: string;
  tracks: readonly SampleTrack[];
}

export const LANDING_SAMPLE: LandingSample = {
  prompt: SAMPLE_PROMPT,
  reply: SAMPLE_REPLY,
  thinkingLines: SAMPLE_THINKING_LINES,
  playlistName: SAMPLE_PLAYLIST_NAME,
  spotifyUrl: SAMPLE_SPOTIFY_URL,
  tracks: SAMPLE_TRACKS,
};
