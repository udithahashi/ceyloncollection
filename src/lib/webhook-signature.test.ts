import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyWebhookSignature } from './webhook-signature';

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
