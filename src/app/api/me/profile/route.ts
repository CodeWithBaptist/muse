import { getSession } from '@/lib/session';
import { orchestrateProfileInsights } from '@/lib/ai/profile-engine';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await orchestrateProfileInsights(session.userId);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Profile API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
