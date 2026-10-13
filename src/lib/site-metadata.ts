import type { Metadata } from 'next';

export const PRODUCTION_SITE_URL = 'https://muse-six-pink.vercel.app';
export const SHARE_DESCRIPTION =
  'Tell MUSE the mood. It answers with real songs, Nigeria first.';

/** This is a public origin, never a connection string or a credential. */
export function siteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  try {
    const url = new URL(value?.trim() || PRODUCTION_SITE_URL);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return new URL(PRODUCTION_SITE_URL);
    }
    return new URL(url.origin);
  } catch {
    return new URL(PRODUCTION_SITE_URL);
  }
}

export const PUBLIC_PATHS = [
  '/',
  '/chat',
  '/privacy',
  '/terms',
  '/spotify-attribution',
] as const;
export const PRIVATE_PATHS = [
  '/api',
  '/login',
  '/design-system',
  '/settings',
  '/profile',
  '/library',
  '/playlists',
  '/discover',
  '/plus',
] as const;
export const NO_INDEX: Metadata['robots'] = { index: false, follow: false };

export function socialMetadata(title: string, description: string): Metadata {
  const origin = siteUrl();
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'MUSE',
      locale: 'en_NG',
      type: 'website',
      images: [
        {
          url: new URL('/opengraph-image', origin),
          width: 1200,
          height: 630,
          alt: SHARE_DESCRIPTION,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        { url: new URL('/twitter-image', origin), alt: SHARE_DESCRIPTION },
      ],
    },
  };
}

export function publicPageMetadata(
  path: (typeof PUBLIC_PATHS)[number],
  title: string,
  description: string,
): Metadata {
  const canonical = new URL(path, siteUrl());
  const social = socialMetadata(title, description);
  return {
    ...social,
    alternates: { canonical },
    openGraph: { ...social.openGraph, url: canonical },
    robots: { index: true, follow: true },
  };
}
