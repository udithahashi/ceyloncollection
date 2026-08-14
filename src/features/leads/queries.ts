/**
 * Reads for the leads pages.
 *
 * Server-only. Every query here filters `deleted_at is null` on the lead and on its
 * customer, because a soft-deleted row that turns up in a list is worse than no soft
 * delete at all: it looks like a bug and it inflates every count on the page.
 *
 * WHY THE FILTERING, SORTING AND PAGING ALL HAPPEN IN POSTGRES
 * The obvious alternative is a client-side table component that receives the rows and
 * does the work in the browser. That is a good pattern for a hundred rows and a bad
 * one here: the whole purpose of this system is to accumulate thousands of enquiries,
 * and shipping all of them to a phone in order to show twenty-five is slowest in
 * exactly the situation the business is working towards. Postgres has the indexes for
 * every filter and sort offered; it should do the work.
 */
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { SelectedFields } from 'drizzle-orm/pg-core';

import { db } from '@/db/client';
import { appUser } from '@/db/schema/auth';
import { customers } from '@/db/schema/customers';
import { leads, leadTags } from '@/db/schema/leads';
import {
  categories,
  cities,
  clothGenders,
  fabrics,
  leadStatuses,
  platforms,
  sizes,
  subcategories,
  tagGroupLabels,
  tags,
  urgencyLevels,
} from '@/db/schema/taxonomy';
import { endOfCalendarDay, startOfCalendarDay } from '@/lib/time';

import type { LeadFilters, LeadSort } from './filters';

/** Every column a lead read needs, with each reference resolved to a name. */
const leadColumns = {
  id: leads.id,
  reference: leads.reference,
  contactedAt: leads.contactedAt,
  statusChangedAt: leads.statusChangedAt,
  quantity: leads.quantity,
  request: leads.request,
  notes: leads.notes,
  source: leads.source,

  customerId: customers.id,
  customerName: customers.name,
  customerPhone: customers.phone,
  cityName: cities.name,

  statusId: leads.statusId,
  statusName: leadStatuses.name,
  statusTone: leadStatuses.tone,
  statusIsTerminal: leadStatuses.isTerminal,
  statusIsWon: leadStatuses.isWon,

  platformId: leads.platformId,
  platformName: platforms.name,
  categoryId: leads.categoryId,
  categoryName: categories.name,
  subcategoryId: leads.subcategoryId,
  subcategoryName: subcategories.name,
  clothGenderId: leads.clothGenderId,
  genderName: clothGenders.name,
  fabricId: leads.fabricId,
  fabricName: fabrics.name,
  sizeId: leads.sizeId,
  sizeName: sizes.name,
  urgencyId: leads.urgencyId,
  urgencyName: urgencyLevels.name,
  urgencyTone: urgencyLevels.tone,
  urgencyIsReadyToBuy: urgencyLevels.isReadyToBuy,

  /**
   * How many enquiries this customer has in total, so a repeat can be marked in the
   * row without a second query per page.
   *
   * A correlated subquery rather than a join and a group-by: it keeps the row shape
   * flat, and on the `leads (customer_id, contacted_at)` index it is a cheap scan
   * over a handful of rows.
   */
  customerRequestCount: sql<number>`(
    select count(*)::int from ${leads} sibling
    where sibling.customer_id = ${customers.id} and sibling.deleted_at is null
  )`,

  customerNotes: customers.notes,
  customerCityId: customers.cityId,
  customerOnWhatsapp: customers.onWhatsapp,
  customerWhatsappNumber: customers.whatsappNumber,
  createdAt: leads.createdAt,
  updatedAt: leads.updatedAt,
  createdByName: appUser.name,
} satisfies SelectedFields;

/**
 * The joins every lead read needs, applied once.
 *
 * One fixed selection rather than a selection passed in: a generic here reads better
 * but Drizzle's builder types cannot resolve a deferred selection far enough to keep
 * offering `.innerJoin`, and the workarounds all end in casts. The cost of the fixed
 * shape is that the list page fetches four columns it does not display, which is
 * nothing next to eleven joins written out twice.
 */
function leadQuery() {
  return db
    .select(leadColumns)
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .innerJoin(leadStatuses, eq(leadStatuses.id, leads.statusId))
    .innerJoin(platforms, eq(platforms.id, leads.platformId))
    .leftJoin(cities, eq(cities.id, customers.cityId))
    .leftJoin(categories, eq(categories.id, leads.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, leads.subcategoryId))
    .leftJoin(clothGenders, eq(clothGenders.id, leads.clothGenderId))
    .leftJoin(fabrics, eq(fabrics.id, leads.fabricId))
    .leftJoin(sizes, eq(sizes.id, leads.sizeId))
    .leftJoin(urgencyLevels, eq(urgencyLevels.id, leads.urgencyId))
    .leftJoin(appUser, eq(appUser.id, leads.createdById));
}

