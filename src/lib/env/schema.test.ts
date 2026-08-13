import { describe, expect, it } from 'vitest';

import { envSchema, parseEnv } from './schema';

/** A minimal environment that must always be considered valid. */
const validDevelopment = {
  APP_ENV: 'development',
  APP_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://ceylon:pw@localhost:5433/ceyloncollection',
  REDIS_URL: 'redis://localhost:6380',
  BETTER_AUTH_SECRET: 'a'.repeat(43),
  BETTER_AUTH_URL: 'http://localhost:3000',
  N8N_WEBHOOK_SECRET: 'b'.repeat(43),
} as const;

const validProduction = {
  ...validDevelopment,
  APP_ENV: 'production',
  APP_URL: 'https://admin.example.com',
  BETTER_AUTH_URL: 'https://admin.example.com',
  DATABASE_URL: 'postgresql://ceylon:pw@db:5432/ceyloncollection',
  REDIS_URL: 'redis://cache:6379',
} as const;

/** Collects the field names that failed, which is what the assertions care about. */
function issuePathsFor(source: Record<string, unknown>): string[] {
  const result = envSchema.safeParse(source);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join('.'));
}

describe('valid configurations', () => {
  it('accepts a normal development environment', () => {
    expect(() => parseEnv({ ...validDevelopment })).not.toThrow();
  });

  it('accepts a normal production environment', () => {
    expect(() => parseEnv({ ...validProduction })).not.toThrow();
  });

  it('applies sensible defaults', () => {
    const env = parseEnv({ ...validDevelopment });
    expect(env.APP_TIMEZONE).toBe('Asia/Qatar');
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.DISABLE_REDIS).toBe(false);
  });

  it('strips trailing slashes from URLs so concatenation stays safe', () => {
    const env = parseEnv({ ...validDevelopment, APP_URL: 'http://localhost:3000/' });
    expect(env.APP_URL).toBe('http://localhost:3000');
  });
});

describe('secrets', () => {
  it('rejects a secret left as the .env.example placeholder', () => {
    expect(
      issuePathsFor({ ...validDevelopment, BETTER_AUTH_SECRET: 'CHANGE_ME_MIN_32_CHARS' })
    ).toContain('BETTER_AUTH_SECRET');
  });

  it('rejects a secret shorter than 32 characters', () => {
    expect(issuePathsFor({ ...validDevelopment, N8N_WEBHOOK_SECRET: 'tooshort' })).toContain(
      'N8N_WEBHOOK_SECRET'
    );
  });

  it('names the offending variable in the error message', () => {
    expect(() => parseEnv({ ...validDevelopment, BETTER_AUTH_SECRET: 'short' })).toThrow(
      /BETTER_AUTH_SECRET/
    );
  });
});

describe('production guards', () => {
  it('refuses plain HTTP for APP_URL', () => {
    const paths = issuePathsFor({
      ...validProduction,
      APP_URL: 'http://admin.example.com',
    });
    expect(paths).toContain('APP_URL');
  });

  it('refuses plain HTTP for BETTER_AUTH_URL', () => {
    const paths = issuePathsFor({
      ...validProduction,
      BETTER_AUTH_URL: 'http://admin.example.com',
    });
    expect(paths).toContain('BETTER_AUTH_URL');
  });

  it('refuses to run without Redis, because rate limiting would be ineffective', () => {
    const paths = issuePathsFor({
      ...validProduction,
      DISABLE_REDIS: 'true',
      REDIS_URL: undefined,
    });
    expect(paths).toContain('DISABLE_REDIS');
  });

  it('refuses a production instance still pointed at localhost', () => {
    const paths = issuePathsFor({
      ...validProduction,
      APP_URL: 'https://localhost:3000',
      BETTER_AUTH_URL: 'https://localhost:3000',
    });
    expect(paths).toContain('APP_URL');
  });
});

describe('the forgotten-APP_ENV safety net', () => {
  it('rejects a real domain while APP_ENV is still development', () => {
    const paths = issuePathsFor({
      ...validDevelopment,
      APP_URL: 'https://admin.example.com',
      BETTER_AUTH_URL: 'https://admin.example.com',
    });
    expect(paths).toContain('APP_ENV');
  });

  it('still allows localhost in development', () => {
    expect(issuePathsFor({ ...validDevelopment })).toEqual([]);
  });

  it('allows 127.0.0.1 and *.local in development', () => {
    expect(
      issuePathsFor({
        ...validDevelopment,
        APP_URL: 'http://127.0.0.1:3000',
        BETTER_AUTH_URL: 'http://127.0.0.1:3000',
      })
    ).toEqual([]);
    expect(
      issuePathsFor({
        ...validDevelopment,
        APP_URL: 'http://ceylon.local:3000',
        BETTER_AUTH_URL: 'http://ceylon.local:3000',
      })
    ).toEqual([]);
  });
});

describe('redis configuration', () => {
  it('requires a URL unless explicitly disabled', () => {
    expect(issuePathsFor({ ...validDevelopment, REDIS_URL: undefined })).toContain('REDIS_URL');
  });

  it('allows the in-memory fallback in development', () => {
    expect(
      issuePathsFor({ ...validDevelopment, REDIS_URL: undefined, DISABLE_REDIS: 'true' })
    ).toEqual([]);
  });
});

describe('boolean parsing', () => {
  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['yes', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['', false],
  ])('reads %j as %s', (input, expected) => {
    const env = parseEnv({
      ...validDevelopment,
      DISABLE_REDIS: input,
      REDIS_URL: 'redis://x:6379',
    });
    expect(env.DISABLE_REDIS).toBe(expected);
  });

  it('rejects a value that is not boolean-like', () => {
    expect(issuePathsFor({ ...validDevelopment, DISABLE_REDIS: 'maybe' })).toContain(
      'DISABLE_REDIS'
    );
  });
});

describe('other fields', () => {
  it('rejects a non-PostgreSQL database URL', () => {
    expect(
      issuePathsFor({ ...validDevelopment, DATABASE_URL: 'mysql://root@localhost/db' })
    ).toContain('DATABASE_URL');
  });

  it('rejects an unknown timezone', () => {
    expect(issuePathsFor({ ...validDevelopment, APP_TIMEZONE: 'Mars/Olympus_Mons' })).toContain(
      'APP_TIMEZONE'
    );
  });

  it('accepts a valid alternative timezone', () => {
    const env = parseEnv({ ...validDevelopment, APP_TIMEZONE: 'Asia/Colombo' });
    expect(env.APP_TIMEZONE).toBe('Asia/Colombo');
  });

  it('rejects an unknown log level', () => {
    expect(issuePathsFor({ ...validDevelopment, LOG_LEVEL: 'chatty' })).toContain('LOG_LEVEL');
  });

  it('reports every problem at once rather than one at a time', () => {
    const paths = issuePathsFor({
      ...validDevelopment,
      BETTER_AUTH_SECRET: 'short',
      N8N_WEBHOOK_SECRET: 'short',
      LOG_LEVEL: 'chatty',
    });
    expect(paths).toEqual(
      expect.arrayContaining(['BETTER_AUTH_SECRET', 'N8N_WEBHOOK_SECRET', 'LOG_LEVEL'])
    );
  });
});
