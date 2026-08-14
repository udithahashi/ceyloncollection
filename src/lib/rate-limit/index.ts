/**
 * Rate limiting.
 *
 * Every entry point an outsider can reach gets a named limit here rather than an
 * ad-hoc number at the call site, so the whole throttling policy of the
 * application is one file you can read in a minute.
 *
 * SERVER ONLY.
 */
import type Redis from 'ioredis';

import { createLogger } from '@/lib/logger';
import { redis } from '@/lib/redis/client';

import {
  createMemoryStore,
  SLIDING_WINDOW_SCRIPT,
  type RateLimitDecision,
  type RateLimitRule,
  type RateLimitStore,
} from './store';

const log = createLogger('rate-limit');

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/**
 * The policy. Names are the only thing call sites reference, so a limit can be
 * retuned here without touching a single feature.
 *
 * The sign-in numbers are deliberately tight. This back office has a handful of
 * staff accounts, so a human never hits ten password attempts in five minutes,
 * while a credential-stuffing script hits it immediately.
 */
export const limits = {
  /** Password attempts per IP address. */
  signIn: { limit: 10, windowMs: 5 * MINUTE },
  /** Password attempts per account, so one target cannot be hammered from a botnet. */
  signInAccount: { limit: 8, windowMs: 15 * MINUTE },
  /** Two-factor code attempts. Six digits is a million guesses; make them expensive. */
  twoFactor: { limit: 6, windowMs: 10 * MINUTE },
  /** Invitation acceptance attempts per IP. */
  inviteAccept: { limit: 10, windowMs: HOUR },
  /** Any authenticated write. Generous - this is a guard rail, not a queue. */
  mutation: { limit: 120, windowMs: MINUTE },
  /** Image uploads, which cost CPU to re-encode and disk to keep. */
  upload: { limit: 30, windowMs: 10 * MINUTE },
  /** CSV imports, which can touch thousands of rows per call. */
  importCsv: { limit: 5, windowMs: HOUR },
  /** n8n intake webhook, keyed by the signing identity. */
  webhookIntake: { limit: 300, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>;

export type LimitName = keyof typeof limits;

interface RedisWithScript extends Redis {
  ccSlidingWindow(
    key: string,
    now: string,
    windowMs: string,
    limit: string,
    member: string
  ): Promise<[number, number, number]>;
}

function createRedisStore(client: Redis): RateLimitStore {
  // defineCommand registers the script once and calls it by hash thereafter,
  // rather than shipping the source on every request.
  const scripted = client as RedisWithScript;
  scripted.defineCommand('ccSlidingWindow', { numberOfKeys: 1, lua: SLIDING_WINDOW_SCRIPT });

  return {
    async consume(key, rule, now) {
      const [allowed, remaining, retryAfterMs] = await scripted.ccSlidingWindow(
        key,
        String(now),
        String(rule.windowMs),
        String(rule.limit),
        `${now}-${Math.random().toString(36).slice(2, 10)}`
      );

      return {
        allowed: allowed === 1,
        remaining,
        limit: rule.limit,
        retryAfterMs,
      };
    },

    async reset(key) {
      await client.del(key);
    },
  };
}

const store: RateLimitStore = redis ? createRedisStore(redis) : createMemoryStore();

/** Namespaced so rate limit keys never collide with cache or session keys. */
function keyFor(name: LimitName, identifier: string): string {
  return `rl:${name}:${identifier}`;
}

/**
 * Records an attempt against a named limit.
 *
 * `identifier` is whatever the limit is per: an IP address, a user id, a signing
 * key name. Never pass a raw phone number or email - hash or use the surrogate id,
 * because these keys end up in Redis where they are easier to read than the
 * database.
 *
 * Fails open. If Redis is unreachable, an outage would otherwise lock every
 * member of staff out of their own back office, which is a worse outcome than a
 * brief window with no throttling. The event is logged at error level so the
 * failure is visible rather than silent.
 */
export async function checkRateLimit(
  name: LimitName,
  identifier: string
): Promise<RateLimitDecision> {
  const rule = limits[name];

  try {
    const decision = await store.consume(keyFor(name, identifier), rule, Date.now());

    if (!decision.allowed) {
      log.warn({ limit: name, retryAfterMs: decision.retryAfterMs }, 'rate limit exceeded');
    }

    return decision;
  } catch (error) {
    log.error({ err: error, limit: name }, 'rate limit store unavailable, allowing the request');
    return { allowed: true, remaining: rule.limit, limit: rule.limit, retryAfterMs: 0 };
  }
}

/**
 * Clears a limit window. Call this after a successful sign-in so that a member of
 * staff who mistyped their password twice does not carry those attempts around
 * for the rest of the window.
 */
export async function resetRateLimit(name: LimitName, identifier: string): Promise<void> {
  try {
    await store.reset(keyFor(name, identifier));
  } catch (error) {
    log.error({ err: error, limit: name }, 'could not reset rate limit window');
  }
}

export type { RateLimitDecision, RateLimitRule } from './store';
