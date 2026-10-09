import {
  STREAMING_FILE_PATTERN,
  parseStreamingHistory,
  summariseStreams,
  type StreamEntry,
} from './spotify-export';
import type { TasteSnapshot } from './types';

/**
 * Opens the files a visitor picked (the export ZIP, or the JSON files from
 * inside it) in the browser and reduces them to a snapshot. Nothing here
 * touches the network: the files are read into memory, parsed, and dropped.
 * The ZIP reader (fflate) is imported only when a ZIP is actually chosen,
 * so the page never pays for it otherwise. It inflates synchronously
 * because the site's Content-Security-Policy does not allow the blob
 * workers the async reader would spawn; a large export blocks the page for
 * a moment, which the UI says up front.
 */

/** Above this, the phone is likely to run out of memory before we finish. */
export const EXPORT_FILE_LIMIT_BYTES = 250 * 1024 * 1024;

export interface SkippedFile {
  name: string;
  reason: string;
}

export interface ReadExportResult {
  snapshot: TasteSnapshot | null;
  /** Streaming history documents that yielded entries. */
  filesRead: number;
  skipped: SkippedFile[];
  entries: number;
}

function parseDocument(name: string, text: string): StreamEntry[] | string {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return 'not valid JSON';
  }
  const entries = parseStreamingHistory(json);
  if (entries.length === 0) {
    return STREAMING_FILE_PATTERN.test(name)
      ? 'no songs in this file'
      : 'not a Spotify streaming history file';
  }
  return entries;
}

async function readZip(file: File): Promise<{ name: string; text: string }[]> {
  const { unzipSync } = await import('fflate');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const unzipped = unzipSync(bytes, {
    filter: (entry) => STREAMING_FILE_PATTERN.test(entry.name),
  });
  const decoder = new TextDecoder();
  return Object.entries(unzipped).map(([name, data]) => ({
    name,
    text: decoder.decode(data),
  }));
}

export async function readSpotifyExportFiles(
  files: readonly File[],
  options: { now?: Date } = {},
): Promise<ReadExportResult> {
  const entries: StreamEntry[] = [];
  const skipped: SkippedFile[] = [];
  let filesRead = 0;

  const consume = (name: string, text: string) => {
    const result = parseDocument(name, text);
    if (typeof result === 'string') {
      skipped.push({ name, reason: result });
      return;
    }
    filesRead += 1;
    entries.push(...result);
  };

  for (const file of files) {
    if (file.size > EXPORT_FILE_LIMIT_BYTES) {
      skipped.push({
        name: file.name,
        reason:
          'too large to open on this device; pick the JSON files inside it instead',
      });
      continue;
    }
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      try {
        const documents = await readZip(file);
        if (documents.length === 0) {
          skipped.push({
            name: file.name,
            reason: 'no streaming history inside this ZIP',
          });
        }
        for (const document of documents)
          consume(`${file.name}/${document.name}`, document.text);
      } catch {
        skipped.push({
          name: file.name,
          reason: 'could not be opened as a ZIP',
        });
      }
    } else if (lower.endsWith('.json')) {
      consume(file.name, await file.text());
    } else {
      skipped.push({
        name: file.name,
        reason: 'only .zip and .json files are read',
      });
    }
  }

  return {
    snapshot: summariseStreams(entries, { now: options.now }),
    filesRead,
    skipped,
    entries: entries.length,
  };
}
