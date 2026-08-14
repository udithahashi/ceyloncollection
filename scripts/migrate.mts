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

try {
  const startedAt = Date.now();
  await migrate(drizzle(sql), { migrationsFolder: './src/db/migrations' });
  console.log(`Migrations up to date in ${Date.now() - startedAt}ms.`);
} catch (error) {
  console.error('\nMigration failed. The database has not been left half-migrated:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
