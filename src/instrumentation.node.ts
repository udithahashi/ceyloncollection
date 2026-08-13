/**
 * Node.js-only half of the instrumentation hooks.
 *
 * Kept in its own module so that Node APIs and the configuration loader never
 * appear in the Edge runtime bundle. See ./instrumentation.ts for why.
 */
import type { Instrumentation } from 'next';

import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Validates configuration and records what this instance believes about itself.
 *
 * Importing `@/lib/env` is what performs validation: the module throws on load
 * if anything is missing or malformed, and throwing here means the server never
 * reaches a ready state.
 */
export function registerNodeServer() {
  logger.info(
    {
      appEnv: env.APP_ENV,
      appUrl: env.APP_URL,
      timezone: env.APP_TIMEZONE,
      storageDriver: env.STORAGE_DRIVER,
      redis: env.DISABLE_REDIS ? 'disabled (in-memory fallback)' : 'enabled',
      node: process.versions.node,
    },
    'server starting'
  );
}

/**
 * Central handler for uncaught server-side errors.
 *
 * Logs enough request context to find the error again. Request headers are
 * omitted entirely rather than relying on redaction, because they carry the
 * session cookie and there is no version of this log line that needs them.
 */
export const reportRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest: unknown }).digest)
      : undefined;

  logger.error(
    {
      err: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      digest,
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
    },
    'unhandled server error'
  );
};
