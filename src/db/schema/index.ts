/**
 * The database schema.
 *
 * Every table is re-exported from here, which is both the import surface for the
 * application and the set of tables drizzle-kit compares against the live
 * database when generating a migration. A table that is not exported here does
 * not exist as far as migrations are concerned.
 *
 * The export names matter beyond convention: Better Auth's Drizzle adapter looks
 * its tables up by key in this object, so `appUser` here must match the
 * `modelName` configured in @/lib/auth.
 */
export * from './columns';

export * from './auth';
export * from './invitation';
export * from './activity-log';
export * from './taxonomy';
export * from './customers';
export * from './leads';
export * from './customer-summary';
