#!/usr/bin/env node
/**
 * Runs `next build`, then finishes the standalone output.
 *
 * This is a script rather than a one-line npm command because of one host.
 *
 * Next 16 builds with Turbopack, which is native Rust and ships inside
 * `@next/swc-<platform>`. Hostinger's Node.js Web Apps build on CloudLinux 8, whose
 * glibc is 2.28; the Linux binary needs 2.29, so it will not load there. Next's
 * WebAssembly fallback can drive the webpack bundler but there is no WebAssembly
 * Turbopack, so on that host the build has to pass `--webpack` or it cannot run at all.
 *
 * Everywhere else - a developer's machine, CI, the production Docker image - the native
 * binary loads fine and Turbopack is both faster and the documented default in
 * AGENTS.md. So the flag is opt-in, set through `NEXT_BUILD_WEBPACK=1` in that host's
 * environment, rather than applied to everyone to suit the weakest machine.
 *
 * Be aware of what that means: builds on that host go through a different bundler from
 * the one CI verifies. If a bundler-specific problem ever appears, this is the first
 * place to look.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');

/** The `next` CLI entry point, invoked through this same Node so it works on Windows too. */
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

const useWebpack = ['1', 'true', 'yes'].includes(
  (process.env.NEXT_BUILD_WEBPACK ?? '').trim().toLowerCase()
);

const buildArgs = ['build', ...(useWebpack ? ['--webpack'] : [])];

console.log(
  useWebpack
    ? 'Building with webpack (NEXT_BUILD_WEBPACK is set - this host cannot load Turbopack).'
    : 'Building with Turbopack.'
);

const steps = [
  [nextBin, buildArgs],
  [path.join(projectRoot, 'scripts', 'prepare-standalone.mjs'), []],
];

for (const [script, args] of steps) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  // A signal-terminated child reports a null status. Treating that as success would
  // let an out-of-memory kill during the build look like a clean deploy.
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
