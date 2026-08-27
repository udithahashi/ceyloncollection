#!/usr/bin/env node
/**
 * Finishes `next build`'s standalone output so it can actually serve a request.
 *
 * `output: 'standalone'` in next.config.ts writes a self-contained server to
 * `.next/standalone`, but Next deliberately leaves two directories out of it:
 * `public/` and `.next/static/`. Its reasoning is that a CDN should serve those,
 * which is true on Vercel and untrue on a plain Node host - there, the standalone
 * server is the only thing answering, and without these copies the app boots
 * perfectly and then serves every page with no CSS, no JavaScript and no images.
 * That failure looks like a broken build and is not one, which is why this exists
 * as a script rather than as a line someone is expected to remember.
 *
 * The Dockerfile does not use this: it copies both directories into the runtime
 * image itself, in the layer order that keeps the image small. This is for hosts
 * that run `npm run build:standalone` and then `node .next/standalone/server.js`
 * in the same directory tree - see docs/DEPLOY-HOSTINGER.md.
 */
import { cp, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const standalone = path.join(projectRoot, '.next', 'standalone');

/** Source, destination, and whether the build is unusable without it. */
const copies = [
  {
    from: path.join(projectRoot, '.next', 'static'),
    to: path.join(standalone, '.next', 'static'),
    required: true,
  },
  {
    from: path.join(projectRoot, 'public'),
    to: path.join(standalone, 'public'),
    required: false,
  },
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error(
    '\n.next/standalone does not exist.\n' +
      'Run `next build` first, and check that next.config.ts still sets `output: "standalone"`.\n'
  );
  process.exit(1);
}

for (const { from, to, required } of copies) {
  if (!(await exists(from))) {
    if (required) {
      console.error(
        `\nMissing ${path.relative(projectRoot, from)} - the build did not complete.\n`
      );
      process.exit(1);
    }
    continue;
  }

  // `force` so a redeploy over a previous build replaces stale assets rather
  // than failing on the first file that already exists.
  await cp(from, to, { recursive: true, force: true });
  console.log(`copied ${path.relative(projectRoot, from)} -> ${path.relative(projectRoot, to)}`);
}

console.log('standalone output ready: node .next/standalone/server.js');
