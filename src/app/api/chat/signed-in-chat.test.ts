import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The signed-in path on the shared engine: the list is built and checked
 * exactly as for guests, saved with the message, and no Spotify call is
 * made anywhere in the chat.
 */

const mocks = vi.hoisted(() => ({
  extractChatIntent: vi.fn(),
  jsonCompletionText: vi.fn(),
  verifyTracks: vi.fn(),
  inserted: [] as Array<{ table: string; values: Record<string, unknown> }>,
  storedMessages: [] as Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
  }>,
}));

vi.mock('@/db/schema', async () => {
  const actual =
    await vi.importActual<typeof import('@/db/schema')>('@/db/schema');
  return actual;
});

vi.mock('@/db', async () => {
  const schema =
    await vi.importActual<typeof import('@/db/schema')>('@/db/schema');
  const tableName = (table: unknown) =>
    table === schema.conversations
      ? 'conversations'
      : table === schema.messages
        ? 'messages'
        : 'other';
  let nextId = 1;
  return {
    db: {
      select: () => ({
        from: (table: unknown) => {
          const rows =
            tableName(table) === 'messages'
              ? mocks.storedMessages
              : [{ id: 'conv-1', userId: 'user-1' }];
          const chain = {
            where: () => chain,
            orderBy: () => chain,
            limit: () => Promise.resolve([...rows].reverse()),
            then: (resolve: (value: unknown) => void) => resolve(rows),
          };
          return chain;
        },
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const name = tableName(table);
          mocks.inserted.push({ table: name, values });
          const id = `${name}-${nextId++}`;
          if (name === 'messages') {
            mocks.storedMessages.push({
              id,
              role: String(values.role),
              content: String(values.content),
              createdAt: new Date(nextId),
            });
          }
          const result = Promise.resolve([{ id, ...values }]);
          return Object.assign(result, {
            returning: () => Promise.resolve([{ id, ...values }]),
          });
        },
      }),
    },
  };
});

vi.mock('@/lib/session', () => ({
  getSession: async () => ({ userId: 'user-1' }),
}));
vi.mock('@/lib/ai/budget', () => ({ enforceAiBudget: async () => null }));
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: async () => null,
  getClientIdentifier: () => 'ip:test',
}));
vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemoryForPrompt: async () => [],
  formatUserMemoryContext: () => '',
}));
vi.mock('@/lib/ai/recommendation-engine', () => ({
  extractChatIntent: (...args: unknown[]) => mocks.extractChatIntent(...args),
}));
vi.mock('@/lib/spotify-service', () => {
  throw new Error('The chat must never load the Spotify service');
});
vi.mock('@/lib/catalogue', () => ({
  verifyTracks: (...args: unknown[]) => mocks.verifyTracks(...args),
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
  };
});

import { POST } from './route';

const PLAYLIST = JSON.stringify({
  intro: 'Windows down.',
  title: 'Third Mainland at 1am',
  tracks: Array.from({ length: 8 }, (_, i) => ({
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    why: 'Fits.',
    region: 'Nigeria',
  })),
});

function post(body: unknown, accept = 'application/json') {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      Host: 'localhost',
      Accept: accept,
    },
    body: JSON.stringify(body),
  });
}

async function readSse(response: Response) {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

describe('POST /api/chat with an account', () => {
  beforeEach(() => {
    mocks.inserted.length = 0;
    mocks.storedMessages.length = 0;
    mocks.extractChatIntent.mockReset().mockResolvedValue({
      intent: 'build_playlist',
      isDiscovery: true,
      isPlaylistRequest: true,
      suggestedPlaylistName: 'Lagos nights',
    });
    mocks.jsonCompletionText.mockReset().mockResolvedValue(PLAYLIST);
    mocks.verifyTracks
      .mockReset()
      .mockImplementation(async (tracks: Array<Record<string, unknown>>) => ({
        tracks: tracks.slice(0, 7).map((track, index) => ({
          ...track,
          verification:
            index === 0
              ? { status: 'unverified', reason: 'title_not_found' }
              : {
                  status: 'verified',
                  source: 'deezer',
                  id: String(index),
                  url: `https://www.deezer.com/track/${index}`,
                },
        })),
        dropped: tracks.slice(7),
      }));
  });

  it('builds, checks, and saves the list with the conversation, in the chosen language', async () => {
    const response = await POST(
      post(
        {
          content: 'Owambe',
          preferences: { scope: 'nigeria', language: 'pidgin' },
        },
        'text/event-stream',
      ),
    );
    expect(response.status).toBe(200);
    const events = await readSse(response);
    expect(
      events.filter((e) => e.type === 'status').map((e) => e.stage),
    ).toEqual([
      'Dey feel your vibe...',
      'Dey cook your playlist...',
      'Dey confirm say the songs dey...',
    ]);
    const done = events.at(-1)!;
    expect(done.type).toBe('done');
    expect(done.conversationId).toBe('conversations-1');
    expect(done.recommendations).toHaveLength(7);
    expect(done.dropped).toBe(1);
    expect(done.short).toBe(true);
    expect(done.suggestedPlaylistName).toBe('Lagos nights');
    expect(done.tracks).toBeUndefined();

    const [, system] = mocks.jsonCompletionText.mock.calls[0] as [
      string,
      string,
    ];
    expect(system).toContain('Language: Nigerian Pidgin.');

    const saved = mocks.inserted.filter((row) => row.table === 'messages');
    expect(saved.map((row) => row.values.role)).toEqual(['user', 'assistant']);
    const list = saved[1].values.list as {
      title: string;
      tracks: unknown[];
      dropped: number;
      short: boolean;
    };
    expect(list.title).toBe('Third Mainland at 1am');
    expect(list.tracks).toHaveLength(7);
    expect(list.dropped).toBe(1);
    expect(list.short).toBe(true);
    // Nothing goes to the old Spotify recommendations table.
    expect(mocks.inserted.some((row) => row.table === 'other')).toBe(false);
  });

  it('feeds earlier turns of the saved conversation to the engine but not the message just sent', async () => {
    mocks.storedMessages.push(
      {
        id: 'm-1',
        role: 'user',
        content: 'Something for Sunday',
        createdAt: new Date(1),
      },
      {
        id: 'm-2',
        role: 'assistant',
        content: 'Here is Sunday.',
        createdAt: new Date(2),
      },
    );
    const response = await POST(
      post({
        content: 'More like that',
        conversationId: '2b1d1a9e-4f4b-4c0f-9c2d-1f2e3d4c5b6a',
      }),
    );
    expect(response.status).toBe(200);
    const [prompt] = mocks.jsonCompletionText.mock.calls[0] as [string, string];
    expect(prompt).toContain('Something for Sunday');
    expect(prompt).toContain('Here is Sunday.');
    expect(prompt.indexOf('<conversation>')).toBeLessThan(
      prompt.indexOf('<user_message>'),
    );
    const body = await response.json();
    expect(body.recommendations).toHaveLength(7);
    expect(body.conversationId).toBe('2b1d1a9e-4f4b-4c0f-9c2d-1f2e3d4c5b6a');
  });

  it('answers honestly when the list cannot be built, without saving a fake answer', async () => {
    mocks.jsonCompletionText.mockResolvedValue('not json at all');
    const response = await POST(post({ content: 'Gym grind' }));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.code).toBe('AI_ERROR');
    expect(body.error).toContain('could not put a list together');
    expect(
      mocks.inserted
        .filter((row) => row.table === 'messages')
        .map((r) => r.values.role),
    ).toEqual(['user']);
  });
});
