/**
 * The tint the page takes on for a vibe. Pure: a prompt in, one colour out.
 * Keywords are matched in order so a named Lagos moment wins over a generic
 * word inside it. Every tint is a CSS token from the cobalt and azure palette.
 */

import { vibeTintVariables } from './design-tokens';

export interface VibePalette {
  name: string;
  tint: string;
}

type VibeTintName = keyof typeof vibeTintVariables;

function tint(name: VibeTintName): string {
  return `var(${vibeTintVariables[name]})`;
}

export const DEFAULT_VIBE_PALETTE: VibePalette = {
  name: 'muse',
  tint: tint('muse'),
};

const PALETTES: ReadonlyArray<{ match: RegExp; palette: VibePalette }> = [
  {
    match:
      /detty december|december|party|turn ?up|club|owambe after|carnival|rave/,
    palette: { name: 'carnival', tint: tint('carnival') },
  },
  {
    match:
      /heartbreak|breakup|broke up|miss (him|her|them|you)|sad|cry|lonely|tears/,
    palette: { name: 'heartbreak', tint: tint('heartbreak') },
  },
  {
    match: /owambe|wedding|aso ?ebi|naming|party jollof|celebrat/,
    palette: { name: 'owambe', tint: tint('owambe') },
  },
  {
    match: /traffic|danfo|go-?slow|hold-?up|bus stop|okada/,
    palette: { name: 'traffic', tint: tint('traffic') },
  },
  {
    match:
      /late[- ]night|night|midnight|2 ?am|drive|third mainland|cruise|moon/,
    palette: { name: 'night drive', tint: tint('nightDrive') },
  },
  {
    match: /campus|read|cram|study|exam|focus|revision|library/,
    palette: { name: 'study', tint: tint('study') },
  },
  {
    match:
      /devotion|worship|gospel|prayer|praise|church|sunday morning|morning/,
    palette: { name: 'devotion', tint: tint('devotion') },
  },
  {
    match: /sunday|rice and stew|jollof|family|lunch|cooking|kitchen/,
    palette: { name: 'sunday', tint: tint('sunday') },
  },
  {
    match: /gym|grind|workout|run|hustle|sprint|lift|cardio|hiit/,
    palette: { name: 'grind', tint: tint('grind') },
  },
  {
    match: /amapiano|piano|log ?drum|sgija/,
    palette: { name: 'piano', tint: tint('piano') },
  },
  {
    match: /highlife|juju|fuji|apala|classic|old school|90s|2000s|throwback/,
    palette: { name: 'classics', tint: tint('classics') },
  },
  {
    match: /chill|calm|soft|slow|sleep|rain|lo-?fi|relax|quiet/,
    palette: { name: 'calm', tint: tint('calm') },
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
