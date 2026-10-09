import type { ListedTrack } from '@/lib/catalogue/types';

/**
 * Plain-text and CSV renderings of a list, for copying, downloading, and
 * sharing. Pure functions, so the formats are tested without a browser.
 */

export interface PlaylistDocument {
  title: string;
  tracks: ListedTrack[];
  /** Where the reader can make their own; omitted when unknown. */
  link?: string;
}

export function playlistFileStem(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `muse-${slug || 'list'}`;
}

/** The list as people paste it into a chat: numbered, one song per line. */
export function playlistAsText(doc: PlaylistDocument): string {
  const lines = [doc.title, 'Built with MUSE', ''];
  doc.tracks.forEach((track, index) => {
    lines.push(`${index + 1}. ${track.title} by ${track.artist}`);
  });
  if (doc.link) {
    lines.push('', `Make your own: ${doc.link}`);
  }
  return lines.join('\n');
}

/** A shorter form for Web Share and WhatsApp, where long texts get cut. */
export function playlistAsShareText(doc: PlaylistDocument): string {
  return playlistAsText(doc);
}

function csvCell(value: string | number | boolean | undefined): string {
  if (value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const PLAYLIST_CSV_COLUMNS = [
  'position',
  'title',
  'artist',
  'region',
  'why',
  'verified',
  'source',
  'link',
] as const;

/** RFC 4180 style CSV with a UTF-8 byte order mark so spreadsheets read accents correctly. */
export function playlistAsCsv(doc: PlaylistDocument): string {
  const rows = [PLAYLIST_CSV_COLUMNS.join(',')];
  doc.tracks.forEach((track, index) => {
    const verification = track.verification;
    rows.push(
      [
        index + 1,
        track.title,
        track.artist,
        track.region,
        track.why,
        verification ? verification.status === 'verified' : '',
        verification?.source === 'itunes'
          ? 'Apple Music'
          : verification?.source === 'deezer'
            ? 'Deezer'
            : '',
        verification?.url ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
  });
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
