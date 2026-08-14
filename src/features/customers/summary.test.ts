import { describe, expect, it } from 'vitest';

import {
  customerActionPriority,
  customerActions,
  customerActionTones,
  customerType,
  DORMANT_AFTER_DAYS,
  FOLLOW_UP_AFTER_DAYS,
  suggestedAction,
  type ActionInput,
} from './summary';

/** Midday in Doha, so that a day's arithmetic cannot be confused by a timezone edge. */
const NOW = new Date('2026-03-10T09:00:00.000Z');

/** An open enquiry, contacted today, with nothing special about it. */
function input(overrides: Partial<ActionInput> = {}): ActionInput {
  return {
    totalRequests: 1,
    openRequests: 1,
    openReadyToBuyRequests: 0,
    lastContactAt: NOW.toISOString(),
    latestIsWon: false,
    latestIsTerminal: false,
    ...overrides,
  };
}

/** `days` before NOW, at the same time of day. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('suggestedAction', () => {
  it('says there is nothing to do for a customer with no enquiries', () => {
    expect(suggestedAction(input({ totalRequests: 0, openRequests: 0 }), NOW)).toBe('none');
  });

  it('monitors an open enquiry contacted today', () => {
    expect(suggestedAction(input(), NOW)).toBe('monitor');
  });

  it('calls it hot when they said they are ready to buy', () => {
    expect(suggestedAction(input({ openReadyToBuyRequests: 1 }), NOW)).toBe('hot');
  });

  it('puts ready-to-buy above silence, however long the silence', () => {
    // Someone who said "I'll take it" and then went quiet for a month is the most
    // valuable person on the list, not the stalest.
    const action = suggestedAction(
      input({ openReadyToBuyRequests: 1, lastContactAt: daysAgo(60) }),
      NOW
    );

    expect(action).toBe('hot');
  });

  it('asks for a follow-up once an open enquiry has gone quiet', () => {
    expect(suggestedAction(input({ lastContactAt: daysAgo(FOLLOW_UP_AFTER_DAYS) }), NOW)).toBe(
      'follow_up'
    );
  });

  it('still monitors the day before the follow-up threshold', () => {
    // Guards the boundary in both directions, since off-by-one here means either
    // nagging customers or forgetting them.
    expect(suggestedAction(input({ lastContactAt: daysAgo(FOLLOW_UP_AFTER_DAYS - 1) }), NOW)).toBe(
      'monitor'
    );
  });

  it('marks an enquiry dormant after long silence', () => {
    expect(suggestedAction(input({ lastContactAt: daysAgo(DORMANT_AFTER_DAYS + 1) }), NOW)).toBe(
      'dormant'
    );
  });

  it('still asks for a follow-up on the dormant boundary itself', () => {
    expect(suggestedAction(input({ lastContactAt: daysAgo(DORMANT_AFTER_DAYS) }), NOW)).toBe(
      'follow_up'
    );
  });

  it('reports a sale when everything is closed and the last one was won', () => {
    const action = suggestedAction(
      input({ openRequests: 0, latestIsWon: true, latestIsTerminal: true }),
      NOW
    );

    expect(action).toBe('won');
  });

  it('reports a loss when everything is closed and the last one was not won', () => {
    const action = suggestedAction(
      input({ openRequests: 0, latestIsWon: false, latestIsTerminal: true }),
      NOW
    );

    expect(action).toBe('lost');
  });

  it('does not claim a sale for an old delivery when a new enquiry is open', () => {
    // A repeat customer whose previous order was delivered and who has just asked
    // again must appear as work to do, not as a closed sale.
    const action = suggestedAction(
      input({ totalRequests: 2, openRequests: 1, latestIsWon: true, latestIsTerminal: true }),
      NOW
    );

    expect(action).toBe('monitor');
  });

  it('falls back to monitor when the counts and the latest status disagree', () => {
    // Should not happen: no open enquiries but the last one is not terminal either.
    // A wrong-looking row in the list is better than a crash or a false "lost".
    const action = suggestedAction(
      input({ openRequests: 0, latestIsWon: false, latestIsTerminal: false }),
      NOW
    );

    expect(action).toBe('monitor');
  });

  it('treats a missing contact date as today rather than as ancient', () => {
    // Null only happens on data we have not seen properly. Guessing "ancient" would
    // push it to the top of the follow-up list on no evidence at all.
    expect(suggestedAction(input({ lastContactAt: null }), NOW)).toBe('monitor');
  });
});

describe('the action set', () => {
  it('gives every action a label, a description, a tone and a priority', () => {
    for (const action of customerActions) {
      expect(customerActionPriority[action], action).toBeTypeOf('number');
      expect(customerActionTones[action], action).toBeTypeOf('string');
    }
  });

  it('has no two actions sharing a priority', () => {
    const priorities = Object.values(customerActionPriority);
    expect(new Set(priorities).size).toBe(priorities.length);
  });

  it('sorts hot first and no-enquiries last', () => {
    const sorted = [...customerActions].sort(
      (a, b) => customerActionPriority[a] - customerActionPriority[b]
    );

    expect(sorted[0]).toBe('hot');
    expect(sorted.at(-1)).toBe('none');
  });
});

describe('customerType', () => {
  it('is new for one enquiry and repeat for more', () => {
    expect(customerType(0)).toBe('New');
    expect(customerType(1)).toBe('New');
    expect(customerType(2)).toBe('Repeat');
  });
});
