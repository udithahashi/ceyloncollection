/**
 * Validated environment configuration.
 *
 * Every environment variable the app needs is declared and checked in ./schema,
 * once, at startup. If something is missing or malformed the process refuses to
 * start and prints exactly which variable is wrong and how to fix it.
 *
 * This is deliberate: the alternative is `process.env.SOMETHING` scattered
 * through the codebase, silently `undefined`, surfacing as a confusing runtime
 * error hours later - or worse, an app running in production with a development
 * secret.
 *
 * Coming from Laravel, this is `config/*.php` plus a strict validation pass over
 * `.env`, with the difference that failure happens at boot instead of at 3am.
 *
 * SERVER ONLY, and enforced rather than requested - see the `server-only` import
 * below. Anything the browser legitimately needs must be a `NEXT_PUBLIC_*`
 * variable, read separately.
 */

/*
 * Turns "a client component imported this" from a runtime error into a build error.
 *
 * Without it the mistake is almost always indirect and the message is misleading: a
 * client component imports a pure-looking helper, that helper imports @/lib/time for
 * one date function, @/lib/time reads this module, and the browser gets a copy that
 * validates `process.env` - which Turbopack has replaced with the public variables
 * only. The page then dies with "DATABASE_URL is required", pointing at the
 * environment rather than at the import that does not belong.
 *
 * This module is a no-op in Node and throws when bundled for the browser, so the
 * failure now names the file that crossed the line.
 */
import 'server-only';

import { parseEnv } from './schema';

export type { Env } from './schema';

/**
 * The validated configuration. Import this instead of touching `process.env`
 * directly, so every value is guaranteed present and correctly typed.
 */
export const env = parseEnv(process.env);

/**
 * True only on a real deployed production instance.
 *
 * Use this for behaviour that must differ live: verbose logging, seed data,
 * debug endpoints. Do NOT use `NODE_ENV === 'production'` for that - it is also
 * true during a local `npm run build`.
 */
export const isProductionDeployment = env.APP_ENV === 'production';
export const isDevelopment = env.APP_ENV === 'development';
export const isTest = env.APP_ENV === 'test';

/** True when the code was compiled in production mode, local builds included. */
export const isProductionBuild = env.NODE_ENV === 'production';
