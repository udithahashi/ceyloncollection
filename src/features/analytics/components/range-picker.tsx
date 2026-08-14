'use client';

/**
 * The period control, shared by every board.
 *
 * A `<form method="get">` for the same reasons as the list filters: the result is a URL,
 * so a period can be bookmarked or pasted into a message, and it keeps working before
 * the bundle arrives. Choosing a preset submits immediately, which is what a segmented
 * control implies; the custom dates need an explicit Apply because two inputs are one
 * decision.
 *
 * It takes the path it submits to, so the same control serves /analytics/demand today
 * and the money and stock boards later without knowing anything about them.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { cn } from '@/lib/cn';

// From './presets', not './range': this is a client component, and `range.ts` resolves
// dates in the business timezone, which reaches the server-only environment config.
import { DEFAULT_PRESET, rangePresets, type RangePreset } from '../presets';
import type { DateRange } from '../range';

export function RangePicker({
  action,
  range,
  today,
}: {
  /** The board's path, e.g. `/analytics/demand`. */
  action: string;
  range: DateRange;
  /** Today in business time, so the date inputs cannot offer the future. */
  today: string;
}) {
  const router = useRouter();
  const [custom, setCustom] = useState(range.preset === 'custom');

  const presets = Object.entries(rangePresets).filter(([key]) => key !== 'custom') as Array<
    [RangePreset, { label: string }]
  >;

  function go(query: string) {
    router.push(query === '' ? action : `${action}?${query}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Period"
          className="flex flex-wrap items-center gap-1 rounded-control border border-line-subtle p-1"
        >
          {presets.map(([key, preset]) => {
            const selected = range.preset === key;

            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setCustom(false);
                  // The default period is the bare URL, so the common case has no query
                  // string to read or share.
                  go(key === DEFAULT_PRESET ? '' : `range=${key}`);
                }}
                className={cn(
                  'rounded-control px-2.5 py-1 text-xs font-medium transition-colors',
                  selected
                    ? 'bg-action-secondary text-action-on-secondary'
                    : 'text-ink-secondary hover:text-ink-primary'
                )}
              >
                {/* "Last 30 days" is too long for a segment; the group label carries the
                    context, so each button only needs its own span. */}
                {preset.label.replace('Last ', '')}
              </button>
            );
          })}

          <button
            type="button"
            aria-pressed={custom}
            onClick={() => setCustom((open) => !open)}
            className={cn(
              'rounded-control px-2.5 py-1 text-xs font-medium transition-colors',
              custom
                ? 'bg-action-secondary text-action-on-secondary'
                : 'text-ink-secondary hover:text-ink-primary'
            )}
          >
            Custom
          </button>
        </div>

        <p className="numeric text-xs text-ink-secondary">{range.label}</p>
      </div>

      {custom ? (
        <form
          method="get"
          action={action}
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const params = new URLSearchParams({ range: 'custom' });

            for (const key of ['from', 'to'] as const) {
              const value = data.get(key);
              if (typeof value === 'string' && value !== '') params.set(key, value);
            }

            params.sort();
            go(params.toString());
          }}
        >
          <input type="hidden" name="range" value="custom" />

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-secondary">
            From
            <input
              type="date"
              name="from"
              max={today}
              defaultValue={range.from ?? ''}
              className={cn(controlClasses, 'h-9 w-40')}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-ink-secondary">
            To
            <input
              type="date"
              name="to"
              max={today}
              defaultValue={range.to}
              className={cn(controlClasses, 'h-9 w-40')}
            />
          </label>

          <Button type="submit" variant="secondary" size="sm">
            Apply
          </Button>
        </form>
      ) : null}
    </div>
  );
}
