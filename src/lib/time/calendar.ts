/**
 * Timezone-aware calendar maths.
 *
 * Every date figure the business cares about - "Days Since Contact", leads per
 * day, this week's inquiries - is a question about *calendar days in Doha*, not
 * about elapsed hours in UTC. Those two answers differ, and the difference is
 * visible to the user:
 *
 *   A customer messages at 01:00 on Tuesday, Doha time. That instant is 22:00
 *   Monday in UTC. Asked on Tuesday afternoon, "how many days since contact?"
 *   must answer 0. Naive UTC arithmetic answers 1, and the lead looks staler
 *   than it is.
 *
 * These functions are deliberately pure and take the timezone explicitly, so
 * they are trivially testable and cannot accidentally depend on the server's
 * local timezone. The env-bound convenience wrappers live in ./index.ts.
 */
import { TZDate } from '@date-fns/tz';
import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';

/** Reinterprets an instant in the given timezone without shifting the instant. */
export function inZone(instant: Date | string | number, timeZone: string): TZDate {
  return new TZDate(new Date(instant), timeZone);
}

/** The first millisecond of the day that `instant` falls on, in `timeZone`. */
export function startOfDayInZone(instant: Date | string | number, timeZone: string): Date {
  return new Date(startOfDay(inZone(instant, timeZone)).getTime());
}

/** The last millisecond of the day that `instant` falls on, in `timeZone`. */
export function endOfDayInZone(instant: Date | string | number, timeZone: string): Date {
  return new Date(endOfDay(inZone(instant, timeZone)).getTime());
}

/**
 * Midnight at the start of a `YYYY-MM-DD` date, in `timeZone`.
 *
 * The counterpart to `calendarDateInZone`, and the only correct way to turn a date
 * picked in a form into an instant. The tempting one-liner -
 * `startOfDayInZone(new Date('2026-03-04T00:00:00'), tz)` - parses the string in the
 * *server's* timezone, so it produces different instants on a laptop and in a
 * container, and lands on the wrong calendar day whenever the two are far enough
 * apart. Building the date from its components in the target zone has no such
 * ambiguity.
 *
 * @param day `YYYY-MM-DD`
 */
export function startOfCalendarDayInZone(day: string, timeZone: string): Date {
  const parts = day.split('-').map(Number);

  // `Number('abc')` is NaN rather than undefined, and a NaN reaches TZDate happily to
  // produce an Invalid Date - which then fails much later, somewhere less obvious.
  if (parts.length !== 3 || !parts.every(Number.isFinite)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${day}".`);
  }

  // The defaults are unreachable after the check above; they exist so the tuple is
  // typed without a non-null assertion.
  const [year = 0, month = 1, date = 1] = parts;

  return new Date(new TZDate(year, month - 1, date, 0, 0, 0, 0, timeZone).getTime());
}

/** The last millisecond of a `YYYY-MM-DD` date, in `timeZone`. */
export function endOfCalendarDayInZone(day: string, timeZone: string): Date {
  return endOfDayInZone(startOfCalendarDayInZone(day, timeZone), timeZone);
}

/**
 * Whole calendar days from `from` to `to`, counted in `timeZone`.
 *
 * Counts day boundaries crossed, not 24-hour blocks: 23:30 yesterday to 00:30
 * today is 1 day, because it is a different date on the calendar.
 *
 * Negative when `to` precedes `from`.
 */
export function daysBetweenInZone(
  from: Date | string | number,
  to: Date | string | number,
  timeZone: string
): number {
  return differenceInCalendarDays(inZone(to, timeZone), inZone(from, timeZone));
}

/**
 * Calendar days elapsed since `instant`, counted in `timeZone`.
 *
 * This is the "Days Since Contact" column. Today is 0, yesterday is 1.
 */
export function daysSinceInZone(
  instant: Date | string | number,
  timeZone: string,
  now: Date = new Date()
): number {
  return daysBetweenInZone(instant, now, timeZone);
}

/** True when both instants fall on the same calendar date in `timeZone`. */
export function isSameDayInZone(
  a: Date | string | number,
  b: Date | string | number,
  timeZone: string
): boolean {
  return daysBetweenInZone(a, b, timeZone) === 0;
}

/**
 * The Monday of the week a `YYYY-MM-DD` date falls in, in `timeZone`.
 *
 * Monday because that is where Postgres's `date_trunc('week', ...)` starts, and a
 * weekly chart whose spine disagrees with its data by one day shows every bucket empty.
 */
export function startOfCalendarWeekInZone(day: string, timeZone: string): string {
  const local = inZone(startOfCalendarDayInZone(day, timeZone), timeZone);
  return calendarDateInZone(startOfWeek(local, { weekStartsOn: 1 }), timeZone);
}

/**
 * A `YYYY-MM-DD` date moved by whole calendar days, still as `YYYY-MM-DD`.
 *
 * Calendar arithmetic rather than adding 86,400,000 milliseconds: those two agree in
 * Qatar, which has no daylight saving, and disagree twice a year anywhere that does.
 * Reports are read from other timezones, and a report that loses a day in October is
 * worse than one that is simply wrong.
 */
export function shiftCalendarDayInZone(day: string, by: number, timeZone: string): string {
  return calendarDateInZone(addDays(startOfCalendarDayInZone(day, timeZone), by), timeZone);
}

/**
 * The calendar date `days` before today in `timeZone`, as `YYYY-MM-DD`.
 *
 * For turning "quiet for 7 days" into a date a query can compare against. Counted in
 * calendar days rather than by subtracting milliseconds, so it agrees with
 * `daysSinceInZone` - the two are used on the same screen, and a filter that disagrees
 * with the column beside it looks like a bug in both.
 */
export function calendarDaysAgoInZone(
  days: number,
  timeZone: string,
  now: Date = new Date()
): string {
  return calendarDateInZone(subDays(inZone(now, timeZone), days), timeZone);
}

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function calendarDateInZone(instant: Date | string | number, timeZone: string): string {
  const zoned = inZone(instant, timeZone);
  const month = String(zoned.getMonth() + 1).padStart(2, '0');
  const day = String(zoned.getDate()).padStart(2, '0');
  return `${zoned.getFullYear()}-${month}-${day}`;
}
