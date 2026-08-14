/**
 * The customer list's filters, as data.
 *
 * The same shape and the same reasoning as the lead filters: the URL is the state, the
 * parsing never throws, and defaults stay out of the query string. See
 * `src/features/leads/filters.ts` for why.
 *
 * WHY THERE IS NO "ACTION" FILTER
 * The list shows a suggested action - Hot lead, Follow up, Dormant - and it is tempting
 * to filter on it. But that label is computed in TypeScript from today's date and a
 * pair of thresholds, so filtering on it would mean either fetching every customer and
 * filtering in memory, which breaks paging, or re-implementing the policy in SQL, which
 * means two copies of it that will disagree.
 *
 * Instead the filters here are the facts the label is made of: still open, saying they
 * are ready to buy, quiet for N days. Each one is an index-friendly condition, and
 * together they reach every list the label would have produced.
 */
import { z } from 'zod';

export const pageSizes = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export const customerSorts = {
  recent: 'Most recent contact',
  oldest: 'Longest since contact',
  requests: 'Most enquiries',
  ready: 'Most ready-to-buy enquiries',
  first: 'Newest customer',
  name: 'Name, A to Z',
} as const;

export type CustomerSort = keyof typeof customerSorts;

export const DEFAULT_SORT: CustomerSort = 'recent';

const id = z
  .string()
  .uuid()
  .optional()
  .catch(undefined)
  .transform((value) => value ?? undefined);

const flag = z
  .string()
  .optional()
  .catch(undefined)
  .transform((value) => value !== undefined && value !== '' && value !== '0' && value !== 'false');

export const customerFilterSchema = z.object({
  /** Name or number. A number is matched loosely, so "5512" finds +97455123456. */
  q: z
    .string()
    .trim()
    .max(120)
    .optional()
    .catch(undefined)
    .transform((value) => (value === '' ? undefined : value)),

  city: id,
  /** The platform of their first enquiry: which channel brought them in. */
  platform: id,
  /** The status of their most recent enquiry. */
  status: id,

  /** At least one enquiry not at a terminal status. */
  open: flag,
  /** At least one open enquiry at a ready-to-buy urgency. Today's call list. */
  ready: flag,
  /** More than one enquiry: they came back. */
  repeat: flag,

  /**
   * Silent for at least this many days, counted from their last contact.
   *
   * A number rather than a "dormant" flag, so the follow-up threshold can be explored
   * without the policy in `summary.ts` having to change.
   */
  quiet: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .catch(undefined)
    .transform((value) => value ?? undefined),

  sort: z
    .enum(Object.keys(customerSorts) as [CustomerSort, ...CustomerSort[]])
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

  per: z
    .union([z.literal('25'), z.literal('50'), z.literal('100')])
    .optional()
    .catch(undefined)
    .transform((value) => (value === undefined ? DEFAULT_PAGE_SIZE : Number(value))),
});

export type CustomerFilters = z.output<typeof customerFilterSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseCustomerFilters(raw: RawSearchParams): CustomerFilters {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );

  const parsed = customerFilterSchema.safeParse(flat);

  return parsed.success ? parsed.data : customerFilterSchema.parse({});
}

const NARROWING_KEYS = [
  'q',
  'city',
  'platform',
  'status',
  'open',
  'ready',
  'repeat',
  'quiet',
] as const satisfies readonly (keyof CustomerFilters)[];

export function activeFilterCount(filters: CustomerFilters): number {
  return NARROWING_KEYS.filter((key) => {
    const value = filters[key];
    return value !== undefined && value !== false;
  }).length;
}

export function hasActiveFilters(filters: CustomerFilters): boolean {
  return activeFilterCount(filters) > 0;
}

export function toSearchParams(
  filters: Partial<CustomerFilters>,
  overrides: Partial<Record<keyof CustomerFilters, string | number | boolean | undefined>> = {}
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