export type LeadListRow = Awaited<ReturnType<typeof leadQuery>>[number];

/**
 * Every filter, as one SQL condition.
 *
 * A list of optional conditions, so an absent filter contributes nothing at all - no
 * `or true`, no string building, and every value bound as a parameter.
 */
function leadConditions(filters: LeadFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    isNull(leads.deletedAt),
    // A soft-deleted customer takes their enquiries out of the list with them.
    isNull(customers.deletedAt),
  ];

  if (filters.q !== undefined) {
    const like = `%${filters.q}%`;
    const asReference = Number.parseInt(filters.q.replace(/^#/, ''), 10);

    conditions.push(
      or(
        ilike(customers.name, like),
        ilike(customers.phone, like),
        ilike(leads.request, like),
        ilike(leads.notes, like),
        // Typing "148" should find lead 148, which is how people will refer to them.
        Number.isNaN(asReference) ? undefined : eq(leads.reference, asReference)
      )
    );
  }

  if (filters.status !== undefined) conditions.push(eq(leads.statusId, filters.status));
  if (filters.platform !== undefined) conditions.push(eq(leads.platformId, filters.platform));
  if (filters.category !== undefined) conditions.push(eq(leads.categoryId, filters.category));
  if (filters.subcategory !== undefined)
    conditions.push(eq(leads.subcategoryId, filters.subcategory));
  if (filters.gender !== undefined) conditions.push(eq(leads.clothGenderId, filters.gender));
  if (filters.fabric !== undefined) conditions.push(eq(leads.fabricId, filters.fabric));
  if (filters.size !== undefined) conditions.push(eq(leads.sizeId, filters.size));
  if (filters.urgency !== undefined) conditions.push(eq(leads.urgencyId, filters.urgency));
  if (filters.city !== undefined) conditions.push(eq(customers.cityId, filters.city));
  if (filters.customer !== undefined) conditions.push(eq(leads.customerId, filters.customer));

  if (filters.open) conditions.push(eq(leadStatuses.isTerminal, false));
  if (filters.ready) conditions.push(eq(urgencyLevels.isReadyToBuy, true));

  /**
   * `exists` rather than a join on `lead_tags`: a join would multiply the row when a
   * lead carries several tags, and the usual fix for that - `distinct` - breaks both
   * the ordering and the count.
   */
  if (filters.tag !== undefined) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(leadTags)
          .where(and(eq(leadTags.leadId, leads.id), eq(leadTags.tagId, filters.tag)))
      )
    );
  }

  /**
   * Dates arrive from a date input as a business-time calendar day and are widened to
   * that day's real instants. Comparing a `timestamptz` against a bare date would use
   * UTC midnight and quietly drop three hours off every Qatari day.
   */
  if (filters.from !== undefined) {
    conditions.push(gte(leads.contactedAt, startOfCalendarDay(filters.from).toISOString()));
  }

  if (filters.to !== undefined) {
    conditions.push(lte(leads.contactedAt, endOfCalendarDay(filters.to).toISOString()));
  }

  return and(...conditions);
}

/**
 * Ordering, with a tiebreaker on every option.
 *
 * The tiebreaker is not decoration. Paging through rows ordered by a column full of
 * duplicates - and a spreadsheet import gives hundreds of leads the same contact date
 * - can show one lead on two pages and skip another entirely. Ending on `id` makes
 * every order total.
 */
function leadOrder(sort: LeadSort): SQL[] {
  switch (sort) {
    case 'oldest':
      return [asc(leads.contactedAt), asc(leads.id)] as SQL[];
    case 'updated':
      return [desc(leads.updatedAt), desc(leads.id)] as SQL[];
    case 'stale':
      return [asc(leads.statusChangedAt), asc(leads.id)] as SQL[];
    case 'quantity':
      return [
        sql`${leads.quantity} desc nulls last`,
        desc(leads.contactedAt),
        desc(leads.id),
      ] as SQL[];
    case 'recent':
    default:
      return [desc(leads.contactedAt), desc(leads.id)] as SQL[];
  }
}

