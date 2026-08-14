/**
 * The ten taxonomy tables: the vocabulary the business describes demand in.
 *
 * WHY TABLES AND NOT ENUMS
 * Every one of these lists will change. A new fabric arrives, a platform stops
 * being used, a sub-category turns out to be two. As a Postgres enum or a
 * TypeScript union, each change is a migration and a deploy; as rows, it is an
 * edit on a page, which is what was asked for. The cost is a join, on tables of
 * at most a few hundred rows.
 *
 * WHAT THEY ALL SHARE
 * `name` for people, `slug` for machines, `sortOrder` so the business decides
 * the order of a dropdown rather than the alphabet, `isActive` to retire a value
 * without rewriting history, and `deletedAt` because a lead recorded last month
 * must keep pointing at something.
 *
 * `isActive` and `deletedAt` are not the same thing:
 *   isActive false  - still real, no longer offered in pickers. "Imo", when
 *                     nobody uses Imo any more.
 *   deletedAt set   - a mistake, hidden everywhere including filters.
 *
 * DELETION
 * Nothing here is ever hard-deleted. That is what makes it safe for `leads` to
 * reference these rows with `on delete restrict`: the row a lead points at
 * cannot vanish underneath it, so no lead can lose its history.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { badgeTones, type BadgeTone } from '@/lib/theme/tones';

import { primaryId, softDelete, timestamps } from './columns';

/**
 * The columns every taxonomy table has.
 *
 * A function rather than a shared object: each `pgTable` needs its own column
 * builders, and handing the same ten instances to ten tables is the kind of
 * thing that works until it quietly does not.
 */
const taxonomyColumns = () => ({
  id: primaryId(),
  /** What people see and edit. */
  name: text('name').notNull(),
  /** The stable machine name. Generated from `name` once, then left alone. */
  slug: text('slug').notNull(),
  /** Optional sentence shown as a hint in pickers and on the taxonomy page. */
  description: text('description'),
  /** Ascending. Ties break on `name`. */
  sortOrder: integer('sort_order').notNull().default(0),
  /** Offered in pickers. A retired value stays readable everywhere else. */
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
  ...softDelete,
});

/** The three shared columns an index helper needs to see. */
type Sortable = { name: AnyPgColumn; slug: AnyPgColumn; sortOrder: AnyPgColumn };

/** The indexes every taxonomy table has: one value per slug, ordered listing. */
const taxonomyIndexes = (prefix: string, table: Sortable) => [
  uniqueIndex(`${prefix}_slug_key`).on(table.slug),
  index(`${prefix}_sort_idx`).on(table.sortOrder, table.name),
];

/** A `tone` column, constrained to the tones the Badge component can render. */
const toneColumn = () =>
  text('tone', { enum: badgeTones as unknown as [BadgeTone, ...BadgeTone[]] });

const toneCheck = (table: string) =>
  check(
    `${table}_tone_valid`,
    sql.raw(`"tone" in (${badgeTones.map((tone) => `'${tone}'`).join(', ')})`)
  );

/* -------------------------------------------------------------------------- */

/**
 * Where a lead has got to. The one taxonomy with real behaviour attached:
 * `isTerminal` marks the two ends of the funnel, which is what the conversion
 * rate is measured against, and `tone` decides the colour of the badge so that
 * choice is data rather than a switch statement that forgets a case.
 */
export const leadStatuses = pgTable(
  'lead_statuses',
  {
    ...taxonomyColumns(),
    tone: toneColumn().notNull().default('neutral'),
    /** Nothing further is expected to happen: Delivered, or Lost/Cancelled. */
    isTerminal: boolean('is_terminal').notNull().default(false),
    /** The terminal status that counts as a sale. Exactly one row should have it. */
    isWon: boolean('is_won').notNull().default(false),
  },
  (table) => [...taxonomyIndexes('lead_statuses', table), toneCheck('lead_statuses')]
);

/** Where the enquiry came from: Facebook, WhatsApp, a referral, the street. */
export const platforms = pgTable(
  'platforms',
  {
    ...taxonomyColumns(),
    /** Distinguishes a social channel from a referral or a walk-in in analytics. */
    isSocial: boolean('is_social').notNull().default(true),
  },
  (table) => taxonomyIndexes('platforms', table)
);

/** Who the garment is for. Not the customer's gender - the clothing's. */
export const clothGenders = pgTable('cloth_genders', taxonomyColumns(), (table) =>
  taxonomyIndexes('cloth_genders', table)
);

/**
 * Sizes, grouped so the picker is usable. Adult letters and children's age bands
 * are different scales and mixing them in one flat list invites mis-selection.
 */
export const sizeGroups = ['adult', 'kids', 'other'] as const;
export type SizeGroup = (typeof sizeGroups)[number];

