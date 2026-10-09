import { getSession } from '@/lib/session';
import { db } from '@/db';
import { conversations, messages, recommendations } from '@/db/schema';
import { verifySameOrigin } from '@/lib/security/csrf';
import { ChatIdParamSchema } from '@/lib/validation/api-schemas';
import { and, eq, asc } from 'drizzle-orm';
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

  const resolvedParams = await params;
  const parsedParams = ChatIdParamSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid conversation ID.' }, { status: 400 });
  }

  const { id } = parsedParams.data;

  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, session.userId)));

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    const chatMessages = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.createdAt));

    const recs = await db.select()
      .from(recommendations)
      .where(eq(recommendations.conversationId, id));

    return NextResponse.json({
      // A message that answered with a list carries it, so the songs reload with the chat.
      messages: chatMessages.map(({ list, ...message }) =>
        list
          ? {
              ...message,
              recommendations: list.tracks,
              playlistTitle: list.title,
              short: list.short,
              dropped: list.dropped,
              isPlaylistSuggestion: true,
            }
          : message
      ),
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
  const csrfError = verifySameOrigin(request);
  if (csrfError) return csrfError;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const resolvedParams = await params;
  const parsedParams = ChatIdParamSchema.safeParse(resolvedParams);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Invalid conversation ID.' }, { status: 400 });
  }

  const { id } = parsedParams.data;

  try {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, session.userId)));

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    await db.delete(messages).where(eq(messages.conversationId, id));
    await db.delete(recommendations).where(eq(recommendations.conversationId, id));
    await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, session.userId)));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Conversation delete error:', error);
    return NextResponse.json({ error: 'Unable to delete conversation.' }, { status: 500 });
  }
}
