import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  enforceAiBudget: vi.fn(),
  enforceRateLimit: vi.fn(),
  extractChatIntent: vi.fn(),
  jsonCompletionText: vi.fn(),
  chatCompletion: vi.fn(),
  chatCompletionStream: vi.fn(),
  dbInsert: vi.fn(),
  verifyTracks: vi.fn(),
}));

vi.mock('@/lib/catalogue', () => ({
  verifyTracks: (...args: unknown[]) => mocks.verifyTracks(...args),
}));

vi.mock('@/db', () => ({
  db: {
    insert: (...args: unknown[]) => {
      mocks.dbInsert(...args);
      throw new Error('The open path must never touch the database');
    },
    select: () => {
      throw new Error('The open path must never touch the database');
    },
  },
}));

vi.mock('@/lib/session', () => ({ getSession: () => mocks.getSession() }));
vi.mock('@/lib/ai/budget', () => ({
  enforceAiBudget: () => mocks.enforceAiBudget(),
}));
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: () => mocks.enforceRateLimit(),
  getClientIdentifier: () => 'ip:test',
}));
vi.mock('@/lib/ai/recommendation-engine', () => ({
  extractChatIntent: (...args: unknown[]) => mocks.extractChatIntent(...args),
}));
vi.mock('@/lib/ai/provider', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/ai/provider')>(
      '@/lib/ai/provider',
    );
  return {
    ...actual,
    isAIConfigured: () => true,
    jsonCompletionText: (...args: unknown[]) =>
      mocks.jsonCompletionText(...args),
    chatCompletion: (...args: unknown[]) => mocks.chatCompletion(...args),
    chatCompletionStream: (...args: unknown[]) =>
      mocks.chatCompletionStream(...args),
  };
});

import { POST } from './route';

const PLAYLIST = JSON.stringify({
  intro: 'Windows down.',
  title: 'Third Mainland at 1am',
  tracks: Array.from({ length: 9 }, (_, i) => ({
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    why: 'Fits.',
    region: i < 6 ? 'Nigeria' : i < 8 ? 'Africa' : 'Global',
  })),
});

function post(body: unknown, accept = 'application/json'): Request {
  return new Request('http://127.0.0.1:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: accept },
    body: JSON.stringify(body),
  });
}

async function readSse(
  response: Response,
): Promise<Array<Record<string, unknown>>> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

