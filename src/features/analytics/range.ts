/**
 * The date range every analytics board is read through.
 *
 * Deliberately domain-agnostic. Leads are the only thing measured today, but stock,
 * spending, income and margin are all coming, and every one of them is asked the same
 * question first: over what period? Putting that question here means each new board
 * inherits the range control, the presets, the previous-period comparison and the
 * business-timezone handling instead of inventing its own.
 *
 * WHY A PRESET AND NOT JUST TWO DATES
 * "Last 30 days" is what someone actually wants, and it should stay correct tomorrow -
 * a bookmarked `?from=2026-07-15&to=2026-08-14` silently becomes "that fortnight in
 * July" the moment it is reopened. So a range is stored as a preset where possible, and
 * only becomes two literal dates when someone picks them.
 *
 * WHY THE PREVIOUS PERIOD IS PART OF THE RANGE
 * A number without a comparison is decoration: 34 enquiries is good news or bad news
 * depending on last month. Every range therefore knows the equal-length period
 * immediately before it, so any metric can show a delta without each board working out
 * its own idea of "before".
 */
import { z } from 'zod';

import {
  APP_TIMEZONE,
  calendarDaysAgo,
  daysBetween,
  endOfCalendarDay,
  shiftCalendarDay,
  startOfCalendarDay,
  todayInBusinessTime,
} from '@/lib/time';

import { DEFAULT_PRESET, rangePresetKeys, rangePresets, type RangePreset } from './presets';

// Re-exported so a server module has one import for the whole concept. The client must
// import from './presets' directly: this file reaches the database's timezone config.
export { DEFAULT_PRESET, rangePresets, type RangePreset };

/** `YYYY-MM-DD`, or nothing. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)
  .transform((value) => value ?? undefined);

/**
 * Same forgiving parsing as the list filters: a query string is user input arriving
 * from an old bookmark, and a stale one should give a sensible report rather than a
 * validation page.
 */
export const rangeSchema = z.object({
  range: z
    .enum(rangePresetKeys)
    .optional()
    .catch(undefined)
    .transform((value) => value ?? DEFAULT_PRESET),
  from: day,
  to: day,
});

export interface DateRange {
  /** Which preset produced this, so the control can show it selected. */
  preset: RangePreset;
  /** Inclusive first calendar day, business time, `YYYY-MM-DD`. Null means all time. */
  from: string | null;
  /** Inclusive last calendar day, business time, `YYYY-MM-DD`. */
  to: string;
  /** How many calendar days the range covers. Null when it is all time. */
  days: number | null;
  /** The equal-length period immediately before, for deltas. Null when all time. */
  previous: { from: string; to: string } | null;
  /** A phrase for the page, e.g. "1 Jul - 14 Aug 2026". */
  label: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Turns search params into a resolved range.
 *
 * `now` is injectable so the tests are not a description of the day they were written.
 */
export function parseRange(raw: RawSearchParams, now: Date = new Date()): DateRange {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
  );

  const parsed = rangeSchema.safeParse(flat);
  const input = parsed.success ? parsed.data : rangeSchema.parse({});

  const today = todayInBusinessTime();

  // Custom wins only if it carries at least one date. A `?range=custom` with no dates
  // is what a half-submitted form produces, and it should read as the default rather
  // than as an empty report.
  if (input.range === 'custom' && (input.from !== undefined || input.to !== undefined)) {
    const from = input.from ?? calendarDaysAgo(rangePresets['30d'].days - 1, now);
    const to = input.to ?? today;

    // Swapped dates are a slip, not an error worth a page about.
    const [start, end] = from <= to ? [from, to] : [to, from];

    return resolve('custom', start, end);
  }

  const preset = input.range === 'custom' ? DEFAULT_PRESET : input.range;
  const days = rangePresets[preset].days;

  if (days === null) {
    return {
      preset,
      from: null,
      to: today,
      days: null,
      previous: null,
      label: 'All time',
    };
  }

  // Inclusive of today, so "last 7 days" is today and the six before it - not eight.
  return resolve(preset, calendarDaysAgo(days - 1, now), today);
}

function resolve(preset: RangePreset, from: string, to: string): DateRange {
  // Inclusive: a single day is one day, not zero.
  const days = daysBetween(startOfCalendarDay(from), startOfCalendarDay(to)) + 1;

  return {
    preset,
    from,
    to,
    days,
    previous: {
      from: shiftCalendarDay(from, -days),
      to: shiftCalendarDay(from, -1),
    },
    label: formatRangeLabel(from, to),
  };
}

/** e.g. `1 Jul – 14 Aug 2026`, dropping the year when both dates share it. */
export function formatRangeLabel(from: string, to: string): string {
  const start = startOfCalendarDay(from);
  const end = startOfCalendarDay(to);

  if (from === to) return fullDay.format(start);

  const sameYear = from.slice(0, 4) === to.slice(0, 4);

  return `${(sameYear ? dayAndMonth : fullDay).format(start)} – ${fullDay.format(end)}`;
}

// Both formatters are pinned to business time. Without that they would read the Doha
// midnight instants above in the server's own timezone, and a container running in UTC
// would label every range a day early.
const dayAndMonth = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'short',
});

const fullDay = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** The range as SQL-ready instants: the whole of the first day to the whole of the last. */
export function rangeInstants(range: { from: string | null; to: string }): {
  from: string | null;
  to: string;
} {
  return {
    from: range.from === null ? null : startOfCalendarDay(range.from).toISOString(),
    to: endOfCalendarDay(range.to).toISOString(),
  };
}

/** The range as a query string, with the default preset left out. */
export function toSearchParams(
  range: Pick<DateRange, 'preset' | 'from' | 'to'>,
  extra: Record<string, string | number | undefined> = {}
): string {
  const params = new URLSearchParams();

  if (range.preset === 'custom') {
    params.set('range', 'custom');
    if (range.from !== null) params.set('from', range.from);
    params.set('to', range.to);
  } else if (range.preset !== DEFAULT_PRESET) {
    params.set('range', range.preset);
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }

  params.sort();
  const query = params.toString();

  return query === '' ? '' : `?${query}`;
}
