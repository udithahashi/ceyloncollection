/**
 * Turning the words in a spreadsheet into taxonomy rows.
 *
 * The sheet says "Ready to Buy" and the database has a row whose name is "Ready to Buy"
 * and whose slug is `ready-to-buy`. Matching happens on a reduced form of both - letters
 * and digits only, lower case - so `READY TO BUY`, `ready_to_buy` and `Ready-to-Buy` all
 * land on the same row.
 *
 * What it will not do is guess. A value that matches nothing is reported with the row
 * and the taxonomy it belongs to, and the import stops short of writing that row. The
 * alternative - creating the missing value on the fly - would turn one typo in one cell
 * into a permanent second spelling in the vocabulary the whole business reports on.
 *
 * Retired values (`isActive` false) are still matched. A back-filled enquiry from March
 * may well name a platform nobody uses now, and refusing it would make the history
 * unimportable.
 *
 * SERVER ONLY.
 */
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
import { isNull } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

/** The three columns a value is matched on, for any taxonomy table. */
function nameFields<T extends { id: PgColumn; name: PgColumn; slug: PgColumn }>(
  table: T
): Pick<T, 'id' | 'name' | 'slug'> {
  return { id: table.id, name: table.name, slug: table.slug };
}

/** The reduced form used for matching. Mirrors `normaliseHeading` for values. */
export function matchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '');
}

/** One taxonomy, ready to look values up in. */
export interface Lookup {
  /** The taxonomy's name, for the report. */
  label: string;
  /** Where to go and add a missing value. */
  href: string;
  byKey: Map<string, string>;
}

function buildLookup(
  label: string,
  href: string,
  rows: readonly { id: string; name: string; slug: string }[]
): Lookup {
  const byKey = new Map<string, string>();

  for (const row of rows) {
    // First writer wins, so a later duplicate spelling cannot shadow the real row.
    for (const key of [matchKey(row.name), matchKey(row.slug)]) {
      if (key !== '' && !byKey.has(key)) byKey.set(key, row.id);
    }
  }

  return { label, href, byKey };
}

/**
 * A sub-category, which needs its category to be unambiguous.
 *
 * The business's own list has "Batik Saree" under both Batik Wear and Sarees & Osari,
 * and both rows are real. So the name alone is only enough when it appears once.
 */
export interface SubcategoryLookup {
  label: string;
  href: string;
  /** `categoryKey\u0000subcategoryKey` to id, for a row that names both. */
  byPair: Map<string, string>;
  /** Sub-category key to every id that spells it that way. */
  byKey: Map<string, string[]>;
  /** Sub-category id to its category id, so the pair written to `leads` is correct. */
  categoryOf: Map<string, string>;
}

export interface ImportLookups {
  status: Lookup;
  platform: Lookup;
  gender: Lookup;
  city: Lookup;
  urgency: Lookup;
  fabric: Lookup;
  size: Lookup;
  category: Lookup;
  tag: Lookup;
  subcategory: SubcategoryLookup;
  /** The status a row with a blank Status column gets. */
  defaultStatusId: string | null;
}

/**
 * Loads every taxonomy once.
 *
 * Ten small queries at the start of an import, rather than a lookup per cell: a
 * five-hundred-row sheet with ten described fields would otherwise be five thousand
 * round trips.
 */
