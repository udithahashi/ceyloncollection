/**
 * `REDIS_CA_CERT` accepts a certificate in the two shapes it can realistically arrive
 * in, and refuses everything else at startup.
 *
 * The variable exists for the split deployment in docs/DEPLOY-HOSTINGER.md, where the
 * cache presents a self-signed certificate across the public internet. Getting it wrong
 * fails in the worst way available: `src/lib/redis/client.ts` logs the connection error
 * and carries on, so the app keeps serving with rate limiting quietly reduced to a
 * per-process in-memory counter. Catching a malformed value at boot is the difference
 * between a startup error naming the variable and a security property that silently
 * stopped holding.
 */
import { describe, expect, it } from 'vitest';

import { parseEnv } from '@/lib/env/schema';

/** Shape only - nothing here is a real key pair, and nothing verifies one. */
const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIByDCCAW6gAwIBAgIUZmFrZSBjZXJ0aWZpY2F0ZSBmb3IgdGVzdHMwCgYIKoZI',
  '-----END CERTIFICATE-----',
].join('\n');

/** The minimum a parse needs, so each case below varies only what it is testing. */
const base = {
  APP_URL: 'http://localhost:3000',
  BETTER_AUTH_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'rediss://default:p@cache.example.com:6380',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  N8N_WEBHOOK_SECRET: 'b'.repeat(32),
};

describe('REDIS_CA_CERT', () => {
  it('accepts a PEM certificate as written', () => {
    expect(parseEnv({ ...base, REDIS_CA_CERT: PEM }).REDIS_CA_CERT).toBe(PEM);
  });

  it('accepts the same certificate base64-encoded, for panels that eat newlines', () => {
    const encoded = Buffer.from(PEM, 'utf8').toString('base64');
    expect(parseEnv({ ...base, REDIS_CA_CERT: encoded }).REDIS_CA_CERT).toBe(PEM);
  });

  it('is optional, because the all-in-one VPS keeps Redis on a private network', () => {
    expect(parseEnv(base).REDIS_CA_CERT).toBeUndefined();
    expect(parseEnv({ ...base, REDIS_CA_CERT: '' }).REDIS_CA_CERT).toBeUndefined();
  });

  it('refuses a value that is neither, rather than failing at first connection', () => {
    expect(() => parseEnv({ ...base, REDIS_CA_CERT: 'not-a-certificate' })).toThrow(
      /REDIS_CA_CERT/
    );
  });
});
