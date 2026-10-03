import { deleteSession } from '@/lib/session';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  await deleteSession();
  return NextResponse.json({ success: true });
}
