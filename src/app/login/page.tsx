import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginScreen, type TesterAccess } from '@/components/auth/LoginScreen';
import { readAuthErrorParam } from '@/components/auth/AuthNotice';
import { DEFAULT_AFTER_LOGIN, safeNextPath } from '@/lib/auth-flow';
import { getSession } from '@/lib/session';
import { isSpotifyLoginConfigured } from '@/lib/spotify-config';
import { spotifyAccessMode, spotifyLoginVisible } from '@/lib/testers';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign in to MUSE',
  description:
    'Tester sign-in for the Spotify features of MUSE. Everyone else can chat without an account.',
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

  // Testers only: the sign-in appears with a tester pass or an email allowlist.
  const mode = spotifyAccessMode();
  const visible = await spotifyLoginVisible();
  const testerAccess: TesterAccess = visible
    ? 'visible'
    : mode === 'key'
      ? 'key'
      : 'hidden';

  return (
    <LoginScreen
      spotifyLoginAvailable={visible && isSpotifyLoginConfigured()}
      authError={readAuthErrorParam(params)}
      next={next}
      testerAccess={testerAccess}
    />
  );
}
