import { publicPageMetadata, SHARE_DESCRIPTION } from '@/lib/site-metadata';
import { LandingPage } from '@/components/landing/LandingPage';
import { readAuthErrorParam } from '@/components/auth/AuthNotice';

export const metadata = publicPageMetadata(
  '/',
  'MUSE | Music by conversation',
  SHARE_DESCRIPTION,
);

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  return <LandingPage authError={readAuthErrorParam(params)} />;
}
