/**
 * Reads for the demand board.
 *
 * Server-only. Lives with the leads feature rather than under `features/analytics`,
 * because the SQL belongs to whoever owns the tables: when stock and spending arrive
 * they bring their own queries, and `features/analytics` stays what it is now - the
 * presentation layer that any domain can borrow.
 *
 * WHY EVERY FIGURE IS AGGREGATED IN POSTGRES
 * The alternative is fetching the leads and counting them in JavaScript, which works
 * for the fortnight when there are forty of them. A `count(*) ... group by` on an
 * indexed column stays flat as the table grows and moves kilobytes instead of
 * megabytes; the browser only ever receives the dozen numbers it draws.
 *
 * WHY BUSINESS TIME APPEARS IN THE SQL
 * `contacted_at` is stored as `timestamptz` in UTC. Grouping it by day without
 * converting first puts a 01:00 Doha message on the previous day, so every daily figure
 * is quietly wrong by however many messages arrive before 03:00. `at time zone` moves
 * the instant into Qatar's calendar before it is truncated.
 */
import { and, eq, gte, isNotNull, isNull, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import { db } from '@/db/client';
import { customerSummary } from '@/db/schema/customer-summary';
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
  tags,
  urgencyLevels,
} from '@/db/schema/taxonomy';
import { bucketsBetween, grainFor, type Grain } from '@/features/analytics/buckets';
import { rangeInstants, type DateRange } from '@/features/analytics/range';
import type { Slice } from '@/features/analytics/slice';
import { APP_TIMEZONE } from '@/lib/time';

/** A resolved window of instants, which is all any of these queries needs. */
interface Window {
  from: string | null;
  to: string;
}

/**
 * The clause shared by every query here: live leads, live customers, in the window.
 *
 * Excluding soft-deleted customers as well as soft-deleted leads matters more in a
 * report than in a list. A list shows a stray row and looks buggy; a chart folds it
 * into a bar and looks authoritative.
 */
function inWindow(window: Window): SQL {
  const clauses: SQLWrapper[] = [
    isNull(leads.deletedAt),
    isNull(customers.deletedAt),
    lte(leads.contactedAt, window.to),
  ];

  if (window.from !== null) clauses.push(gte(leads.contactedAt, window.from));

  // Non-null: the array always holds at least the three clauses above.
  return and(...clauses) as SQL;
}

/** The count of leads matching an extra condition, as a single scalar. */
const countWhere = (condition: SQL) => sql<number>`count(*) filter (where ${condition})::int`;

export interface DemandTotals {
  /** Enquiries recorded in the window. */
  enquiries: number;
  /** Distinct people who wrote in the window. */
  people: number;
  /** Enquiries at an urgency the business marked as ready to buy. */
  readyToBuy: number;
  /** Enquiries that reached a status marked as won. */
  won: number;
  /** Enquiries no longer needing attention - delivered, lost or cancelled. */
  closed: number;
  /** Pieces asked for, where anyone said. Null when nobody did. */
  pieces: number | null;
}

/**
 * The headline figures for one window.
 *
 * One query rather than six, using `filter (where ...)`: the six differ only in which
 * rows they count, so one pass over the same index answers all of them.
 */
export async function demandTotals(window: Window): Promise<DemandTotals> {
  const [row] = await db
    .select({
      enquiries: sql<number>`count(*)::int`,
      people: sql<number>`count(distinct ${leads.customerId})::int`,
      readyToBuy: countWhere(eq(urgencyLevels.isReadyToBuy, true)),
      won: countWhere(eq(leadStatuses.isWon, true)),
      closed: countWhere(eq(leadStatuses.isTerminal, true)),
      pieces: sql<number | null>`sum(${leads.quantity})::int`,
    })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .innerJoin(leadStatuses, eq(leadStatuses.id, leads.statusId))
    .leftJoin(urgencyLevels, eq(urgencyLevels.id, leads.urgencyId))
    .where(inWindow(window));

  return row ?? { enquiries: 0, people: 0, readyToBuy: 0, won: 0, closed: 0, pieces: null };
}

/**
 * How many of the people who wrote in the window were new to the business.
 *
 * Read from `customer_summary` rather than counted here, so "new" means the same thing
 * on this page as it does on the customers list: their first enquiry ever, not their
 * first in the window.
 */
export async function newCustomerCount(window: Window): Promise<number> {
  const clauses: SQLWrapper[] = [
    isNull(customers.deletedAt),
    lte(customerSummary.firstContactAt, window.to),
  ];

  if (window.from !== null) clauses.push(gte(customerSummary.firstContactAt, window.from));

  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(customerSummary)
    .innerJoin(customers, eq(customers.id, customerSummary.customerId))
    .where(and(...clauses));

  return row?.value ?? 0;
}

/* ------------------------------------------------------------------ over time */

