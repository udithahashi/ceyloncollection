/**
 * Customers: one row per phone number.
 *
 * WHY THE PHONE NUMBER IS THE IDENTITY
 * The point of this system is to learn what people want and notice when the same
 * person asks twice. There is no login, no email, no account - a stranger sends a
 * WhatsApp message, and the only durable thing about them is their number. So the
 * number is the key, stored in E.164 (see @/lib/phone), unique, and never edited
 * casually: changing it means claiming these enquiries belong to someone else.
 *
 * WHAT IS *NOT* HERE
 * Total requests, first and last contact, days since last contact, latest status,
 * repeat-or-new, ready-to-buy count, last interest. Every one of those was on the
 * business's own list of customer columns, and every one of them is a fact about
 * this customer's leads rather than about the customer. Storing them would mean
 * eight numbers to keep in step with every insert, update and undelete - and the
 * first time one drifts, the analytics quietly lie.
 *
 * They live in the `customer_summary` view instead, computed from the leads on
 * every read. See the migration that creates it.
 */
import { relations } from 'drizzle-orm';
import { boolean, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { cities } from './taxonomy';

import { instant, primaryId, softDelete, timestamps } from './columns';

export const customers = pgTable(
  'customers',
  {
    id: primaryId(),

    /**
     * E.164, e.g. `+97455123456`. The business identity of this person.
     *
     * Unique, so a second enquiry from the same number attaches to the existing
     * customer instead of creating a duplicate. Every write path normalises before
     * it gets here; nothing may insert a raw typed string.
     */
    phone: text('phone').notNull(),

    /**
     * What they call themselves. Not unique and not required to be accurate - two
     * different people are both "Fathima", and one person may give a different
     * name on Instagram than on WhatsApp.
     */
    name: text('name'),

    /**
     * A second number for WhatsApp, when it differs from `phone`.
     *
     * Usually null: most customers arrive on WhatsApp on the number they gave.
     * `whatsappNumber ?? phone` is where to message them.
     */
    whatsappNumber: text('whatsapp_number'),

    /** False once we learn the number has no WhatsApp, which changes how we reply. */
    onWhatsapp: boolean('on_whatsapp').notNull().default(true),

    /**
     * Where in Qatar they are, for judging delivery. On the customer rather than
     * the lead: people do not move house between enquiries, and when they do, the
     * current answer is the one that matters.
     */
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'restrict' }),

    /** Anything about the person rather than a particular enquiry. */
    notes: text('notes'),

    /**
     * Set when this customer should be left alone - asked not to be contacted, or
     * turned out to be a competitor fishing for prices. Kept rather than deleted,
     * precisely so nobody messages them again by accident.
     */
    blockedAt: instant('blocked_at'),
    blockedReason: text('blocked_reason'),

    ...timestamps,
    ...softDelete,
  },
  (table) => [
    /**
     * One customer per number.
     *
     * A plain unique constraint, not a partial one excluding soft-deleted rows:
     * if a customer is removed by mistake and the same number writes again, the
     * insert should fail so the existing row can be restored with its history,
     * rather than starting a second identity for the same person.
     */
    uniqueIndex('customers_phone_key').on(table.phone),
    index('customers_name_idx').on(table.name),
    index('customers_city_idx').on(table.cityId),
    /** The default listing order: most recently added first. */
    index('customers_created_idx').on(table.createdAt),
  ]
);

export const customerRelations = relations(customers, ({ one }) => ({
  city: one(cities, { fields: [customers.cityId], references: [cities.id] }),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
