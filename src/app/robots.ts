import type { MetadataRoute } from 'next';
import { PRIVATE_PATHS, PUBLIC_PATHS, siteUrl } from '@/lib/site-metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [...PUBLIC_PATHS],
      disallow: [...PRIVATE_PATHS],
    },
    sitemap: new URL('/sitemap.xml', siteUrl()).href,
  };
}
