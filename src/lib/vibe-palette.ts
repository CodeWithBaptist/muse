/**
 * The colours the background drifts toward for a vibe. Pure: a prompt in,
 * three glow colours and an energy out. Keywords are matched in order so a
 * named Lagos moment wins over a generic word inside it. Everything stays a
 * tint over the brand palette; the lime is never replaced, only joined.
 */

export interface VibePalette {
  name: string;
  a: string;
  b: string;
  c: string;
  /** 0 (still) to 1 (full tilt); the drift speed follows it. */
  energy: number;
}

export const DEFAULT_VIBE_PALETTE: VibePalette = {
  name: 'muse',
  a: '#A8E85C',
  b: '#2B5D1A',
  c: '#5B4B8A',
  energy: 0.5,
};

const PALETTES: ReadonlyArray<{ match: RegExp; palette: VibePalette }> = [
  {
    match:
      /detty december|december|party|turn ?up|club|owambe after|carnival|rave/,
    palette: {
      name: 'carnival',
      a: '#A8E85C',
      b: '#FF7A1A',
      c: '#FF3D8A',
      energy: 0.9,
    },
  },
  {
    match:
      /heartbreak|breakup|broke up|miss (him|her|them|you)|sad|cry|lonely|tears/,
    palette: {
      name: 'heartbreak',
      a: '#F06292',
      b: '#8E5BE8',
      c: '#2C3E99',
      energy: 0.5,
    },
  },
  {
    match: /owambe|wedding|aso ?ebi|naming|party jollof|celebrat/,
    palette: {
      name: 'owambe',
      a: '#F5C542',
      b: '#E0418F',
      c: '#A8E85C',
      energy: 0.8,
    },
  },
  {
    match: /traffic|danfo|go-?slow|hold-?up|bus stop|okada/,
    palette: {
      name: 'traffic',
      a: '#FFB020',
      b: '#E8705F',
      c: '#6B4EFF',
      energy: 0.6,
    },
  },
  {
    match:
      /late[- ]night|night|midnight|2 ?am|drive|third mainland|cruise|moon/,
    palette: {
      name: 'night drive',
      a: '#3B4CCA',
      b: '#7A3FE0',
      c: '#19B5B0',
      energy: 0.4,
    },
  },
  {
    match: /campus|read|cram|study|exam|focus|revision|library/,
    palette: {
      name: 'study',
      a: '#1FA2A6',
      b: '#3F7EE8',
      c: '#A8E85C',
      energy: 0.3,
    },
  },
  {
    match:
      /devotion|worship|gospel|prayer|praise|church|sunday morning|morning/,
    palette: {
      name: 'devotion',
      a: '#F3D27A',
      b: '#7FC8F8',
      c: '#F2F1ED',
      energy: 0.4,
    },
  },
  {
    match: /sunday|rice and stew|jollof|family|lunch|cooking|kitchen/,
    palette: {
      name: 'sunday',
      a: '#E5533C',
      b: '#F59E42',
      c: '#F2E7C8',
      energy: 0.5,
    },
  },
  {
    match: /gym|grind|workout|run|hustle|sprint|lift|cardio|hiit/,
    palette: {
      name: 'grind',
      a: '#FF3B30',
      b: '#A8E85C',
      c: '#FF8A00',
      energy: 1,
    },
  },
  {
    match: /amapiano|piano|log ?drum|sgija/,
    palette: {
      name: 'piano',
      a: '#9B5DE5',
      b: '#00BBF9',
      c: '#FEE440',
      energy: 0.8,
    },
  },
  {
    match: /highlife|juju|fuji|apala|classic|old school|90s|2000s|throwback/,
    palette: {
      name: 'classics',
      a: '#D9A441',
      b: '#8C5A2B',
      c: '#A8E85C',
      energy: 0.5,
    },
  },
  {
    match: /chill|calm|soft|slow|sleep|rain|lo-?fi|relax|quiet/,
    palette: {
      name: 'calm',
      a: '#5DADE2',
      b: '#7A86B6',
      c: '#A8E85C',
      energy: 0.25,
    },
  },
];

export function paletteForVibe(text: string | null | undefined): VibePalette {
  if (!text) return DEFAULT_VIBE_PALETTE;
  const normalised = text.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const entry of PALETTES) {
    if (entry.match.test(normalised)) return entry.palette;
  }
  return DEFAULT_VIBE_PALETTE;
}
