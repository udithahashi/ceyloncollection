/**
 * Checks the Drizzle declaration of `customer_summary` against the real view.
 *
 * The view is created by hand-written SQL in a migration and declared separately in
 * `customer-summary.ts`. Nothing in the type system connects the two, so a renamed
 * column would compile happily and fail on the customers page. This test is that
 * connection: it asks Postgres for the view's columns and compares the two lists.
 *
 * WHY IT SKIPS RATHER THAN FAILS WITHOUT A DATABASE
 * CI has no Postgres - the build there proves the app compiles, not that it runs - and
 * a developer running the tests with the dev stack down should not see a red suite for
 * a reason unrelated to their change. So the check reports itself as skipped instead,
 * and does its work on the machine that has the database: the one where the migration
 * was just written.
 */
import { getViewSelectedFields } from 'drizzle-orm';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { env } from '@/lib/env';

import { customerSummary } from './customer-summary';

/** The column names Drizzle believes the view has. */
const declared = Object.values(getViewSelectedFields(customerSummary)).map((column) =>
  String((column as { name: string }).name)
);

/**
 * Column names as Postgres holds them, or null if the database is unreachable.
 *
 * Its own short-lived connection rather than `@/db/client`, whose pool is deliberately
 * long-lived and would keep the test process alive after the run.
 */
async function liveColumns(connection: string): Promise<string[] | null> {
  const sql = postgres(connection, {
    max: 1,
    connect_timeout: 3,
    onnotice: () => {
      /* nothing to report in a test */
    },
  });

  try {
    const rows = await sql<{ column_name: string }[]>`
      select column_name
      from information_schema.columns
      where table_name = 'customer_summary'
      order by ordinal_position
    `;

    return rows.map((row) => row.column_name);
  } catch {
    return null;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

const columns = await liveColumns(env.DATABASE_URL);

describe('customer_summary declaration', () => {
  it('declares at least the columns the pages read', () => {
    // Runs everywhere, database or not: a declaration that has been emptied by a bad
    // refactor is worth catching in CI too.
    expect(declared).toContain('customer_id');
    expect(declared).toContain('open_ready_to_buy_requests');
  });

  describe.skipIf(columns === null)('against the live view', () => {
    it('names only columns the view actually has', () => {
      for (const name of declared) {
        expect(columns, `${name} is declared in Drizzle but missing from the view`).toContain(name);
      }
    });

    it('knows about every column the view has', () => {
      // Not strictly a bug - a view may carry a column nobody reads - but in practice
      // it means a migration added something and the declaration was not updated,
      // which is the drift this file exists to catch.
      for (const name of columns ?? []) {
        expect(declared, `the view has ${name}, which Drizzle does not declare`).toContain(name);
      }
    });
  });
});
