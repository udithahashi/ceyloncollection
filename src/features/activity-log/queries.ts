/**
 * Reads for the activity log page.
 *
 * Server-only, and deliberately the only reader `activity_log` has: the table is
 * append-only (see `src/db/schema/activity-log.ts`), and a page like this one is
 * the reason it exists - "a lead's status is wrong, who touched it and when".
 *
 * No join back to `app_user`: `actorLabel` is already a copy of the actor's name
 * at the time the row was written, for the same reason `entityLabel` is - an
 * account renamed or removed later must not change what the log says happened.
 */
import { desc, eq, sql, type SQL } from 'drizzle-orm';

import { db } from '@/db/client';
import { activityLog, type ActivityLogRow } from '@/db/schema/activity-log';

import { DEFAULT_PAGE_SIZE, type ActivityFilters } from './filters';

export type ActivityPage = {
  rows: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function activityConditions(filters: ActivityFilters): SQL | undefined {
  return filters.action ? eq(activityLog.action, filters.action) : undefined;
}

export async function listActivity(filters: ActivityFilters): Promise<ActivityPage> {
  const where = activityConditions(filters);
  const pageSize = DEFAULT_PAGE_SIZE;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(activityLog)
      .where(where)
      .orderBy(desc(activityLog.createdAt))
      .limit(pageSize)
      .offset((filters.page - 1) * pageSize),

    countActivity(filters),
  ]);

  return {
    rows,
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function countActivity(filters: ActivityFilters): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(activityLog)
    .where(activityConditions(filters));

  return row?.total ?? 0;
}
