/**
 * Application logger.
 *
 * Structured JSON logging via pino. One line per event, machine-parseable, so
 * that when something goes wrong on the server you can search logs instead of
 * squinting at them.
 *
 * Locally, if you prefer human-readable output, run `npm run dev:pretty`
 * instead of `npm run dev` - that pipes the same JSON through a formatter.
 *
 * SERVER ONLY. Do not import this into client components.
 */
import pino from 'pino';

import { env, isProductionDeployment } from '@/lib/env';

/**
 * Field names that must never reach a log file, matched anywhere in the object
 * tree. Logging a session token or a password is how a log file becomes a
 * credential store, and log files get copied around far more casually than
 * databases do.
 */
const REDACTED_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'setCookie',
  'set-cookie',
  'signature',
  'totpCode',
  'twoFactorCode',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { app: 'ceyloncollection', env: env.APP_ENV },
  redact: {
    paths: REDACTED_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
    censor: '[redacted]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Human-readable ISO timestamps cost a little performance and save a lot of
  // time when reading logs at 2am.
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Creates a child logger tagged with a subsystem name, so every line from a
 * given area of the app is filterable.
 *
 * @example
 * const log = createLogger('leads');
 * log.info({ leadId }, 'lead created');
 */
export function createLogger(subsystem: string, context: Record<string, unknown> = {}) {
  return logger.child({ subsystem, ...context });
}

if (!isProductionDeployment) {
  // Not named `level`: that is pino's own field, and reusing it produces a log
  // line with two `level` keys.
  logger.debug({ logLevel: env.LOG_LEVEL, timezone: env.APP_TIMEZONE }, 'logger initialised');
}
