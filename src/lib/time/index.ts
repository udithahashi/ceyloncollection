/**
 * Application-facing date helpers, pre-bound to the business timezone.
 *
 * Use these in features. The pure, timezone-explicit versions live in
 * ./calendar and are what the tests exercise.
 *
 * Rule for the whole codebase: store instants in UTC (`timestamptz`), and only
 * convert to the business timezone at the edges - when displaying a date, or
 * when grouping records by day for a report.
 */
import { env } from '@/lib/env';

import {
  calendarDateInZone,
  calendarDaysAgoInZone,
  daysBetweenInZone,
  daysSinceInZone,
  endOfCalendarDayInZone,
  endOfDayInZone,
  isSameDayInZone,
  startOfCalendarDayInZone,
  startOfDayInZone,
} from './calendar';

/** The configured business timezone, e.g. `Asia/Qatar`. */
export const APP_TIMEZONE = env.APP_TIMEZONE;

/** Calendar days elapsed since `instant`, in business time. Today is 0. */
export const daysSince = (instant: Date | string | number, now?: Date) =>
  daysSinceInZone(instant, APP_TIMEZONE, now);

/** Whole calendar days from `from` to `to`, in business time. */
export const daysBetween = (from: Date | string | number, to: Date | string | number) =>
  daysBetweenInZone(from, to, APP_TIMEZONE);

/** True when both instants land on the same business-time date. */
export const isSameDay = (a: Date | string | number, b: Date | string | number) =>
  isSameDayInZone(a, b, APP_TIMEZONE);

/** Midnight at the start of the business-time day containing `instant`. */
export const startOfBusinessDay = (instant: Date | string | number) =>
  startOfDayInZone(instant, APP_TIMEZONE);

/** The final millisecond of the business-time day containing `instant`. */
export const endOfBusinessDay = (instant: Date | string | number) =>
  endOfDayInZone(instant, APP_TIMEZONE);

/** The business-time calendar date as `YYYY-MM-DD`, for grouping and CSV export. */
export const businessDate = (instant: Date | string | number) =>
  calendarDateInZone(instant, APP_TIMEZONE);

/** Midnight at the start of a `YYYY-MM-DD` date, in business time. */
export const startOfCalendarDay = (day: string) => startOfCalendarDayInZone(day, APP_TIMEZONE);

/** The final millisecond of a `YYYY-MM-DD` date, in business time. */
export const endOfCalendarDay = (day: string) => endOfCalendarDayInZone(day, APP_TIMEZONE);

/** Today's date in business time, as `YYYY-MM-DD`. For defaulting a date input. */
export const todayInBusinessTime = () => calendarDateInZone(new Date(), APP_TIMEZONE);

/** The date `days` ago in business time, as `YYYY-MM-DD`. For "quiet for a week". */
export const calendarDaysAgo = (days: number, now?: Date) =>
  calendarDaysAgoInZone(days, APP_TIMEZONE, now);

/**
 * Formatters are constructed once and reused. Building an Intl.DateTimeFormat is
 * comparatively expensive, and a leads table renders hundreds of dates per page.
 */
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** e.g. `04 Mar 2026` */
export const formatDate = (instant: Date | string | number) =>
  dateFormatter.format(new Date(instant));

/** e.g. `04 Mar 2026, 13:05` */
export const formatDateTime = (instant: Date | string | number) =>
  dateTimeFormatter.format(new Date(instant));

/**
 * A short human phrase for how stale a lead is, for use next to the raw date.
 * Kept deliberately plain: "3 days ago" is easier to scan in a table than
 * "3 days, 4 hours ago".
 */
export function formatDaysSince(instant: Date | string | number, now?: Date): string {
  const days = daysSince(instant, now);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 0) return `in ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  return `${days} days ago`;
}
