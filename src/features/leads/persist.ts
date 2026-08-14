/**
 * Writing a lead, shared by every route one can arrive through.
 *
 * The manual form, the CSV importer and the n8n review queue all end the same way:
 * find or create the customer by phone, resolve a sub-category's category so the
 * composite foreign key on `leads` is always satisfied, and replace a lead's tags with
 * exactly the set given. Three callers writing that by hand is one too many - the third
 * one, the intake promote action, is what pays for pulling it out here.
 *
 * SERVER ONLY.
 */
import type { db } from '@/db/client';
import { customers } from '@/db/schema/customers';
import { leadTags } from '@/db/schema/leads';
import { subcategories } from '@/db/schema/taxonomy';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The customer for a phone number: found, updated, or created.
 *
 * `on conflict` rather than "select, then insert or update", because the second one has
 * a race between the two statements that the n8n intake would eventually find.
 *
 * `coalesce(excluded.x, customers.x)` on the optional fields means a lead entered
 * without a name cannot blank the name we already had. The blank on a later enquiry is
 * absence of information, not a correction.
 */
export async function resolveCustomer(
  tx: Tx,
  input: {
    phone: string;
    customerName: string | null;
    whatsappNumber: string | null;
    onWhatsapp: boolean;
    cityId: string | null;
  },
  options: {
    /**
     * Whether `onWhatsapp` overwrites what is already on file.
     *
     * The manual form and the intake review form both have a real, deliberate answer
     * to "reachable on WhatsApp" every time they submit, so their write should win. A
     * spreadsheet with no WhatsApp column does not - it would otherwise reset every
     * existing customer to the importer's default on every re-upload.
     */
    overwriteOnWhatsapp: boolean;
  }
): Promise<{ id: string; created: boolean }> {
  const [row] = await tx
    .insert(customers)
    .values({
      phone: input.phone,
      name: input.customerName,
      whatsappNumber: input.whatsappNumber,
      onWhatsapp: input.onWhatsapp,
      cityId: input.cityId,
    })
    .onConflictDoUpdate({
      target: customers.phone,
      set: {
        name: sql`coalesce(excluded.name, ${customers.name})`,
        whatsappNumber: sql`coalesce(excluded.whatsapp_number, ${customers.whatsappNumber})`,
        cityId: sql`coalesce(excluded.city_id, ${customers.cityId})`,
        ...(options.overwriteOnWhatsapp ? { onWhatsapp: sql`excluded.on_whatsapp` } : {}),
        // A customer who was removed and has now written again is a customer again.
        // Restoring them keeps their history attached instead of starting a second
        // identity for the same number, which the unique index would refuse anyway.
        deletedAt: null,
        updatedAt: sql`now()`,
      },
    })
    .returning({
      id: customers.id,
      // Postgres exposes the row's transaction id in `xmax`, which is zero only for a
      // row this statement inserted. It is the one way to tell an insert from an
      // update in a single round trip.
      created: sql<boolean>`(xmax = 0)`,
    });

  if (!row) throw new Error('customer upsert returned no row');

  return row;
}

/**
 * The category a sub-category belongs to.
 *
 * Looked up rather than trusted, so the pair written to `leads` always satisfies the
 * composite foreign key.
 */
export async function categoryOf(tx: Tx, subcategoryId: string): Promise<string | null> {
  const [row] = await tx
    .select({ categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(and(eq(subcategories.id, subcategoryId), isNull(subcategories.deletedAt)))
    .limit(1);

  return row?.categoryId ?? null;
}

/** Replaces a lead's tags with exactly the set given. */
export async function syncTags(tx: Tx, leadId: string, tagIds: string[]): Promise<void> {
  const existing = await tx
    .select({ tagId: leadTags.tagId })
    .from(leadTags)
    .where(eq(leadTags.leadId, leadId));

  const before = new Set(existing.map((row) => row.tagId));
  const after = new Set(tagIds);

  const removed = [...before].filter((id) => !after.has(id));
  const added = [...after].filter((id) => !before.has(id));

  // Only the difference is written. Delete-all-then-reinsert would be simpler and
  // would churn the table - and would show up in the log as twenty changes when one
  // tag was ticked.
  if (removed.length > 0) {
    await tx
      .delete(leadTags)
      .where(and(eq(leadTags.leadId, leadId), inArray(leadTags.tagId, removed)));
  }

  if (added.length > 0) {
    await tx.insert(leadTags).values(added.map((tagId) => ({ leadId, tagId })));
  }
}
