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
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RAW = path.join(ROOT, 'reference', 'generated-raw');
const OUT = path.join(ROOT, 'public', 'brand');

/**
 * Checksums of the files this script last produced.
 *
 * It exists to answer one question: is the asset sitting in `public/brand` still
 * the one we generated, or did somebody replace it by hand? Timestamps cannot
 * answer that - a generated output is *always* newer than its raw source, so
 * every asset looks hand-edited by that measure. Content can answer it exactly.
 *
 * Committed, because the raw sources are gitignored and a fresh clone otherwise
 * has no way to tell a hand-picked photograph from a regenerated one.
 */
const MANIFEST = path.join(OUT, '.generated.json');

const sha = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 16);

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

/** `width` is the intended CSS width doubled, so the asset is sharp on retina. */
const ASSETS = [
  // Full-viewport hero, so it carries the largest budget of the set.
  { name: 'hero', width: 2000 },

  // The three focus categories and the lookbook, all shown in portrait cards.
  { name: 'edit-batik-frock', width: 900 },
  { name: 'edit-flower-frock', width: 900 },
  { name: 'edit-sarong', width: 900 },
  { name: 'look-1', width: 900 },
  { name: 'look-2', width: 900 },
  { name: 'look-3', width: 900 },

  // The batik process, shown wide.
  { name: 'craft-wax', width: 1400 },
  { name: 'craft-dye', width: 1400 },
  { name: 'detail-batik', width: 1400 },

  // Offer panels. Artwork only - every word on these is HTML rendered on top,
  // so nothing here needs to stay legible at large sizes.
  { name: 'offer-delivery', width: 1200 },
  { name: 'offer-loyalty', width: 1200 },
  { name: 'offer-seasonal', width: 1200 },
];

await mkdir(OUT, { recursive: true });

/**
 * `--force` rebuilds everything, including assets that were replaced by hand.
 *
 * Without it, anything whose checksum this script does not recognise is left
 * alone. That case is not hypothetical: the owner swapped
 * `public/brand/hero.webp` for a photograph of his own, and a re-run overwrote
 * it with a regenerated image - no error, no obvious cause, work gone. The file
 * being served wins by default, and you have to ask for the alternative.
 */
const force = process.argv.includes('--force');

let built = 0;
const missing = [];
const preserved = [];

for (const { name, width } of ASSETS) {
  const source = path.join(RAW, `${name}.png`);

  if (!existsSync(source)) {
    missing.push(name);
    continue;
  }

  const destination = path.join(OUT, `${name}.webp`);

  /*
   * ONLY OVERWRITE A FILE WE CAN PROVE WE PRODUCED.
   *
   * The rule is deliberately conservative, and it is conservative because the
   * looser version already destroyed work: an earlier revision regenerated
   * anything without a manifest entry, and the very first run - when no manifest
   * existed yet - overwrote a hero photograph the owner had just dropped in by
   * hand. A missing or non-matching checksum means "this is not ours", and the
   * safe response to that is to leave it alone, not to assume.
   *
   * `--force` is the way to say you meant it.
   */
  if (!force && existsSync(destination)) {
    const isOurs =
      manifest[name] !== undefined && sha(readFileSync(destination)) === manifest[name];

    if (!isOurs) {
      preserved.push(name);
      continue;
    }
  }

  const output = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  writeFileSync(destination, output.data);
  manifest[name] = sha(output.data);

  const { width: w, height: h } = output.info;
  console.log(`${name}.webp  ${w}x${h}  ${(output.data.length / 1024).toFixed(0)} KB`);
  built += 1;
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

if (preserved.length > 0) {
  console.log(
    `\nKept your own version of: ${preserved.join(', ')}.` +
      '\nThese do not match the checksum this script last wrote, so they were replaced' +
      '\nby hand and are left untouched. Pass --force to regenerate them anyway.'
  );
}

if (missing.length > 0) {
  console.warn(
    `\nSkipped (no raw file in reference/generated-raw): ${missing.join(', ')}.` +
      '\nRegenerate them from the prompts in docs/ASSETS.md.'
  );
}

console.log(`\nBuilt ${built} of ${ASSETS.length} brand image(s) into public/brand.`);

// Nothing built is only a failure if nothing was deliberately preserved either.
if (built === 0 && preserved.length === 0) process.exitCode = 1;
