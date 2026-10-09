/**
 * Sample data for the landing page.
 *
 * This is the only scripted simulation in the product: it never contacts
 * OpenAI, a music catalogue, or any music service, nothing is copied or
 * shared, and the preview labels itself "Sample" on screen. The demo drives the real chat components with these
 * values, and every control inside it is inert.
 *
 * The track rows name real, widely released songs so the sample shows the kind
 * of answer MUSE gives, but their ids are sample ids and no durations are
 * shown: nothing in the sample is looked up, guessed, or invented.
 */

export interface SampleTrack {
  id: string;
  name: string;
  artist: string;
  /**
   * Omitted on purpose. Durations come from a catalogue lookup and the sample
   * never makes one, so the real TrackRow simply renders no duration.
   */
  durationMs?: number;
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
  'Reading your request',
  'Finding tracks',
] as const;

export const SAMPLE_PLAYLIST_NAME = 'Late Night Lagos';

/**
 * Three example rows: real songs from three Nigerian artists that fit a late
 * night drive. The ids are sample ids, so the real TrackRow never renders a
 * track link for them: the demo has no reachable links at all.
 */
export const SAMPLE_TRACKS: readonly SampleTrack[] = [
  {
    id: 'sample-free-mind',
    name: 'Free Mind',
    artist: 'Tems',
    reason:
      'Slow, airy, and warm. It sets the pace without asking for attention.',
  },
  {
    id: 'sample-essence',
    name: 'Essence',
    artist: 'Wizkid, Tems',
    reason: 'Soft groove and warm vocals, made for the quiet hours.',
  },
  {
    id: 'sample-calm-down',
    name: 'Calm Down',
    artist: 'Rema',
    reason: 'A steady, easy bounce that keeps the drive moving.',
  },
];

export interface LandingSample {
  prompt: string;
  inputPlaceholder: string;
  hint: string;
  reply: string;
  thinkingLines: readonly string[];
  playlistName: string;
  tracks: readonly SampleTrack[];
}

export const LANDING_SAMPLE: LandingSample = {
  prompt: SAMPLE_PROMPT,
  inputPlaceholder: SAMPLE_INPUT_PLACEHOLDER,
  hint: SAMPLE_HINT,
  reply: SAMPLE_REPLY,
  thinkingLines: SAMPLE_THINKING_LINES,
  playlistName: SAMPLE_PLAYLIST_NAME,
  tracks: SAMPLE_TRACKS,
};

/**
 * The phrases the rolling word cycles through. They are examples of what a
 * request can sound like, not claims about a catalogue.
 */
export const ROLLING_PHRASES: readonly string[] = [
  'a late night drive',
  'Lagos traffic',
  'Rema, but calmer',
  'songs like Brent Faiyaz',
  'a 2am Afrobeats mix',
  'slow mornings',
];
