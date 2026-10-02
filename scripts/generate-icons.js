const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

const faviconSvg = path.join(__dirname, '..', 'public', 'favicon.svg');
const publicDir = path.join(__dirname, '..', 'public');

const sizes = [16, 32, 48, 180, 192, 512];

async function generateIcons() {
  console.log('Generating raster icons from favicon.svg...');
  
  const pngPromises = sizes.map(size => {
    return sharp(faviconSvg)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, `favicon-${size}.png`));
  });

  await Promise.all(pngPromises);
  console.log('PNG icons generated.');

  // Create favicon.ico (multi-size: 16, 32, 48)
  const icoBuffers = await Promise.all(
    [16, 32, 48].map(size => 
      sharp(faviconSvg)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  const icoBuffer = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('favicon.ico generated.');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
