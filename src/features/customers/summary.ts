/**
 * What to do about a customer.
 *
 * The business asked for an "Action" column - HOT LEAD, Monitor, Follow up - and
 * this is where that judgement is made. It lives in TypeScript rather than in the
 * `customer_summary` view because it is policy, not fact: the thresholds below are
 * opinions about how quickly a quiet lead goes cold, and opinions get revised. A
 * number in a view needs a migration to change; a number here needs an edit and a
 * test.
 *
 * It is also pure, and pure in a strict sense: it takes the number of quiet days
 * rather than a date, so it needs neither a clock nor a timezone. That is not
 * fastidiousness. Reading the configured timezone would pull `@/lib/env` in behind it,
 * which would make this module - and every component that imports a threshold from it -
 * server-only. Counting the days is the caller's job; deciding what they mean is this
 * module's.
 */
import type { BadgeTone } from '@/lib/theme/tones';

/**
 * Days of silence on an open enquiry before it needs chasing.
 *
 * Three, because a WhatsApp enquiry that gets no answer for three days has usually
 * been answered by someone else. Raise it if the follow-up list becomes noise.
 */
export const FOLLOW_UP_AFTER_DAYS = 3;

/**
 * Days of silence after which an open enquiry is probably not coming back.
 *
 * It still says follow up - a dormant customer is worth one message - but it sorts
 * below the fresher ones, because chasing in order of age is chasing the coldest
 * leads first.
 */
export const DORMANT_AFTER_DAYS = 21;

export const customerActions = [
  'hot',
  'follow_up',
  'dormant',
  'monitor',
  'won',
  'lost',
  'none',
] as const;

export type CustomerAction = (typeof customerActions)[number];

export const customerActionLabels: Record<CustomerAction, string> = {
  hot: 'Hot lead',
  follow_up: 'Follow up',
  dormant: 'Dormant',
  monitor: 'Monitor',
  won: 'Delivered',
  lost: 'Lost',
  none: 'No enquiries',
};

export const customerActionDescriptions: Record<CustomerAction, string> = {
  hot: 'Said they are ready to buy and the enquiry is still open. Contact today.',
  follow_up: `Open and quiet for ${FOLLOW_UP_AFTER_DAYS} days or more.`,
  dormant: `Open but silent for over ${DORMANT_AFTER_DAYS} days. Worth one more message.`,
  monitor: 'Open and recently active. Nothing to do yet.',
  won: 'Their most recent enquiry ended in a sale.',
  lost: 'Their most recent enquiry was lost or cancelled.',
  none: 'On file with no enquiry recorded.',
};

/**
 * The order the actions should sort in, urgent first.
 *
 * Named rather than derived from the array index, so reordering `customerActions`
 * for any other reason cannot silently reshuffle the work queue.
 */
export const customerActionPriority: Record<CustomerAction, number> = {
  hot: 0,
  follow_up: 1,
  dormant: 2,
  monitor: 3,
  won: 4,
  lost: 5,
  none: 6,
};

/**
 * The facts this decision needs, and nothing else.
 *
 * A narrow input rather than the whole summary row: it makes the rule obvious, and
 * it means the CSV importer and the dashboard can ask the same question without
 * first constructing a complete customer.
 */
export interface ActionInput {
  totalRequests: number;
  openRequests: number;
  /** Enquiries at a ready-to-buy urgency that are still open. */
  openReadyToBuyRequests: number;
  /**
   * Calendar days since they last made contact, counted in business time by the
   * caller. Null when they have never been in touch.
   */
  quietForDays: number | null;
  /** Whether the most recent enquiry ended at a status marked as a sale. */
  latestIsWon: boolean;
  /** Whether the most recent enquiry ended at any terminal status. */
  latestIsTerminal: boolean;
}

/**
 * What someone should do about this customer next.
 *
 * The order of the checks is the priority order: a person who said "I'll take it"
 * outranks a person who has gone quiet, however long the quiet one has waited.
 */
export function suggestedAction(input: ActionInput): CustomerAction {
  if (input.totalRequests === 0) return 'none';

  // Everything closed. Which way it closed decides the label.
  if (input.openRequests === 0) {
    return input.latestIsWon ? 'won' : input.latestIsTerminal ? 'lost' : 'monitor';
  }

  if (input.openReadyToBuyRequests > 0) return 'hot';

  const quietFor = input.quietForDays ?? 0;

  if (quietFor > DORMANT_AFTER_DAYS) return 'dormant';
  if (quietFor >= FOLLOW_UP_AFTER_DAYS) return 'follow_up';

  return 'monitor';
}

/**
 * Which badge colour each action gets.
 *
 * `satisfies Record<CustomerAction, BadgeTone>` is the compile-time link to the tone
 * list the Badge component and the database both use: invent a colour here and this
 * stops building rather than rendering an unstyled pill.
 */
export const customerActionTones = {
  hot: 'error',
  follow_up: 'warning',
  dormant: 'neutral',
  monitor: 'info',
  won: 'success',
  lost: 'neutral',
  none: 'neutral',
} as const satisfies Record<CustomerAction, BadgeTone>;

/**
 * New or repeat.
 *
 * A single word, but the one the whole exercise is aimed at: a customer who came
 * back has told you the product was right, which no first message can.
 */
export function customerType(totalRequests: number): 'New' | 'Repeat' {
  return totalRequests > 1 ? 'Repeat' : 'New';
}
