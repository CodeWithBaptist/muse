import { getSession } from '@/lib/session';
import { db } from '@/db';
import { memories } from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  MemoryInputSchema,
  MemoryListResponseSchema,
  MemoryMutationResponseSchema,
  SuccessResponseSchema,
} from '@/lib/validation/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function memoryResponse(memory: typeof memories.$inferSelect) {
  return {
    id: memory.id,
    key: memory.key,
    value: memory.value,
    confidence: memory.confidence,
    source: memory.source,
    updatedAt: memory.updatedAt.toISOString(),
  };
}

export async function GET(request?: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (request) {
    const rateLimited = await enforceRateLimit(request, {
      scope: 'memory:list',
      limit: 60,
      windowMs: 60_000,
      identifier: `user:${session.userId}`,
    });
    if (rateLimited) return rateLimited;
  }

  try {
    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, session.userId))
      .orderBy(memories.updatedAt);

    return NextResponse.json(
      MemoryListResponseSchema.parse({
        memories: rows.map(memoryResponse),
      }),
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    console.error('Memory list request failed.');
    return NextResponse.json(
      { error: 'Unable to load saved memory.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'memory:write',
    limit: 30,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const parsed = MemoryInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid memory preference.' },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const [memory] = await db
      .insert(memories)
      .values({
        userId: session.userId,
        key: parsed.data.key,
        value: parsed.data.value,
        confidence: 100,
        source: 'explicit',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [memories.userId, memories.key],
        set: {
          value: parsed.data.value,
          confidence: 100,
          source: 'explicit',
          updatedAt: now,
        },
      })
      .returning();

    return NextResponse.json(
      MemoryMutationResponseSchema.parse({ memory: memoryResponse(memory) }),
      { status: 201, headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch {
    console.error('Memory save request failed.');
    return NextResponse.json(
      { error: 'Unable to save this memory right now.' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await enforceRateLimit(request, {
    scope: 'memory:clear',
    limit: 10,
    windowMs: 60_000,
    identifier: `user:${session.userId}`,
  });
  if (rateLimited) return rateLimited;

  try {
    await db.delete(memories).where(eq(memories.userId, session.userId));
    return NextResponse.json(SuccessResponseSchema.parse({ success: true }));
  } catch {
    console.error('Memory clear request failed.');
    return NextResponse.json(
      { error: 'Unable to clear saved memory right now.' },
      { status: 500 },
    );
  }
}
