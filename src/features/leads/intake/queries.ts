/**
 * Reads for the intake review queue.
 *
 * SERVER ONLY.
 */
import { asc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { leadIntake, leads, type LeadIntakeRow } from '@/db/schema';

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

/**
 * One staged row, whatever its status.
 *
 * Deliberately not filtered to `pending`. The review page has to be able to tell "no
 * such message" from "already dealt with", because the second is the ordinary outcome
 * of promoting one - and of a colleague getting to it first - and answering both with a
 * 404 makes a successful save look like a broken link.
 */
export interface IntakeDetail {
  row: LeadIntakeRow;
  /** The lead it became, when it was promoted. Null otherwise. */
  promotedLeadReference: number | null;
}

export async function getIntakeById(id: string): Promise<IntakeDetail | null> {
  const [found] = await db
    .select({ row: leadIntake, promotedLeadReference: leads.reference })
    .from(leadIntake)
    .leftJoin(leads, eq(leads.id, leadIntake.promotedLeadId))
    .where(eq(leadIntake.id, id))
    .limit(1);

  return found ?? null;
}
