/**
 * Turning a long tail into a readable chart.
 *
 * There are 389 taxonomy values in this business - 200-odd sub-categories alone - and a
 * bar chart with 200 bars communicates nothing. Every categorical chart therefore shows
 * the leading few and folds the rest into one bar, so the reader learns "batik frocks
 * and cotton sarees, then a long tail" instead of squinting at a barcode.
 *
 * Shared rather than per-board on purpose: expense categories, suppliers and SKUs will
 * all have the same shape of long tail, and they should all be summarised the same way
 * so a number means the same thing wherever it appears.
 */

/** One row of a categorical count, as the queries return it. */
export interface Slice {
  /** What is being counted, already resolved to its display name. */
  label: string;
  value: number;
  /**
   * A design-token tone when the dimension carries one - statuses and urgency levels
   * do. Lets a chart use the same colour the badge uses elsewhere.
   */
  tone?: string | null;
}

export interface SliceSet {
  slices: Slice[];
  /** Sum across every slice, folded ones included. Denominator for shares. */
  total: number;
  /** How many rows were folded into "Other", so the chart can say so. */
  folded: number;
}

/**
 * The `limit` largest slices, with anything beyond them folded into one.
 *
 * The fold keeps the total honest: shares still add to 100%, which they would not if
 * the tail were simply dropped. A tail of exactly one is left alone - "Other: 3" where
 * the label could have said "Denim: 3" is a worse chart, not a tidier one.
 */
export function topSlices(
  rows: readonly Slice[],
  limit = 8,
  otherLabel = 'Everything else'
): SliceSet {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const total = sorted.reduce((sum, row) => sum + row.value, 0);

  if (sorted.length <= limit + 1) {
    return { slices: sorted, total, folded: 0 };
  }

  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);

  return {
    slices: [
      ...head,
      {
        label: otherLabel,
        value: tail.reduce((sum, row) => sum + row.value, 0),
        tone: null,
      },
    ],
    total,
    folded: tail.length,
  };
}

/** A slice's share of the total, as a percentage rounded to one decimal. */
export function share(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

/**
 * The change from one period to the next, as a signed percentage.
 *
 * Null when the previous period was zero, because "up 100%" from a base of nothing is
 * arithmetic dressed up as insight. The UI shows "no comparison" instead.
 */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