export async function importLookups(): Promise<ImportLookups> {
  const [
    statusRows,
    platformRows,
    genderRows,
    cityRows,
    urgencyRows,
    fabricRows,
    sizeRows,
    categoryRows,
    subcategoryRows,
    tagRows,
  ] = await Promise.all([
    db
      .select(nameFields(leadStatuses))
      .from(leadStatuses)
      .where(isNull(leadStatuses.deletedAt))
      // Ordered so that the first row is the first status in the funnel, which is what a
      // row with a blank Status column gets.
      .orderBy(leadStatuses.sortOrder),
    db.select(nameFields(platforms)).from(platforms).where(isNull(platforms.deletedAt)),
    db.select(nameFields(clothGenders)).from(clothGenders).where(isNull(clothGenders.deletedAt)),
    db.select(nameFields(cities)).from(cities).where(isNull(cities.deletedAt)),
    db.select(nameFields(urgencyLevels)).from(urgencyLevels).where(isNull(urgencyLevels.deletedAt)),
    db.select(nameFields(fabrics)).from(fabrics).where(isNull(fabrics.deletedAt)),
    db.select(nameFields(sizes)).from(sizes).where(isNull(sizes.deletedAt)),
    db.select(nameFields(categories)).from(categories).where(isNull(categories.deletedAt)),
    db
      .select({ ...nameFields(subcategories), categoryId: subcategories.categoryId })
      .from(subcategories)
      .where(isNull(subcategories.deletedAt)),
    db.select(nameFields(tags)).from(tags).where(isNull(tags.deletedAt)),
  ]);

  const categoryLookup = buildLookup('Categories', '/admin/taxonomy/categories', categoryRows);

  const byPair = new Map<string, string>();
  const byKey = new Map<string, string[]>();
  const categoryOf = new Map<string, string>();
  const categoryKeyOf = new Map<string, string[]>();

  for (const row of categoryRows) {
    const keys = [...new Set([matchKey(row.name), matchKey(row.slug)])].filter((key) => key !== '');
    categoryKeyOf.set(row.id, keys);
  }

  for (const row of subcategoryRows) {
    categoryOf.set(row.id, row.categoryId);

    for (const key of new Set([matchKey(row.name), matchKey(row.slug)])) {
      if (key === '') continue;

      const ids = byKey.get(key) ?? [];
      ids.push(row.id);
      byKey.set(key, ids);

      for (const categoryKey of categoryKeyOf.get(row.categoryId) ?? []) {
        const pair = `${categoryKey}\u0000${key}`;
        if (!byPair.has(pair)) byPair.set(pair, row.id);
      }
    }
  }

  return {
    status: buildLookup('Lead statuses', '/admin/taxonomy/lead-statuses', statusRows),
    platform: buildLookup('Platforms', '/admin/taxonomy/platforms', platformRows),
    gender: buildLookup('Cloth genders', '/admin/taxonomy/cloth-genders', genderRows),
    city: buildLookup('Cities', '/admin/taxonomy/cities', cityRows),
    urgency: buildLookup('Urgency levels', '/admin/taxonomy/urgency-levels', urgencyRows),
    fabric: buildLookup('Fabrics', '/admin/taxonomy/fabrics', fabricRows),
    size: buildLookup('Sizes', '/admin/taxonomy/sizes', sizeRows),
    category: categoryLookup,
    tag: buildLookup('Tags', '/admin/taxonomy/tags', tagRows),
    subcategory: {
      label: 'Sub-categories',
      href: '/admin/taxonomy/subcategories',
      byPair,
      byKey,
      categoryOf,
    },
    // Lowest sort order among the statuses, which is New Inquiry as seeded. Read from
    // the data rather than named here, so renaming the first status cannot break import.
    defaultStatusId: statusRows[0]?.id ?? null,
  };
}

/** Finds one value in a taxonomy, or nothing. */
export function findIn(lookup: Lookup, value: string): string | null {
  return lookup.byKey.get(matchKey(value)) ?? null;
}

export type SubcategoryMatch =
  { kind: 'found'; id: string; categoryId: string } | { kind: 'missing' } | { kind: 'ambiguous' };

/**
 * Finds a sub-category, using the category as a tie-break when the sheet gives one.
 *
 * A name that exists under two categories with no category named is `ambiguous`, not a
 * coin toss: "Batik Saree" filed under the wrong parent would put the enquiry in the
 * wrong column of the demand board for good.
 */
export function findSubcategory(
  lookup: SubcategoryLookup,
  value: string,
  categoryValue: string | null
): SubcategoryMatch {
  const key = matchKey(value);

  if (categoryValue !== null) {
    const id = lookup.byPair.get(`${matchKey(categoryValue)}\u0000${key}`);
    if (id !== undefined) {
      return { kind: 'found', id, categoryId: lookup.categoryOf.get(id)! };
    }
  }

  const ids = lookup.byKey.get(key);

  if (ids === undefined || ids.length === 0) return { kind: 'missing' };
  if (ids.length > 1) return { kind: 'ambiguous' };

  const id = ids[0]!;
  return { kind: 'found', id, categoryId: lookup.categoryOf.get(id)! };
}
