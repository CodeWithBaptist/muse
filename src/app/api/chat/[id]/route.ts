import { getSession } from '@/lib/session';
import { db } from '@/db';
import { messages, recommendations } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const chatMessages = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    const recs = await db.select()
      .from(recommendations)
      .where(eq(recommendations.conversationId, id));

    return NextResponse.json({
      messages: chatMessages,
      recommendations: recs,
    });
  } catch (error: unknown) {
    console.error('Conversation fetch error:', error);
    return NextResponse.json({ error: 'Unable to load conversation.' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(recommendations).where(eq(recommendations.conversationId, id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Conversation delete error:', error);
    return NextResponse.json({ error: 'Unable to delete conversation.' }, { status: 500 });
  }
}
