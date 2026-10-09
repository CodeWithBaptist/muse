import { describe, expect, it } from 'vitest';
import {
  STREAMING_FILE_PATTERN,
  parseStreamingHistory,
  summariseStreams,
} from './spotify-export';

const accountData = [
  {
    endTime: '2024-01-05 14:23',
    artistName: 'Asake',
    trackName: 'Lonely At The Top',
    msPlayed: 184000,
  },
  {
    endTime: '2024-01-05 14:27',
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
  // Skipped before 30 seconds: counts for nothing.
  {
    endTime: '2024-01-06 09:03',
    artistName: 'Rema',
    trackName: 'Calm Down',
    msPlayed: 4000,
  },
];

const extendedData = [
  {
    ts: '2023-12-31T22:00:00Z',
    ms_played: 200000,
    master_metadata_track_name: 'Essence',
    master_metadata_album_artist_name: 'Wizkid',
    master_metadata_album_album_name: 'Made in Lagos',
    spotify_track_uri: 'spotify:track:abc',
    ip_addr_decrypted: '203.0.113.9',
    user_agent_decrypted: 'should never be read',
  },
  {
    ts: '2024-02-01T08:00:00Z',
    ms_played: 1500000,
    master_metadata_track_name: null,
    master_metadata_album_artist_name: null,
    episode_name: 'A podcast episode',
    episode_show_name: 'A show',
  },
];

describe('Spotify export parser', () => {
  it('reads both layouts and skips podcasts and rows without a song', () => {
    expect(parseStreamingHistory(accountData)).toHaveLength(4);
    const extended = parseStreamingHistory(extendedData);
    expect(extended).toEqual([
      {
        title: 'Essence',
        artist: 'Wizkid',
        playedAt: Date.parse('2023-12-31T22:00:00Z'),
        msPlayed: 200000,
      },
    ]);
    expect(parseStreamingHistory({ not: 'an array' })).toEqual([]);
    expect(parseStreamingHistory([null, 1, 'x', {}])).toEqual([]);
  });

  it('ranks artists and songs by plays over 30 seconds and lists recent plays newest first', () => {
    const entries = [
      ...parseStreamingHistory(accountData),
      ...parseStreamingHistory(extendedData),
    ];
    const snapshot = summariseStreams(entries, {
      now: new Date('2024-03-01T00:00:00Z'),
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.source).toBe('spotify_export');
    expect(snapshot!.plays).toBe(4);
    expect(snapshot!.topArtists).toEqual([
      { name: 'Asake', plays: 2 },
      { name: 'Wizkid', plays: 1 },
      { name: 'Burna Boy', plays: 1 },
    ]);
    expect(snapshot!.topTracks[0]).toEqual({
      title: 'Lonely At The Top',
      artist: 'Asake',
      plays: 2,
    });
    expect(snapshot!.recentTracks.map((track) => track.title)).toEqual([
      'Last Last',
      'Lonely At The Top',
      'Essence',
    ]);
    expect(snapshot!.range).toEqual({ from: '2023-12-31', to: '2024-01-06' });
    expect(snapshot!.capturedAt).toBe('2024-03-01T00:00:00.000Z');
    expect(JSON.stringify(snapshot)).not.toContain('203.0.113.9');
  });

  it('falls back to short plays when nothing ran past 30 seconds, and to null when empty', () => {
    const short = summariseStreams(parseStreamingHistory([accountData[3]]));
    expect(short?.topArtists).toEqual([{ name: 'Rema', plays: 1 }]);
    expect(summariseStreams([])).toBeNull();
  });

  it('knows which files inside an export are streaming history', () => {
    const yes = [
      'Spotify Account Data/StreamingHistory_music_0.json',
      'StreamingHistory0.json',
      'Spotify Extended Streaming History/Streaming_History_Audio_2023-2024_1.json',
      'MyData/endsong_3.json',
    ];
    const no = [
      'Spotify Account Data/StreamingHistory_podcast_0.json',
      'Spotify Account Data/YourLibrary.json',
      'Spotify Extended Streaming History/Streaming_History_Video_2023.json',
      'Userdata.json',
    ];
    for (const name of yes) expect(name).toMatch(STREAMING_FILE_PATTERN);
    for (const name of no) expect(name).not.toMatch(STREAMING_FILE_PATTERN);
  });
});
