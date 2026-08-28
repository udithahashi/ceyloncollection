/**
 * The environment schema and its parser.
 *
 * Kept separate from ./index.ts, which holds the singleton, so that this module
 * has no side effects and can be unit tested against made-up environments. The
 * production guards in here are a security boundary, and an untested security
 * boundary is a decorative one.
 */
import { z } from 'zod';

/** Values `.env.example` ships with. Real config must never keep them. */
const PLACEHOLDER_PATTERN = /CHANGE_ME/i;

/**
 * Parses the loose string values that environment variables always are into a
 * real boolean, accepting the spellings people actually type.
 */
const envBoolean = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .default(defaultValue)
    .transform((value, ctx) => {
      if (typeof value === 'boolean') return value;
      const normalised = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalised)) return true;
      if (['false', '0', 'no', 'off', ''].includes(normalised)) return false;
      ctx.addIssue({
        code: 'custom',
        message: `expected a boolean like "true" or "false", received "${value}"`,
      });
      return z.NEVER;
    });

/** A secret that must be long enough to be worth having. */
const secret = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .min(
      32,
      `${name} must be at least 32 characters - generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
    )
    .refine(
      (value) => !PLACEHOLDER_PATTERN.test(value),
      `${name} is still the placeholder from .env.example - replace it with a real generated secret`
    );

/**
 * A PEM certificate, accepted either as-is or base64-encoded.
 *
 * The base64 form exists because a certificate is a multi-line value and the place it
 * has to be typed is a hosting panel's single-line environment variable field. Whether
 * such a field preserves newlines is not something to find out at boot, in production,
 * from an error about a malformed certificate - so both spellings are accepted and the
 * distinction is made here, once, by looking at the bytes rather than by asking.
 *
 * Anything that is neither is rejected at startup rather than at first connection.
 */
const pemCertificate = (name: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === '') return undefined;

      const trimmed = value.trim();
      if (trimmed.includes('-----BEGIN CERTIFICATE-----')) return trimmed;

      // Not PEM, so it should be base64 of PEM. Decoding garbage yields garbage
      // rather than throwing, hence the second check.
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN CERTIFICATE-----')) return decoded.trim();

      ctx.addIssue({
        code: 'custom',
        message: `${name} must be a PEM certificate (starting with -----BEGIN CERTIFICATE-----), or that same PEM base64-encoded`,
      });
      return z.NEVER;
    });

/** An IANA timezone name that this runtime actually knows about. */
const timezone = z
  .string()
  .default('Asia/Qatar')
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'must be a valid IANA timezone name, for example "Asia/Qatar"');

/** A URL with no trailing slash, so string concatenation elsewhere is safe. */
const baseUrl = z
  .string()
  .url('must be a full URL including the scheme, for example http://localhost:3000')
  .transform((value) => value.replace(/\/+$/, ''));

/** Hostnames that mean "this machine", where HTTPS is not expected. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  );
}

export const envSchema = z
  .object({
    /**
     * How this code was COMPILED. Next.js forces this to `production` for any
     * `next build`, including a build you run on your own laptop, so it is not a
     * reliable signal for "is this the live server".
     */
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    /**
     * WHERE this instance is running. This is the flag that governs the strict
     * production safety checks below, and it must be set explicitly to
     * `production` in the server environment.
     *
     * Keeping this separate from NODE_ENV is what allows you to run a real
     * production build locally (`npm run build && npm start`) against
     * http://localhost without tripping the HTTPS requirement.
     */
    APP_ENV: z.enum(['development', 'test', 'production']).default('development'),

    APP_URL: baseUrl,
    APP_TIMEZONE: timezone,

    DATABASE_URL: z
      .string({ error: 'DATABASE_URL is required' })
      .refine(
        (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
        'must be a PostgreSQL connection string starting with postgresql://'
      ),

    REDIS_URL: z.string().optional(),
    DISABLE_REDIS: envBoolean(false),

    /**
     * The certificate Redis presents, when it is one a public CA did not sign.
     *
     * Only needed for the split deployment in docs/DEPLOY-HOSTINGER.md, where the app
     * and the cache are on different machines and `rediss://` crosses the internet
     * between them. That deployment uses a self-signed certificate on purpose - it
     * never expires out from under the site the way a 90-day one does - and Node
     * verifies against the system CA store, which has never heard of it. Supplying it
     * here is what turns "cannot verify" into "verified, and only this one is
     * accepted": stricter than a public CA, because no other certificate is trusted.
     *
     * Unset everywhere else. On the all-in-one VPS the cache is on a private Docker
     * network and `redis://` never leaves it.
     */
    REDIS_CA_CERT: pemCertificate('REDIS_CA_CERT'),

    BETTER_AUTH_SECRET: secret('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: baseUrl,

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage/uploads'),

    N8N_WEBHOOK_SECRET: secret('N8N_WEBHOOK_SECRET'),

    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Redis is optional only because we allow an in-memory fallback for local
    // development. Without a URL and without the opt-out, the intent is unclear,
    // so say so rather than silently degrading.
    if (!env.DISABLE_REDIS && !env.REDIS_URL) {
      ctx.addIssue({
        code: 'custom',
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required unless DISABLE_REDIS=true',
      });
    }

    const hostname = (() => {
      try {
        return new URL(env.APP_URL).hostname;
      } catch {
        return '';
      }
    })();

    if (env.APP_ENV !== 'production') {
      // Safety net for the mistake this NODE_ENV/APP_ENV split introduces:
      // deploying to a real host but forgetting APP_ENV=production, which would
      // silently disable every check below.
      if (hostname && !isLocalHostname(hostname)) {
        ctx.addIssue({
          code: 'custom',
          path: ['APP_ENV'],
          message: `APP_URL points at "${hostname}", which is not a local address, but APP_ENV is "${env.APP_ENV}". Set APP_ENV=production so the production safety checks actually apply.`,
        });
      }
      return;
    }

    // Production-only guards. These exist because the failures they prevent are
    // the expensive kind: a live app with unshared rate limit counters, or
    // session cookies sent over plain HTTP.
    if (env.DISABLE_REDIS) {
      ctx.addIssue({
        code: 'custom',
        path: ['DISABLE_REDIS'],
        message:
          'DISABLE_REDIS must be false in production - the in-memory fallback resets on restart and is not shared between processes, which would make rate limiting ineffective',
      });
    }

    for (const key of ['APP_URL', 'BETTER_AUTH_URL'] as const) {
      if (!env[key].startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} must use https:// in production - session cookies are Secure-only and will not be sent over plain HTTP`,
        });
      }
    }

    // A production instance pointing at localhost means the deployment
    // configuration was never filled in.
    if (hostname && isLocalHostname(hostname)) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: `APP_URL is "${env.APP_URL}" but APP_ENV is production - set APP_URL to the real public URL of the deployment`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/** Formats validation issues into an error a human can act on immediately. */
export function formatEnvIssues(issues: z.core.$ZodIssue[]): string {
  const details = issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  return [
    '',
    'Invalid environment configuration. The app will not start.',
    '',
    details,
    '',
    'Fix these in .env.local (development) or in the server environment (production).',
    'Run `npm run doctor` for a guided check of your local setup.',
    '',
  ].join('\n');
}

/**
 * Validates a raw environment object, throwing a readable error if it is not
 * usable. Pass `process.env` in the app; pass a literal in tests.
 */
export function parseEnv(source: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;
  throw new Error(formatEnvIssues(parsed.error.issues));
}
