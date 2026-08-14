/**
 * How a chart is described to the client.
 *
 * Plain data, no imports: this crosses the server/client boundary, so everything in it
 * has to survive serialisation, and keeping the module free of runtime imports means a
 * server-only helper can never be dragged into the browser bundle behind it.
 *
 * Adding a chart type is a case here and a branch in `Chart`. Adding a *board* needs
 * neither - income and stock will describe their charts with exactly these three shapes.
 */

/** What the numbers are, so a tooltip can say "3 enquiries" rather than "3". */
export interface ChartUnit {
  one: string;
  many: string;
}

interface Base {
  labels: string[];
  values: number[];
  unit: ChartUnit;
  /**
   * Denominator for the percentage in tooltips. Pass the true total when the chart shows
   * only the leading slices, so the shares still refer to everything rather than to
   * what happens to be drawn.
   */
  total?: number;
}

export type ChartSpec =
  | (Base & { kind: 'line' })
  | (Base & {
      kind: 'bar';
      /** Design-token tone per bar, where the dimension carries one. */
      tones?: (string | null)[];
      /** Bars along the y axis: the only readable way to show long category names. */
      horizontal?: boolean;
    })
  | (Base & { kind: 'doughnut'; tones?: (string | null)[] });

interface SliceLike {
  label: string;
  value: number;
  tone?: string | null;
}

interface SliceSetLike {
  slices: readonly SliceLike[];
  total: number;
}

/** Categorical counts as bars. Horizontal by default, because labels here are phrases. */
export function barSpec(
  set: SliceSetLike,
  unit: ChartUnit,
  options: { horizontal?: boolean } = {}
): ChartSpec {
  const tones = set.slices.map((slice) => slice.tone ?? null);

  return {
    kind: 'bar',
    labels: set.slices.map((slice) => slice.label),
    values: set.slices.map((slice) => slice.value),
    // Only pass tones through when at least one is real; otherwise every bar should
    // share the first series colour.
    tones: tones.some((tone) => tone !== null) ? tones : undefined,
    horizontal: options.horizontal ?? true,
    unit,
    total: set.total,
  };
}

/** A composition: how one whole divides. Never use it for more than about six slices. */
export function doughnutSpec(set: SliceSetLike, unit: ChartUnit): ChartSpec {
  const tones = set.slices.map((slice) => slice.tone ?? null);

  return {
    kind: 'doughnut',
    labels: set.slices.map((slice) => slice.label),
    values: set.slices.map((slice) => slice.value),
    tones: tones.some((tone) => tone !== null) ? tones : undefined,
    unit,
    total: set.total,
  };
}

/** A measure over time. */
export function lineSpec(
  points: readonly { label: string; value: number }[],
  unit: ChartUnit
): ChartSpec {
  return {
    kind: 'line',
    labels: points.map((point) => point.label),
    values: points.map((point) => point.value),
    unit,
  };
}
