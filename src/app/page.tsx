import { LandingPage } from '@/components/landing/LandingPage';
import { readAuthErrorParam } from '@/components/auth/AuthNotice';
import { isSpotifyLoginConfigured } from '@/lib/spotify-config';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <LandingPage
      spotifyLoginAvailable={isSpotifyLoginConfigured()}
      authError={readAuthErrorParam(params)}
    />
  );
}
