/**
 * Facts about the current request that the audit trail and rate limiter need.
 *
 * SERVER ONLY.
 */
import { headers } from 'next/headers';

import { env } from '@/lib/env';

/**
 * Headers a reverse proxy uses to report the real client address, most trusted
 * first. Only consulted because we know what sits in front of this app.
 */
const FORWARDED_HEADERS = ['x-real-ip', 'x-forwarded-for', 'cf-connecting-ip'] as const;

/**
 * The client IP address, or null when it cannot be determined.
 *
 * A caveat worth understanding: these headers are trivially forged by whoever
 * speaks to the app directly. They are trustworthy only because nginx on the VPS
 * overwrites them, and the app is not reachable except through it. If the app is
 * ever exposed directly, per-IP rate limits become bypassable - which is why the
 * sign-in limiter is also keyed per account.
 */
export async function getClientIp(): Promise<string | null> {
  const headerList = await headers();

  for (const name of FORWARDED_HEADERS) {
    const value = headerList.get(name);
    if (!value) continue;
    // x-forwarded-for is a chain: client, proxy1, proxy2. The client is first.
    const first = value.split(',')[0]?.trim();
    if (first) return first;
  }

  return null;
}

/** The user agent, truncated. Some crawlers send kilobyte-long strings. */
export async function getUserAgent(): Promise<string | null> {
  const value = (await headers()).get('user-agent');
  return value ? value.slice(0, 512) : null;
}

/**
 * An identifier for rate limiting when there is no account to key on yet.
 *
 * Falls back to a fixed string rather than to null, so a request with no
 * discoverable IP shares one bucket with every other such request instead of
 * escaping the limit entirely.
 */
export async function getRateLimitKey(): Promise<string> {
  return (await getClientIp()) ?? 'unknown-ip';
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export async function getRequestContext(): Promise<RequestContext> {
  const [ipAddress, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  return { ipAddress, userAgent };
}

/** The business timezone, for formatting timestamps shown to staff. */
export const displayTimezone = env.APP_TIMEZONE;
