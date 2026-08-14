/**
 * Database connection.
 *
 * One pool per process, reused across requests. Everything the business owns -
 * leads, customers, taxonomy, users, the audit trail - lives here and only here.
 *
 * SERVER ONLY. Importing this into a client component would ship a database
 * driver and your connection string to the browser.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env, isProductionDeployment } from '@/lib/env';
import { createLogger } from '@/lib/logger';

import * as schema from './schema';

const log = createLogger('db');

/**
 * Stashed on globalThis because Next.js re-evaluates modules on hot reload. A
 * fresh pool per edit exhausts Postgres's connection slots within a few minutes
 * of editing, and the error it produces ("too many clients") points nowhere near
 * the cause.
 */
declare global {
  var __ccSql: ReturnType<typeof postgres> | undefined;
}

function createPool() {
  return postgres(env.DATABASE_URL, {
    // Small on purpose. This is a back office for a handful of staff, and each
    // idle connection costs the database memory. Raise it when measurement says to.
    max: isProductionDeployment ? 10 : 5,
    idle_timeout: 30,
    connect_timeout: 10,
    // Dates come back as strings so that a timestamptz is never silently
    // reinterpreted in the server's local timezone on its way through the driver.
    // Conversion is explicit, via @/lib/time.
    types: {
      date: {
        to: 1184,
        from: [1082, 1114, 1184],
        serialize: (value: Date | string) =>
          value instanceof Date ? value.toISOString() : String(value),
        parse: (value: string) => value,
      },
    },
    onnotice: (notice) => log.debug({ notice: notice.message }, 'postgres notice'),
  });
}

export const sql = (globalThis.__ccSql ??= createPool());

export const db = drizzle(sql, {
  schema,
  // Query logging in development only. In production these lines would contain
  // customer data and would dwarf every other log line in volume.
  logger: isProductionDeployment
    ? false
    : {
        logQuery: (query, params) => log.debug({ query, params }, 'query'),
      },
});

export type Database = typeof db;
