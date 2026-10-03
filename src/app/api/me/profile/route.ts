import { getSession } from '@/lib/session';
import { orchestrateProfileInsights } from '@/lib/ai/profile-engine';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
  isAINotConnectedError,
} from '@/lib/ai/provider';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
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
    const data = await orchestrateProfileInsights(session.userId);
    return NextResponse.json(data);
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
    console.error('Profile API Error:', error);
    return NextResponse.json(
      { error: 'Unable to load profile insights right now.' },
      { status: 500 }
    );
  }
}
