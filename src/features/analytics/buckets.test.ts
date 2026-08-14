import { describe, expect, it } from 'vitest';

import { bucketLabel, bucketsBetween, grainFor, labelled, startOfBucket } from './buckets';

describe('grainFor', () => {
  it('keeps a readable number of points at every span', () => {
    expect(grainFor(7)).toBe('day');
    expect(grainFor(30)).toBe('day');
    expect(grainFor(90)).toBe('week');
    expect(grainFor(365)).toBe('week');
    expect(grainFor(1000)).toBe('month');
  });

  it('bucket an unbounded range by month', () => {
    expect(grainFor(null)).toBe('month');
  });
});

describe('startOfBucket', () => {
  it('truncates a week to its Monday, the way Postgres does', () => {
    // 14 August 2026 is a Friday.
    expect(startOfBucket('2026-08-14', 'week')).toBe('2026-08-10');
    expect(startOfBucket('2026-08-10', 'week')).toBe('2026-08-10');
    // The Sunday belongs to the week that began the previous Monday.
    expect(startOfBucket('2026-08-16', 'week')).toBe('2026-08-10');
  });

  it('truncates a month to the first', () => {
    expect(startOfBucket('2026-08-14', 'month')).toBe('2026-08-01');
  });
});

describe('bucketsBetween', () => {
  it('includes both ends', () => {
    expect(bucketsBetween('2026-08-12', '2026-08-14', 'day')).toEqual([
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
    ]);
  });

  it('crosses a month boundary by the calendar', () => {
    expect(bucketsBetween('2026-07-30', '2026-08-02', 'day')).toEqual([
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
    ]);
  });

  it('steps weeks from Monday to Monday', () => {
    expect(bucketsBetween('2026-08-12', '2026-08-31', 'week')).toEqual([
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ]);
  });

  it('steps whole months, not 30-day blocks', () => {
    // Twelve additions of 30 days would land five days short of the year and produce
    // thirteen buckets, two of them in the same month.
    const months = bucketsBetween('2025-09-14', '2026-08-14', 'month');

    expect(months).toHaveLength(12);
    expect(months.at(0)).toBe('2025-09-01');
    expect(months.at(-1)).toBe('2026-08-01');
  });

  it('handles a leap day', () => {
    expect(bucketsBetween('2028-02-27', '2028-03-01', 'day')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('is a single bucket when both ends are the same', () => {
    expect(bucketsBetween('2026-08-14', '2026-08-14', 'day')).toEqual(['2026-08-14']);
  });
});

describe('bucketLabel', () => {
  it('labels days and weeks by date, months by name', () => {
    expect(bucketLabel('2026-08-14', 'day')).toBe('14 Aug');
    expect(bucketLabel('2026-08-10', 'week')).toBe('10 Aug');
    expect(bucketLabel('2026-08-01', 'month')).toBe('Aug 26');
  });

  it('reads the date in business time, not the server timezone', () => {
    // The bucket key is a Doha calendar date. Formatted in UTC it would come out as the
    // 13th, because Doha midnight is 21:00 the previous day.
    expect(bucketLabel('2026-08-14', 'day')).not.toBe('13 Aug');
  });
});

describe('labelled', () => {
  it('keeps values beside their labels', () => {
    expect(labelled([{ bucket: '2026-08-14', value: 3 }], 'day')).toEqual([
      { label: '14 Aug', value: 3 },
    ]);
  });
});
