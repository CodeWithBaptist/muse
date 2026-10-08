import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { readAuthErrorParam } from '@/components/auth/AuthNotice';
import { DEFAULT_AFTER_LOGIN, safeNextPath } from '@/lib/auth-flow';
import { getSession } from '@/lib/session';
import { isSpotifyLoginConfigured } from '@/lib/spotify-config';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in to MUSE',
  description:
    'Connect your Spotify account to MUSE. You see exactly what is asked for and can disconnect at any time.',
  robots: { index: false, follow: false },
};

/**
 * Looks up the current session without letting a database problem take the
 * whole page down. If the lookup fails the visitor sees the login page, and
 * the failure is logged where the operator can see it.
 */
async function currentSessionOrNull() {
  try {
    return await getSession();
  } catch (error) {
    console.error('Could not read the session on /login:', error);
    return null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const next = safeNextPath(params.next);

  const session = await currentSessionOrNull();
  if (session) {
    redirect(next ?? DEFAULT_AFTER_LOGIN);
  }

  return (
    <LoginScreen
      spotifyLoginAvailable={isSpotifyLoginConfigured()}
      authError={readAuthErrorParam(params)}
      next={next}
    />
  );
}
