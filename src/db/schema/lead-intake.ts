/**
 * Staged automated intake, from n8n.
 *
 * A message from social media is a guess: a phone number that might be mistyped, a
 * platform name in whatever words n8n was told to use, a sentence with no fabric, size
 * or category attached to it at all. Writing guesses straight into `leads` would poison
 * the one honest measurement of demand this business has, so every message lands here
 * first, `pending`, and a human turns it into a lead - or rejects it - from the review
 * queue at /intake. See src/app/n8n/intake/route.ts for how a row gets here, and
 * src/features/leads/intake/ for the queue itself.
 *
 * WHAT IS *NOT* HERE
 * No resolved taxonomy ids. n8n is not asked to guess a fabric or a category - nobody
 * has built that extraction, and inventing a contract for it now would be designing for
 * a workflow that does not exist. `rawPayload` keeps the whole body for a human to read;
 * the review form resolves what it reasonably can (the phone number, a platform name
 * matched by name) at review time, against whatever the taxonomy looks like *then* -
 * never something decided once at receipt and trusted stale.
 */
import { relations, sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { appUser } from './auth';
import { instant, primaryId, timestamps } from './columns';
import { leads } from './leads';

export const leadIntakeStatuses = ['pending', 'promoted', 'rejected'] as const;
export type LeadIntakeStatus = (typeof leadIntakeStatuses)[number];

export const leadIntake = pgTable(
  'lead_intake',
  {
    id: primaryId(),

    /**
     * n8n's own id for the message, when it sends one. Lets a retried delivery - n8n
     * resending because our 201 was lost on the way back, not because the message was
     * sent twice - land on the same row instead of creating a second one.
     */
    externalId: text('external_id'),

    /**
     * When the message arrived. Defaults to when we received it, but the payload may
     * set it explicitly for a replayed or back-filled message, the same reason
     * `contactedAt` on a lead is distinct from `createdAt`.
     */
    receivedAt: instant('received_at')
      .notNull()
      .default(sql`now()`),

    /** The whole parsed body, verbatim, for the raw view on the review page and for
     * debugging a workflow that is still being tuned on the n8n side. */
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>().notNull(),

    phoneRaw: text('phone_raw'),
    customerNameRaw: text('customer_name_raw'),
    platformRaw: text('platform_raw'),

    /** The enquiry itself, in whoever's words sent it. Seeds `request` on the lead. */
    messageText: text('message_text').notNull(),

    status: text('status', {
      enum: leadIntakeStatuses as unknown as [LeadIntakeStatus, ...LeadIntakeStatus[]],
    })
      .notNull()
      .default('pending'),

    /** Who acted on it, and how. Both null while `status` is `pending`. */
    reviewedById: uuid('reviewed_by_id').references(() => appUser.id, { onDelete: 'set null' }),
    reviewedAt: instant('reviewed_at'),

    /** Set only on promotion. `set null` rather than `restrict`: a lead can be soft- or
     * (rarely) hard-deleted later without that touching this record of how it arrived. */
    promotedLeadId: uuid('promoted_lead_id').references(() => leads.id, { onDelete: 'set null' }),

    rejectionReason: text('rejection_reason'),

    ...timestamps,
  },
  (table) => [
    check(
      'lead_intake_status_valid',
      sql.raw(`"status" in (${leadIntakeStatuses.map((status) => `'${status}'`).join(', ')})`)
    ),

    /**
     * Guards the retry case above. Partial, not on the whole column, because most
     * payloads will not carry an id at all and every one of those nulls must be free
     * to coexist.
     */
    uniqueIndex('lead_intake_external_id_key')
      .on(table.externalId)
      .where(sql`${table.externalId} is not null`),

    /** The queue itself: pending rows, oldest first. */
    index('lead_intake_status_idx').on(table.status, table.receivedAt),
  ]
);

export const leadIntakeRelations = relations(leadIntake, ({ one }) => ({
  reviewedBy: one(appUser, { fields: [leadIntake.reviewedById], references: [appUser.id] }),
  promotedLead: one(leads, { fields: [leadIntake.promotedLeadId], references: [leads.id] }),
}));

export type LeadIntakeRow = typeof leadIntake.$inferSelect;
export type NewLeadIntake = typeof leadIntake.$inferInsert;
