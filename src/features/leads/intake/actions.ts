'use server';

/**
 * Acting on the intake review queue.
 *
 * `imports:create` / `imports:update` rather than `leads:create` / `leads:update`, for
 * the same reason the CSV importer uses `imports:create` and not `leads:create`: someone
 * doing day-to-day data entry should not be able to wave a whole queue of automated
 * guesses into `leads` in one click. Both are `imports` because both are ways external
 * data becomes - or is refused as - a lead, not the operation of working one by hand.
 */
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import { leadIntake } from '@/db/schema';
import { leads } from '@/db/schema/leads';
import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { logActivity } from '@/lib/activity';
import { authorize } from '@/lib/auth/session';
import { maskPhone } from '@/lib/phone';
import { APP_TIMEZONE } from '@/lib/time';
import { and, eq, sql } from 'drizzle-orm';

import { isFutureDay, resolveContactedAt } from '../contact-date';
import { categoryOf, resolveCustomer, syncTags } from '../persist';
import type { SavedLead } from '../actions';
import { promoteIntakeSchema, rejectIntakeSchema } from './schemas';

/** Promotes a staged row to a real lead. */
export async function promoteIntakeAction(
  _previous: ActionResult<SavedLead | undefined>,
  formData: FormData
): Promise<ActionResult<SavedLead | undefined>> {
  return runAction('lead.intake.promote', async () => {
    const user = await authorize('imports', 'create');

    const parsed = parseInput(promoteIntakeSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const input = parsed.data;

    if (input.contactedOn !== null && isFutureDay(input.contactedOn, APP_TIMEZONE)) {
      return fail('That contact date is in the future.', {
        code: 'validation',
        fieldErrors: { contactedOn: ['Pick today or an earlier date.'] },
      });
    }

    const contactedAt = resolveContactedAt(input.contactedOn, APP_TIMEZONE);

    const result = await db.transaction(async (tx) => {
      // Re-checked here, not trusted from whatever the review page last rendered:
      // two people could have this row open at once, or someone else could have
      // already rejected it while this tab sat idle.
      const [staged] = await tx
        .select({ status: leadIntake.status })
        .from(leadIntake)
        .where(eq(leadIntake.id, input.intakeId))
        .limit(1);

      if (!staged || staged.status !== 'pending') return null;

      const customer = await resolveCustomer(tx, input, { overwriteOnWhatsapp: true });

      const categoryId =
        input.subcategoryId === null ? input.categoryId : await categoryOf(tx, input.subcategoryId);

      const [lead] = await tx
        .insert(leads)
        .values({
          customerId: customer.id,
          contactedAt,
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
          source: 'automation',
          createdById: user.id,
        })
        .returning({ id: leads.id, reference: leads.reference });

      if (!lead) throw new Error('lead insert returned no row');

      await syncTags(tx, lead.id, input.tags);

      await tx
        .update(leadIntake)
        .set({
          status: 'promoted',
          reviewedById: user.id,
          reviewedAt: sql`now()`,
          promotedLeadId: lead.id,
          updatedAt: sql`now()`,
        })
        .where(eq(leadIntake.id, input.intakeId));

      return { ...lead, customerCreated: customer.created };
    });

    if (result === null) {
      return fail('That message has already been reviewed.', { code: 'notFound' });
    }

    await logActivity({
      action: 'intake.promoted',
      actor: user,
      entityType: 'lead',
      entityId: result.id,
      entityLabel: `Lead ${result.reference}`,
      metadata: {
        customer: maskPhone(input.phone),
        newCustomer: result.customerCreated,
        intakeId: input.intakeId,
      },
    });

    revalidatePath('/admin/leads');
    revalidatePath('/admin/customers');
    revalidatePath('/admin/intake');

    return ok({ id: result.id, reference: result.reference });
  });
}

/**
 * What a dismissal hands back.
 *
 * It carries a value rather than `undefined` for a specific reason: `idleActionState` is
 * `{ ok: true, data: undefined }`, so a form that asks only "is this result ok?" reads
 * "yes" before anything has been submitted. Returning data is what lets the review form
 * tell "not submitted yet" apart from "dismissed" - see the note in
 * ./components/intake-review-form.
 */
export interface DismissedIntake {
  intakeId: string;
}

/** Dismisses a staged row without creating a lead. */
export async function rejectIntakeAction(
  _previous: ActionResult<DismissedIntake | undefined>,
  formData: FormData
): Promise<ActionResult<DismissedIntake | undefined>> {
  return runAction('lead.intake.reject', async () => {
    const user = await authorize('imports', 'update');

    const parsed = parseInput(rejectIntakeSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { intakeId, reason } = parsed.data;

    const [rejected] = await db
      .update(leadIntake)
      .set({
        status: 'rejected',
        reviewedById: user.id,
        reviewedAt: sql`now()`,
        rejectionReason: reason,
        updatedAt: sql`now()`,
      })
      .where(and(eq(leadIntake.id, intakeId), eq(leadIntake.status, 'pending')))
      .returning({ id: leadIntake.id });

    if (!rejected) {
      return fail('That message has already been reviewed.', { code: 'notFound' });
    }

    await logActivity({
      action: 'intake.rejected',
      actor: user,
      entityType: 'leadIntake',
      entityId: intakeId,
      metadata: { reason },
    });

    revalidatePath('/admin/intake');

    return ok({ intakeId });
  });
}
