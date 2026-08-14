/**
 * One headline figure, with its comparison.
 *
 * A number on its own is not information: 34 enquiries is a good month or a bad one
 * depending entirely on the month before. So the comparison is part of the component
 * rather than an option on it, and the only way to omit it is to have nothing to
 * compare against - an all-time range, or a first period.
 *
 * The arrow is never coloured green or red by itself. "Down" is good news for expenses
 * and bad news for income, and this component will be used for both, so the caller says
 * which direction is favourable.
 */
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

import { delta } from '../slice';

interface MetricCardProps {
  label: string;
  value: number | null;
  /** Same measure over the previous period. Omit when there is nothing to compare. */
  previous?: number | null;
  /** Appended to the figure, e.g. "%" or " pieces". */
  suffix?: string;
  /** What the figure means, in a few words. */
  hint?: string;
  /** Which direction is good news. `neutral` shows the change without judging it. */
  goodDirection?: 'up' | 'down' | 'neutral';
}

export function MetricCard({
  label,
  value,
  previous,
  suffix,
  hint,
  goodDirection = 'up',
}: MetricCardProps) {
  const change =
    value === null || previous === null || previous === undefined ? null : delta(value, previous);

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="eyebrow text-xs text-ink-secondary">{label}</p>

        <p className="numeric text-2xl font-semibold text-ink-primary">
          {/* A dash, not a zero, when there is no measurement: zero is itself a finding
              and should not be claimed on a period nobody has data for. */}
          {value === null ? '—' : formatNumber(value)}
          {value === null || suffix === undefined ? null : (
            <span className="text-base font-medium text-ink-secondary">{suffix}</span>
          )}
        </p>

        {change === null ? (
          <p className="text-xs text-ink-secondary">
            {hint ?? (previous === undefined ? '' : 'No comparable period')}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-ink-secondary">
            <Change change={change} goodDirection={goodDirection} />
            <span>vs previous period</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Change({
  change,
  goodDirection,
}: {
  change: number;
  goodDirection: 'up' | 'down' | 'neutral';
}) {
  const Icon = change === 0 ? ArrowRight : change > 0 ? ArrowUpRight : ArrowDownRight;

  const favourable =
    goodDirection === 'neutral' || change === 0 ? null : change > 0 === (goodDirection === 'up');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 numeric font-medium',
        favourable === null
          ? 'text-ink-secondary'
          : favourable
            ? 'text-success-ink'
            : 'text-error-ink'
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {/* The sign is carried by the arrow, so the number itself stays unsigned. */}
      {Math.abs(change)}%
    </span>
  );
}

/** Thousands separated, so four figures are readable at a glance. */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(value);
}
