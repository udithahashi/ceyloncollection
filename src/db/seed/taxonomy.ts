/**
 * Seeding the taxonomy.
 *
 * Two rules make this safe to run whenever you like, including on a database
 * that is already in use:
 *
 * 1. **Insert only.** A row whose slug already exists is left exactly as it is.
 *    If someone renames "Lost/Cancelled" to "Closed" on the taxonomy page, a
 *    later deploy must not undo their decision.
 * 2. **Fail before writing.** Slugs are built and checked for collisions first,
 *    so a typo in the seed data is a clear error rather than a half-seeded table.
 *
 * `sortOrder` counts in tens, leaving room to slot a value in between two others
 * later without renumbering the whole list.
 */
import { inArray } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { db } from '@/db/client';
import {
  categories,
  cities,
  clothGenders,
  fabrics,
  leadStatuses,
  platforms,
  sizes,
  subcategories,
  tags,
  urgencyLevels,
} from '@/db/schema/taxonomy';
import { slugify } from '@/lib/slug';

import {
  seedCategories,
  seedCities,
  seedClothGenders,
  seedFabrics,
  seedLeadStatuses,
  seedPlatforms,
  seedSizes,
  seedTags,
  seedUrgencyLevels,
  type SeedValue,
} from './taxonomy-data';

export interface SeedReport {
  table: string;
  inserted: number;
  /** Rows that were already there and were left untouched. */
  unchanged: number;
}

/** Gaps of ten, so a value can be inserted between two others later. */
const STEP = 10;

/**
 * Adds `slug` and `sortOrder` to a list of seed values, and refuses to return
 * anything if two names would produce the same slug.
 *
 * Exported for its test: a duplicate in several hundred hand-transcribed names is
 * the single most likely mistake in this file, and it is much cheaper to catch in
 * CI than as a constraint violation halfway through a seed.
 */
export function buildRows<T extends SeedValue>(
  values: readonly T[],
  label: string
): Array<T & { slug: string; sortOrder: number }> {
  const seen = new Map<string, string>();
  const rows = values.map((value, index) => {
    const slug = slugify(value.name);
    const clash = seen.get(slug);

    if (clash !== undefined) {
      throw new Error(
        `${label}: "${value.name}" and "${clash}" both slugify to "${slug}". ` +
          'Rename one of them - a slug is a machine key and must be unique.'
      );
    }

    seen.set(slug, value.name);
    return { ...value, slug, sortOrder: (index + 1) * STEP };
  });

  return rows;
}

/**
 * Every taxonomy table has an `id` and a `slug`, which is all this file needs,
 * but each has a different row type and Drizzle's insert builder is generic over
 * the exact table. `cities` is the plainest of the ten, so it stands in for the
 * shape here and `asSlugTable` is the one place that cast is made.
 */
type SlugTable = typeof cities;

const asSlugTable = (table: { id: AnyPgColumn; slug: AnyPgColumn }) =>
  table as unknown as SlugTable;

/**
 * Inserts the rows whose slug is not present yet.
 *
 * `onConflictDoNothing` rather than read-then-write: it is one statement, so two
 * seeds running at once cannot both decide a row is missing.
 */
async function insertMissing<T extends { slug: string }>(
  table: SlugTable,
  label: string,
  rows: T[]
): Promise<SeedReport> {
  if (rows.length === 0) return { table: label, inserted: 0, unchanged: 0 };

  const inserted = await db
    .insert(table)
    .values(rows as never)
    .onConflictDoNothing({ target: table.slug })
    .returning({ id: table.id });

  return { table: label, inserted: inserted.length, unchanged: rows.length - inserted.length };
}

/**
 * Categories and their sub-categories.
 *
 * Sub-category slugs are unique per category, not globally, so the conflict
 * target is the pair. That is what allows "Batik Saree" to exist under both Batik
 * Wear and Sarees & Osari, which the business's own list asks for.
 */
async function seedCategoryTree(): Promise<SeedReport[]> {
  const categoryRows = buildRows(
    seedCategories.map(({ name, description }) => ({ name, description })),
    'categories'
  );

  const categoryReport = await insertMissing(asSlugTable(categories), 'categories', categoryRows);

  // Read the ids back rather than trusting the insert's return value: on a
  // re-run most categories already exist and would not be returned.
  const parents = await db
    .select({ id: categories.id, slug: categories.slug })
    .from(categories)
    .where(
      inArray(
        categories.slug,
        categoryRows.map((row) => row.slug)
      )
    );

  const idBySlug = new Map(parents.map((parent) => [parent.slug, parent.id]));

  const childRows = seedCategories.flatMap((category) => {
    const categoryId = idBySlug.get(slugify(category.name));
    if (categoryId === undefined) {
      throw new Error(`categories: "${category.name}" was not inserted and was not found`);
    }

    return buildRows(
      category.subcategories.map((name) => ({ name })),
      `subcategories of ${category.name}`
    ).map((row) => ({ ...row, categoryId }));
  });

  const insertedChildren = await db
    .insert(subcategories)
    .values(childRows)
    .onConflictDoNothing({ target: [subcategories.categoryId, subcategories.slug] })
    .returning({ id: subcategories.id });

  return [
    categoryReport,
    {
      table: 'subcategories',
      inserted: insertedChildren.length,
      unchanged: childRows.length - insertedChildren.length,
    },
  ];
}

/** Seeds all ten tables and reports what it did. */
export async function seedTaxonomy(): Promise<SeedReport[]> {
  const simple = [
    ['lead_statuses', leadStatuses, seedLeadStatuses],
    ['platforms', platforms, seedPlatforms],
    ['cloth_genders', clothGenders, seedClothGenders],
    ['sizes', sizes, seedSizes],
    ['cities', cities, seedCities],
    ['urgency_levels', urgencyLevels, seedUrgencyLevels],
    ['fabrics', fabrics, seedFabrics],
    ['tags', tags, seedTags],
  ] as const;

  // Build every row before writing anything, so a bad name in the last list does
  // not leave the first eight tables half seeded.
  const prepared = simple.map(([label, table, values]) => ({
    label,
    table,
    rows: buildRows(values, label),
  }));

  const reports: SeedReport[] = [];

  for (const { label, table, rows } of prepared) {
    reports.push(await insertMissing(asSlugTable(table), label, rows));
  }

  reports.push(...(await seedCategoryTree()));

  return reports.sort((a, b) => a.table.localeCompare(b.table));
}