export interface LeadPage {
  rows: LeadListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** One page of the leads list, plus the total so the pager knows where it ends. */
export async function listLeads(filters: LeadFilters): Promise<LeadPage> {
  const where = leadConditions(filters);
  const pageSize = filters.per;

  const [rows, total] = await Promise.all([
    leadQuery()
      .where(where)
      .orderBy(...leadOrder(filters.sort))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),

    countLeads(filters),
  ]);

  return {
    rows,
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * How many leads match, ignoring the page.
 *
 * Joins exactly the three tables the filters reach into - the customer for its city
 * and its own soft delete, the status for "open", the urgency for "ready to buy" -
 * and no more. Counting `leads` alone would give a different answer to the one on
 * screen; counting over all eleven joins would do needless work on every page load.
 */
export async function countLeads(filters: LeadFilters): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .innerJoin(leadStatuses, eq(leadStatuses.id, leads.statusId))
    .leftJoin(urgencyLevels, eq(urgencyLevels.id, leads.urgencyId))
    .where(leadConditions(filters));

  return row?.total ?? 0;
}

export interface LeadTag {
  id: string;
  name: string;
  group: string;
}

export type LeadDetail = LeadListRow & { tags: LeadTag[] };

/** One lead by its quotable reference number, with everything its page shows. */
export async function getLeadByReference(reference: number): Promise<LeadDetail | null> {
  const [row] = await leadQuery()
    .where(
      and(eq(leads.reference, reference), isNull(leads.deletedAt), isNull(customers.deletedAt))
    )
    .limit(1);

  if (!row) return null;

  return { ...row, tags: await listTagsFor(row.id) };
}

/** One line per other enquiry from the same customer, for the history panel. */
export interface LeadHistoryRow {
  id: string;
  reference: number;
  contactedAt: string;
  statusName: string;
  statusTone: string | null;
  interest: string | null;
}

/**
 * A customer's other enquiries, newest first.
 *
 * The point of the whole system in one query: the fourth time a number appears, the
 * three earlier conversations should be on screen before you reply to the fourth.
 * Excludes the lead being viewed, since it is already the page.
 */
export async function listCustomerHistory(
  customerId: string,
  exceptLeadId: string,
  limit = 20
): Promise<LeadHistoryRow[]> {
  return db
    .select({
      id: leads.id,
      reference: leads.reference,
      contactedAt: leads.contactedAt,
      statusName: leadStatuses.name,
      statusTone: leadStatuses.tone,
      interest: sql<string | null>`coalesce(${subcategories.name}, ${categories.name})`,
    })
    .from(leads)
    .innerJoin(leadStatuses, eq(leadStatuses.id, leads.statusId))
    .leftJoin(subcategories, eq(subcategories.id, leads.subcategoryId))
    .leftJoin(categories, eq(categories.id, leads.categoryId))
    .where(
      and(
        eq(leads.customerId, customerId),
        sql`${leads.id} <> ${exceptLeadId}`,
        isNull(leads.deletedAt)
      )
    )
    .orderBy(desc(leads.contactedAt), desc(leads.id))
    .limit(limit);
}

/** The tags on one lead, in the taxonomy's own order. */
export async function listTagsFor(leadId: string): Promise<LeadTag[]> {
  const rows = await db
    .select({ id: tags.id, name: tags.name, group: tags.tagGroup })
    .from(leadTags)
    .innerJoin(tags, eq(tags.id, leadTags.tagId))
    .where(eq(leadTags.leadId, leadId))
    .orderBy(asc(tags.tagGroup), asc(tags.sortOrder), asc(tags.name));

  return rows.map((row) => ({ ...row, group: tagGroupLabels[row.group] }));
}

/* -------------------------------------------------------------------------- */

export interface Option {
  value: string;
  label: string;
  hint?: string;
  group?: string;
}

export interface LeadFormOptions {
  statuses: (Option & { isTerminal: boolean })[];
  platforms: Option[];
  categories: Option[];
  subcategories: (Option & { categoryId: string })[];
  genders: Option[];
  fabrics: Option[];
  sizes: Option[];
  urgencies: Option[];
  cities: Option[];
  tags: Option[];
}

/** Group headings for the size picker: the stored value is a machine word. */
const sizeGroupHeadings: Record<string, string> = {
  adult: 'Adult',
  kids: 'Kids',
  other: 'Other',
};

/**
 * Everything the pickers need, in one round trip.
 *
 * Ten small queries in parallel rather than one wide join, because they are
 * independent and the alternative is a cross product of ten lists.
 *
 * Retired values are excluded, which is the entire point of `isActive`: a platform
 * nobody uses any more should not be offered on a new enquiry, while staying readable
 * on the old ones that came through it.
 */
export async function leadFormOptions(): Promise<LeadFormOptions> {
  const [
    statuses,
    platformRows,
    categoryRows,
    subcategoryRows,
    genderRows,
    fabricRows,
    sizeRows,
    urgencyRows,
    cityRows,
    tagRows,
  ] = await Promise.all([
    db
      .select({
        value: leadStatuses.id,
        label: leadStatuses.name,
        isTerminal: leadStatuses.isTerminal,
      })
      .from(leadStatuses)
      .where(and(isNull(leadStatuses.deletedAt), eq(leadStatuses.isActive, true)))
      .orderBy(asc(leadStatuses.sortOrder), asc(leadStatuses.name)),

    db
      .select({ value: platforms.id, label: platforms.name })
      .from(platforms)
      .where(and(isNull(platforms.deletedAt), eq(platforms.isActive, true)))
      .orderBy(asc(platforms.sortOrder), asc(platforms.name)),

    db
      .select({ value: categories.id, label: categories.name })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(categories.name)),

    // Grouped by category, so 165 sub-categories read as a menu rather than a list.
    // `categoryId` travels with each option so the form can narrow the choice once a
    // category is picked, and so the action can derive the category from the product.
    db
      .select({
        value: subcategories.id,
        label: subcategories.name,
        group: categories.name,
        categoryId: subcategories.categoryId,
      })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId))
      .where(and(isNull(subcategories.deletedAt), eq(subcategories.isActive, true)))
      .orderBy(asc(categories.sortOrder), asc(subcategories.sortOrder), asc(subcategories.name)),

