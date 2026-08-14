/**
 * Writing an approved plan.
 *
 * One transaction for the whole file. Either the spreadsheet is in or it is not, because
 * the alternative - four hundred rows in and a failure on row four hundred and one -
 * leaves someone guessing where to cut the file before trying again. The plan has
 * already been checked row by row, so a failure here means something systemic, and
 * systemic failures should not leave half a customer list behind.
 *
 * Rows are inserted one at a time and in file order. A batched insert would be fewer
 * round trips, but attaching tags needs each new lead's id, and reading those ids back
 * from a multi-row `returning` clause means trusting that Postgres hands them back in
 * the order they were given - true in practice, promised nowhere. At two thousand rows
 * on a transaction that runs once a month, the round trips cost less than the doubt.
 * File order also means the reference numbers follow the sheet, which is the first thing
 * anyone will check afterwards.
 *
 * SERVER ONLY.
 */
import { db } from '@/db/client';
import { leads, leadTags } from '@/db/schema/leads';
import { APP_TIMEZONE } from '@/lib/time';

import { resolveContactedAt } from '../contact-date';
import { resolveCustomer } from '../persist';
import type { ResolvedRow } from './plan';

export interface CommitOutcome {
  imported: number;
  newCustomers: number;
}

export async function commitImport(
  rows: readonly ResolvedRow[],
  createdById: string
): Promise<CommitOutcome> {
  if (rows.length === 0) return { imported: 0, newCustomers: 0 };

  return db.transaction(async (tx) => {
    const customerIds = new Map<string, string>();
    let newCustomers = 0;

    // Customers first, one upsert per distinct number. `overwriteOnWhatsapp: false`
    // because a sheet with no WhatsApp column must not reset every existing customer
    // to the importer's default - see the note on resolveCustomer in ../persist.
    for (const row of rows) {
      if (customerIds.has(row.phone)) continue;

      const customer = await resolveCustomer(
        tx,
        {
          phone: row.phone,
          customerName: row.customerName,
          whatsappNumber: row.whatsappNumber,
          onWhatsapp: row.onWhatsapp,
          cityId: row.cityId,
        },
        { overwriteOnWhatsapp: false }
      );

      customerIds.set(row.phone, customer.id);
      if (customer.created) newCustomers += 1;
    }

    let imported = 0;

    for (const row of rows) {
      const contactedAt = resolveContactedAt(row.contactedOn, APP_TIMEZONE);

      const [lead] = await tx
        .insert(leads)
        .values({
          customerId: customerIds.get(row.phone)!,
          contactedAt,
          // The status clock starts when they made contact, not when the file was
          // uploaded, so a back-filled enquiry does not look brand new.
          statusChangedAt: contactedAt,
          platformId: row.platformId,
          statusId: row.statusId,
          categoryId: row.categoryId,
          subcategoryId: row.subcategoryId,
          clothGenderId: row.clothGenderId,
          fabricId: row.fabricId,
          sizeId: row.sizeId,
          urgencyId: row.urgencyId,
          quantity: row.quantity,
          request: row.request,
          notes: row.notes,
          source: 'import',
          createdById,
        })
        .returning({ id: leads.id });

      if (!lead) throw new Error('lead insert returned no row');

      if (row.tags.length > 0) {
        await tx.insert(leadTags).values(row.tags.map((tagId) => ({ leadId: lead.id, tagId })));
      }

      imported += 1;
    }

    return { imported, newCustomers };
  });
}
