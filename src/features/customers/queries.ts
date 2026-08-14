/**
 * Reads for the customers pages.
 *
 * Server-only. Every read goes through the `customer_summary` view, which already
 * excludes soft-deleted customers and already counts only live leads - so a caller
 * cannot leak a removed customer by forgetting a condition, and the nine derived
 * figures the business asked for have exactly one definition.
 *
 * WHAT IS NOT IN HERE
 * The suggested action. The view supplies the facts; `./summary.ts` turns them into
 * "Hot lead" or "Follow up", in TypeScript, where the thresholds can be tested and
 * changed without a migration. This module's job is to hand those facts up.
 */
import { and, asc, desc, eq, ilike, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db/client';
import { customerSummary } from '@/db/schema/customer-summary';
import { customers } from '@/db/schema/customers';
import { leads } from '@/db/schema/leads';
import {
  categories,
  cities,
  fabrics,
  leadStatuses,
  platforms,
  sizes,
  subcategories,
  urgencyLevels,
} from '@/db/schema/taxonomy';
import { digitsOf } from '@/lib/phone';
import { calendarDaysAgo, endOfCalendarDay } from '@/lib/time';

import type { CustomerFilters, CustomerSort } from './filters';

/**
 * Aliases for the taxonomy tables this file reaches for a specific lead of a customer
 * rather than for the customer.
 *
 * `platforms` is joined as the first-touch channel, `lead_statuses` as the status of the
 * latest enquiry - both selected through the summary view rather than through a lead.
 * Aliasing them keeps those joins distinct from the ones in `listLeadsForCustomer`,
 * where the same tables mean something else.
 */
const firstPlatform = alias(platforms, 'first_platform');
const latestStatus = alias(leadStatuses, 'latest_status');
const latestUrgency = alias(urgencyLevels, 'latest_urgency');
const interestCategory = alias(categories, 'interest_category');
const interestSubcategory = alias(subcategories, 'interest_subcategory');

const customerColumns = {
  id: customers.id,
  name: customers.name,
  phone: customers.phone,
  whatsappNumber: customers.whatsappNumber,
  onWhatsapp: customers.onWhatsapp,
  notes: customers.notes,
  cityId: customers.cityId,
  cityName: cities.name,
  blockedAt: customers.blockedAt,
  blockedReason: customers.blockedReason,
  createdAt: customers.createdAt,
  updatedAt: customers.updatedAt,

  totalRequests: customerSummary.totalRequests,
  openRequests: customerSummary.openRequests,
  readyToBuyRequests: customerSummary.readyToBuyRequests,
  openReadyToBuyRequests: customerSummary.openReadyToBuyRequests,
  wonRequests: customerSummary.wonRequests,
  lostRequests: customerSummary.lostRequests,
  totalQuantity: customerSummary.totalQuantity,
  firstContactAt: customerSummary.firstContactAt,
  lastContactAt: customerSummary.lastContactAt,
  isRepeat: customerSummary.isRepeat,

  latestLeadReference: customerSummary.latestLeadReference,
  latestStatusName: latestStatus.name,
  latestStatusTone: latestStatus.tone,
  latestStatusIsWon: latestStatus.isWon,
  latestStatusIsTerminal: latestStatus.isTerminal,
  latestUrgencyName: latestUrgency.name,

  /** How we met them: the platform of their *first* enquiry, not their latest. */
  firstPlatformName: firstPlatform.name,

  /** The last product they named. A bare follow-up cannot blank this. */
  lastInterest: sql<string | null>`coalesce(${interestSubcategory.name}, ${interestCategory.name})`,
};

function customerQuery() {
  return db
    .select(customerColumns)
    .from(customerSummary)
    .innerJoin(customers, eq(customers.id, customerSummary.customerId))
    .leftJoin(cities, eq(cities.id, customers.cityId))
    .leftJoin(firstPlatform, eq(firstPlatform.id, customerSummary.firstPlatformId))
    .leftJoin(latestStatus, eq(latestStatus.id, customerSummary.latestStatusId))
    .leftJoin(latestUrgency, eq(latestUrgency.id, customerSummary.latestUrgencyId))
    .leftJoin(interestCategory, eq(interestCategory.id, customerSummary.lastInterestCategoryId))
    .leftJoin(
      interestSubcategory,
      eq(interestSubcategory.id, customerSummary.lastInterestSubcategoryId)
    );
}

export type CustomerRow = Awaited<ReturnType<typeof customerQuery>>[number];

function customerConditions(filters: CustomerFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [isNull(customers.deletedAt)];

  if (filters.q !== undefined) {
    const like = `%${filters.q}%`;
    // Numbers are stored in E.164 and typed however people type them. Matching on the
    // digits alone means "5512 3456", "+974 5512 3456" and "55123456" all find the
    // same customer, which is the only behaviour that survives contact with a paste
    // from WhatsApp.
    const digits = digitsOf(filters.q);

    conditions.push(
      or(
        ilike(customers.name, like),
        ilike(customers.phone, like),
        digits === '' ? undefined : ilike(customers.phone, `%${digits}%`)
      )
    );
  }

  if (filters.city !== undefined) conditions.push(eq(customers.cityId, filters.city));

  if (filters.platform !== undefined) {
    conditions.push(eq(customerSummary.firstPlatformId, filters.platform));
  }

  if (filters.status !== undefined) {
    conditions.push(eq(customerSummary.latestStatusId, filters.status));
  }

  if (filters.open) conditions.push(sql`${customerSummary.openRequests} > 0`);
  if (filters.ready) conditions.push(sql`${customerSummary.openReadyToBuyRequests} > 0`);
  if (filters.repeat) conditions.push(eq(customerSummary.isRepeat, true));

  /**
   * "Quiet for N days" as a date comparison.
   *
   * The cut-off is the end of the calendar day N days ago in business time, so the
   * filter agrees with the "days since" figure shown beside it rather than being three
   * hours out of step with it.
   */
  if (filters.quiet !== undefined) {
    const cutoff = endOfCalendarDay(calendarDaysAgo(filters.quiet));
    conditions.push(lte(customerSummary.lastContactAt, cutoff.toISOString()));
  }

  return and(...conditions);
}

/**
 * Ordering, with a tiebreaker.
 *
 * `nulls last` throughout: a customer entered by hand with no enquiry yet has no last
 * contact date, and Postgres would otherwise sort those nulls to the top of a
 * descending order - putting the least informative rows first.
 */
function customerOrder(sort: CustomerSort): SQL[] {
  const summary = customerSummary;

  switch (sort) {
    case 'oldest':
      return [sql`${summary.lastContactAt} asc nulls last`, asc(customers.id)] as SQL[];
    case 'requests':
      return [
        desc(summary.totalRequests),
        sql`${summary.lastContactAt} desc nulls last`,
        asc(customers.id),
      ] as SQL[];
    case 'ready':
      return [
        desc(summary.openReadyToBuyRequests),
        sql`${summary.lastContactAt} desc nulls last`,
        asc(customers.id),
      ] as SQL[];
    case 'first':
      return [sql`${summary.firstContactAt} desc nulls last`, asc(customers.id)] as SQL[];
    case 'name':
      // Nulls last again: unnamed customers belong at the end of an alphabetical list,
      // not at the front of it.
      return [sql`${customers.name} asc nulls last`, asc(customers.id)] as SQL[];
    case 'recent':
    default:
      return [sql`${summary.lastContactAt} desc nulls last`, asc(customers.id)] as SQL[];
  }
}

export interface CustomerPage {
  rows: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listCustomers(filters: CustomerFilters): Promise<CustomerPage> {
  const where = customerConditions(filters);
  const pageSize = filters.per;

  const [rows, total] = await Promise.all([
    customerQuery()
      .where(where)
      .orderBy(...customerOrder(filters.sort))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),

    countCustomers(filters),
  ]);

  return {
    rows,
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function countCustomers(filters: CustomerFilters): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(customerSummary)
    .innerJoin(customers, eq(customers.id, customerSummary.customerId))
    .where(customerConditions(filters));

  return row?.total ?? 0;
}

/** One customer with their derived figures, or null if there is no such live customer. */
export async function getCustomer(id: string): Promise<CustomerRow | null> {
  const [row] = await customerQuery()
    .where(and(eq(customers.id, id), isNull(customers.deletedAt)))
    .limit(1);

  return row ?? null;
}

export interface CustomerLeadRow {
  id: string;
  reference: number;
  contactedAt: string;
  quantity: number | null;
  request: string | null;
  platformName: string;
  statusName: string;
  statusTone: string | null;
  urgencyName: string | null;
  urgencyTone: string | null;
  interest: string | null;
  fabricName: string | null;
  sizeName: string | null;
}

/**
 * Every enquiry from one customer, newest first.
 *
 * The whole reason the phone number is the identity: this list is the conversation, and
 * reading it before replying is the difference between "do you have batik frocks" and
 * "the frock you asked about in March is in this shipment".
 *
 * Unpaginated on purpose. A customer with more than a few dozen enquiries would be
 * remarkable, and a pager over eight rows is worse than the rows.
 */
export async function listLeadsForCustomer(customerId: string): Promise<CustomerLeadRow[]> {
  return db
    .select({
      id: leads.id,
      reference: leads.reference,
      contactedAt: leads.contactedAt,
      quantity: leads.quantity,
      request: leads.request,
      platformName: platforms.name,
      statusName: leadStatuses.name,
      statusTone: leadStatuses.tone,
      urgencyName: urgencyLevels.name,
      urgencyTone: urgencyLevels.tone,
      interest: sql<string | null>`coalesce(${subcategories.name}, ${categories.name})`,
      fabricName: fabrics.name,
      sizeName: sizes.name,
    })
    .from(leads)
    .innerJoin(platforms, eq(platforms.id, leads.platformId))
    .innerJoin(leadStatuses, eq(leadStatuses.id, leads.statusId))
    .leftJoin(urgencyLevels, eq(urgencyLevels.id, leads.urgencyId))
    .leftJoin(subcategories, eq(subcategories.id, leads.subcategoryId))
    .leftJoin(categories, eq(categories.id, leads.categoryId))
    .leftJoin(fabrics, eq(fabrics.id, leads.fabricId))
    .leftJoin(sizes, eq(sizes.id, leads.sizeId))
    .where(and(eq(leads.customerId, customerId), isNull(leads.deletedAt)))
    .orderBy(desc(leads.contactedAt), desc(leads.id));
}

/** The taxonomy lists the customer filter bar offers. */
export interface CustomerFilterOptions {
  cities: { value: string; label: string }[];
  platforms: { value: string; label: string }[];
  statuses: { value: string; label: string }[];
}

export async function customerFilterOptions(): Promise<CustomerFilterOptions> {
  const [cityRows, platformRows, statusRows] = await Promise.all([
    db
      .select({ value: cities.id, label: cities.name })
      .from(cities)
      .where(and(isNull(cities.deletedAt), eq(cities.isActive, true)))
      .orderBy(asc(cities.sortOrder), asc(cities.name)),

    db
      .select({ value: platforms.id, label: platforms.name })
      .from(platforms)
      .where(and(isNull(platforms.deletedAt), eq(platforms.isActive, true)))
      .orderBy(asc(platforms.sortOrder), asc(platforms.name)),

    db
      .select({ value: leadStatuses.id, label: leadStatuses.name })
      .from(leadStatuses)
      .where(and(isNull(leadStatuses.deletedAt), eq(leadStatuses.isActive, true)))
      .orderBy(asc(leadStatuses.sortOrder), asc(leadStatuses.name)),
  ]);

  return { cities: cityRows, platforms: platformRows, statuses: statusRows };
}
