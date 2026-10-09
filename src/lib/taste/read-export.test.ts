// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { readSpotifyExportFiles } from './read-export';

const history = JSON.stringify([
  {
    endTime: '2024-01-05 14:23',
    artistName: 'Asake',
    trackName: 'Lonely At The Top',
    msPlayed: 184000,
  },
  {
    endTime: '2024-01-06 09:00',
    artistName: 'Burna Boy',
    trackName: 'Last Last',
    msPlayed: 172000,
  },
]);

function fileOf(
  name: string,
  content: string | Uint8Array,
  type = 'application/json',
) {
  const file = new File([content as BlobPart], name, { type });
  // jsdom's File lacks text() and arrayBuffer() in some versions; provide both.
  if (typeof file.text !== 'function') {
    Object.defineProperty(file, 'text', {
      value: async () =>
        typeof content === 'string'
          ? content
          : new TextDecoder().decode(content),
    });
  }
  if (typeof file.arrayBuffer !== 'function') {
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => {
        const bytes = typeof content === 'string' ? strToU8(content) : content;
        return bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        );
      },
    });
  }
  return file;
}

describe('readSpotifyExportFiles', () => {
  it('reads JSON files directly and reports what it skipped', async () => {
    const result = await readSpotifyExportFiles([
      fileOf('StreamingHistory_music_0.json', history),
      fileOf('YourLibrary.json', '{"tracks":[]}'),
      fileOf('notes.txt', 'hello', 'text/plain'),
      fileOf('broken.json', '{oops'),
    ]);
    expect(result.filesRead).toBe(1);
    expect(result.entries).toBe(2);
    expect(result.snapshot?.topArtists.map((artist) => artist.name)).toEqual([
      'Asake',
      'Burna Boy',
    ]);
    expect(result.skipped).toEqual([
      {
        name: 'YourLibrary.json',
        reason: 'not a Spotify streaming history file',
      },
      { name: 'notes.txt', reason: 'only .zip and .json files are read' },
      { name: 'broken.json', reason: 'not valid JSON' },
    ]);
  });

  it('opens the export ZIP on the device and reads only the streaming history inside', async () => {
    const zip = zipSync({
      'Spotify Account Data/StreamingHistory_music_0.json': strToU8(history),
      'Spotify Account Data/StreamingHistory_podcast_0.json': strToU8(
        '[{"podcastName":"x"}]',
      ),
      'Spotify Account Data/Userdata.json': strToU8(
        '{"email":"private@example.com"}',
      ),
    });
    const result = await readSpotifyExportFiles([
      fileOf('my_spotify_data.zip', zip, 'application/zip'),
    ]);
    expect(result.filesRead).toBe(1);
    expect(result.snapshot?.plays).toBe(2);
    expect(result.skipped).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('private@example.com');

    const empty = await readSpotifyExportFiles([
      fileOf(
        'other.zip',
        zipSync({ 'Userdata.json': strToU8('{}') }),
        'application/zip',
      ),
    ]);
    expect(empty.snapshot).toBeNull();
    expect(empty.skipped[0].reason).toBe(
      'no streaming history inside this ZIP',
    );
  });
});
