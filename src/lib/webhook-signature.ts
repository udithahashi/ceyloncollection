/**
 * Verifying a signed webhook request.
 *
 * The one caller today is n8n, at src/app/n8n/intake/route.ts - the endpoint AGENTS.md
 * names as one of the two deliberate exceptions to "no browser-facing API", reachable
 * only on the internal Docker network in production. It has no session to check, so the
 * shared secret in N8N_WEBHOOK_SECRET is the only proof a request is genuine, and this
 * is where that proof is checked.
 *
 * TWO THINGS ARE VERIFIED, NOT ONE
 * The signature alone proves the body was not altered and the sender knows the secret.
 * It says nothing about *when* the request was made, so a signature captured off the
 * wire stays valid forever unless the timestamp is checked too. Both are covered here:
 * the timestamp is part of what gets signed, so a copied request cannot have its
 * timestamp bumped without invalidating the signature, and a stale timestamp is
 * rejected outright.
 *
 * SERVER ONLY.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookVerification =
  | { ok: true }
  /** A header was absent - most likely a caller that has not been signed at all. */
  | { ok: false; reason: 'missingHeaders' }
  | { ok: false; reason: 'malformedTimestamp' }
  /** Older or newer than `maxAgeMs` allows. Guards against a captured request being replayed later. */
  | { ok: false; reason: 'stale' }
  | { ok: false; reason: 'badSignature' };

/** How old a signed request may be before it is refused. Five minutes is generous for
 * clock drift between this server and n8n's, and tight enough that a captured request
 * is useless once the window has passed. */
export const DEFAULT_MAX_AGE_MS = 5 * 60_000;

/**
 * @param rawBody the exact bytes received, as text - re-serialising parsed JSON would
 *   sign different bytes than the sender signed, and a body with re-ordered keys would
 *   fail for no reason a sender could predict.
 * @param timestampHeader the `X-Timestamp` header: milliseconds since the epoch, as a string.
 * @param signatureHeader the `X-Signature` header: hex-encoded HMAC-SHA256.
 */
export function verifyWebhookSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS
): WebhookVerification {
  if (timestampHeader === null || signatureHeader === null) {
    return { ok: false, reason: 'missingHeaders' };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'malformedTimestamp' };
  }

  if (Math.abs(Date.now() - timestamp) > maxAgeMs) {
    return { ok: false, reason: 'stale' };
  }

  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest();

  // Node's hex decoder does not throw on invalid input; it stops early and returns
  // whatever it managed to read, which is exactly the kind of short buffer the length
  // check below exists to catch.
  const received = Buffer.from(signatureHeader, 'hex');

  // timingSafeEqual throws on mismatched lengths rather than returning false, and a
  // length mismatch is itself a fact worth not leaking through timing - so it is
  // checked, and rejected, before the constant-time comparison ever runs.
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'badSignature' };
  }

  return { ok: true };
}
