/**
 * Reads for the intake review queue.
 *
 * SERVER ONLY.
 */
import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { leadIntake, type LeadIntakeRow } from '@/db/schema';

const PAGE_SIZE = 25;

export interface IntakeQueueRow {
  id: string;
  receivedAt: string;
  phoneRaw: string | null;
  customerNameRaw: string | null;
  platformRaw: string | null;
  messageText: string;
}

export interface IntakeQueuePage {
  rows: IntakeQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** Pending rows, oldest first - the same FIFO reasoning as the leads work queue: the
 * enquiry that has waited longest gets looked at first. */
export async function listPendingIntake(page: number): Promise<IntakeQueuePage> {
  const where = eq(leadIntake.status, 'pending');

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: leadIntake.id,
        receivedAt: leadIntake.receivedAt,
        phoneRaw: leadIntake.phoneRaw,
        customerNameRaw: leadIntake.customerNameRaw,
        platformRaw: leadIntake.platformRaw,
        messageText: leadIntake.messageText,
      })
      .from(leadIntake)
      .where(where)
      .orderBy(asc(leadIntake.receivedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(leadIntake)
      .where(where),
  ]);

  const total = totalRow?.total ?? 0;

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** One staged row, whatever its status - the review page decides what to do with a row
 * that has already been promoted or rejected since the queue was last loaded. */
export async function getIntakeById(id: string): Promise<LeadIntakeRow | null> {
  const [row] = await db.select().from(leadIntake).where(eq(leadIntake.id, id)).limit(1);

  return row ?? null;
}