    db
      .select({ value: clothGenders.id, label: clothGenders.name })
      .from(clothGenders)
      .where(and(isNull(clothGenders.deletedAt), eq(clothGenders.isActive, true)))
      .orderBy(asc(clothGenders.sortOrder), asc(clothGenders.name)),

    db
      .select({ value: fabrics.id, label: fabrics.name })
      .from(fabrics)
      .where(and(isNull(fabrics.deletedAt), eq(fabrics.isActive, true)))
      .orderBy(asc(fabrics.sortOrder), asc(fabrics.name)),

    db
      .select({ value: sizes.id, label: sizes.name, group: sizes.sizeGroup })
      .from(sizes)
      .where(and(isNull(sizes.deletedAt), eq(sizes.isActive, true)))
      .orderBy(asc(sizes.sizeGroup), asc(sizes.sortOrder), asc(sizes.name)),

    db
      .select({ value: urgencyLevels.id, label: urgencyLevels.name })
      .from(urgencyLevels)
      .where(and(isNull(urgencyLevels.deletedAt), eq(urgencyLevels.isActive, true)))
      .orderBy(asc(urgencyLevels.sortOrder), asc(urgencyLevels.name)),

    db
      .select({ value: cities.id, label: cities.name })
      .from(cities)
      .where(and(isNull(cities.deletedAt), eq(cities.isActive, true)))
      .orderBy(asc(cities.sortOrder), asc(cities.name)),

    db
      .select({ value: tags.id, label: tags.name, group: tags.tagGroup })
      .from(tags)
      .where(and(isNull(tags.deletedAt), eq(tags.isActive, true)))
      .orderBy(asc(tags.tagGroup), asc(tags.sortOrder), asc(tags.name)),
  ]);

  return {
    statuses,
    platforms: platformRows,
    categories: categoryRows,
    subcategories: subcategoryRows,
    genders: genderRows,
    fabrics: fabricRows,
    sizes: sizeRows.map((row) => ({ ...row, group: sizeGroupHeadings[row.group] ?? row.group })),
    urgencies: urgencyRows,
    cities: cityRows,
    tags: tagRows.map((row) => ({ ...row, group: tagGroupLabels[row.group] })),
  };
}

/**
 * The status a new lead starts at: the first non-terminal one in the business's own
 * order, which is "New Inquiry" until they reorder the list.
 *
 * Looked up rather than hardcoded, so renaming or reordering the statuses cannot
 * leave the form pointing at something that makes no sense as an opening position.
 */
export async function defaultStatusId(): Promise<string | null> {
  const [row] = await db
    .select({ id: leadStatuses.id })
    .from(leadStatuses)
    .where(
      and(
        isNull(leadStatuses.deletedAt),
        eq(leadStatuses.isActive, true),
        eq(leadStatuses.isTerminal, false)
      )
    )
    .orderBy(asc(leadStatuses.sortOrder), asc(leadStatuses.name))
    .limit(1);

  return row?.id ?? null;
}
