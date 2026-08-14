/**
 * Rate limit storage.
 *
 * Two implementations behind one interface: Redis for anything real, and an
 * in-memory map for local development without Redis and for unit tests. Both use
 * a sliding window, so a caller cannot get a double allowance by timing requests
 * either side of a window boundary.
 *
 * SERVER ONLY.
 */

export interface RateLimitDecision {
  /** Whether this attempt may proceed. */
  allowed: boolean;
  /** How many further attempts are permitted in the current window. */
  remaining: number;
  /** The configured ceiling, echoed back for response headers. */
  limit: number;
  /** Milliseconds until the caller may retry. Zero when allowed. */
  retryAfterMs: number;
}

export interface RateLimitRule {
  /** Attempts permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitStore {
  /** Records an attempt and reports whether it is permitted. */
  consume(key: string, rule: RateLimitRule, now: number): Promise<RateLimitDecision>;
  /** Clears the window for a key, e.g. after a successful sign-in. */
  reset(key: string): Promise<void>;
}

/**
 * Sliding window, expressed once in Lua so that the read-decide-write sequence
 * is atomic. Done as separate round trips, two simultaneous requests could both
 * observe "one attempt left" and both be allowed - which is precisely the case a
 * login limiter exists to prevent.
 *
 * KEYS[1] window key. ARGV: now, windowMs, limit, member.
 * Returns { allowed, remaining, retryAfterMs }.
 */
export const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local used = redis.call('ZCARD', key)

if used >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = 0
  if oldest[2] then
    retryAfter = math.ceil(tonumber(oldest[2]) + window - now)
  end
  if retryAfter < 1 then retryAfter = 1 end
  return { 0, 0, retryAfter }
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return { 1, limit - used - 1, 0 }
`;

/**
 * In-memory store. Correct for one process, useless across several, and empty
 * again after a restart - which is why the env schema forbids it in production.
 */
export function createMemoryStore(): RateLimitStore {
  const windows = new Map<string, number[]>();

  return {
    consume(key, rule, now) {
      const cutoff = now - rule.windowMs;
      const attempts = (windows.get(key) ?? []).filter((at) => at > cutoff);

      if (attempts.length >= rule.limit) {
        windows.set(key, attempts);
        const oldest = attempts[0] ?? now;
        return Promise.resolve({
          allowed: false,
          remaining: 0,
          limit: rule.limit,
          retryAfterMs: Math.max(1, Math.ceil(oldest + rule.windowMs - now)),
        });
      }

      attempts.push(now);
      windows.set(key, attempts);

      return Promise.resolve({
        allowed: true,
        remaining: rule.limit - attempts.length,
        limit: rule.limit,
        retryAfterMs: 0,
      });
    },

    reset(key) {
      windows.delete(key);
      return Promise.resolve();
    },
  };
}
