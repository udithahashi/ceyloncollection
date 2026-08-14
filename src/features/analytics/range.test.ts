import { describe, expect, it } from 'vitest';

import { DEFAULT_PRESET, parseRange, rangeInstants, toSearchParams } from './range';

/**
 * A fixed instant to reason from: 14 August 2026, 09:00 UTC, which is midday in Doha.
 * Every expectation below is a business-time calendar date.
 */
const now = new Date('2026-08-14T09:00:00.000Z');

describe('parseRange', () => {
  it('defaults to the last 30 days, today included', () => {
    const range = parseRange({}, now);

    expect(range.preset).toBe(DEFAULT_PRESET);
    expect(range.to).toBe('2026-08-14');
    // 30 days ending today, so it starts on the 29th day back - not the 30th.
    expect(range.from).toBe('2026-07-16');
    expect(range.days).toBe(30);
  });

  it('compares against the equal-length period immediately before', () => {
    const range = parseRange({ range: '7d' }, now);

    expect(range.from).toBe('2026-08-08');
    expect(range.days).toBe(7);
    expect(range.previous).toEqual({ from: '2026-08-01', to: '2026-08-07' });
  });

  it('offers no comparison for all time, because there is nothing before it', () => {
    const range = parseRange({ range: 'all' }, now);

    expect(range.from).toBeNull();
    expect(range.days).toBeNull();
    expect(range.previous).toBeNull();
    expect(range.label).toBe('All time');
  });

  it('accepts custom dates', () => {
    const range = parseRange({ range: 'custom', from: '2026-06-01', to: '2026-06-30' }, now);

    expect(range).toMatchObject({
      preset: 'custom',
      from: '2026-06-01',
      to: '2026-06-30',
      days: 30,
    });
    expect(range.previous).toEqual({ from: '2026-05-02', to: '2026-05-31' });
  });

  it('reads swapped custom dates the way they were meant', () => {
    const range = parseRange({ range: 'custom', from: '2026-06-30', to: '2026-06-01' }, now);

    expect(range.from).toBe('2026-06-01');
    expect(range.to).toBe('2026-06-30');
  });

  it('treats a custom range with no dates as the default', () => {
    // What a half-submitted form produces. It should read as a normal report rather than
    // an empty one.
    expect(parseRange({ range: 'custom' }, now).preset).toBe(DEFAULT_PRESET);
  });

  it('falls back to the default rather than failing on nonsense', () => {
    // A stale bookmark is user input; it should not produce a validation page.
    const range = parseRange({ range: 'last-fortnight', from: 'yesterday' }, now);

    expect(range.preset).toBe(DEFAULT_PRESET);
    expect(range.from).toBe('2026-07-16');
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseRange({ range: ['7d', '90d'] }, now).days).toBe(7);
  });

  it('labels a range in prose, dropping the repeated year', () => {
    expect(parseRange({ range: 'custom', from: '2026-07-01', to: '2026-08-14' }, now).label).toBe(
      '1 Jul – 14 Aug 2026'
    );

    expect(parseRange({ range: 'custom', from: '2025-12-30', to: '2026-01-02' }, now).label).toBe(
      '30 Dec 2025 – 2 Jan 2026'
    );

    expect(parseRange({ range: 'custom', from: '2026-08-14', to: '2026-08-14' }, now).label).toBe(
      '14 Aug 2026'
    );
  });
});

describe('rangeInstants', () => {
  it('covers whole business-time days, so nothing on the boundary is missed', () => {
    const instants = rangeInstants({ from: '2026-08-01', to: '2026-08-14' });

    // Qatar is UTC+3: local midnight is 21:00 the day before, and the last millisecond
    // of the 14th is 20:59:59.999 UTC.
    expect(instants.from).toBe('2026-07-31T21:00:00.000Z');
    expect(instants.to).toBe('2026-08-14T20:59:59.999Z');
  });

  it('leaves an all-time range open at the start', () => {
    expect(rangeInstants({ from: null, to: '2026-08-14' }).from).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('leaves the default preset out of the URL', () => {
    expect(toSearchParams({ preset: '30d', from: '2026-07-16', to: '2026-08-14' })).toBe('');
  });

  it('names any other preset', () => {
    expect(toSearchParams({ preset: '90d', from: null, to: '2026-08-14' })).toBe('?range=90d');
  });

  it('carries both dates for a custom range', () => {
    expect(toSearchParams({ preset: 'custom', from: '2026-06-01', to: '2026-06-30' })).toBe(
      '?from=2026-06-01&range=custom&to=2026-06-30'
    );
  });
});
