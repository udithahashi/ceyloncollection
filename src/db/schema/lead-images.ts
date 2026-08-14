/**
 * Reference photos on a lead.
 *
 * The photo is often the enquiry. "The green one in your third post" is a sentence
 * nobody can source from; a screenshot of that post is unambiguous, and so is the
 * picture a customer takes of a dress they saw on someone else. Keeping it beside
 * the lead is what lets a buyer in Sri Lanka be shown exactly what was asked for.
 *
 * WHAT IS STORED HERE AND WHAT IS ON DISK
 * The row holds the keys, the dimensions and the provenance; the bytes live in
 * @/lib/storage under `leads/<lead>/<image>-full.webp`. The keys are recorded rather
 * than recomputed so that a later change to the naming scheme cannot orphan
 * everything uploaded before it.
 *
 * WHY NOT SOFT DELETE
 * Every other business table here is soft-deleted, and this one deliberately is not.
 * The reason someone deletes a photo is usually that it should not be held: the wrong
 * customer's picture, a face nobody agreed to store, a screenshot of a private
 * conversation. A soft delete would leave the bytes on disk, which makes the delete
 * button a lie. Keeping the row but destroying the file is worse still - a record
 * whose only content is a broken pointer.
 *
 * So the row and the file both go, and the audit trail lives where audit trails
 * belong: `activity_log` records who removed which image from which lead and when.
 * Nothing is lost that the log did not keep.
 */
import { relations } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { appUser } from './auth';
import { instant, primaryId } from './columns';
import { leads } from './leads';

export const leadImages = pgTable(
  'lead_images',
  {
    id: primaryId(),

    /**
     * `cascade`, unlike every other reference to `leads`. A lead is soft-deleted, so
     * this only fires if a lead is ever truly removed - by a data-retention job, or
     * by hand - and at that point images of a deleted enquiry are not something to
     * keep. It also means no image row can outlive its lead.
     */
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),

    /** Object keys in storage. WebP, re-encoded; see @/lib/images/prepare. */
    fullKey: text('full_key').notNull(),
    thumbKey: text('thumb_key').notNull(),

    /**
     * The stored image's dimensions, so a page can reserve the right space before the
     * bytes arrive. Without them the gallery reflows as each image loads, which on a
     * phone means tapping the thing that was there a moment ago.
     */
    width: integer('width').notNull(),
    height: integer('height').notNull(),

    /** Size of the full variant, for the operator's sense of what the disk holds. */
    byteSize: integer('byte_size').notNull(),

    /**
     * The name the file arrived with, trimmed and length-capped, for display only.
     * "whatsapp-image-2026-03-09.jpg" is a weak clue about provenance and sometimes
     * the only one. Never used to build a path - see @/lib/storage/keys.
     */
    originalName: text('original_name'),

    /** What the upload actually was before re-encoding: jpeg, heic, png... */
    sourceType: text('source_type').notNull(),

    /**
     * Display order within the lead, counted in tens so an image can be slotted
     * between two others without renumbering. Ties break on `createdAt`.
     */
    sortOrder: integer('sort_order').notNull().default(0),

    /**
     * Who uploaded it. `set null` rather than `restrict`: a colleague who leaves must
     * not make their uploads undeletable. Also the basis of one permission rule -
     * staff may remove an image they uploaded themselves.
     */
    uploadedById: uuid('uploaded_by_id').references(() => appUser.id, { onDelete: 'set null' }),

    createdAt: instant('created_at')
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    /** The gallery query: one lead's images, in order. */
    index('lead_images_lead_idx').on(table.leadId, table.sortOrder, table.createdAt),

    check('lead_images_width_positive', sql`${table.width} > 0 and ${table.height} > 0`),
    check('lead_images_size_positive', sql`${table.byteSize} > 0`),
  ]
);

export const leadImageRelations = relations(leadImages, ({ one }) => ({
  lead: one(leads, { fields: [leadImages.leadId], references: [leads.id] }),
  uploadedBy: one(appUser, { fields: [leadImages.uploadedById], references: [appUser.id] }),
}));

export type LeadImage = typeof leadImages.$inferSelect;
export type NewLeadImage = typeof leadImages.$inferInsert;
