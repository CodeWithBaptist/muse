import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, getSession, deleteSession } from './session';
import { db } from '@/db';
import { sessions } from '@/db/schema';

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn() })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('Session Management', () => {
  it('creates a session correctly', async () => {
    const userId = 'user-123';
    await createSession(userId);
    expect(db.insert).toHaveBeenCalled();
  });
});
