'use server';

/**
 * Lead Server Actions.
 *
 * Three things every one of them does, in this order: check the permission, validate
 * the input, then write inside a transaction. The order matters - validating before
 * authorising leaks which fields exist to someone who may not read them at all.
 *
 * THE CUSTOMER IS FOUND, NOT CHOSEN
 * The form has no customer picker. It has a phone number, and the number decides who
 * this is: an existing customer if we have seen the number, a new one if not. That is
 * what makes "requests by customer" and "repeat or new" true without anyone having to
 * remember to link the enquiry to the right person.
 *
 * THE CATEGORY IS DERIVED, NOT SUBMITTED
 * When a sub-category is chosen, its category is looked up here and the submitted one
 * is ignored. The database refuses a mismatched pair - see the composite foreign key
 * on `leads` - and this is what guarantees the pair is never mismatched in the first
 * place, however the form was manipulated.
 */
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import { customers } from '@/db/schema/customers';
import { leads, leadTags } from '@/db/schema/leads';
import { subcategories } from '@/db/schema/taxonomy';
import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { diffFields, logActivity } from '@/lib/activity';
import { authorize } from '@/lib/auth/session';
import { maskPhone } from '@/lib/phone';
import { APP_TIMEZONE } from '@/lib/time';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';

import { isFutureDay, resolveContactedAt } from './contact-date';
import { changeStatusSchema, createLeadSchema, leadRowSchema, updateLeadSchema } from './schemas';

