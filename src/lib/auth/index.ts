/**
 * Better Auth configuration.
 *
 * Sign-in is email and password with mandatory TOTP two-factor. There is no
 * public sign-up: accounts exist only because an owner invited them, which is the
 * right model for a back office with four staff and no reason to ever be found by
 * a stranger.
 *
 * SERVER ONLY.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { twoFactor } from 'better-auth/plugins/two-factor';

import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { env, isProductionDeployment } from '@/lib/env';
import { createLogger } from '@/lib/logger';

import { DEFAULT_ROLE, roles } from './roles';

const log = createLogger('auth');

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const auth = betterAuth({
  appName: 'Ceylon Collection',
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    // Our tables are singular, matching the rest of the schema.
    usePlural: false,
  }),

  advanced: {
    database: {
      // UUIDs everywhere, so an id from the auth tables looks and behaves like an
      // id from the business tables and can be a foreign key to either.
      generateId: 'uuid',
    },
    cookiePrefix: 'cc',
    // Cookies are Secure-only in production; the env schema already refuses to
    // start with a non-HTTPS APP_URL there, so the two cannot disagree.
    useSecureCookies: isProductionDeployment,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    },
  },

  emailAndPassword: {
    enabled: true,
    // The single most important line in this file. Without it, anyone who finds
    // the login page can create themselves an account.
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 256,
    // Better Auth uses scrypt by default, which is memory-hard and appropriate.
    // Do not swap this for a fast hash.
    requireEmailVerification: false,
  },

  session: {
    expiresIn: 7 * DAY,
    // Sliding expiry: a session in daily use is refreshed rather than expiring
    // mid-week, while an abandoned one still dies within seven days.
    updateAge: DAY,
    // Signed session data cached in the cookie for a short window, so a page load
    // does not query the database for the session on every request. The cost is
    // that a revoked session survives at most this long, which is why it is
    // seconds rather than minutes.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },

  user: {
    // `user` is a reserved word in SQL, so `select * from user` fails in psql or
    // DBeaver unless you remember to quote it. The physical table is `app_user`;
    // this name is the key the adapter looks up in the Drizzle schema object.
    modelName: 'appUser',
    additionalFields: {
      role: {
        type: roles as unknown as string[],
        required: true,
        defaultValue: DEFAULT_ROLE,
        // Critical: without this, a user could send `role: "owner"` to any
        // endpoint that updates their own profile and promote themselves. Roles
        // change only through our own Server Action, which checks the actor first.
        input: false,
      },
      // Set when an owner deactivates someone. We keep the row so the audit trail
      // still resolves, rather than deleting a user and orphaning history.
      disabledAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
    changeEmail: { enabled: false },
    deleteUser: { enabled: false },
  },

  plugins: [
    twoFactor({
      issuer: 'Ceylon Collection',
      totpOptions: {
        digits: 6,
        period: 30,
      },
      // The code must be verified before 2FA is considered active, so nobody can
      // lock themselves out by scanning a QR code that did not save properly.
      skipVerificationOnEnable: false,
      backupCodeOptions: {
        // Encrypted at rest with the app secret. A backup code is a password.
        storeBackupCodes: 'encrypted',
      },
    }),
    // Must be last: it flushes Better Auth's cookies through the Next.js cookie
    // API so that calling an auth endpoint from a Server Action actually sets them.
    nextCookies(),
  ],

  // We rate limit at our own boundary, in @/lib/rate-limit, where the policy for
  // the whole app lives and where the limits are per-account as well as per-IP.
  rateLimit: { enabled: false },

  logger: {
    disabled: false,
    level: isProductionDeployment ? 'warn' : 'info',
    log: (level, message, ...args) => {
      const line = { library: 'better-auth', args: args.length > 0 ? args : undefined };
      if (level === 'error') log.error(line, message);
      else if (level === 'warn') log.warn(line, message);
      else if (level === 'debug') log.debug(line, message);
      else log.info(line, message);
    },
  },
});

export type Auth = typeof auth;
