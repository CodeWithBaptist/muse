import { getSession } from '@/lib/session';
import { db } from '@/db';
import { users } from '@/db/schema';
import { MeResponseSchema } from '@/lib/validation/api-schemas';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(MeResponseSchema.parse({ authenticated: false }));
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));

    if (!user) {
      return NextResponse.json(MeResponseSchema.parse({ authenticated: false }));
    }

    return NextResponse.json(
      MeResponseSchema.parse({
        authenticated: true,
        user: {
          displayName: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
        },
      })
    );
  } catch (error: unknown) {
    console.error('Auth state fetch error:', error);
    return NextResponse.json({ authenticated: false });
  }
}
