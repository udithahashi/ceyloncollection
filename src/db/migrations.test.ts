/**
 * Guards on the migration journal itself.
 *
 * These exist because of a failure that cost an afternoon and gave no error at all.
 * Drizzle decides what to apply by comparing each journal entry's `when` against the
 * newest one already recorded in the database, and applies whatever is later. A
 * hand-written migration was given a `when` value slightly in the future; the next
 * generated migration therefore had an *earlier* timestamp than an already-applied
 * one, and the migrator skipped it while printing "up to date". The table simply was
 * not there, and the first sign of it was a query failing hours later.
 *
 * A migration that silently does not run is the worst kind of bug in a schema: every
 * environment disagrees about what exists, and the difference shows up as something
 * else entirely. So the ordering is asserted here, where it fails in CI instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(import.meta.dirname, 'migrations');

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

const journal = JSON.parse(
  readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8')
) as { entries: JournalEntry[] };

describe('the migration journal', () => {
  it('has entries', () => {
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  /** The one that bites. See the note at the top of this file. */
  it('records timestamps that only ever increase', () => {
    const outOfOrder = journal.entries
      .map((entry, index) => ({ entry, previous: journal.entries[index - 1] }))
      .filter(({ entry, previous }) => previous !== undefined && entry.when <= previous.when)
      .map(
        ({ entry, previous }) =>
          `${entry.tag} (${entry.when}) is not later than ${previous!.tag} (${previous!.when})`
      );

    expect(
      outOfOrder,
      'Drizzle applies only migrations newer than the last one recorded, so an entry with an earlier timestamp than its predecessor is skipped in silence. Raise its `when` above the entry before it.'
    ).toEqual([]);
  });

  it('numbers entries in order, with no gaps', () => {
    expect(journal.entries.map((entry) => entry.idx)).toEqual(
      journal.entries.map((_entry, index) => index)
    );
  });

  it('has a SQL file for every entry, and an entry for every SQL file', () => {
    const files = readdirSync(migrationsDir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.replace(/\.sql$/, ''))
      .sort();

    expect(journal.entries.map((entry) => entry.tag).sort()).toEqual(files);
  });
});
