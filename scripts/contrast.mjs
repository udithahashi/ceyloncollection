#!/usr/bin/env node
/**
 * Colour contrast tool, for choosing accessible colours.
 *
 * Reports the WCAG 2.1 contrast ratio between a foreground and one or more
 * backgrounds, and if it falls short, suggests the nearest compliant variant.
 *
 * Usage:
 *   node scripts/contrast.mjs <foreground> <background> [...more backgrounds]
 *   node scripts/contrast.mjs #B77A17 #FFFFFF --target 4.5 --adjust darken
 *
 * Options:
 *   --target <ratio>   Required ratio. Default 4.5 (AA body text).
 *                      Use 3 for large text, control borders and focus rings.
 *   --adjust <dir>     `darken` or `lighten`. Which way to move the foreground
 *                      when searching for a compliant variant. Defaults to
 *                      whichever direction moves away from the background.
 *
 * The suggestion scales RGB channels toward black or white, which keeps the hue
 * recognisably the same - important when the colour is part of a brand palette.
 *
 * The tokens actually used by the app are enforced separately, by
 * src/lib/theme/tokens.test.ts, so a change that breaks contrast fails CI.
 */
import process from 'node:process';

const parseHex = (hex) => {
  const cleaned = hex.trim().replace(/^#/, '');
  const full =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => c + c)
          .join('')
      : cleaned;
  if (!/^[0-9a-f]{6}$/i.test(full)) {
    console.error(`Not a hex colour: "${hex}"`);
    process.exit(1);
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
};

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');

const luminance = ({ r, g, b }) => {
  const [lr, lg, lb] = [r, g, b]
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Truncates rather than rounds, so a reported 4.5 is never actually 4.497. */
const show = (value) => (Math.floor(value * 100) / 100).toFixed(2);

const darken = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k });
const lighten = (c, k) => ({
  r: c.r + (255 - c.r) * k,
  g: c.g + (255 - c.g) * k,
  b: c.b + (255 - c.b) * k,
});

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const colours = args.filter((arg) => arg.startsWith('#') || /^[0-9a-f]{3,6}$/i.test(arg));

if (colours.length < 2) {
  console.error('Usage: node scripts/contrast.mjs <foreground> <background> [...backgrounds]');
  console.error('       node scripts/contrast.mjs #B77A17 #FFFFFF --target 4.5 --adjust darken');
  process.exit(1);
}

const target = Number(flag('target') ?? 4.5);
const [foregroundHex, ...backgroundHexes] = colours;
const foreground = parseHex(foregroundHex);
const backgrounds = backgroundHexes.map(parseHex);

// Default direction: move away from the backgrounds. A dark foreground on light
// backgrounds should get darker, and vice versa.
const backgroundsAreLight =
  backgrounds.reduce((sum, bg) => sum + luminance(bg), 0) / backgrounds.length > 0.5;
const direction = flag('adjust') ?? (backgroundsAreLight ? 'darken' : 'lighten');

console.log(`\nForeground ${toHex(foreground)}   target ${target}:1\n`);

let worst = Infinity;
for (const [index, background] of backgrounds.entries()) {
  const value = ratio(foreground, background);
  worst = Math.min(worst, value);
  const verdict = value >= target ? 'PASS' : 'FAIL';
  console.log(`  ${verdict}  ${show(value).padStart(6)}:1  on ${backgroundHexes[index]}`);
}

if (worst >= target) {
  console.log('\nMeets the target against every background.\n');
  process.exit(0);
}

console.log(
  `\nShort of ${target}:1. Searching for the nearest compliant variant (${direction})...\n`
);

for (let step = 1; step <= 100; step++) {
  const k = direction === 'darken' ? 1 - step / 100 : step / 100;
  const candidate = direction === 'darken' ? darken(foreground, k) : lighten(foreground, k);
  const lowest = Math.min(...backgrounds.map((bg) => ratio(candidate, bg)));

  if (lowest >= target) {
    const hex = toHex(candidate);
    console.log(`  ${hex}`);
    for (const [index, background] of backgrounds.entries()) {
      console.log(
        `      ${show(ratio(parseHex(hex), background)).padStart(6)}:1  on ${backgroundHexes[index]}`
      );
    }
    console.log('');
    process.exit(0);
  }
}

console.log('  No variant in this direction reaches the target. Try the other direction,');
console.log('  or reconsider the background.\n');
process.exit(1);
