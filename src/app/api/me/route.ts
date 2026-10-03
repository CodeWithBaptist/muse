import { getSession } from '@/lib/session';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  });
}
