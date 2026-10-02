import { describe, it, expect, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

import { db } from '@/db';

describe('Health API', () => {
  it('returns ok: true when database is healthy', async () => {
    (db.execute as any).mockResolvedValueOnce({});
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('returns ok: false when database is unhealthy', async () => {
    (db.execute as any).mockRejectedValueOnce(new Error('DB Error'));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false });
  });
});
