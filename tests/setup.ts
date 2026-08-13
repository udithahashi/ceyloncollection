/**
 * Vitest global setup.
 *
 * Loads `.env.local` so that any test touching configuration sees the same
 * values the app does. Pure logic tests should not depend on this - keep them
 * importing modules that do not read the environment, so they stay fast and
 * work on a machine with no `.env.local` at all.
 */
import path from 'node:path';

import dotenv from 'dotenv';

// dotenv does not overwrite variables that are already set, so the NODE_ENV of
// 'test' that Vitest provides survives the `NODE_ENV=development` line in
// .env.local. That matters: the env schema applies stricter rules in production.
dotenv.config({
  path: path.resolve(import.meta.dirname, '../.env.local'),
  quiet: true,
});
