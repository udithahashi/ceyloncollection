/**
 * Redis connection.
 *
 * Redis holds only data we are willing to lose: rate limit counters, one-time
 * token markers, short-lived caches. Anything the business depends on lives in
 * PostgreSQL. That rule is what makes it safe for Redis to be optional locally.
 *
 * SERVER ONLY.
 */
import Redis from 'ioredis';

import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('redis');

/**
 * The connection is created once per process and reused. Next.js hot reloading
 * re-evaluates modules, so without the global stash a long dev session would
 * leak a socket per edit until Redis refused new connections.
 */
declare global {
  var __ccRedis: Redis | undefined;
}

function connect(): Redis | null {
  if (env.DISABLE_REDIS || !env.REDIS_URL) {
    log.warn(
      'Redis is disabled; rate limiting will use a per-process in-memory fallback. Never do this in production.'
    );
    return null;
  }

  const client = new Redis(env.REDIS_URL, {
    // Fail fast rather than queueing commands forever behind a dead socket. A
    // request that hangs is worse than a request that errors, because you cannot
    // see it in the logs.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    lazyConnect: false,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2_000),
  });

  client.on('error', (error: Error) => {
    // Logged, not thrown: a Redis outage should degrade the app, not stop it.
    // Callers decide what "degraded" means for them.
    log.error({ err: error }, 'redis connection error');
  });

  client.on('connect', () => log.info('redis connected'));

  return client;
}

export const redis: Redis | null = (globalThis.__ccRedis ??= connect() ?? undefined) ?? null;

/** True when a shared store is available, so callers can log the difference. */
export const hasRedis = redis !== null;
