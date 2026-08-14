/**
 * Reads for the taxonomy pages.
 *
 * Server-only. Called from Server Components, never from an action that is about
 * to write - a write reads inside its own transaction.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { categories, subcategories, taxonomyTables, type TaxonomyKey } from '@/db/schema/taxonomy';

import { parentField, taxonomies } from './registry';

/** A row as the table renders it: the shared columns plus whatever extras exist. */
export interface TaxonomyListRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  /** The extra columns, if this taxonomy has any. Keyed by column name. */
  extras: Record<string, string | boolean | null>;
  /** For sub-categories: the name of the category they sit under. */
  parentName: string | null;
  parentId: string | null;
}

/**
 * Every row of one taxonomy, in the order the business set, archived rows last.
 *
 * Soft-deleted rows are excluded: `deletedAt` means "this was a mistake", and a
 * mistake should not be in a list at all. Retiring a value that was real is what
 * `isActive` is for, and those rows stay visible here so they can be brought back.
 */
export async function listTaxonomy(key: TaxonomyKey): Promise<TaxonomyListRow[]> {
  const table = taxonomyTables[key];
  const definition = taxonomies[key];
  const parent = parentField(key);

  if (parent) {
    const rows = await db
      .select({
        id: subcategories.id,
        name: subcategories.name,
        slug: subcategories.slug,
        description: subcategories.description,
        sortOrder: subcategories.sortOrder,
        isActive: subcategories.isActive,
        parentId: categories.id,
        parentName: categories.name,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(isNull(subcategories.deletedAt))
      .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name));

    return rows.map((row) => ({ ...row, extras: {} }));
  }

  const rows = await db
    .select()
    .from(table)
    .where(isNull(table.deletedAt))
    .orderBy(asc(table.sortOrder), asc(table.name));

  const extraColumns = definition.extras.map((extra) => extra.column);

  return rows.map((row) => {
    const record = row as unknown as Record<string, string | boolean | null>;

    return {
      id: String(record.id),
      name: String(record.name),
      slug: String(record.slug),
      description: (record.description as string | null) ?? null,
      sortOrder: Number(record.sortOrder),
      isActive: Boolean(record.isActive),
      extras: Object.fromEntries(extraColumns.map((column) => [column, record[column] ?? null])),
      parentName: null,
      parentId: null,
    };
  });
}

/** How many live rows each taxonomy holds, for the index page. */
export async function countTaxonomies(): Promise<Record<TaxonomyKey, number>> {
  const entries = Object.entries(taxonomyTables) as [
    TaxonomyKey,
    (typeof taxonomyTables)[TaxonomyKey],
  ][];

  const counts = await Promise.all(
    entries.map(async ([key, table]) => {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(table)
        .where(and(isNull(table.deletedAt), eq(table.isActive, true)));

      return [key, row?.total ?? 0] as const;
    })
  );

  return Object.fromEntries(counts) as Record<TaxonomyKey, number>;
}

/** The categories a sub-category can belong to, active ones only. */
export async function listCategoryOptions(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(and(isNull(categories.deletedAt), eq(categories.isActive, true)))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

/**
 * How many sub-categories hang off a category.
 *
 * Asked before a category is archived, so the page can say what the consequence
 * is rather than discovering it afterwards.
 */
export async function countChildren(categoryId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(subcategories)
    .where(and(eq(subcategories.categoryId, categoryId), isNull(subcategories.deletedAt)));

  return row?.total ?? 0;
}

/** The slugs already in use in a taxonomy, so a new name can avoid them. */
export async function existingSlugs(key: TaxonomyKey, categoryId?: string): Promise<string[]> {
  const table = taxonomyTables[key];

  if (key === 'subcategories' && categoryId !== undefined) {
    const rows = await db
      .select({ slug: subcategories.slug })
      .from(subcategories)
      .where(eq(subcategories.categoryId, categoryId));

    return rows.map((row) => row.slug);
  }

  const rows = await db.select({ slug: table.slug }).from(table);
  return rows.map((row) => row.slug);
}
