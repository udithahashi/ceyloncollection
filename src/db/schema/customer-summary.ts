/**
 * The `customer_summary` view, declared so Drizzle can type a select against it.
 *
 * `.existing()` means "this relation is managed elsewhere" - drizzle-kit will not
 * try to create or drop it. The definition that matters is the SQL in
 * src/db/migrations/0003_customer_summary.sql, and the reasoning behind the view is
 * written out there.
 *
 * KEEPING THE TWO IN STEP
 * Nothing in the type system checks that this declaration matches the real view: get a
 * column name wrong and the query fails at runtime rather than at build time. That is
 * what `./customer-summary.test.ts` is for - it reads the view's columns out of
 * `information_schema` and compares the two lists, so drift fails a test rather than a
 * page. It skips itself when no database is reachable, which is the case in CI.
 */
import { boolean, integer, pgView, uuid } from 'drizzle-orm/pg-core';

import { instant } from './columns';

export const customerSummary = pgView('customer_summary', {
  customerId: uuid('customer_id').notNull(),

  /** Enquiries that are not soft-deleted. Zero for a customer entered by hand. */
  totalRequests: integer('total_requests').notNull(),
  /** Not at a terminal status: still worth someone's attention. */
  openRequests: integer('open_requests').notNull(),
  /** Enquiries at an urgency the business marked as ready to buy, ever. */
  readyToBuyRequests: integer('ready_to_buy_requests').notNull(),
  /**
   * The same, but still open - which is what makes someone a hot lead today. A
   * ready-to-buy enquiry that was delivered last month is a happy customer, not a
   * call to make this morning.
   */
  openReadyToBuyRequests: integer('open_ready_to_buy_requests').notNull(),
  wonRequests: integer('won_requests').notNull(),
  lostRequests: integer('lost_requests').notNull(),
  /** Pieces asked for across all enquiries. Null when nobody stated a quantity. */
  totalQuantity: integer('total_quantity'),

  firstContactAt: instant('first_contact_at'),
  lastContactAt: instant('last_contact_at'),

  /** More than one enquiry: they came back. */
  isRepeat: boolean('is_repeat').notNull(),

  latestLeadId: uuid('latest_lead_id'),
  latestLeadReference: integer('latest_lead_reference'),
  latestStatusId: uuid('latest_status_id'),
  latestUrgencyId: uuid('latest_urgency_id'),
  latestPlatformId: uuid('latest_platform_id'),

  /** How we met them: the platform of their first enquiry, not their last. */
  firstPlatformId: uuid('first_platform_id'),

  /** The newest enquiry that named a product, so a bare follow-up cannot blank it. */
  lastInterestCategoryId: uuid('last_interest_category_id'),
  lastInterestSubcategoryId: uuid('last_interest_subcategory_id'),
}).existing();

export type CustomerSummary = typeof customerSummary.$inferSelect;