export const sizes = pgTable(
  'sizes',
  {
    ...taxonomyColumns(),
    sizeGroup: text('size_group', { enum: sizeGroups as unknown as [SizeGroup, ...SizeGroup[]] })
      .notNull()
      .default('adult'),
  },
  (table) => [
    ...taxonomyIndexes('sizes', table),
    index('sizes_group_idx').on(table.sizeGroup, table.sortOrder),
    check(
      'sizes_size_group_valid',
      sql.raw(`"size_group" in (${sizeGroups.map((group) => `'${group}'`).join(', ')})`)
    ),
  ]
);

/** Qatar municipalities and the two districts customers actually name. */
export const cities = pgTable('cities', taxonomyColumns(), (table) =>
  taxonomyIndexes('cities', table)
);

/**
 * How close this person is to buying.
 *
 * `isReadyToBuy` exists so the "Ready to Buy requests" count on the customer
 * page is a boolean on a row rather than a string comparison in a query. Rename
 * the level tomorrow and the count keeps working.
 */
export const urgencyLevels = pgTable(
  'urgency_levels',
  {
    ...taxonomyColumns(),
    tone: toneColumn().notNull().default('neutral'),
    isReadyToBuy: boolean('is_ready_to_buy').notNull().default(false),
  },
  (table) => [...taxonomyIndexes('urgency_levels', table), toneCheck('urgency_levels')]
);

/** Fabric or material. The heart of the business: this is what people ask for. */
export const fabrics = pgTable('fabrics', taxonomyColumns(), (table) =>
  taxonomyIndexes('fabrics', table)
);

/** Top-level product grouping. */
export const categories = pgTable('categories', taxonomyColumns(), (table) =>
  taxonomyIndexes('categories', table)
);

/**
 * Sub-category, under exactly one category.
 *
 * The slug is unique per category rather than globally, and deliberately so: the
 * business's own list has "Batik Saree" under both Batik Wear and Sarees & Osari,
 * because Batik Wear is a craft while Sarees & Osari is a garment type. Both rows
 * are real and both are wanted.
 *
 * `on delete restrict` on the parent: a category with sub-categories under it
 * cannot be removed, and since categories are only ever soft-deleted, the
 * restriction never actually fires. It is there to make a hard delete from a SQL
 * console fail loudly instead of orphaning rows.
 */
export const subcategories = pgTable(
  'subcategories',
  {
    ...taxonomyColumns(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
  },
  (table) => [
    uniqueIndex('subcategories_category_slug_key').on(table.categoryId, table.slug),
    index('subcategories_category_idx').on(table.categoryId),
    index('subcategories_sort_idx').on(table.sortOrder, table.name),
  ]
);

/**
 * Free-form descriptors on a lead: pattern, cut, neckline, occasion, provenance.
 *
 * `tagGroup` is what makes 122 tags usable. One flat dropdown of that length is
 * a scroll bar; eight labelled groups is a menu. The groups match the order the
 * business's own list was written in, which is not a coincidence - that ordering
 * is how they already think about the vocabulary.
 */
export const tagGroups = [
  'print',
  'silhouette',
  'length',
  'neckline',
  'sleeve',
  'occasion',
  'details',
  'origin',
] as const;
export type TagGroup = (typeof tagGroups)[number];

export const tagGroupLabels: Record<TagGroup, string> = {
  print: 'Print & Craft',
  silhouette: 'Silhouette & Fit',
  length: 'Length',
  neckline: 'Neckline',
  sleeve: 'Sleeve',
  occasion: 'Occasion',
  details: 'Details & Features',
  origin: 'Origin & Sizing',
};

export const tags = pgTable(
  'tags',
  {
    ...taxonomyColumns(),
    tagGroup: text('tag_group', { enum: tagGroups as unknown as [TagGroup, ...TagGroup[]] })
      .notNull()
      .default('details'),
  },
  (table) => [
    ...taxonomyIndexes('tags', table),
    index('tags_group_idx').on(table.tagGroup, table.sortOrder),
    check(
      'tags_tag_group_valid',
      sql.raw(`"tag_group" in (${tagGroups.map((group) => `'${group}'`).join(', ')})`)
    ),
  ]
);

/* -------------------------------------------------------------------------- */

/**
 * Every taxonomy table, keyed by the slug that appears in its URL.
 *
 * This is what lets one page, one set of Server Actions and one form serve all
 * ten lists instead of ten near-identical copies. See
 * `src/features/taxonomy/registry.ts` for the labels and extra fields.
 */
export const taxonomyTables = {
  'lead-statuses': leadStatuses,
  platforms,
  'cloth-genders': clothGenders,
  sizes,
  cities,
  'urgency-levels': urgencyLevels,
  fabrics,
  categories,
  subcategories,
  tags,
} as const;

export type TaxonomyKey = keyof typeof taxonomyTables;

export const taxonomyKeys = Object.keys(taxonomyTables) as TaxonomyKey[];

export function isTaxonomyKey(value: unknown): value is TaxonomyKey {
  return typeof value === 'string' && value in taxonomyTables;
}

/** The columns shared by every taxonomy row, as a type. */
export interface TaxonomyRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
