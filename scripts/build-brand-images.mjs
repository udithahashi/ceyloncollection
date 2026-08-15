#!/usr/bin/env node
/**
 * Turns the raw Higgsfield downloads into the web assets the public site ships.
 *
 * Raw generations are 6-8 MB PNGs at 2K. Serving those would undo every other
 * performance decision in the app, so each one is resized to the largest size it
 * is actually displayed at (times two, for retina) and encoded as WebP.
 *
 * A committed script rather than a one-off command, because the raw files are
 * gitignored: `reference/generated-raw` is where generations land, `public/brand`
 * is what is committed and served. If the raw folder is empty on a fresh clone,
 * that is expected - regenerate from the prompts in docs/ASSETS.md, then run this.
 *
 *   node scripts/build-brand-images.mjs
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'reference', 'generated-raw');
const OUT = path.join(ROOT, 'public', 'brand');

/** `width` is the intended CSS width doubled, so the asset is sharp on retina. */
const ASSETS = [
  { name: 'hero', width: 1200 },
  { name: 'loom', width: 1600 },
  { name: 'edit-saree', width: 900 },
  { name: 'edit-occasion', width: 900 },
  { name: 'edit-everyday', width: 900 },
];

await mkdir(OUT, { recursive: true });

let built = 0;
const missing = [];

for (const { name, width } of ASSETS) {
  const source = path.join(RAW, `${name}.png`);

  if (!existsSync(source)) {
    missing.push(name);
    continue;
  }

  const destination = path.join(OUT, `${name}.webp`);

  const info = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destination);

  console.log(`${name}.webp  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  built += 1;
}

if (missing.length > 0) {
  console.warn(
    `\nSkipped (no raw file in reference/generated-raw): ${missing.join(', ')}.` +
      '\nRegenerate them from the prompts in docs/ASSETS.md.'
  );
}

console.log(`\nBuilt ${built} of ${ASSETS.length} brand image(s) into public/brand.`);

if (built === 0) process.exitCode = 1;
