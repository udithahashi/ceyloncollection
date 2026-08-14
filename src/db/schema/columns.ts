/**
 * Column helpers shared by every table.
 *
 * Defining these once is what stops the schema drifting into three different
 * spellings of "created at" and two different notions of deletion.
 */
import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Primary key. A random UUID rather than a sequence, because an auto-incrementing
 * id in a URL tells anyone who sees it how many records you have and lets them
 * guess the next one.
 */
export const primaryId = () => uuid('id').primaryKey().defaultRandom();

/**
 * An instant. Always `timestamptz`, always stored in UTC, converted to Qatar time
 * only for display or for grouping by day - see @/lib/time.
 *
 * A bare `timestamp` would record "3pm" with no record of whose 3pm, which
 * silently corrupts every date comparison the moment a server moves timezone.
 */
export const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

/** Creation and modification stamps, defaulted by the database rather than the app. */
export const timestamps = {
  createdAt: instant('created_at')
    .notNull()
    .default(sql`now()`),
  updatedAt: instant('updated_at')
    .notNull()
    .default(sql`now()`),
};

/**
 * Soft deletion. Business records are hidden, never destroyed: a lead removed by
 * mistake is a customer you can no longer contact, and the audit trail has to keep
 * pointing at something.
 *
 * Every query over a soft-deletable table must filter `deletedAt IS NULL`.
 */
export const softDelete = {
  deletedAt: instant('deleted_at'),
};