/** What a successful save hands back, so the form can confirm it by name. */
export interface SavedLead {
  id: string;
  reference: number;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The customer for a phone number: found, updated, or created.
 *
 * `on conflict` rather than "select, then insert or update", because the second one
 * has a race between the two statements that the n8n intake would eventually find.
 *
 * `coalesce(excluded.x, customers.x)` on the optional fields means a lead entered
 * without a name cannot blank the name we already had. The blank on a later enquiry is
 * absence of information, not a correction.
 */
async function resolveCustomer(
  tx: Tx,
  input: {
    phone: string;
    customerName: string | null;
    whatsappNumber: string | null;
    onWhatsapp: boolean;
    cityId: string | null;
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
        onWhatsapp: sql`excluded.on_whatsapp`,
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
async function categoryOf(tx: Tx, subcategoryId: string): Promise<string | null> {
  const [row] = await tx
    .select({ categoryId: subcategories.categoryId })
    .from(subcategories)
    .where(and(eq(subcategories.id, subcategoryId), isNull(subcategories.deletedAt)))
    .limit(1);

  return row?.categoryId ?? null;
}

/** Replaces a lead's tags with exactly the set given. */
async function syncTags(tx: Tx, leadId: string, tagIds: string[]): Promise<void> {
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

/** Records a lead. */
export async function createLeadAction(
  _previous: ActionResult<SavedLead | undefined>,
  formData: FormData
): Promise<ActionResult<SavedLead | undefined>> {
  return runAction('lead.create', async () => {
    const user = await authorize('leads', 'create');

    const parsed = parseInput(createLeadSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const input = parsed.data;

    if (input.contactedOn !== null && isFutureDay(input.contactedOn, APP_TIMEZONE)) {
      return fail('That contact date is in the future.', {
        code: 'validation',
        fieldErrors: { contactedOn: ['Pick today or an earlier date.'] },
      });
    }

    const contactedAt = resolveContactedAt(input.contactedOn, APP_TIMEZONE);

    const saved = await db.transaction(async (tx) => {
      const customer = await resolveCustomer(tx, input);

      const categoryId =
        input.subcategoryId === null ? input.categoryId : await categoryOf(tx, input.subcategoryId);

      const [lead] = await tx
        .insert(leads)
        .values({
          customerId: customer.id,
          contactedAt,
          // The clock starts when they made contact, not when the row was typed:
          // "how long has this been sitting in New Inquiry" should count the wait the
          // customer experienced, which matters most for a back-filled enquiry.
          statusChangedAt: contactedAt,
          platformId: input.platformId,
          statusId: input.statusId,
          categoryId,
          subcategoryId: input.subcategoryId,
          clothGenderId: input.clothGenderId,
          fabricId: input.fabricId,
          sizeId: input.sizeId,
          urgencyId: input.urgencyId,
          quantity: input.quantity,
          request: input.request,
          notes: input.notes,
          source: 'manual',
          createdById: user.id,
        })
        .returning({ id: leads.id, reference: leads.reference });

      if (!lead) throw new Error('lead insert returned no row');

      await syncTags(tx, lead.id, input.tags);

      return { ...lead, customerCreated: customer.created };
    });

    await logActivity({
      action: 'lead.created',
      actor: user,
      entityType: 'lead',
      entityId: saved.id,
      entityLabel: `Lead ${saved.reference}`,
      metadata: {
        // The last four digits only. A full number in an audit log is personal data
        // that will be copied into a support conversation one day.
        customer: maskPhone(input.phone),
        newCustomer: saved.customerCreated,
        contactedAt,
        tags: input.tags.length,
      },
    });

    revalidatePath('/leads');
    revalidatePath('/customers');

    return ok({ id: saved.id, reference: saved.reference });
  });
}

/** Edits a lead. */
export async function updateLeadAction(
  _previous: ActionResult<SavedLead | undefined>,
  formData: FormData
): Promise<ActionResult<SavedLead | undefined>> {
  return runAction('lead.update', async () => {
    const user = await authorize('leads', 'update');

    const parsed = parseInput(updateLeadSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const input = parsed.data;

    if (input.contactedOn !== null && isFutureDay(input.contactedOn, APP_TIMEZONE)) {
      return fail('That contact date is in the future.', {
        code: 'validation',
        fieldErrors: { contactedOn: ['Pick today or an earlier date.'] },
      });
    }

    const result = await db.transaction(async (tx) => {
      const [before] = await tx
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.id), isNull(leads.deletedAt)))
        .limit(1);

      if (!before) return null;

      const customer = await resolveCustomer(tx, input);

      const categoryId =
        input.subcategoryId === null ? input.categoryId : await categoryOf(tx, input.subcategoryId);

      // Only re-dated when the form actually carried a date, and only re-timed when
      // the day changed: re-saving an edit must not quietly move the contact time.
      const contactedAt =
        input.contactedOn === null
          ? before.contactedAt
          : resolveContactedAt(input.contactedOn, APP_TIMEZONE);

      const statusChanged = before.statusId !== input.statusId;

      const [updated] = await tx
        .update(leads)
        .set({
          customerId: customer.id,
          contactedAt,
          platformId: input.platformId,
          statusId: input.statusId,
          statusChangedAt: statusChanged ? sql`now()` : before.statusChangedAt,
          categoryId,
          subcategoryId: input.subcategoryId,
          clothGenderId: input.clothGenderId,
          fabricId: input.fabricId,
          sizeId: input.sizeId,
          urgencyId: input.urgencyId,
          quantity: input.quantity,
          request: input.request,
          notes: input.notes,
          updatedAt: sql`now()`,
        })
        .where(eq(leads.id, input.id))
        .returning({ id: leads.id, reference: leads.reference });

      if (!updated) return null;

      await syncTags(tx, updated.id, input.tags);

      return { lead: updated, before };
    });

    if (result === null) return fail('That lead no longer exists.', { code: 'notFound' });

    await logActivity({
      action: 'lead.updated',
      actor: user,
      entityType: 'lead',
      entityId: result.lead.id,
      entityLabel: `Lead ${result.lead.reference}`,
      metadata: {
        changes: diffFields(result.before as unknown as Record<string, unknown>, {
          statusId: input.statusId,
          platformId: input.platformId,
          subcategoryId: input.subcategoryId,
          clothGenderId: input.clothGenderId,
          fabricId: input.fabricId,
          sizeId: input.sizeId,
          urgencyId: input.urgencyId,
          quantity: input.quantity,
          request: input.request,
          notes: input.notes,
        }),
      },
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${result.lead.reference}`);
    revalidatePath('/customers');

    return ok({ id: result.lead.id, reference: result.lead.reference });
  });
}

/**
 * Moves a lead to another status.
 *
 * Its own action because this is the thing that happens twenty times a day, usually
 * from the list. Requiring the whole form for it would mean loading and re-submitting
 * every other field to change one word.
 */
export async function changeLeadStatusAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('lead.changeStatus', async () => {
    const user = await authorize('leads', 'update');

    const parsed = parseInput(changeStatusSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { id, statusId, note } = parsed.data;

    const [before] = await db
      .select({ reference: leads.reference, statusId: leads.statusId, notes: leads.notes })
      .from(leads)
      .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
      .limit(1);

    if (!before) return fail('That lead no longer exists.', { code: 'notFound' });

    // Nothing to do, and nothing worth an audit row either.
    if (before.statusId === statusId && note === null) return ok(undefined);

    await db
      .update(leads)
      .set({
        statusId,
        statusChangedAt: sql`now()`,
        // A note given with a status change is appended rather than replacing what is
        // there: "customer stopped replying" is history, not a correction.
        notes: note === null ? before.notes : appendNote(before.notes, note),
        updatedAt: sql`now()`,
      })
      .where(eq(leads.id, id));

    await logActivity({
      action: 'lead.updated',
      actor: user,
      entityType: 'lead',
      entityId: id,
      entityLabel: `Lead ${before.reference}`,
      metadata: { statusId: { from: before.statusId, to: statusId }, note: note !== null },
    });

    revalidatePath('/leads');
    revalidatePath(`/leads/${before.reference}`);
    revalidatePath('/customers');

    return ok(undefined);
  });
}

/** Adds a dated line to the notes, keeping what was already there. */
function appendNote(existing: string | null, note: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const line = `[${stamp}] ${note}`;

  return existing === null || existing === '' ? line : `${existing}\n${line}`;
}

/**
 * Soft-deletes a lead.
 *
 * Needs `leads:delete`, which staff do not have: a mistake by the person doing data
 * entry should always be recoverable by someone more senior, and a real deletion here
 * would take a customer's history with it.
 */
export async function deleteLeadAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('lead.delete', async () => {
    const user = await authorize('leads', 'delete');

    const parsed = parseInput(leadRowSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const [deleted] = await db
      .update(leads)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(leads.id, parsed.data.id), isNull(leads.deletedAt)))
      .returning({ reference: leads.reference });

    if (!deleted) return fail('That lead no longer exists.', { code: 'notFound' });

    await logActivity({
      action: 'lead.deleted',
      actor: user,
      entityType: 'lead',
      entityId: parsed.data.id,
      entityLabel: `Lead ${deleted.reference}`,
    });

    revalidatePath('/leads');
    revalidatePath('/customers');

    return ok(undefined);
  });
}

/** Brings back a lead that was removed. */
export async function restoreLeadAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('lead.restore', async () => {
    const user = await authorize('leads', 'delete');

    const parsed = parseInput(leadRowSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const [restored] = await db
      .update(leads)
      .set({ deletedAt: null, updatedAt: sql`now()` })
      .where(eq(leads.id, parsed.data.id))
      .returning({ reference: leads.reference });

    if (!restored) return fail('That lead no longer exists.', { code: 'notFound' });

    await logActivity({
      action: 'lead.restored',
      actor: user,
      entityType: 'lead',
      entityId: parsed.data.id,
      entityLabel: `Lead ${restored.reference}`,
    });

    revalidatePath('/leads');
    revalidatePath('/customers');

    return ok(undefined);
  });
}
