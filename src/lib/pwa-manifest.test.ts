import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = path.resolve(__dirname, '../../public');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifest {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  icons: ManifestIcon[];
}

describe('PWA manifest', () => {
  const manifest = JSON.parse(
    readFileSync(path.join(PUBLIC, 'site.webmanifest'), 'utf8'),
  ) as Manifest;

  it('is installable: id, scope, standalone display, and the brand colours', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.start_url).toBe('/chat');
    expect(manifest.display).toBe('standalone');
    expect(manifest.short_name).toBe('MUSE');
    expect(manifest.background_color).toBe('#0B0B0C');
    expect(manifest.theme_color).toBe('#0B0B0C');
  });

  it('ships any and maskable icons at 192 and 512, and every file exists', () => {
    for (const purpose of ['any', 'maskable']) {
      for (const size of ['192x192', '512x512']) {
        const icon = manifest.icons.find(
          (candidate) =>
            candidate.sizes === size &&
            (candidate.purpose ?? 'any') === purpose,
        );
        expect(icon, `${purpose} ${size}`).toBeDefined();
        expect(icon?.type).toBe('image/png');
      }
    }
    for (const icon of manifest.icons) {
      expect(existsSync(path.join(PUBLIC, icon.src)), icon.src).toBe(true);
    }
  });
});
