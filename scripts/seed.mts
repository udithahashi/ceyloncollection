/**
 * Seeds the taxonomy tables.
 *
 *   npm run db:seed
 *
 * Safe to run as often as you like: it inserts what is missing and never touches
 * a row that already exists, so an edit made on the taxonomy page survives.
 */
// Must come first: it populates process.env before the env module validates it.
import './load-env.mts';

import { sql } from '../src/db/client';
import { seedTaxonomy } from '../src/db/seed/taxonomy';

try {
  const reports = await seedTaxonomy();

  const width = Math.max(...reports.map((report) => report.table.length));
  let inserted = 0;

  for (const report of reports) {
    inserted += report.inserted;
    const name = report.table.padEnd(width);
    const detail =
      report.inserted === 0
        ? `all ${report.unchanged} already there`
        : `${report.inserted} inserted, ${report.unchanged} already there`;

    console.log(`  ${name}  ${detail}`);
  }

  console.log(
    inserted === 0
      ? '\nNothing to do - the taxonomy is already seeded.'
      : `\nSeeded ${inserted} row${inserted === 1 ? '' : 's'}.`
  );
} catch (error) {
  console.error(`\nSeed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
