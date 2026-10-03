import { NextResponse } from 'next/server';
import {
  AI_NOT_CONNECTED_CODE,
  AI_NOT_CONNECTED_MESSAGE,
  isAIConfigured,
} from '@/lib/ai/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const connected = isAIConfigured();
  return NextResponse.json({
    connected,
    code: connected ? 'AI_CONNECTED' : AI_NOT_CONNECTED_CODE,
    message: connected ? 'AI is connected' : AI_NOT_CONNECTED_MESSAGE,
  });
}
