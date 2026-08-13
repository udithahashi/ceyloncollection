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
import { differenceInCalendarDays, endOfDay, startOfDay } from 'date-fns';

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

/** The calendar date of `instant` in `timeZone`, as `YYYY-MM-DD`. */
export function calendarDateInZone(instant: Date | string | number, timeZone: string): string {
  const zoned = inZone(instant, timeZone);
  const month = String(zoned.getMonth() + 1).padStart(2, '0');
  const day = String(zoned.getDate()).padStart(2, '0');
  return `${zoned.getFullYear()}-${month}-${day}`;
}
