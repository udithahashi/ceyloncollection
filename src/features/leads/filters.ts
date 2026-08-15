/**
 * The lead list's filters, as data.
 *
 * WHY THE URL IS THE STATE
 * Every filter lives in the query string, and this module is the only thing that
 * knows how to read or write it. That has consequences worth being deliberate about:
 * a filtered list can be bookmarked, sent to a colleague, and reloaded without
 * losing its place; the back button does what it looks like it does; and the server
 * can render the correct page on the first request, with no loading spinner and no
 * client-side fetch.
 *
 * The alternative - filter state in React - would mean the first paint is always the
 * unfiltered list, and "send me that view" becomes a screenshot.
 *
 * WHY THE PARSING IS FORGIVING
 * A query string is user input arriving from a bookmark that may be months old, a
 * hand-edited URL, or a link written before a filter was renamed. Nothing here
 * throws: an unrecognised value is dropped and the rest of the filters still work.
 * A 400 page because a stale bookmark mentions a deleted status would be absurd.
 */
import { z } from 'zod';

/** How many rows a page may show. Anything else in the URL falls back to the default. */
export const pageSizes = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

/**
 * The orderings offered, and the label for each.
 *
 * A closed set rather than a column name from the URL: `sort=` naming a real column
 * would let anyone order by a column the list does not show, and would make the
 * query builder responsible for validating SQL identifiers. This way an unknown
 * value is simply the default order.
 */
export const leadSorts = {
  recent: 'Newest contact first',
  oldest: 'Oldest contact first',
  updated: 'Recently changed',
  stale: 'Longest without a status change',
  quantity: 'Largest quantity first',
} as const;

export type LeadSort = keyof typeof leadSorts;

export const DEFAULT_SORT: LeadSort = 'recent';

/** A uuid, or nothing. Used for every taxonomy filter. */
const id = z
  .string()
  .uuid()
  .optional()
  .catch(undefined)
  .transform((value) => value ?? undefined);

/** `YYYY-MM-DD` from a date input, or nothing. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)
  .transform((value) => value ?? undefined);

/** Present and not "0" or "false" means on. Absent means off. */
const flag = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => value !== undefined && value !== '' && value !== '0' && value !== 'false');

export const leadFilterSchema = z.object({
  /** Free text over the customer's name and number, the request, and the notes. */
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .catch(undefined)
    .transform((value) => (value === '' ? undefined : value)),

  status: id,
  platform: id,
  category: id,
  subcategory: id,
  gender: id,
  fabric: id,
  size: id,
  urgency: id,
  city: id,
  tag: id,
  customer: id,

  /** Only enquiries at a status the business has not marked as terminal. */
  open: flag,
  /** Only enquiries at a ready-to-buy urgency. The list worth working first. */
  ready: flag,

  /** Contact date range, inclusive, in business time. */
  from: day,
  to: day,

  sort: z
    .enum(Object.keys(leadSorts) as [LeadSort, ...LeadSort[]])
    .optional()
    .catch(undefined)
    .transform((value) => value ?? DEFAULT_SORT),

  page: z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .optional()
    .catch(undefined)
    .transform((value) => value ?? 1),

  /**
   * Rows per page. Called `per` rather than `size` because `size` is already a
   * filter - the garment size - and one name cannot mean both.
   */
  per: z
    .union([z.literal('25'), z.literal('50'), z.literal('100')])
    .optional()
    .catch(undefined)
    .transform((value) => (value === undefined ? DEFAULT_PAGE_SIZE : Number(value))),
});

export type LeadFilters = z.output<typeof leadFilterSchema>;

/**
 * The raw shape Next hands a page. A repeated parameter arrives as an array; the
 * first occurrence wins, since none of these filters is multi-valued.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseLeadFilters(raw: RawSearchParams): LeadFilters {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );

  // `catch` on every field means this cannot fail, but parse rather than safeParse
  // would still throw on a shape error, so the result is read defensively.
  const parsed = leadFilterSchema.safeParse(flat);

  return parsed.success ? parsed.data : leadFilterSchema.parse({});
}

/** Filters that are not the sort order or the page: what "clear filters" clears. */
const NARROWING_KEYS = [
  'q',
  'status',
  'platform',
  'category',
  'subcategory',
  'gender',
  'fabric',
  'size',
  'urgency',
  'city',
  'tag',
  'customer',
  'open',
  'ready',
  'from',
  'to',
] as const satisfies readonly (keyof LeadFilters)[];

/** How many filters are narrowing the list, for the "3 filters active" hint. */
export function activeFilterCount(filters: LeadFilters): number {
  return NARROWING_KEYS.filter((key) => {
    const value = filters[key];
    return value !== undefined && value !== false;
  }).length;
}

export function hasActiveFilters(filters: LeadFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/**
 * Filters back to a query string, dropping anything at its default.
 *
 * Keeping defaults out matters more than it looks: it is what makes the URL of the
 * plain list `/admin/leads` rather than `/admin/leads?sort=recent&page=1&size=25`, and it is
 * what makes two links to the same view compare equal.
 */
export function toSearchParams(
  filters: Partial<LeadFilters>,
  overrides: Partial<Record<keyof LeadFilters, string | number | boolean | undefined>> = {}
): string {
  const merged: Record<string, string | number | boolean | undefined> = {
    ...filters,
    ...overrides,
  };

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '' || value === false) continue;
    if (key === 'sort' && value === DEFAULT_SORT) continue;
    if (key === 'page' && Number(value) === 1) continue;
    if (key === 'per' && Number(value) === DEFAULT_PAGE_SIZE) continue;

    params.set(key, value === true ? '1' : String(value));
  }

  params.sort();
  const query = params.toString();

  return query === '' ? '' : `?${query}`;
}

/**
 * A link to the same list with one filter changed, back on page one.
 *
 * Resetting the page is the whole reason this exists as a helper. Changing a filter
 * while staying on page 7 usually lands on an empty page, and an empty page reads as
 * "no results" rather than "wrong page".
 */
export function filterLink(
  base: string,
  filters: LeadFilters,
  changes: Partial<Record<keyof LeadFilters, string | number | boolean | undefined>>
): string {
  return `${base}${toSearchParams(filters, { ...changes, page: 1 })}`;
}
