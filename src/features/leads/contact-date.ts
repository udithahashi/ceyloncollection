/**
 * Turning "the date they contacted us" into an instant.
 *
 * The form collects a calendar day, because a day is all anyone knows: the message
 * said Tuesday. The database stores a `timestamptz`, because every other date
 * question - which week, how many days since, group by month - needs a real instant to
 * be answered without ambiguity. Something has to bridge the two, and doing it
 * carelessly produces one of two familiar bugs:
 *
 *   - Store midnight UTC for a Doha date, and every lead entered before 03:00 Doha
 *     time lands on the previous day in every report.
 *   - Store `now()` regardless of the date entered, and back-filling last week's
 *     enquiries makes them all look like today's demand.
 *
 * So: today keeps the current time, which is accurate and useful. Any other day gets
 * the start of that day in business time, which is honest about knowing only the date.
 */
import { calendarDateInZone, startOfCalendarDayInZone } from '@/lib/time/calendar';

/**
 * @param day `YYYY-MM-DD` in business time, or null for "now"
 * @param timeZone the business timezone
 * @param now injected so the behaviour is testable
 * @returns an ISO instant for the `contacted_at` column
 */
export function resolveContactedAt(
  day: string | null,
  timeZone: string,
  now: Date = new Date()
): string {
  if (day === null) return now.toISOString();

  // The date entered is today in business time, so the current clock time is the
  // best answer available - and the one that makes "contacted 10 minutes ago" true.
  if (day === calendarDateInZone(now, timeZone)) return now.toISOString();

  // Only the date is known, so the start of that day in business time is the honest
  // answer. `startOfCalendarDayInZone` builds it from the components in the target
  // timezone, which is what keeps the result independent of the server's own clock.
  return startOfCalendarDayInZone(day, timeZone).toISOString();
}

/**
 * Whether a contact date is in the future, in business time.
 *
 * Refused rather than corrected: a future date is always a typo, and a lead dated
 * next month would sit at the top of the list until the date arrived.
 */
export function isFutureDay(day: string, timeZone: string, now: Date = new Date()): boolean {
  return day > calendarDateInZone(now, timeZone);
}
