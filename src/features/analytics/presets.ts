/**
 * The periods a board can be read over.
 *
 * Its own module, with no imports at all, because both sides need it: the server resolves
 * a preset into dates, and the client renders one button per preset. Kept in `range.ts`
 * it would drag `@/lib/time` - and `@/lib/env` behind it - into the browser bundle, and
 * the page would die complaining about DATABASE_URL.
 */

/**
 * How many days each preset covers.
 *
 * `null` means "no fixed length": all time has no start until the data says so, and
 * custom takes its dates from the URL.
 */
export const rangePresets = {
  '7d': { label: 'Last 7 days', days: 7 },
  '30d': { label: 'Last 30 days', days: 30 },
  '90d': { label: 'Last 90 days', days: 90 },
  '12m': { label: 'Last 12 months', days: 365 },
  all: { label: 'All time', days: null },
  custom: { label: 'Custom dates', days: null },
} as const satisfies Record<string, { label: string; days: number | null }>;

export type RangePreset = keyof typeof rangePresets;

export const DEFAULT_PRESET: RangePreset = '30d';

export const rangePresetKeys = Object.keys(rangePresets) as [RangePreset, ...RangePreset[]];
