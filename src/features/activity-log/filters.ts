/**
 * The activity log's filters, as data. Same URL-is-the-state reasoning as
 * `@/features/leads/filters` - see that file for why nothing here throws on a
 * stale or hand-edited query string.
 */
import { z } from 'zod';

import { activityActions } from '@/db/schema/activity-log';

export const DEFAULT_PAGE_SIZE = 50;

export const activityFilterSchema = z.object({
  /** One action, or every action when absent. */
  action: z.enum(activityActions).optional().catch(undefined),

  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined).default(1),
});

export type ActivityFilters = z.output<typeof activityFilterSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseActivityFilters(raw: RawSearchParams): ActivityFilters {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );

  const parsed = activityFilterSchema.safeParse(flat);
  return parsed.success ? parsed.data : activityFilterSchema.parse({});
}

/** Filters back to a query string, dropping anything at its default. */
export function toSearchParams(
  filters: Partial<ActivityFilters>,
  overrides: Partial<Record<keyof ActivityFilters, string | number | undefined>> = {}
): string {
  const merged: Record<string, string | number | undefined> = { ...filters, ...overrides };
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === '') continue;
    if (key === 'page' && Number(value) === 1) continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}
