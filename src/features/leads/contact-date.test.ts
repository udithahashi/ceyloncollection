import { describe, expect, it } from 'vitest';

import { calendarDateInZone } from '@/lib/time/calendar';

import { isFutureDay, resolveContactedAt } from './contact-date';

const QATAR = 'Asia/Qatar';

describe('resolveContactedAt', () => {
  it('uses the current instant when no date is given', () => {
    const now = new Date('2026-03-04T09:30:00.000Z');
    expect(resolveContactedAt(null, QATAR, now)).toBe(now.toISOString());
  });

  it('keeps the current time when the date entered is today', () => {
    // Entering today's date should not throw away the time of day: "contacted 10
    // minutes ago" has to stay true for a lead typed in as it arrives.
    const now = new Date('2026-03-04T09:30:00.000Z');
    expect(resolveContactedAt('2026-03-04', QATAR, now)).toBe(now.toISOString());
  });

  it('recognises today across the Doha day boundary', () => {
    // 01:00 Wednesday in Doha is 22:00 Tuesday in UTC. Entering Wednesday's date must
    // count as today, or the time is discarded for every lead typed after midnight.
    const now = new Date('2026-03-03T22:00:00.000Z');
    expect(calendarDateInZone(now, QATAR)).toBe('2026-03-04');
    expect(resolveContactedAt('2026-03-04', QATAR, now)).toBe(now.toISOString());
  });

  it('uses the start of the day in Doha for an earlier date', () => {
    const now = new Date('2026-03-10T09:30:00.000Z');

    // Midnight on 4 March in Doha is 21:00 on 3 March in UTC.
    expect(resolveContactedAt('2026-03-04', QATAR, now)).toBe('2026-03-03T21:00:00.000Z');
  });

  it('lands on the intended Doha date, not the UTC one', () => {
    // The whole point of the exercise: read the stored instant back in Doha and it
    // must be the date that was typed.
    const now = new Date('2026-03-10T09:30:00.000Z');
    const stored = resolveContactedAt('2026-03-04', QATAR, now);

    expect(calendarDateInZone(stored, QATAR)).toBe('2026-03-04');
  });

  it('is stable for every day of a month, in timezones either side of UTC', () => {
    // The regression guard for this module. An implementation that parses the date in
    // the server's own timezone, or anchors it at noon UTC, passes in Doha and fails
    // at UTC+13 - which is the kind of bug that only appears in production logs.
    const now = new Date('2026-05-01T00:00:00.000Z');

    for (let date = 1; date <= 31; date += 1) {
      const day = `2026-03-${String(date).padStart(2, '0')}`;

      for (const zone of ['Asia/Qatar', 'America/New_York', 'Pacific/Auckland']) {
        const stored = resolveContactedAt(day, zone, now);
        expect(calendarDateInZone(stored, zone), `${day} in ${zone}`).toBe(day);
      }
    }
  });
});

describe('isFutureDay', () => {
  it('is false for today and the past', () => {
    const now = new Date('2026-03-04T09:30:00.000Z');
    expect(isFutureDay('2026-03-04', QATAR, now)).toBe(false);
    expect(isFutureDay('2026-03-03', QATAR, now)).toBe(false);
  });

  it('is true for tomorrow', () => {
    const now = new Date('2026-03-04T09:30:00.000Z');
    expect(isFutureDay('2026-03-05', QATAR, now)).toBe(true);
  });

  it('judges "today" in business time, not UTC', () => {
    // 22:00 Tuesday UTC is already Wednesday in Doha, so Wednesday is not the future.
    const now = new Date('2026-03-03T22:00:00.000Z');
    expect(isFutureDay('2026-03-04', QATAR, now)).toBe(false);
    expect(isFutureDay('2026-03-05', QATAR, now)).toBe(true);
  });
});
