import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { boards } from '@/features/analytics/boards';
import { authorize } from '@/lib/auth/session';
import { cn } from '@/lib/cn';

export const metadata = { title: 'Analytics' };

/**
 * The way in to the boards.
 *
 * A deliberate index rather than a redirect to the only board that exists. It sets the
 * expectation that analytics here is several separate subjects - demand, money, stock,
 * orders - so no single page becomes the place every future chart is bolted onto.
 */
export default async function AnalyticsPage() {
  await authorize('analytics', 'read');

  return (
    <>
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        description="One board per question. They stay separate on purpose: what people are asking for and what the business earned are different sittings, with different periods and different comparisons."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {boards.map((board) => {
          const Icon = board.icon;
          const planned = board.href === undefined;

          const inner = (
            <CardContent className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-control',
                    planned
                      ? 'bg-surface-inset text-ink-secondary'
                      : 'bg-action-soft text-action-on-soft'
                  )}
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>

                {planned ? <Badge>Planned</Badge> : null}
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-ink-primary">{board.label}</p>
                <p className="text-sm text-ink-secondary">{board.question}</p>
              </div>

              <p className="mt-auto text-xs text-ink-secondary">{board.detail}</p>

              {planned ? null : (
                <p className="flex items-center gap-1 text-xs font-medium text-ink-accent">
                  Open board
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </p>
              )}
            </CardContent>
          );

          return planned ? (
            <Card key={board.key} className="opacity-70">
              {inner}
            </Card>
          ) : (
            <Link
              key={board.key}
              href={board.href ?? '/analytics/demand'}
              className="rounded-panel transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-focus"
            >
              <Card className="h-full hover:border-line-strong">{inner}</Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
