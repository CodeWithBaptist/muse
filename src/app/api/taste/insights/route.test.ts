import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRateLimit: vi.fn(),
  enforceAiBudget: vi.fn(),
  structuredCompletion: vi.fn(),
  aiConfigured: true,
}));

vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => mocks.enforceRateLimit(...args),
}));
vi.mock('@/lib/ai/budget', () => ({
  enforceAiBudget: () => mocks.enforceAiBudget(),
}));
vi.mock('@/lib/ai/provider', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/ai/provider')>(
      '@/lib/ai/provider',
    );
  return {
    ...actual,
    isAIConfigured: () => mocks.aiConfigured,
    structuredCompletion: (...args: unknown[]) =>
      mocks.structuredCompletion(...args),
  };
});

import { POST } from './route';

const insights = {
  identity: {
    dominantGenre: 'Afrobeats',
    tasteSummary: 'Lagos-born energy.',
    eraPreference: '2020s',
  },
  vibe: {
    inferredMood: 'Up',
    inferredEnergy: 'High',
    description: 'Inferred from recent plays.',
  },
  discovery: { habit: 'Follows artists.', recommendation: 'Try Alte next.' },
};

const snapshot = {
  source: 'spotify_export',
  label: 'Spotify data export',
  topArtists: [{ name: 'Asake', plays: 120 }],
  topTracks: [{ title: 'Lonely At The Top', artist: 'Asake', plays: 30 }],
  recentTracks: [{ title: 'Last Last', artist: 'Burna Boy' }],
  range: { from: '2024-01-01', to: '2024-06-30' },
  plays: 900,
  capturedAt: '2024-07-01T00:00:00.000Z',
};

function post(body: unknown) {
  return new Request('http://localhost/api/taste/insights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      Host: 'localhost',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/taste/insights', () => {
  beforeEach(() => {
    mocks.enforceRateLimit.mockReset().mockResolvedValue(null);
    mocks.enforceAiBudget.mockReset().mockResolvedValue(null);
    mocks.structuredCompletion.mockReset().mockResolvedValue(insights);
    mocks.aiConfigured = true;
  });

  it('writes the profile from the posted snapshot without any account', async () => {
    const response = await POST(post({ snapshot }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(insights);
    const [prompt, , system] = mocks.structuredCompletion.mock.calls[0] as [
      string,
      unknown,
      string,
    ];
    expect(prompt).toContain('<listener_taste source="Spotify data export">');
    expect(prompt).toContain('Top artists: Asake (120 plays).');
    expect(prompt).toContain('Covers 2024-01-01 to 2024-06-30.');
    expect(system).toContain('untrusted data');
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({ scope: 'ai:profile' }),
    );
  });

  it('refuses an empty or malformed snapshot before spending the budget', async () => {
    const empty = await POST(
      post({
        snapshot: {
          ...snapshot,
          topArtists: [],
          topTracks: [],
          recentTracks: [],
        },
      }),
    );
    expect(empty.status).toBe(400);
    const malformed = await POST(post({ snapshot: { source: 'lastfm' } }));
    expect(malformed.status).toBe(400);
    expect(mocks.enforceAiBudget).not.toHaveBeenCalled();
    expect(mocks.structuredCompletion).not.toHaveBeenCalled();
  });

  it('says when AI is not connected and when MUSE is resting', async () => {
    mocks.aiConfigured = false;
    const off = await POST(post({ snapshot }));
    expect(off.status).toBe(503);
    expect((await off.json()).code).toBe('AI_NOT_CONNECTED');

    mocks.aiConfigured = true;
    mocks.enforceAiBudget.mockResolvedValue(
      Response.json(
        { error: 'MUSE is resting, try again soon.', code: 'AI_RESTING' },
        { status: 503 },
      ),
    );
    const resting = await POST(post({ snapshot }));
    expect(resting.status).toBe(503);
    expect((await resting.json()).code).toBe('AI_RESTING');
    expect(mocks.structuredCompletion).not.toHaveBeenCalled();
  });
});
