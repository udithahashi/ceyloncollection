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

  /**
   * Trust exactly one certificate, when told which.
   *
   * `rediss://` makes ioredis open a TLS connection and verify the server against the
   * system CA store. The split deployment's cache presents a self-signed certificate,
   * which that store has never heard of, so without this the connection is refused -
   * quietly, because a Redis failure degrades the app rather than stopping it, which
   * would leave rate limiting silently running on the in-memory fallback.
   *
   * `servername` is set explicitly rather than left to ioredis: passing our own `tls`
   * object replaces the one it derives from the URL, and losing the server name would
   * skip hostname verification while still looking encrypted.
   */
  const tls = env.REDIS_CA_CERT
    ? {
        tls: {
          ca: [env.REDIS_CA_CERT],
          servername: new URL(env.REDIS_URL).hostname,
        },
      }
    : {};

  const client = new Redis(env.REDIS_URL, {
    ...tls,
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
