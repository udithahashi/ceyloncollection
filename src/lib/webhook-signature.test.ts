import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyWebhookRequest, verifyWebhookSignature } from './webhook-signature';

// Fixed on purpose, not a real credential, so the signatures below are reproducible.
const secret = 'a-secret-at-least-this-long-for-testing-purposes'; // secret-scan:allow

function sign(body: string, timestamp: string, withSecret = secret): string {
  return createHmac('sha256', withSecret).update(`${timestamp}.${body}`).digest('hex');
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed, fresh request', () => {
    const body = '{"message":"hello"}';
    const timestamp = String(Date.now());

    expect(verifyWebhookSignature(body, timestamp, sign(body, timestamp), secret)).toEqual({
      ok: true,
    });
  });

  it('rejects a signature made with the wrong secret', () => {
    const body = '{"message":"hello"}';
    const timestamp = String(Date.now());

    expect(
      verifyWebhookSignature(body, timestamp, sign(body, timestamp, 'a-different-secret'), secret)
    ).toEqual({ ok: false, reason: 'badSignature' });
  });

  it('rejects a body that was altered after signing', () => {
    const timestamp = String(Date.now());
    const signature = sign('{"message":"hello"}', timestamp);

    expect(verifyWebhookSignature('{"message":"goodbye"}', timestamp, signature, secret)).toEqual({
      ok: false,
      reason: 'badSignature',
    });
  });

  it('rejects a signature of the wrong length instead of throwing', () => {
    const body = '{"message":"hello"}';
    const timestamp = String(Date.now());

    expect(verifyWebhookSignature(body, timestamp, 'ab', secret)).toEqual({
      ok: false,
      reason: 'badSignature',
    });
  });

  it('rejects a missing signature header', () => {
    expect(verifyWebhookSignature('{}', String(Date.now()), null, secret)).toEqual({
      ok: false,
      reason: 'missingHeaders',
    });
  });

  it('rejects a missing timestamp header', () => {
    expect(verifyWebhookSignature('{}', null, 'deadbeef', secret)).toEqual({
      ok: false,
      reason: 'missingHeaders',
    });
  });

  it('rejects a timestamp that is not a number', () => {
    expect(verifyWebhookSignature('{}', 'not-a-number', 'deadbeef', secret)).toEqual({
      ok: false,
      reason: 'malformedTimestamp',
    });
  });

  it('rejects a timestamp older than the allowed window', () => {
    const body = '{}';
    const timestamp = String(Date.now() - 10 * 60_000);

    expect(
      verifyWebhookSignature(body, timestamp, sign(body, timestamp), secret, 5 * 60_000)
    ).toEqual({ ok: false, reason: 'stale' });
  });

  it('rejects a timestamp further in the future than the allowed window', () => {
    const body = '{}';
    const timestamp = String(Date.now() + 10 * 60_000);

    expect(
      verifyWebhookSignature(body, timestamp, sign(body, timestamp), secret, 5 * 60_000)
    ).toEqual({ ok: false, reason: 'stale' });
  });
});

describe('verifyWebhookRequest', () => {
  const base = {
    rawBody: '{"message":"hello"}',
    authorization: null,
    timestamp: null,
    signature: null,
    secret,
  };

  it('accepts a bearer token that matches the secret', () => {
    expect(verifyWebhookRequest({ ...base, authorization: `Bearer ${secret}` })).toEqual({
      ok: true,
      method: 'bearer',
    });
  });

  it('accepts the raw secret without the Bearer prefix, which is easy to omit', () => {
    expect(verifyWebhookRequest({ ...base, authorization: secret })).toEqual({
      ok: true,
      method: 'bearer',
    });
  });

  it('rejects a bearer token that does not match', () => {
    expect(verifyWebhookRequest({ ...base, authorization: 'Bearer not-the-secret' })).toEqual({
      ok: false,
      reason: 'badToken',
    });
  });

  it('rejects a request carrying no credentials at all', () => {
    expect(verifyWebhookRequest(base)).toEqual({ ok: false, reason: 'noCredentials' });
  });

  it('accepts a correctly signed request', () => {
    const timestamp = String(Date.now());

    expect(
      verifyWebhookRequest({ ...base, timestamp, signature: sign(base.rawBody, timestamp) })
    ).toEqual({ ok: true, method: 'signature' });
  });

  /**
   * The important one. A caller that signs must never be quietly downgraded to the
   * weaker check just because it also sent an Authorization header - otherwise a valid
   * token would paper over a signature that does not match the body.
   */
  it('checks the signature, not the token, when both are present', () => {
    const timestamp = String(Date.now());

    expect(
      verifyWebhookRequest({
        ...base,
        authorization: `Bearer ${secret}`,
        timestamp,
        signature: sign('a different body', timestamp),
      })
    ).toEqual({ ok: false, reason: 'badSignature' });
  });

  it('does not fall back to the token when a signature is only half-sent', () => {
    expect(
      verifyWebhookRequest({ ...base, authorization: `Bearer ${secret}`, timestamp: '123' })
    ).toEqual({ ok: false, reason: 'missingHeaders' });
  });
});
