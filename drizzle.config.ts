/**
 * drizzle-kit configuration.
 *
 * This runs as a standalone CLI, outside Next.js, so it loads `.env.local`
 * itself and reads DATABASE_URL directly - the validated `env` singleton pulls in
 * the logger and half the app, which a schema diff has no business booting.
 */
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local', quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and run `npm run doctor`.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: { url: databaseUrl },
  // Migrations are written to disk, reviewed, and committed. `drizzle-kit push`
  // is convenient and untraceable; it has no place near data we care about.
  strict: true,
  verbose: true,
  casing: 'snake_case',
});
