/**
 * Time buckets: the spine of any "over time" chart, and its labels.
 *
 * Domain-agnostic on purpose. Enquiries per week and spending per month are the same
 * problem - choose a bucket size for the span, then produce every bucket in it, including
 * the empty ones - and it should have one answer rather than one per board.
 *
 * WHY THE EMPTY BUCKETS MATTER
 * A `group by` returns nothing for a silent week. Draw a line through those rows and it
 * joins the week before to the week after, which reads as steady demand across a gap
 * where there was none. Zero has to be drawn as zero.
 */
import {
  APP_TIMEZONE,
  shiftCalendarDay,
  startOfCalendarDay,
  startOfCalendarWeek,
} from '@/lib/time';

/** How coarsely a series is bucketed. */
export type Grain = 'day' | 'week' | 'month';

/**
 * The bucket size a span deserves.
 *
 * A year of daily bars is 365 bars in 600 pixels - a texture, not a chart. Deciding from
 * the span means nobody has to choose a granularity by hand, and the same period always
 * looks the same way on every board.
 */
export function grainFor(days: number | null): Grain {
  if (days === null) return 'month';
  if (days <= 70) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

/**
 * Every bucket start from `from` to `to` inclusive, as `YYYY-MM-DD`.
 *
 * The spine has to land on exactly the dates Postgres's `date_trunc` produced, or the
 * lookup by key misses and every bucket reads zero - hence Monday weeks and
 * first-of-month months rather than "every 7 days from the start date".
 */
export function bucketsBetween(from: string, to: string, grain: Grain): string[] {
  const buckets: string[] = [];

  let cursor = startOfBucket(from, grain);
  const last = startOfBucket(to, grain);

  // ISO dates compare chronologically as strings, and every step moves forward, so this
  // terminates. The cap is a seatbelt against a future grain that does not.
  while (cursor <= last && buckets.length < 600) {
    buckets.push(cursor);
    cursor = nextBucket(cursor, grain);
  }

  return buckets;
}

/** The bucket a date belongs to. Postgres truncates weeks to Monday; this agrees. */
export function startOfBucket(day: string, grain: Grain): string {
  if (grain === 'day') return day;
  if (grain === 'week') return startOfCalendarWeek(day);
  return `${day.slice(0, 7)}-01`;
}

function nextBucket(day: string, grain: Grain): string {
  if (grain === 'month') {
    // String arithmetic, because a month is not a fixed number of days and the first of
    // the month is all a month bucket ever is.
    const year = Number(day.slice(0, 4));
    const month = Number(day.slice(5, 7));

    return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
  }

  return shiftCalendarDay(day, grain === 'week' ? 7 : 1);
}

/* ---------------------------------------------------------------------- labels */

const dayLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  day: 'numeric',
  month: 'short',
});

const monthLabel = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  month: 'short',
  year: '2-digit',
});

/**
 * A bucket key as an axis label.
 *
 * A weekly bucket is labelled by its Monday with no "week of" prefix: the axis has no
 * room for it, and the chart's own subtitle says the points are weeks.
 */
export function bucketLabel(bucket: string, grain: Grain): string {
  const instant = startOfCalendarDay(bucket);
  return grain === 'month' ? monthLabel.format(instant) : dayLabel.format(instant);
}

/** A whole series, ready for `lineSpec`. */
export function labelled(
  points: readonly { bucket: string; value: number }[],
  grain: Grain
): Array<{ label: string; value: number }> {
  return points.map((point) => ({ label: bucketLabel(point.bucket, grain), value: point.value }));
}

/** The word for a grain, for a chart subtitle. */
export const grainNoun: Record<Grain, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
};
