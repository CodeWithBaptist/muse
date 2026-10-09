/**
 * The tint the page takes on for a vibe. Pure: a prompt in, one colour out.
 * Keywords are matched in order so a named Lagos moment wins over a generic
 * word inside it. The tint is washed over the top of the page at a few
 * percent, so it reads as warmth or coolness, never as a coloured screen.
 */

export interface VibePalette {
  name: string;
  tint: string;
}

export const DEFAULT_VIBE_PALETTE: VibePalette = {
  name: 'muse',
  tint: '#A8E85C',
};

const PALETTES: ReadonlyArray<{ match: RegExp; palette: VibePalette }> = [
  {
    match:
      /detty december|december|party|turn ?up|club|owambe after|carnival|rave/,
    palette: { name: 'carnival', tint: '#FF7A1A' },
  },
  {
    match:
      /heartbreak|breakup|broke up|miss (him|her|them|you)|sad|cry|lonely|tears/,
    palette: { name: 'heartbreak', tint: '#C96A8E' },
  },
  {
    match: /owambe|wedding|aso ?ebi|naming|party jollof|celebrat/,
    palette: { name: 'owambe', tint: '#E0A93A' },
  },
  {
    match: /traffic|danfo|go-?slow|hold-?up|bus stop|okada/,
    palette: { name: 'traffic', tint: '#E8A33D' },
  },
  {
    match:
      /late[- ]night|night|midnight|2 ?am|drive|third mainland|cruise|moon/,
    palette: { name: 'night drive', tint: '#4C5FD5' },
  },
  {
    match: /campus|read|cram|study|exam|focus|revision|library/,
    palette: { name: 'study', tint: '#2E9BA0' },
  },
  {
    match:
      /devotion|worship|gospel|prayer|praise|church|sunday morning|morning/,
    palette: { name: 'devotion', tint: '#E3C76A' },
  },
  {
    match: /sunday|rice and stew|jollof|family|lunch|cooking|kitchen/,
    palette: { name: 'sunday', tint: '#D8603F' },
  },
  {
    match: /gym|grind|workout|run|hustle|sprint|lift|cardio|hiit/,
    palette: { name: 'grind', tint: '#E24B3B' },
  },
  {
    match: /amapiano|piano|log ?drum|sgija/,
    palette: { name: 'piano', tint: '#7C5CC4' },
  },
  {
    match: /highlife|juju|fuji|apala|classic|old school|90s|2000s|throwback/,
    palette: { name: 'classics', tint: '#C9973F' },
  },
  {
    match: /chill|calm|soft|slow|sleep|rain|lo-?fi|relax|quiet/,
    palette: { name: 'calm', tint: '#5B9BD5' },
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
