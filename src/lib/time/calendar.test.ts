import { describe, expect, it } from 'vitest';

import {
  calendarDateInZone,
  daysBetweenInZone,
  daysSinceInZone,
  isSameDayInZone,
  startOfDayInZone,
} from './calendar';

const QATAR = 'Asia/Qatar'; // UTC+3 year round, no daylight saving.

describe('calendarDateInZone', () => {
  it('reports the Doha date, not the UTC date, for late-evening instants', () => {
    // 22:00 UTC on 3 March is already 01:00 on 4 March in Doha.
    expect(calendarDateInZone('2026-03-03T22:00:00Z', QATAR)).toBe('2026-03-04');
    expect(calendarDateInZone('2026-03-03T22:00:00Z', 'UTC')).toBe('2026-03-03');
  });

  it('handles an instant early in the Doha morning', () => {
    expect(calendarDateInZone('2026-03-04T05:30:00Z', QATAR)).toBe('2026-03-04');
  });
});

describe('daysBetweenInZone', () => {
  it('counts calendar boundaries crossed, not elapsed hours', () => {
    // Only one hour apart, but on different Doha dates.
    const late = '2026-03-03T20:30:00Z'; // 23:30 Doha, 3 March
    const early = '2026-03-03T21:30:00Z'; // 00:30 Doha, 4 March
    expect(daysBetweenInZone(late, early, QATAR)).toBe(1);
  });

  it('returns 0 for two instants on the same Doha day, hours apart', () => {
    const morning = '2026-03-04T05:00:00Z'; // 08:00 Doha
    const evening = '2026-03-04T18:00:00Z'; // 21:00 Doha
    expect(daysBetweenInZone(morning, evening, QATAR)).toBe(0);
  });

  it('is negative when the second instant is earlier', () => {
    expect(daysBetweenInZone('2026-03-10T09:00:00Z', '2026-03-08T09:00:00Z', QATAR)).toBe(-2);
  });

  it('counts across a month boundary', () => {
    expect(daysBetweenInZone('2026-01-30T09:00:00Z', '2026-02-02T09:00:00Z', QATAR)).toBe(3);
  });

  it('counts across a leap day', () => {
    expect(daysBetweenInZone('2028-02-28T09:00:00Z', '2028-03-01T09:00:00Z', QATAR)).toBe(2);
  });
});

describe('daysSinceInZone', () => {
  const now = new Date('2026-03-04T10:00:00Z'); // 13:00 Doha, 4 March

  it('reports 0 for a contact made earlier the same Doha day', () => {
    expect(daysSinceInZone('2026-03-04T04:00:00Z', QATAR, now)).toBe(0);
  });

  it('reports 0 for a 01:00 Doha contact, even though UTC calls it yesterday', () => {
    // This is the case that naive UTC maths gets wrong.
    expect(daysSinceInZone('2026-03-03T22:00:00Z', QATAR, now)).toBe(0);
    expect(daysSinceInZone('2026-03-03T22:00:00Z', 'UTC', now)).toBe(1);
  });

  it('reports 1 for yesterday in Doha', () => {
    expect(daysSinceInZone('2026-03-03T12:00:00Z', QATAR, now)).toBe(1);
  });

  it('reports 30 for a month-old lead', () => {
    expect(daysSinceInZone('2026-02-02T12:00:00Z', QATAR, now)).toBe(30);
  });
});

describe('isSameDayInZone', () => {
  it('groups a late-night and next-morning Doha contact as different days', () => {
    expect(isSameDayInZone('2026-03-03T20:30:00Z', '2026-03-03T21:30:00Z', QATAR)).toBe(false);
  });

  it('groups two contacts within the same Doha day', () => {
    expect(isSameDayInZone('2026-03-04T05:00:00Z', '2026-03-04T19:00:00Z', QATAR)).toBe(true);
  });
});

describe('startOfDayInZone', () => {
  it('resolves to 21:00 UTC the previous day, which is midnight in Doha', () => {
    const start = startOfDayInZone('2026-03-04T10:00:00Z', QATAR);
    expect(start.toISOString()).toBe('2026-03-03T21:00:00.000Z');
  });

  it('is idempotent', () => {
    const once = startOfDayInZone('2026-03-04T10:00:00Z', QATAR);
    const twice = startOfDayInZone(once, QATAR);
    expect(twice.toISOString()).toBe(once.toISOString());
  });
});
