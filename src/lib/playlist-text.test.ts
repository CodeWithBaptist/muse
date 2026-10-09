import { describe, expect, it } from 'vitest';
import {
  playlistAsCsv,
  playlistAsText,
  playlistFileStem,
  whatsAppShareUrl,
} from './playlist-text';
import { openLinksFor } from './catalogue/search-links';
import type { ListedTrack } from './catalogue/types';

const tracks: ListedTrack[] = [
  {
    id: 'wizkid--essence',
    title: 'Essence',
    artist: 'Wizkid',
    why: 'Slow heat, "the" one.',
    region: 'Nigeria',
    verification: {
      status: 'verified',
      source: 'deezer',
      id: '1',
      url: 'https://www.deezer.com/track/1',
    },
  },
  {
    id: 'asa--jailer',
    title: 'Jailer',
    artist: 'Asa',
    why: 'Voice, guitar, nothing else needed.',
    region: 'Nigeria',
    verification: { status: 'unverified', reason: 'title_not_found' },
  },
  {
    id: 'tyla--water',
    title: 'Water',
    artist: 'Tyla',
    why: 'Pool side.',
    region: 'Africa',
  },
];

describe('playlist text formats', () => {
  it('writes a numbered plain text list with the MUSE line and an optional link', () => {
    const text = playlistAsText({
      title: 'Sunday rice and stew',
      tracks,
      link: 'https://muse.example/chat',
    });
    expect(text.split('\n')).toEqual([
      'Sunday rice and stew',
      'Built with MUSE',
      '',
      '1. Essence by Wizkid',
      '2. Jailer by Asa',
      '3. Water by Tyla',
      '',
      'Make your own: https://muse.example/chat',
    ]);
    expect(playlistAsText({ title: 'X', tracks: [] })).toBe(
      'X\nBuilt with MUSE\n',
    );
  });

  it('writes CSV with a header, quoting, CRLF, and a byte order mark', () => {
    const csv = playlistAsCsv({ title: 'Sunday', tracks });
    expect(
      csv.startsWith(
        '\uFEFFposition,title,artist,region,why,verified,source,link\r\n',
      ),
    ).toBe(true);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[1]).toBe(
      '1,Essence,Wizkid,Nigeria,"Slow heat, ""the"" one.",true,Deezer,https://www.deezer.com/track/1',
    );
    expect(lines[2]).toBe(
      '2,Jailer,Asa,Nigeria,"Voice, guitar, nothing else needed.",false,,',
    );
    expect(lines[3]).toBe('3,Water,Tyla,Africa,Pool side.,,,');
  });

  it('makes safe file names and an encoded WhatsApp link', () => {
    expect(playlistFileStem('Third Mainland at 1am!')).toBe(
      'muse-third-mainland-at-1am',
    );
    expect(playlistFileStem('   ')).toBe('muse-list');
    expect(whatsAppShareUrl('Owambe\n1. Ye by Burna Boy')).toBe(
      'https://wa.me/?text=Owambe%0A1.%20Ye%20by%20Burna%20Boy',
    );
  });
});

describe('open-in links', () => {
  it('leads with Audiomack and Boomplay and uses the catalogue page for a verified pick', () => {
    const links = openLinksFor(tracks[0]);
    expect(links.map((l) => l.service)).toEqual([
      'audiomack',
      'boomplay',
      'spotify',
      'apple-music',
      'youtube-music',
      'deezer',
    ]);
    const deezer = links.find((l) => l.service === 'deezer')!;
    expect(deezer.direct).toBe(true);
    expect(deezer.url).toBe('https://www.deezer.com/track/1');
    expect(links.find((l) => l.service === 'spotify')!.url).toBe(
      'https://open.spotify.com/search/Wizkid%20Essence',
    );
    expect(openLinksFor(tracks[1]).every((l) => !l.direct)).toBe(true);
  });
});
