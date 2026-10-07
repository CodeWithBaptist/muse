/**
 * Sample data for the scripted landing demo.
 *
 * This is the only scripted simulation in the product: it never contacts
 * Spotify or OpenAI, no playlist is created, and the preview labels itself
 * "Sample" on screen. The demo drives the real chat components with these
 * values, and every control inside it is inert.
 *
 * The three tracks are real recordings by three different artists, chosen
 * because they genuinely answer the sample prompt: same alternative R&B
 * territory as the named artist, warm and romantic rather than bleak. A
 * request for something like an artist but less sad must not be answered with
 * three tracks by that same artist.
 *
 * These rows are not resolved through Spotify, so the ids keep a `sample-`
 * prefix and the real TrackRow renders no link for any of them.
 *
 * Durations are deliberately absent. Spotify is the only source of truth for
 * `duration_ms`, and public sources disagree with each other and with Spotify
 * by a second or two, so any number written here would be invented metadata.
 * TrackRow reserves the duration slot whether or not a value is present, so
 * omitting it causes no layout shift.
 */

export interface SampleTrack {
  id: string;
  name: string;
  artist: string;
}

/** A prompt that reads like a real request, kept from the landing copy. */
export const SAMPLE_PROMPT = 'I want something like Brent Faiyaz but less sad.';

/** The reply body shown by the demo. Short, so the reveal stays quick. */
export const SAMPLE_REPLY =
  'Warmer alternative R&B from three different artists, with less of the melancholy.';

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
 * Three example rows from three artists. The ids are not Spotify track ids, so
 * the real TrackRow never renders a track link for them: the demo has no
 * reachable links at all.
 */
export const SAMPLE_TRACKS: readonly SampleTrack[] = [
  {
    id: 'sample-get-you',
    name: 'Get You (feat. Kali Uchis)',
    artist: 'Daniel Caesar',
  },
  {
    id: 'sample-i-want-you-around',
    name: 'I Want You Around',
    artist: 'Snoh Aalegra',
  },
  {
    id: 'sample-over',
    name: 'Over',
    artist: 'Lucky Daye',
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
