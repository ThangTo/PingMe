import sharp from 'sharp';
import path from 'path';
import { mkdir } from 'fs/promises';

const outDir = path.resolve('public/brand');

const assets = [
  { input: 'src/assets/images/logo_trans.png', basename: 'logo-trans', width: 192 },
  { input: 'src/assets/images/pingme_trans.png', basename: 'pingme-wordmark', width: 420 },
];

await mkdir(outDir, { recursive: true });

for (const asset of assets) {
  const resized = sharp(asset.input).resize({ width: asset.width, withoutEnlargement: true });
  await resized.clone().webp({ quality: 82, effort: 6 }).toFile(path.join(outDir, `${asset.basename}.webp`));
  await resized
    .clone()
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true })
    .toFile(path.join(outDir, `${asset.basename}.png`));
}

console.log(`Optimized ${assets.length} brand asset(s) into ${outDir}`);
