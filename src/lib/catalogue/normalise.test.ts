import { describe, expect, it } from 'vitest';
import {
  artistMatches,
  coreTitle,
  normaliseText,
  splitArtists,
  titleMatches,
} from './normalise';

describe('catalogue text matching', () => {
  it('normalises case, accents, punctuation, and ampersands', () => {
    expect(normaliseText('Fela KUTI \u2013 Zombie!')).toBe('fela kuti zombie');
    expect(normaliseText('Aya\u0301 & Mama')).toBe('aya and mama');
    expect(normaliseText("D'Banj")).toBe('dbanj');
  });

  it('strips features and version notes from the core title', () => {
    expect(coreTitle('Essence (feat. Tems)')).toBe('essence');
    expect(coreTitle('Essence feat. Tems & Justin Bieber')).toBe('essence');
    expect(coreTitle('Ye - Remastered 2019')).toBe('ye');
    expect(coreTitle('Calm Down (Remix)')).toBe('calm down');
    expect(coreTitle('Water (Sped Up)')).toBe('water');
    expect(coreTitle('Last Last')).toBe('last last');
  });

  it('splits artist credits the way models write them', () => {
    expect(splitArtists('Wizkid ft. Tems')).toEqual(['wizkid', 'tems']);
    expect(splitArtists('Davido x Focalistic')).toEqual([
      'davido',
      'focalistic',
    ]);
    expect(splitArtists('Kabza De Small, DJ Maphorisa & Tyler ICU')).toEqual([
      'kabza de small',
      'dj maphorisa',
      'tyler icu',
    ]);
    expect(splitArtists('Odumodublvck')).toEqual(['odumodublvck']);
  });

  it('matches titles that differ only by features, versions, or minor words', () => {
    expect(titleMatches('Essence', 'Essence (feat. Tems)')).toBe(true);
    expect(titleMatches('Calm Down', 'Calm Down (with Selena Gomez)')).toBe(
      true,
    );
    expect(titleMatches('Ojuelegba', 'Ojuelegba')).toBe(true);
    expect(titleMatches('Sungba', 'Sungba (Remix)')).toBe(true);
    expect(titleMatches('Joro', 'Jaiye Jaiye')).toBe(false);
    expect(titleMatches('Ye', 'Yes')).toBe(false);
  });

  it('matches an artist named as the main act or as a feature', () => {
    expect(artistMatches('Wizkid', 'Wizkid', 'Essence (feat. Tems)')).toBe(
      true,
    );
    expect(artistMatches('Tems', 'Wizkid', 'Essence (feat. Tems)')).toBe(true);
    expect(artistMatches('Wizkid ft. Tems', 'WizKid', 'Essence')).toBe(true);
    expect(artistMatches('Burna Boy', 'Wizkid', 'Essence')).toBe(false);
    expect(artistMatches('Asa', 'Asake', 'Joha')).toBe(false);
  });
});
