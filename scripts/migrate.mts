/**
 * Applies pending migrations.
 *
 * Run with `npm run db:migrate`. Safe to run repeatedly: Drizzle records which
 * files have been applied and skips them.
 *
 * This is a script rather than `drizzle-kit migrate` so that the same code path
 * runs locally and on the server at deploy time, and so failures print something
 * you can act on.
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({ path: '.env.local', quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Run `npm run doctor` for a guided check.');
  process.exit(1);
}

// A dedicated single connection, closed at the end. A pool would keep the process
// alive after the migration finished.
const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

/**
 * How many migrations the database has recorded.
 *
 * Counted before and after, so this script can say what it did rather than assert that
 * all is well. That distinction is not pedantry: Drizzle skips a journal entry whose
 * timestamp is not later than the newest one already applied, and a silent skip once
 * left a table missing while the output read "up to date". `src/db/migrations.test.ts`
 * guards the ordering; this reports the outcome.
 *
 * Returns 0 before the first migration, when the bookkeeping table does not exist yet.
 */
async function appliedCount(): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    select count(*)::text as count
    from drizzle.__drizzle_migrations
  `.catch(() => [{ count: '0' }]);

  return Number(rows[0]?.count ?? 0);
}

try {
  const startedAt = Date.now();
  const before = await appliedCount();

  await migrate(drizzle(sql), { migrationsFolder: './src/db/migrations' });

  const applied = (await appliedCount()) - before;
  const elapsed = Date.now() - startedAt;

  console.log(
    applied === 0
      ? `Nothing to apply; already up to date (${elapsed}ms).`
      : `Applied ${applied} migration${applied === 1 ? '' : 's'} in ${elapsed}ms.`
  );
} catch (error) {
  console.error('\nMigration failed. The database has not been left half-migrated:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
