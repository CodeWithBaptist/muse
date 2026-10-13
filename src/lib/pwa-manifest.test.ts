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
    expect(manifest.theme_color).toBe('#A8E85C');
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

describe('generated brand assets', () => {
  it('keeps static manifest and SVG fills synchronized with the tokens', async () => {
    const { colors, lightColors } = await import('./design-tokens');
    const manifest = JSON.parse(
      readFileSync(path.join(PUBLIC, 'site.webmanifest'), 'utf8'),
    ) as Manifest;
    expect(manifest.theme_color).toBe(colors.accent);
    expect(manifest.background_color).toBe(colors.background);
    for (const name of ['favicon.svg', 'favicon-dark.svg']) {
      const svg = readFileSync(path.join(PUBLIC, name), 'utf8');
      expect(svg).toContain(`rx="16" fill="${colors.accent}"`);
      expect(svg).toContain(`<path fill="${colors.accentContrast}"`);
      expect(svg).toContain('viewBox="0 0 64 64"');
    }
    for (const name of ['muse-mark', 'muse-wordmark']) {
      for (const theme of ['', '-light']) {
        const svg = readFileSync(
          path.resolve(PUBLIC, `../src/assets/brand/${name}${theme}.svg`),
          'utf8',
        );
        const fills = [...svg.matchAll(/<path fill="([^"]+)"/g)].map(
          (match) => match[1],
        );
        const palette = theme ? lightColors : colors;
        expect(fills.at(-1)).toBe(palette.accent);
        expect(
          fills
            .slice(0, -1)
            .every(
              (fill) =>
                fill === (theme ? colors.background : colors.textPrimary),
            ),
        ).toBe(true);
      }
    }
  });

  it('renders every raster size and keeps maskable corners opaque and lime', async () => {
    const sharp = (await import('sharp')).default;
    for (const size of [16, 32, 48, 180, 192, 512]) {
      const metadata = await sharp(
        path.join(PUBLIC, `favicon-${size}.png`),
      ).metadata();
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
    for (const size of [192, 512]) {
      const { data, info } = await sharp(
        path.join(PUBLIC, `maskable-${size}.png`),
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(size);
      expect(info.height).toBe(size);
      expect([...data.subarray(0, 4)]).toEqual([168, 232, 92, 255]);
      const bounds = [size, size, 0, 0];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (data[(y * size + x) * 4] >= 118) continue;
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
        }
      }
      // These are the existing glyph bounds before the palette change.
      expect(bounds).toEqual(
        size === 192 ? [53, 66, 138, 125] : [142, 177, 369, 334],
      );
      for (let offset = 3; offset < data.length; offset += 4)
        expect(data[offset]).toBe(255);
    }
  });
});
