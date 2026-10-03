import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  AINotConnectedError,
  chatCompletion,
  isAIConfigured,
  isAINotConnectedError,
  structuredCompletion,
} from './provider';
import { orchestrateDiscover } from './discover-engine';
import { orchestrateProfileInsights } from './profile-engine';
import { GET as getAiStatus } from '@/app/api/ai/status/route';
import { POST as postChat } from '@/app/api/chat/route';
import { GET as getDiscover } from '@/app/api/discover/route';
import { GET as getProfile } from '@/app/api/me/profile/route';
import ChatPage from '@/app/(app)/chat/page';
import DiscoverPage from '@/app/(app)/discover/page';
import ProfilePage from '@/app/(app)/profile/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('AI graceful state when OPENAI_API_KEY is not set', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('detects missing, blank, or placeholder OPENAI_API_KEY without crashing', () => {
    expect(isAIConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = '   ';
    expect(isAIConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = 'add-later';
    expect(isAIConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = 'ADD-LATER';
    expect(isAIConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = 'sk-test-key';
    expect(isAIConfigured()).toBe(true);
  });

  it('throws AINotConnectedError (never fake responses) from provider and engines', async () => {
    await expect(
      chatCompletion([{ role: 'user', content: 'Hello' }])
    ).rejects.toThrow(AINotConnectedError);

    await expect(
      structuredCompletion('Test prompt', {})
    ).rejects.toThrow(AI_NOT_CONNECTED_MESSAGE);

    await expect(orchestrateDiscover('user-123')).rejects.toThrow(
      AI_NOT_CONNECTED_MESSAGE
    );

    await expect(orchestrateProfileInsights('user-123')).rejects.toThrow(
      AI_NOT_CONNECTED_MESSAGE
    );

    expect(isAINotConnectedError(new AINotConnectedError())).toBe(true);
  });

  it('returns clear AI_NOT_CONNECTED responses from API routes without crashing', async () => {
    const statusRes = await getAiStatus();
    expect(statusRes.status).toBe(200);
    await expect(statusRes.json()).resolves.toEqual({
      connected: false,
      code: AI_NOT_CONNECTED_CODE,
      message: AI_NOT_CONNECTED_MESSAGE,
    });

    const chatRes = await postChat(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Recommend some Afrobeats' }),
      })
    );
    expect(chatRes.status).toBe(503);
    await expect(chatRes.json()).resolves.toEqual({
      error: AI_NOT_CONNECTED_MESSAGE,
      code: AI_NOT_CONNECTED_CODE,
      aiConnected: false,
    });

    const discoverRes = await getDiscover();
    expect(discoverRes.status).toBe(503);
    await expect(discoverRes.json()).resolves.toEqual({
      error: AI_NOT_CONNECTED_MESSAGE,
      code: AI_NOT_CONNECTED_CODE,
      aiConnected: false,
    });

    const profileRes = await getProfile();
    expect(profileRes.status).toBe(503);
    await expect(profileRes.json()).resolves.toEqual({
      error: AI_NOT_CONNECTED_MESSAGE,
      code: AI_NOT_CONNECTED_CODE,
      aiConnected: false,
    });
  });

  it('shows "AI is not connected yet" on ChatPage and never shows fake assistant messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/ai/status')) {
        return new Response(
          JSON.stringify({
            connected: false,
            code: AI_NOT_CONNECTED_CODE,
            message: AI_NOT_CONNECTED_MESSAGE,
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/chat')) {
        return new Response(
          JSON.stringify({
            error: AI_NOT_CONNECTED_MESSAGE,
            code: AI_NOT_CONNECTED_CODE,
            aiConnected: false,
          }),
          { status: 503 }
        );
      }
      return new Response('{}', { status: 200 });
    });

    renderWithQueryClient(<ChatPage />);

    await waitFor(() => {
      expect(screen.getByText('AI is not connected yet')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Late night Afrobeats'));

    await waitFor(() => {
      expect(screen.getByText('AI is not connected yet')).toBeDefined();
    });
    expect(screen.queryByText('MUSE')).toBeNull();
  });

  it('shows "AI is not connected yet" on DiscoverPage and ProfilePage', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          error: AI_NOT_CONNECTED_MESSAGE,
          code: AI_NOT_CONNECTED_CODE,
          aiConnected: false,
        }),
        { status: 503 }
      );
    });

    renderWithQueryClient(<DiscoverPage />);
    await waitFor(() => {
      expect(screen.getByText('AI is not connected yet')).toBeDefined();
    });

    renderWithQueryClient(<ProfilePage />);
    await waitFor(() => {
      expect(
        screen.getAllByText('AI is not connected yet').length
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
