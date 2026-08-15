/**
 * Proving a webhook request came from us.
 *
 * The one caller today is n8n, at src/app/n8n/intake/route.ts - the endpoint AGENTS.md
 * names as one of the two deliberate exceptions to "no browser-facing API", reachable
 * only on the internal Docker network in production. It has no session to check, so the
 * shared secret in N8N_WEBHOOK_SECRET is the only proof a request is genuine, and this
 * is where that proof is checked.
 *
 * `verifyWebhookRequest` is the entry point and accepts either of two credentials; the
 * long note above it explains why both exist and what the weaker one costs.
 *
 * WHAT THE SIGNATURE SCHEME VERIFIES, AND WHY IT IS TWO THINGS
 * The signature alone proves the body was not altered and the sender knows the secret.
 * It says nothing about *when* the request was made, so a signature captured off the
 * wire stays valid forever unless the timestamp is checked too. Both are covered: the
 * timestamp is part of what gets signed, so a copied request cannot have its timestamp
 * bumped without invalidating the signature, and a stale timestamp is rejected outright.
 *
 * SERVER ONLY.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Why a request was refused.
 *
 * - `noCredentials` nothing to check at all: no token, no signature.
 * - `badToken` an `Authorization` header that does not match the secret.
 * - `missingHeaders` a partly-signed request: one of the two signature headers absent.
 * - `stale` older or newer than `maxAgeMs` allows, so a captured request cannot be replayed.
 * - `badSignature` the signature does not match the body and timestamp received.
 */
export type WebhookFailure =
  'noCredentials' | 'badToken' | 'missingHeaders' | 'malformedTimestamp' | 'stale' | 'badSignature';

export type WebhookVerification = { ok: true } | { ok: false; reason: WebhookFailure };

/** How a request proved itself, or why it failed to. */
export type WebhookAuth =
  { ok: true; method: 'bearer' | 'signature' } | { ok: false; reason: WebhookFailure };

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

/** Constant-time string comparison, for anything secret. */
function secretsMatch(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  // Same reasoning as above: timingSafeEqual throws on a length mismatch, so the
  // lengths are compared first and the result fails closed.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Authenticates an incoming webhook by either accepted method.
 *
 * TWO METHODS, AND WHY BOTH
 * The HMAC scheme above is stronger: it proves the body was not altered, and the signed
 * timestamp means a captured request cannot be replayed tomorrow. It also costs the
 * *caller* real complexity - computing an HMAC needs a scripting step, and n8n's Code
 * node blocks Node's `crypto` module unless the container is started with
 * `NODE_FUNCTION_ALLOW_BUILTIN=crypto`. On a managed or shared n8n that flag may simply
 * not be available, and rebuilding the container for every integration is not a
 * deployment story anyone should sign up to.
 *
 * So a plain shared secret in an `Authorization: Bearer` header is also accepted. n8n
 * sends that natively with a Header Auth credential - no code, no container changes, and
 * the secret is stored encrypted in n8n's own database rather than pasted into a
 * workflow that gets exported and emailed around.
 *
 * What that costs, stated plainly: a bearer token proves only that the caller knows the
 * secret. It does not prove the body arrived unaltered, and a captured request stays
 * valid until the secret is rotated. That is an acceptable trade *here* because this
 * endpoint is reachable only on the internal Docker network - see the route - so an
 * attacker who could capture or alter the request is already inside the host, at which
 * point the signature was never the thing protecting you. Over a public network, prefer
 * the signature.
 */
export function verifyWebhookRequest(input: {
  rawBody: string;
  /** The `Authorization` header, if the caller sent one. */
  authorization: string | null;
  /** The `X-Timestamp` header, for the signature method. */
  timestamp: string | null;
  /** The `X-Signature` header, for the signature method. */
  signature: string | null;
  secret: string;
  maxAgeMs?: number;
}): WebhookAuth {
  const { rawBody, authorization, timestamp, signature, secret, maxAgeMs } = input;

  // The signature is checked first when one is offered, so a caller that goes to the
  // trouble of signing is never quietly downgraded to the weaker method.
  if (timestamp !== null || signature !== null) {
    const verification = verifyWebhookSignature(rawBody, timestamp, signature, secret, maxAgeMs);
    return verification.ok ? { ok: true, method: 'signature' } : verification;
  }

  if (authorization !== null) {
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : authorization.trim();

    return secretsMatch(token, secret)
      ? { ok: true, method: 'bearer' }
      : { ok: false, reason: 'badToken' };
  }

  return { ok: false, reason: 'noCredentials' };
}
