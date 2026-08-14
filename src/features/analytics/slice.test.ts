import { describe, expect, it } from 'vitest';

import { delta, share, topSlices } from './slice';

const rows = (...values: number[]) =>
  values.map((value, index) => ({ label: `Value ${index + 1}`, value }));

describe('topSlices', () => {
  it('orders largest first', () => {
    const { slices } = topSlices(rows(3, 9, 5), 8);

    expect(slices.map((slice) => slice.value)).toEqual([9, 5, 3]);
  });

  it('breaks ties by label, so the order is stable between requests', () => {
    // Postgres makes no promise about the order of equal counts, and a chart whose bars
    // swap places on refresh looks like changing data.
    const { slices } = topSlices([
      { label: 'Viber', value: 4 },
      { label: 'Imo', value: 4 },
    ]);

    expect(slices.map((slice) => slice.label)).toEqual(['Imo', 'Viber']);
  });

  it('folds the tail into one slice', () => {
    const set = topSlices(rows(10, 9, 8, 7, 6, 5), 3);

    expect(set.slices).toHaveLength(4);
    expect(set.slices.at(-1)).toEqual({ label: 'Everything else', value: 18, tone: null });
    expect(set.folded).toBe(3);
  });

  it('keeps the total honest so shares still add up', () => {
    const set = topSlices(rows(10, 9, 8, 7, 6, 5), 3);

    expect(set.total).toBe(45);
    expect(set.slices.reduce((sum, slice) => sum + slice.value, 0)).toBe(45);
  });

  it('leaves a tail of one alone', () => {
    // "Everything else: 3" where the label could have said "Denim: 3" is a worse chart,
    // not a tidier one.
    const set = topSlices(rows(10, 9, 8, 3), 3);

    expect(set.folded).toBe(0);
    expect(set.slices.map((slice) => slice.label)).not.toContain('Everything else');
  });

  it('handles nothing at all', () => {
    expect(topSlices([])).toEqual({ slices: [], total: 0, folded: 0 });
  });
});

describe('share', () => {
  it('rounds to one decimal', () => {
    expect(share(1, 3)).toBe(33.3);
  });

  it('is zero rather than NaN when there is no total', () => {
    expect(share(0, 0)).toBe(0);
  });
});

describe('delta', () => {
  it('is a signed percentage change', () => {
    expect(delta(12, 10)).toBe(20);
    expect(delta(8, 10)).toBe(-20);
    expect(delta(10, 10)).toBe(0);
  });

  it('refuses to compare against nothing', () => {
    // "Up 100%" from a base of zero is arithmetic dressed as insight.
    expect(delta(7, 0)).toBeNull();
  });
});
