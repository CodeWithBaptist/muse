// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { SHARE_WORDMARK_PATHS, shareImage } from './share-image';
import og, {
  size as ogSize,
  contentType as ogType,
} from '@/app/opengraph-image';
import twitter, {
  size as twitterSize,
  contentType as twitterType,
} from '@/app/twitter-image';

describe('local share images', () => {
  it('copies the existing logo outlines rather than rendering wordmark text', () => {
    const logo = readFileSync(
      path.join(process.cwd(), 'src/components/ui/Logo.tsx'),
      'utf8',
    );
    const paths = [...logo.matchAll(/\bd="([^"]+)"/g)].map((match) => match[1]);
    expect(SHARE_WORDMARK_PATHS).toEqual(paths.slice(-5));
  });

  it('renders a 1200x630 PNG without fetching fonts or other network assets', async () => {
    const originalFetch = globalThis.fetch;
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) => {
        if (String(input).startsWith('data:'))
          return originalFetch(input, init);
        return Promise.reject(
          new Error('Network is forbidden in share images'),
        );
      });
    try {
      expect(og).toBe(shareImage);
      expect(twitter).toBe(shareImage);
      expect(ogSize).toEqual({ width: 1200, height: 630 });
      expect(twitterSize).toEqual(ogSize);
      expect(ogType).toBe('image/png');
      expect(twitterType).toBe(ogType);
      const response = await shareImage();
      const png = Buffer.from(await response.arrayBuffer());
      expect([...png.subarray(0, 8)]).toEqual([
        137, 80, 78, 71, 13, 10, 26, 10,
      ]);
      expect(png.readUInt32BE(16)).toBe(1200);
      expect(png.readUInt32BE(20)).toBe(630);
      // Next uses a local data URL for its bundled layout WASM.
      expect(
        fetch.mock.calls.every(([input]) => String(input).startsWith('data:')),
      ).toBe(true);
    } finally {
      fetch.mockRestore();
    }
  }, 30_000);
});
