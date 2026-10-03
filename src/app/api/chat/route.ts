import { getSession } from '@/lib/session';
import { db } from '@/db';
import { conversations, messages, recommendations } from '@/db/schema';
import { orchestrateRecommendations } from '@/lib/ai/recommendation-engine';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  chatCompletion,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import { eq, desc } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { content?: string; conversationId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { content, conversationId } = body;

  if (!content) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }

  if (!isAIConfigured()) {
    return NextResponse.json(
      {
        error: AI_NOT_CONNECTED_MESSAGE,
        code: AI_NOT_CONNECTED_CODE,
        aiConnected: false,
      },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let activeConversationId = conversationId;

    // 1. Get or create conversation
    if (!activeConversationId) {
      const [newConv] = await db.insert(conversations).values({
        userId: session.userId,
        title: content.slice(0, 50),
      }).returning();
      activeConversationId = newConv.id;
    }

    // 2. Save User Message
    await db.insert(messages).values({
      conversationId: activeConversationId,
      role: 'user',
      content,
    });

    // 3. Simple Intent Logic
    const isDiscoveryRequest = /listening|music|find|recommend|playlist|vibe|play|song|artist|genre/i.test(content);

    if (isDiscoveryRequest) {
      const result = await orchestrateRecommendations(session.userId, content);
      const isPlaylistSuggestion = /playlist|mix|collection|create|save/i.test(content) || result.tracks.length > 5;

      // Save MUSE response
      await db.insert(messages).values({
        conversationId: activeConversationId,
        role: 'assistant',
        content: result.message,
      }).returning();

      // Save recommendations for Why This and Library
      if (result.tracks.length > 0) {
        const recs = result.tracks.map((track: any) => ({
          userId: session.userId,
          conversationId: activeConversationId,
          spotifyTrackId: track.id,
          reason: track.reason,
        }));
        await db.insert(recommendations).values(recs);
      }

      return NextResponse.json({
        conversationId: activeConversationId,
        role: 'assistant',
        content: result.message,
        tracks: result.tracks,
        isPlaylistSuggestion,
      });
    } else {
      // General Chat
      const history = await db.select()
        .from(messages)
        .where(eq(messages.conversationId, activeConversationId))
        .orderBy(desc(messages.createdAt))
        .limit(10);
      
      const chatMessages = history.reverse().map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

      const response = await chatCompletion([
        { role: 'system', content: 'You are MUSE, a knowledgeable music companion. You are warm, direct, and have excellent taste.' },
        ...chatMessages
      ]);

      const museContent = (response as any).choices[0].message.content;

      await db.insert(messages).values({
        conversationId: activeConversationId,
        role: 'assistant',
        content: museContent,
      });

      return NextResponse.json({
        conversationId: activeConversationId,
        role: 'assistant',
        content: museContent,
      });
    }

  } catch (error: unknown) {
    if (isAINotConnectedError(error)) {
      return NextResponse.json(
        {
          error: AI_NOT_CONNECTED_MESSAGE,
          code: AI_NOT_CONNECTED_CODE,
          aiConnected: false,
        },
        { status: 503 }
      );
    }
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: 'Unable to process chat request right now.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const convs = await db.select()
      .from(conversations)
      .where(eq(conversations.userId, session.userId))
      .orderBy(desc(conversations.createdAt));

    return NextResponse.json(convs);
  } catch (error: unknown) {
    console.error('Chat list API Error:', error);
    return NextResponse.json(
      { error: 'Unable to load conversations.' },
      { status: 500 }
    );
  }
}
