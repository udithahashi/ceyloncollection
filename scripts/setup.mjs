#!/usr/bin/env node
/**
 * First-time local setup.
 *
 *     npm run setup
 *
 * Creates `.env.local` from `.env.example`, generating real random secrets for
 * every placeholder and keeping the database password consistent between
 * DATABASE_URL and the POSTGRES_* variables that Docker uses to create the
 * container. Getting those two out of step is the most common setup mistake,
 * so this removes the chance to make it.
 *
 * Refuses to overwrite an existing `.env.local` unless you pass --force.
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const examplePath = path.join(projectRoot, '.env.example');
const targetPath = path.join(projectRoot, '.env.local');
const force = process.argv.includes('--force');

const token = () => randomBytes(32).toString('base64url');
const password = () => randomBytes(12).toString('base64url');

if (!existsSync(examplePath)) {
  console.error('.env.example is missing - cannot generate .env.local from it.');
  process.exit(1);
}

if (existsSync(targetPath) && !force) {
  console.log('.env.local already exists, leaving it alone.');
  console.log('Pass --force to replace it (a .env.local.backup copy is kept).');
  console.log('\nRun `npm run doctor` to check your current setup.');
  process.exit(0);
}

if (existsSync(targetPath) && force) {
  copyFileSync(targetPath, `${targetPath}.backup`);
  console.log('Existing .env.local backed up to .env.local.backup');
}

const databasePassword = password();
const replacements = {
  BETTER_AUTH_SECRET: token(),
  N8N_WEBHOOK_SECRET: token(),
  POSTGRES_PASSWORD: databasePassword,
};

const lines = readFileSync(examplePath, 'utf8').split(/\r?\n/);
const output = [];

for (const line of lines) {
  // Preserve comments and blank lines so the generated file stays readable and
  // self-documenting rather than becoming an opaque list of values.
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (!match) {
    output.push(line);
    continue;
  }

  const [, key, value] = match;

  if (key in replacements) {
    output.push(`${key}=${replacements[key]}`);
    continue;
  }

  if (key === 'DATABASE_URL') {
    output.push(
      `DATABASE_URL=postgresql://ceylon:${databasePassword}@localhost:5433/ceyloncollection`
    );
    continue;
  }

  output.push(`${key}=${value}`);
}

writeFileSync(targetPath, output.join('\n'), 'utf8');

console.log('Created .env.local with freshly generated secrets.');
console.log('');
console.log('Next steps:');
console.log('  1. npm run dev:up     start PostgreSQL and Redis');
console.log('  2. npm run doctor     confirm everything is wired up');
console.log('  3. npm run dev        start the app');