export interface TimePoint {
  /** First day of the bucket, `YYYY-MM-DD`, business time. */
  bucket: string;
  value: number;
}

export interface TimeSeries {
  grain: Grain;
  points: TimePoint[];
}

/**
 * Enquiries over time, with empty buckets included.
 *
 * The zero-filling is the point. Postgres returns no row for a silent week, and a line
 * chart drawn from those rows connects the week before to the week after, which reads
 * as steady demand across a gap where there was none.
 */
export async function enquiriesOverTime(range: DateRange): Promise<TimeSeries> {
  const window = rangeInstants(range);
  const grain = grainFor(range.days);

  const bucket = sql<string>`to_char(date_trunc(${grain}, ${leads.contactedAt} at time zone ${APP_TIMEZONE}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({ bucket, value: sql<number>`count(*)::int` })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .where(inWindow(window))
    /*
     * By position, not by repeating the expression. Written out twice, the grain and the
     * timezone become a second pair of placeholders - `date_trunc($5, ... $6)` against
     * `date_trunc($1, ... $2)` - and Postgres compares placeholders by identity, so it
     * refuses the query as an ungrouped column. `group by 1` refers to the first output
     * column and cannot drift from it.
     */
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  const counted = new Map(rows.map((row) => [row.bucket, row.value]));

  // All time starts at the first enquiry there is; an empty database has no series.
  const first = range.from ?? rows[0]?.bucket ?? null;
  if (first === null) return { grain, points: [] };

  const points: TimePoint[] = [];

  for (const day of bucketsBetween(first, range.to, grain)) {
    points.push({ bucket: day, value: counted.get(day) ?? 0 });
  }

  return { grain, points };
}

/* ----------------------------------------------------------------- dimensions */

/**
 * A way of slicing leads: the taxonomy table, and how a lead reaches it.
 *
 * Written as data so adding "by size" is a table entry rather than another query. Each
 * dimension is the same shape of question - how many enquiries per value of X - and
 * writing it ten times is ten chances to forget the soft-delete clause.
 */
interface Dimension {
  table: PgTable;
  name: PgColumn;
  /** Design-token tone, where the taxonomy carries one. */
  tone?: PgColumn;
  /** The business's own ordering, for dimensions that have a natural sequence. */
  sortOrder?: PgColumn;
  /** How the lead joins to it. */
  on: SQL;
  /**
   * Label for leads that named no value.
   *
   * Omitted for the dimensions that are a buying list - sub-category, fabric - where a
   * tall "Not stated" bar crowds out the answer to the question being asked. Those
   * enquiries are then excluded from the chart, and the page says how many there were
   * rather than losing them silently.
   */
  unspecified?: string;
}

export const dimensions = {
  platform: {
    table: platforms,
    name: platforms.name,
    on: eq(platforms.id, leads.platformId),
  },
  status: {
    table: leadStatuses,
    name: leadStatuses.name,
    tone: leadStatuses.tone,
    sortOrder: leadStatuses.sortOrder,
    on: eq(leadStatuses.id, leads.statusId),
  },
  urgency: {
    table: urgencyLevels,
    name: urgencyLevels.name,
    tone: urgencyLevels.tone,
    sortOrder: urgencyLevels.sortOrder,
    on: eq(urgencyLevels.id, leads.urgencyId),
    unspecified: 'Not stated',
  },
  category: {
    table: categories,
    name: categories.name,
    on: eq(categories.id, leads.categoryId),
    unspecified: 'Not stated',
  },
  subcategory: {
    table: subcategories,
    name: subcategories.name,
    on: eq(subcategories.id, leads.subcategoryId),
  },
  fabric: {
    table: fabrics,
    name: fabrics.name,
    on: eq(fabrics.id, leads.fabricId),
  },
  gender: {
    table: clothGenders,
    name: clothGenders.name,
    on: eq(clothGenders.id, leads.clothGenderId),
    unspecified: 'Not stated',
  },
  size: {
    table: sizes,
    name: sizes.name,
    sortOrder: sizes.sortOrder,
    on: eq(sizes.id, leads.sizeId),
  },
  city: {
    table: cities,
    name: cities.name,
    on: eq(cities.id, customers.cityId),
    unspecified: 'Not stated',
  },
} as const satisfies Record<string, Dimension>;

export type DimensionKey = keyof typeof dimensions;

/**
 * Enquiries per value of one dimension.
 *
 * Rows the business ordered itself - statuses, urgency, sizes - come back in that
 * order; everything else comes back largest first, which is what a Top-N chart wants.
 * Unspecified values are counted under a label rather than dropped, because "half of
 * them never said which fabric" is a finding about the intake form.
 */
export async function countByDimension(key: DimensionKey, window: Window): Promise<Slice[]> {
  const dimension: Dimension = dimensions[key];

  // Wrapped in `sql` even when it is a plain column: the descriptors above are typed as
  // bare `PgColumn`, which carries no data type, so without this the rows come back
  // `unknown` and every caller needs a cast.
  const label =
    dimension.unspecified === undefined
      ? sql<string>`${dimension.name}`
      : sql<string>`coalesce(${dimension.name}, ${dimension.unspecified})`;

  const tone =
    dimension.tone === undefined
      ? sql<string | null>`null::text`
      : sql<string | null>`${dimension.tone}`;

  const value = sql<number>`count(*)::int`;

  const where =
    dimension.unspecified === undefined
      ? // The join is a left join, so an enquiry that named no value arrives here with a
        // null label. Without this it becomes a nameless bar.
        and(inWindow(window), isNotNull(dimension.name))
      : inWindow(window);

  const rows = await db
    .select({ label, tone, value })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .leftJoin(dimension.table, dimension.on)
    .where(where)
    /*
     * Grouped by output position rather than by repeating the expressions above. Each
     * embedding of a `sql` fragment mints fresh placeholders, so a `coalesce(name, $3)`
     * in the GROUP BY is not the same expression as `coalesce(name, $1)` in the SELECT as
     * far as Postgres is concerned, and it rejects the query.
     */
    .groupBy(sql`1, 2`)
    /*
     * `min(sort_order)` rather than grouping by it: the taxonomy's own order is a property
     * of the value, so taking the minimum within the group is exactly the value itself,
     * and it stays out of the grouping key where it would have no business being.
     */
    .orderBy(
      dimension.sortOrder === undefined
        ? sql`count(*) desc, 1 asc`
        : sql`min(${dimension.sortOrder}) asc`
    );

  return rows.map((row) => ({ label: row.label, tone: row.tone, value: row.value }));
}

/**
 * Enquiries per tag.
 *
 * Its own function because tags are many-to-many: a lead with three tags contributes to
 * three bars, so the counts deliberately sum to more than the number of enquiries.
 */
export async function countByTag(window: Window): Promise<Slice[]> {
  const value = sql<number>`count(*)::int`;

  const rows = await db
    .select({ label: tags.name, value })
    .from(leadTags)
    .innerJoin(leads, eq(leads.id, leadTags.leadId))
    .innerJoin(customers, eq(customers.id, leads.customerId))
    .innerJoin(tags, eq(tags.id, leadTags.tagId))
    .where(inWindow(window))
    .groupBy(tags.name)
    .orderBy(sql`${value} desc`);

  return rows.map((row) => ({ label: row.label, value: row.value, tone: null }));
}

/* -------------------------------------------------------------------- the board */

export interface DemandReport {
  totals: DemandTotals;
  previousTotals: DemandTotals | null;
  newCustomers: number;
  previousNewCustomers: number | null;
  overTime: TimeSeries;
  byPlatform: Slice[];
  byStatus: Slice[];
  byUrgency: Slice[];
  byCategory: Slice[];
  bySubcategory: Slice[];
  byFabric: Slice[];
  byGender: Slice[];
  bySize: Slice[];
  byCity: Slice[];
  byTag: Slice[];
}

/**
 * Everything the demand board draws, in one round of queries.
 *
 * Issued together rather than awaited one after another: they are independent, they hit
 * the same warm indexes, and serialising a dozen of them would make the page feel slow
 * for no reason. The comparison window is skipped for an all-time range, which has
 * nothing before it to compare against.
 */
export async function demandReport(range: DateRange): Promise<DemandReport> {
  const window = rangeInstants(range);

  const previousWindow =
    range.previous === null
      ? null
      : rangeInstants({ from: range.previous.from, to: range.previous.to });

  const [
    totals,
    previousTotals,
    newCustomers,
    previousNewCustomers,
    overTime,
    byPlatform,
    byStatus,
    byUrgency,
    byCategory,
    bySubcategory,
    byFabric,
    byGender,
    bySize,
    byCity,
    byTag,
  ] = await Promise.all([
    demandTotals(window),
    previousWindow === null ? null : demandTotals(previousWindow),
    newCustomerCount(window),
    previousWindow === null ? null : newCustomerCount(previousWindow),
    enquiriesOverTime(range),
    countByDimension('platform', window),
    countByDimension('status', window),
    countByDimension('urgency', window),
    countByDimension('category', window),
    countByDimension('subcategory', window),
    countByDimension('fabric', window),
    countByDimension('gender', window),
    countByDimension('size', window),
    countByDimension('city', window),
    countByTag(window),
  ]);

  return {
    totals,
    previousTotals,
    newCustomers,
    previousNewCustomers,
    overTime,
    byPlatform,
    byStatus,
    byUrgency,
    byCategory,
    bySubcategory,
    byFabric,
    byGender,
    bySize,
    byCity,
    byTag,
  };
}
