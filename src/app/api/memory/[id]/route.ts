import { getSession } from '@/lib/session';
import { db } from '@/db';
import { memories } from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import {
  MemoryIdParamSchema,
  MemoryInputSchema,
  MemoryMutationResponseSchema,
  SuccessResponseSchema,
} from '@/lib/validation/api-schemas';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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

async function checkRequest(request: Request, userId: string) {
  return enforceRateLimit(request, {
    scope: 'memory:write',
    limit: 30,
    windowMs: 60_000,
    identifier: `user:${userId}`,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await checkRequest(request, session.userId);
  if (rateLimited) return rateLimited;

  const parsedParams = MemoryIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid memory ID.' }, { status: 400 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 },
    );
  }

  const parsedBody = MemoryInputSchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid memory preference.' },
      { status: 400 },
    );
  }

  try {
    const [memory] = await db
      .update(memories)
      .set({
        key: parsedBody.data.key,
        value: parsedBody.data.value,
        confidence: 100,
        source: 'explicit',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memories.id, parsedParams.data.id),
          eq(memories.userId, session.userId),
        ),
      )
      .returning();

    if (!memory) {
      return NextResponse.json({ error: 'Memory not found.' }, { status: 404 });
    }

    return NextResponse.json(
      MemoryMutationResponseSchema.parse({ memory: memoryResponse(memory) }),
      { headers: { 'Cache-Control': 'no-store, private' } },
    );
  } catch (error: unknown) {
    const isDuplicateKey =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505';
    if (isDuplicateKey) {
      return NextResponse.json(
        { error: 'A memory item with that preference name already exists.' },
        { status: 409 },
      );
    }

    console.error('Memory update request failed.');
    return NextResponse.json(
      { error: 'Unable to update this memory right now.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rateLimited = await checkRequest(request, session.userId);
  if (rateLimited) return rateLimited;

  const parsedParams = MemoryIdParamSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid memory ID.' }, { status: 400 });
  }

  try {
    const [deleted] = await db
      .delete(memories)
      .where(
        and(
          eq(memories.id, parsedParams.data.id),
          eq(memories.userId, session.userId),
        ),
      )
      .returning({ id: memories.id });

    if (!deleted) {
      return NextResponse.json({ error: 'Memory not found.' }, { status: 404 });
    }

    return NextResponse.json(SuccessResponseSchema.parse({ success: true }));
  } catch {
    console.error('Memory delete request failed.');
    return NextResponse.json(
      { error: 'Unable to delete this memory right now.' },
      { status: 500 },
    );
  }
}
