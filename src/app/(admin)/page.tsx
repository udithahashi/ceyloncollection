import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Plus } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { parseRange, rangeInstants } from '@/features/analytics/range';
import { countByDimension, demandTotals, newCustomerCount } from '@/features/leads/analytics';
import { can } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * A single headline number. Shows a dash rather than a zero when there is nothing
 * to measure: zero is itself a measurement, and claiming one for a period nobody
 * has data for would undermine every other number on the page.
 */
function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="eyebrow text-xs text-ink-secondary">{label}</p>
        {/* Tabular figures, so a column of these lines up digit for digit. */}
        <p className="numeric text-2xl font-semibold text-ink-primary">{value}</p>
        <p className="text-xs text-ink-secondary">{note}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The dashboard: four numbers and a way in.
 *
 * Deliberately not a report. Every chart belongs on a board under /analytics, one
 * subject per page - if this page starts accumulating them it becomes the single
 * crowded dashboard that structure exists to avoid. What belongs here is the handful of
 * figures worth seeing on the way past, and a link to the boards.
 */
export default async function DashboardPage() {
  const user = await requireUser('/');

  // A role without analytics access sees the shape of the page and no figures, rather
  // than being turned away from the front door.
  const mayRead = can(user.role, 'analytics', 'read');

  const week = parseRange({ range: '7d' });
  const window = rangeInstants(week);

  const [totals, newCustomers, subcategories] = mayRead
    ? await Promise.all([
        demandTotals(window),
        newCustomerCount(window),
        countByDimension('subcategory', window),
      ])
    : [null, null, []];

  const leading = subcategories.at(0);
  const dash = '—';

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="The week at a glance. Everything that needs a chart lives on its own board, so this page stays something you can read in five seconds."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {mayRead ? (
              <Link
                href="/analytics"
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                <BarChart3 aria-hidden="true" />
                Analytics
              </Link>
            ) : null}

            {can(user.role, 'leads', 'create') ? (
              <Link
                href="/leads/new"
                className={buttonVariants({ variant: 'primary', size: 'sm' })}
              >
                <Plus aria-hidden="true" />
                Record a lead
              </Link>
            ) : null}
          </div>
        }
      />

      <section aria-labelledby="signals" className="flex flex-col gap-3">
        <h2 id="signals" className="eyebrow text-sm text-ink-secondary">
          Last 7 days
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Enquiries"
            value={totals === null ? dash : String(totals.enquiries)}
            note={totals === null ? 'No access' : `From ${totals.people} people`}
          />
          <Metric
            label="Ready to buy"
            value={totals === null ? dash : String(totals.readyToBuy)}
            note="At a buying urgency"
          />
          <Metric
            label="New customers"
            value={newCustomers === null ? dash : String(newCustomers)}
            note="First ever enquiry"
          />
          <Metric
            label="Top sub-category"
            value={leading === undefined ? dash : String(leading.value)}
            note={leading === undefined ? 'Nothing named yet' : leading.label}
          />
        </div>
      </section>
    </>
  );
}
