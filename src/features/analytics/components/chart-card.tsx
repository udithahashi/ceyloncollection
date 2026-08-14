/**
 * The frame every chart sits in.
 *
 * Three things it does that a bare canvas cannot:
 *
 * 1. Reserves its height before the chart draws, so a board does not jump as each one
 *    initialises.
 * 2. Renders the same numbers as a visually hidden table. A canvas is a picture to a
 *    screen reader, and "chart of leads by platform" is not the information. The table
 *    is also what someone gets when they copy the card.
 * 3. Says when there is nothing to draw, instead of an empty grid that looks broken.
 *
 * Server Component: only `Chart` itself needs the browser.
 */
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

import { Chart } from './chart';
import type { ChartSpec } from './spec';

interface ChartCardProps {
  title: string;
  /** The question the chart answers, in one line. */
  hint?: string;
  eyebrow?: string;
  spec: ChartSpec;
  /** Canvas height in pixels. Bar charts need room per bar; 22px each is comfortable. */
  height?: number;
  /** Shown instead of the chart when every value is zero. */
  empty?: string;
  /** Noted under the chart, e.g. how many values were folded into "Everything else". */
  footnote?: string;
  className?: string;
}

export function ChartCard({
  title,
  hint,
  eyebrow,
  spec,
  height = 260,
  empty = 'Nothing recorded in this period.',
  footnote,
  className,
}: ChartCardProps) {
  const hasData = spec.values.some((value) => value > 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-1">
          {eyebrow === undefined ? null : <CardEyebrow>{eyebrow}</CardEyebrow>}
          <CardTitle>{title}</CardTitle>
          {hint === undefined ? null : <p className="text-xs text-ink-secondary">{hint}</p>}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {hasData ? (
          <>
            <figure className="flex flex-col gap-2">
              {/* The canvas is absolutely sized by Chart.js, so the wrapper owns the box. */}
              <div style={{ height }} className="relative">
                <Chart spec={spec} label={hint === undefined ? title : `${title}. ${hint}`} />
              </div>

              <figcaption className="sr-only">
                <table>
                  <caption>{title}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Label</th>
                      <th scope="col">{spec.unit.many}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spec.labels.map((label, index) => (
                      <tr key={`${label}-${index}`}>
                        <th scope="row">{label}</th>
                        <td>{spec.values[index] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </figcaption>
            </figure>

            {footnote === undefined ? null : (
              <p className="text-xs text-ink-secondary">{footnote}</p>
            )}
          </>
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-control border border-dashed border-line-subtle',
              'px-4 text-center text-sm text-ink-secondary'
            )}
            style={{ height }}
          >
            {empty}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
