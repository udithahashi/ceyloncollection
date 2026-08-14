/**
 * Loads `.env.local` for standalone scripts.
 *
 * Next.js does this itself, but a script run through tsx does not, so anything
 * importing `@/lib/env` from a script would fail its startup validation with every
 * variable missing.
 *
 * Import this FIRST, before any module that reads configuration:
 *
 *   import './load-env.mts';
 *   import { something } from '../src/...';
 *
 * The order matters. Static imports are evaluated in the order they are written, so
 * putting this line second would mean the env module is initialised before the file
 * has been read.
 *
 * Existing environment variables win, so running a script on the server with real
 * values in the environment does not get overridden by a stray local file.
 */
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true, override: false });
