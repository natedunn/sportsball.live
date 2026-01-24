import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const createEmojiSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="80">🏀</text>
</svg>
`;

const createMaskableSvg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#1a1a1a"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="60">🏀</text>
</svg>
`;

async function generateIcon(svg, filename, size) {
  const buffer = Buffer.from(svg);
  await sharp(buffer)
    .resize(size, size)
    .png()
    .toFile(join(publicDir, filename));
  console.log('Generated', filename);
}

async function main() {
  await generateIcon(createEmojiSvg(512), 'icon-192.png', 192);
  await generateIcon(createEmojiSvg(512), 'icon-512.png', 512);
  await generateIcon(createEmojiSvg(180), 'apple-touch-icon.png', 180);
  await generateIcon(createMaskableSvg(512), 'icon-maskable-512.png', 512);
  console.log('All icons generated!');
}

main().catch(console.error);
