/**
 * Authentication tables.
 *
 * These are Better Auth's tables, so their shape is dictated by the library
 * rather than by us. Do not rename a column here on aesthetic grounds: the
 * adapter looks columns up by name and a mismatch fails at runtime, not at
 * compile time.
 *
 * To check this file still matches what the library expects after upgrading
 * better-auth:
 *
 *   npx @better-auth/cli generate --config src/lib/auth/index.ts \
 *     --output src/db/schema/auth.generated.ts -y
 *
 * then diff and delete the generated file. Two deliberate differences from the
 * generated output:
 *
 * 1. Every timestamp is `timestamptz`. The generator emits `timestamp`, which is
 *    "3pm with no record of whose 3pm" and silently breaks the moment a server
 *    changes timezone. Session expiry is not something to be relaxed about.
 * 2. The user table is physically `app_user`, because `user` is a reserved word
 *    in SQL and unquoted queries against it fail.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { roles, type Role } from '@/lib/auth/roles';

/**
 * Better Auth hands us `Date` objects and expects them back, so these columns are
 * `mode: 'date'` rather than the `mode: 'string'` used by the business tables.
 */
const authInstant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** The role column type, plus a real CHECK constraint so the database agrees. */
export const roleColumn = (name: string) =>
  text(name, { enum: roles as unknown as [Role, ...Role[]] });

/**
 * Drizzle's `enum` option is a TypeScript nicety only - it emits a plain `text`
 * column. This is the constraint that actually stops an UPDATE from a SQL console
 * inventing a role such as `superuser`, which would then be denied everything and
 * be very confusing to debug.
 */
export const roleCheck = (table: string, column: string) =>
  check(
    `${table}_${column}_valid`,
    sql.raw(`"${column}" in (${roles.map((role) => `'${role}'`).join(', ')})`)
  );

/** A staff account. Created only by invitation - see the `invitation` table. */
export const appUser = pgTable(
  'app_user',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    createdAt: authInstant('created_at').notNull().defaultNow(),
    updatedAt: authInstant('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    /** Set by the two-factor plugin once a TOTP secret has been verified. */
    twoFactorEnabled: boolean('two_factor_enabled').default(false),

    /** Authorisation. See @/lib/auth/roles for what each role may do. */
    role: roleColumn('role').notNull().default('staff'),

    /**
     * Set when an owner deactivates someone. The row survives so the activity log
     * still resolves to a name, and every session check refuses a disabled account.
     */
    disabledAt: authInstant('disabled_at'),
  },
  (table) => [
    roleCheck('app_user', 'role'),
    // Email is the sign-in identifier, so it must be unique case-insensitively.
    // The unique constraint above is case-sensitive, which would otherwise let
    // `Sam@x.com` and `sam@x.com` exist as two separate accounts. We also
    // lowercase on the way in; this is the backstop for when someone forgets.
    uniqueIndex('app_user_email_lower_key').on(sql`lower(${table.email})`),
  ]
);

export const session = pgTable(
  'session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expiresAt: authInstant('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: authInstant('created_at').notNull().defaultNow(),
    updatedAt: authInstant('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('session_user_id_idx').on(table.userId),
    // Expired sessions are swept periodically, and the sweep would otherwise scan
    // the whole table.
    index('session_expires_at_idx').on(table.expiresAt),
  ]
);

/**
 * Credentials. For password sign-in there is one row per user with `providerId`
 * of `credential` and the scrypt hash in `password`. The OAuth columns are unused
 * today and kept because the library expects them.
 */
export const account = pgTable(
  'account',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: authInstant('access_token_expires_at'),
    refreshTokenExpiresAt: authInstant('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: authInstant('created_at').notNull().defaultNow(),
    updatedAt: authInstant('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_user_id_idx').on(table.userId)]
);

/** Short-lived tokens: password reset, and the one-time codes used during 2FA. */
export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: authInstant('expires_at').notNull(),
    createdAt: authInstant('created_at').notNull().defaultNow(),
    updatedAt: authInstant('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('verification_identifier_idx').on(table.identifier),
    index('verification_expires_at_idx').on(table.expiresAt),
  ]
);

/**
 * TOTP secrets and backup codes, both encrypted at rest with BETTER_AUTH_SECRET.
 * Rotating that secret invalidates every enrolled authenticator, so it is not a
 * value to change casually.
 */
export const twoFactor = pgTable(
  'two_factor',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    verified: boolean('verified').default(true),
    /** Drives the library's own lockout after repeated bad codes. */
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: authInstant('locked_until'),
  },
  (table) => [
    index('two_factor_secret_idx').on(table.secret),
    index('two_factor_user_id_idx').on(table.userId),
  ]
);

export const appUserRelations = relations(appUser, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(appUser, { fields: [session.userId], references: [appUser.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(appUser, { fields: [account.userId], references: [appUser.id] }),
}));

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
  user: one(appUser, { fields: [twoFactor.userId], references: [appUser.id] }),
}));

export type AppUser = typeof appUser.$inferSelect;
export type SessionRow = typeof session.$inferSelect;
