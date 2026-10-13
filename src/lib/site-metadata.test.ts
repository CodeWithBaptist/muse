import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_SITE_URL,
  PRIVATE_PATHS,
  PUBLIC_PATHS,
  siteUrl,
  publicPageMetadata,
} from './site-metadata';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { metadata as root } from '@/app/layout';
import { metadata as home } from '@/app/page';
import { metadata as chat } from '@/app/(app)/chat/layout';
import { metadata as privacy } from '@/app/privacy/page';
import { metadata as terms } from '@/app/terms/page';
import { metadata as attribution } from '@/app/spotify-attribution/page';
import { metadata as account } from '@/app/(app)/layout';

vi.mock(
  'motion/react',
  async () => (await import('@/test/motion-mock')).motionMock,
);
afterEach(() => vi.unstubAllEnvs());

describe('site metadata', () => {
  it('uses the production fallback and rejects invalid origins without exposing credentials', () => {
    for (const value of [
      '',
      'invalid',
      'file:///tmp/muse',
      'https://user:secret@example.com',
    ]) {
      expect(siteUrl(value).origin).toBe(PRODUCTION_SITE_URL);
    }
    expect(siteUrl('https://muse.example/path?q=1').href).toBe(
      'https://muse.example/',
    );
  });

  it('honors the public site origin for canonical, graph, image and crawling URLs', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://muse.example');
    const metadata = publicPageMetadata(
      '/chat',
      'Chat | MUSE',
      'Music by conversation',
    );
    expect(String(metadata.alternates?.canonical)).toBe(
      'https://muse.example/chat',
    );
    expect(metadata.openGraph).toMatchObject({
      url: new URL('https://muse.example/chat'),
    });
    expect(sitemap().map((entry) => entry.url)).toEqual(
      PUBLIC_PATHS.map((path) => `https://muse.example${path}`),
    );
    expect(robots().sitemap).toBe('https://muse.example/sitemap.xml');
  });

  it('exports full social metadata and distinct canonicals for every public page', () => {
    expect(root.metadataBase).toEqual(siteUrl());
    expect(root.icons).toMatchObject({
      apple: [{ url: '/favicon-180.png', sizes: '180x180', type: 'image/png' }],
    });
    const pages = [home, chat, privacy, terms, attribution];
    pages.forEach((metadata, index) => {
      expect(metadata.title).toBeTruthy();
      expect(metadata.description).toBeTruthy();
      expect(metadata.alternates?.canonical?.toString()).toBe(
        new URL(PUBLIC_PATHS[index], siteUrl()).href,
      );
      expect(metadata.openGraph).toMatchObject({
        title: metadata.title,
        description: metadata.description,
        siteName: 'MUSE',
        locale: 'en_NG',
        type: 'website',
        url: metadata.alternates?.canonical,
      });
      expect(metadata.twitter).toMatchObject({
        card: 'summary_large_image',
        title: metadata.title,
        description: metadata.description,
      });
      expect(metadata.robots).toEqual({ index: true, follow: true });
    });
    expect(account.robots).toEqual({ index: false, follow: false });
  });

  it('indexes only the public routes and excludes closed Plus and internal routes', () => {
    expect(robots().rules).toEqual({
      userAgent: '*',
      allow: [...PUBLIC_PATHS],
      disallow: [...PRIVATE_PATHS],
    });
    expect(sitemap()).toHaveLength(5);
    const indexedPaths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(indexedPaths).toEqual([...PUBLIC_PATHS]);
    for (const path of PRIVATE_PATHS) expect(indexedPaths).not.toContain(path);
  });
});