describe('POST /api/chat without an account', () => {
  beforeEach(() => {
    mocks.getSession.mockReset().mockResolvedValue(null);
    mocks.enforceAiBudget.mockReset().mockResolvedValue(null);
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    mocks.extractChatIntent.mockReset();
    mocks.jsonCompletionText.mockReset();
    mocks.chatCompletion.mockReset();
    mocks.chatCompletionStream.mockReset();
    mocks.dbInsert.mockReset();
    mocks.verifyTracks
      .mockReset()
      .mockImplementation(async (tracks: Array<Record<string, unknown>>) => ({
        tracks: tracks.map((track) => ({
          ...track,
          verification: {
            status: 'verified',
            source: 'deezer',
            id: '1',
            url: 'https://www.deezer.com/track/1',
          },
        })),
        dropped: [],
      }));
  });

  it('answers a discovery request with the JSON playlist and stores nothing', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'recommend_tracks',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue(PLAYLIST);

    const response = await POST(post({ content: 'Lagos traffic' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.playlistTitle).toBe('Third Mainland at 1am');
    expect(body.content).toBe('Windows down.');
    expect(body.isPlaylistSuggestion).toBe(true);
    expect(body.recommendations).toHaveLength(9);
    expect(body.recommendations[0]).toEqual({
      id: 'artist-0--song-0',
      title: 'Song 0',
      artist: 'Artist 0',
      why: 'Fits.',
      region: 'Nigeria',
      verification: {
        status: 'verified',
        source: 'deezer',
        id: '1',
        url: 'https://www.deezer.com/track/1',
      },
    });
    expect(mocks.verifyTracks).toHaveBeenCalledTimes(1);
    expect(body.conversationId).toBeUndefined();
    expect(mocks.dbInsert).not.toHaveBeenCalled();
    expect(mocks.enforceAiBudget).toHaveBeenCalledTimes(1);
  });

  it('streams status, intro words, and a done event carrying the list', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'build_playlist',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue(PLAYLIST);

    const response = await POST(
      post({ content: 'Owambe' }, 'text/event-stream'),
    );
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    const events = await readSse(response);
    expect(events.map((event) => event.type)).toEqual([
      'status',
      'status',
      'status',
      'delta',
      'delta',
      'delta',
      'done',
    ]);
    expect(events[1].stage).toBe('Building your list');
    expect(events[2].stage).toBe('Checking the songs against the catalogue');
    const done = events.at(-1)!;
    expect(done.recommendations).toHaveLength(9);
    expect(
      (done.recommendations as Array<{ verification: { status: string } }>)[0]
        .verification.status,
    ).toBe('verified');
    expect(done.short).toBe(false);
    expect(done.dropped).toBe(0);
  });

  it('reports dropped picks and keeps unverified ones in the done event', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'build_playlist',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue(PLAYLIST);
    mocks.verifyTracks.mockImplementation(
      async (tracks: Array<Record<string, unknown>>) => ({
        tracks: tracks.slice(0, 7).map((track) => ({
          ...track,
          verification: { status: 'unverified', reason: 'title_not_found' },
        })),
        dropped: tracks.slice(7),
      }),
    );

    const response = await POST(post({ content: 'Owambe' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.recommendations).toHaveLength(7);
    expect(body.recommendations[0].verification.reason).toBe('title_not_found');
    expect(body.dropped).toBe(2);
    expect(body.short).toBe(true);
    expect(body.noResults).toBe(false);
  });

  it('passes the scope and language through to the prompts and the status lines', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'build_playlist',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue(PLAYLIST);

    const response = await POST(
      post(
        {
          content: 'Gym grind',
          preferences: { scope: 'global', language: 'pidgin' },
        },
        'text/event-stream',
      ),
    );
    const events = await readSse(response);
    expect(events[0].stage).toBe('Dey feel your vibe...');
    expect(events[1].stage).toBe('Dey cook your playlist...');

    const [prompt, system] = mocks.jsonCompletionText.mock.calls[0] as [
      string,
      string,
    ];
    expect(system).toContain('Scope: global.');
    expect(system).toContain('Language: Nigerian Pidgin.');
    expect(system).toContain('not a caricature');
    expect(prompt).toContain('no regional lean');
  });

  it('falls back to Nigeria first in English when no preferences are sent', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'build_playlist',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue(PLAYLIST);

    const response = await POST(post({ content: 'Owambe' }));
    expect(response.status).toBe(200);
    const [prompt, system] = mocks.jsonCompletionText.mock.calls[0] as [
      string,
      string,
    ];
    expect(system).toContain('Scope: Nigeria first.');
    expect(system).toContain('Language: clear, warm Nigerian English.');
    expect(prompt).toContain('Lead with Nigerian music');
  });

  it('feeds the browser-held history to the reply and never the database', async () => {
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'general_chat',
      isDiscovery: false,
    });
    mocks.chatCompletion.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'I do not have your listening data, but tell me a vibe.',
          },
        },
      ],
    });

    const response = await POST(
      post({
        content: 'What is my taste like?',
        history: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'Welcome in.' },
        ],
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.content).toContain('tell me a vibe');

    const sent = mocks.chatCompletion.mock.calls[0][0] as Array<{
      role: string;
      content: string;
    }>;
    expect(sent.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ]);
    expect(sent[0].content).toContain('do not have access to this visitor');
    expect(sent[3].content).toBe('What is my taste like?');
    expect(mocks.dbInsert).not.toHaveBeenCalled();
  });

  it('rejects an over-long or malformed history before spending anything', async () => {
    const tooMany = Array.from({ length: 11 }, () => ({
      role: 'user',
      content: 'x',
    }));
    const response = await POST(post({ content: 'hi', history: tooMany }));
    expect(response.status).toBe(400);
    expect(mocks.enforceAiBudget).not.toHaveBeenCalled();

    const badRole = await POST(
      post({ content: 'hi', history: [{ role: 'system', content: 'x' }] }),
    );
    expect(badRole.status).toBe(400);
  });

  it('reports an unusable playlist answer on the stream instead of an empty list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.extractChatIntent.mockResolvedValue({
      intent: 'recommend_tracks',
      isDiscovery: true,
    });
    mocks.jsonCompletionText.mockResolvedValue('{"tracks": []}');

    const events = await readSse(
      await POST(post({ content: 'anything' }, 'text/event-stream')),
    );
    const last = events.at(-1)!;
    expect(last.type).toBe('error');
    expect(last.code).toBe('AI_ERROR');
    expect(last.error).toContain('could not put a list together');
    expect(mocks.jsonCompletionText).toHaveBeenCalledTimes(2);

    const json = await POST(post({ content: 'anything' }));
    expect(json.status).toBe(502);
  });

  it('still answers "MUSE is resting" when the daily budget is spent', async () => {
    const resting = Response.json({ code: 'AI_RESTING' }, { status: 503 });
    mocks.enforceAiBudget.mockResolvedValue(resting);
    expect(await POST(post({ content: 'hi' }))).toBe(resting);
    expect(mocks.extractChatIntent).not.toHaveBeenCalled();
  });
});
