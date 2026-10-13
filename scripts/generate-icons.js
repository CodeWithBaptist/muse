const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const faviconSvg = path.join(publicDir, 'favicon.svg');
const tokens = fs.readFileSync(
  path.join(root, 'src/lib/design-tokens.ts'),
  'utf8',
);
const darkBlock = tokens.slice(
  tokens.indexOf('export const colors'),
  tokens.indexOf('export type ColorToken'),
);
const lightBlock = tokens.slice(
  tokens.indexOf('export const lightColors'),
  tokens.indexOf('export const vibeTints'),
);
function token(block, name) {
  const match = block.match(new RegExp(`${name}: '(#[0-9A-Fa-f]{6})'`));
  if (!match) throw new Error(`Missing color token: ${name}`);
  return match[1];
}
const accent = token(darkBlock, 'accent');
const contrast = token(darkBlock, 'accentContrast');
const background = token(darkBlock, 'background');
const sizes = [16, 32, 48, 180, 192, 512];

async function generateIcons() {
  // Preserve all SVG geometry and sync only color attributes from the tokens.
  for (const name of ['favicon.svg', 'favicon-dark.svg']) {
    const file = path.join(publicDir, name);
    const svg = fs
      .readFileSync(file, 'utf8')
      .replace(/(<rect[^>]*fill=")[^"]+/, `$1${accent}`)
      .replace(/(<path[^>]*fill=")[^"]+/, `$1${contrast}`);
    fs.writeFileSync(file, svg);
  }
  for (const name of fs.readdirSync(path.join(root, 'src/assets/brand'))) {
    if (!name.endsWith('.svg')) continue;
    const file = path.join(root, 'src/assets/brand', name);
    const block = name.includes('-light') ? lightBlock : darkBlock;
    const paths = [...fs.readFileSync(file, 'utf8').matchAll(/<path\b[^>]*>/g)];
    let index = 0;
    const svg = fs
      .readFileSync(file, 'utf8')
      .replace(/<path\b[^>]*>/g, (element) => {
        const color =
          ++index === paths.length
            ? token(block, 'accent')
            : token(
                darkBlock,
                name.includes('-light') ? 'background' : 'textPrimary',
              );
        return element.replace(/fill="[^"]+"/, `fill="${color}"`);
      });
    fs.writeFileSync(file, svg);
  }
  const manifestFile = path.join(publicDir, 'site.webmanifest');
  const manifest = fs
    .readFileSync(manifestFile, 'utf8')
    .replace(/("theme_color": ")[^"]+/, `$1${accent}`)
    .replace(/("background_color": ")[^"]+/, `$1${background}`);
  fs.writeFileSync(manifestFile, manifest);

  await Promise.all(
    sizes.map((size) =>
      sharp(faviconSvg)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `favicon-${size}.png`)),
    ),
  );
  // Preserve the existing maskable glyph at 72% scale, centered in an
  // opaque full-bleed square. The favicon path and rounded square stay intact.
  const glyph = fs.readFileSync(faviconSvg, 'utf8').match(/<path[^>]+\/>/)?.[0];
  if (!glyph) throw new Error('Missing favicon glyph');
  const maskable = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${accent}"/><g transform="translate(8.96 8.96) scale(0.72)">${glyph}</g></svg>`,
  );
  await Promise.all(
    [192, 512].map((size) =>
      sharp(maskable)
        .resize(size, size)
        .png()
        .toFile(path.join(publicDir, `maskable-${size}.png`)),
    ),
  );
  const icoBuffers = await Promise.all(
    [16, 32, 48].map((size) =>
      sharp(faviconSvg).resize(size, size).png().toBuffer(),
    ),
  );
  fs.writeFileSync(
    path.join(publicDir, 'favicon.ico'),
    await pngToIco(icoBuffers),
  );
  console.log(
    'Generated favicon, maskable icons, brand colors, and manifest from the design tokens.',
  );
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
