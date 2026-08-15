import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ChartCard } from '@/features/analytics/components/chart-card';
import { MetricCard } from '@/features/analytics/components/metric-card';
import { RangePicker } from '@/features/analytics/components/range-picker';
import { barSpec, doughnutSpec, lineSpec } from '@/features/analytics/components/spec';
import { grainNoun, labelled } from '@/features/analytics/buckets';
import { parseRange } from '@/features/analytics/range';
import { share, topSlices, type Slice } from '@/features/analytics/slice';
import { demandReport } from '@/features/leads/analytics';
import { authorize } from '@/lib/auth/session';
import { todayInBusinessTime } from '@/lib/time';

export const metadata = { title: 'Demand analytics' };

const enquiries = { one: 'enquiry', many: 'enquiries' };

/**
 * The demand board: what people are asking for.
 *
 * One subject, in four sittings - how much, from where, what for, and where it stands.
 * Nothing about money or stock appears here, and nothing about demand will appear on
 * those boards, so neither page has to grow to hold the other's charts.
 *
 * Every categorical chart shows the leading values and folds the rest into one bar. With
 * 200-odd sub-categories in the taxonomy, the alternative is a chart nobody can read, and
 * the folded bar still counts towards the totals so the percentages stay true.
 */
export default async function DemandBoardPage({
  searchParams,
}: PageProps<'/admin/analytics/demand'>) {
  await authorize('analytics', 'read');

  const range = parseRange(await searchParams);
  const report = await demandReport(range);

  const { totals, previousTotals } = report;

  /** Won as a share of everything that has stopped moving, not of everything recorded. */
  const conversion = totals.closed === 0 ? null : share(totals.won, totals.closed);
  const previousConversion =
    previousTotals === null || previousTotals.closed === 0
      ? null
      : share(previousTotals.won, previousTotals.closed);

  const cities = topSlices(report.byCity, 6);
  const categories = topSlices(report.byCategory, 6);
  const subcategories = topSlices(report.bySubcategory, 8);
  const fabrics = topSlices(report.byFabric, 8);
  const tags = topSlices(report.byTag, 10);
  const platforms = topSlices(report.byPlatform, 5);
  const sizeTotal = sum(report.bySize);

  return (
    <>
      <PageHeader
        eyebrow="Analytics"
        title="Demand"
        description="The evidence for what goes in the next shipment: how many people are asking, where they come from, and what they ask for."
        actions={
          <Link
            href="/admin/analytics"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" />
            All boards
          </Link>
        }
      />

      <Card>
        <CardContent>
          <RangePicker
            action="/admin/analytics/demand"
            range={range}
            today={todayInBusinessTime()}
          />
        </CardContent>
      </Card>

      <Section id="volume" heading="How much">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Enquiries"
            value={totals.enquiries}
            previous={previousTotals?.enquiries}
            hint="Messages recorded in this period"
          />
          <MetricCard
            label="People"
            value={totals.people}
            previous={previousTotals?.people}
            hint="Distinct customers who wrote"
          />
          <MetricCard
            label="New customers"
            value={report.newCustomers}
            previous={report.previousNewCustomers}
            hint="First ever enquiry"
          />
          <MetricCard
            label="Ready to buy"
            value={totals.readyToBuy}
            previous={previousTotals?.readyToBuy}
            hint="At a buying urgency"
          />
          <MetricCard
            label="Converted"
            value={conversion}
            previous={previousConversion}
            suffix="%"
            hint="Of enquiries that closed"
          />
        </div>

        <ChartCard
          title="Enquiries over time"
          hint={`One point per ${grainNoun[report.overTime.grain]}, in Qatar time.`}
          spec={lineSpec(labelled(report.overTime.points, report.overTime.grain), enquiries)}
          height={240}
          empty="No enquiries in this period."
        />
      </Section>

      <Section id="channels" heading="Where they come from">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Platform"
            hint="Which channel is worth the next post."
            spec={doughnutSpec(platforms, enquiries)}
            footnote={foldNote(platforms.folded, 'platforms')}
          />

          <ChartCard
            title="Area"
            hint="Where in Qatar the interest is, which is also where delivery is cheapest."
            spec={barSpec(cities, enquiries)}
            footnote={foldNote(cities.folded, 'areas')}
          />
        </div>
      </Section>

      <Section id="products" heading="What they ask for">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Sub-category"
            hint="The buying list, in order."
            spec={barSpec(subcategories, enquiries)}
            height={280}
            footnote={note(
              foldNote(subcategories.folded, 'sub-categories'),
              unstated(totals.enquiries, subcategories.total, 'sub-category')
            )}
            empty="Nobody named a sub-category in this period."
          />

          <ChartCard
            title="Category"
            spec={barSpec(categories, enquiries)}
            height={280}
            footnote={foldNote(categories.folded, 'categories')}
          />

          <ChartCard
            title="Fabric"
            hint="The material people name, which is the reason they are asking a Sri Lankan supplier."
            spec={barSpec(fabrics, enquiries)}
            footnote={note(
              foldNote(fabrics.folded, 'fabrics'),
              unstated(totals.enquiries, fabrics.total, 'fabric')
            )}
            empty="Nobody named a fabric in this period."
          />

          <ChartCard
            title="Size"
            hint="In the taxonomy's own order, so the curve is readable."
            spec={barSpec({ slices: report.bySize, total: sizeTotal }, enquiries, {
              horizontal: false,
            })}
            footnote={unstated(totals.enquiries, sizeTotal, 'size')}
            empty="Nobody named a size in this period."
          />

          <ChartCard
            title="Who it is for"
            spec={doughnutSpec({ slices: report.byGender, total: sum(report.byGender) }, enquiries)}
          />

          <ChartCard
            title="Details asked for"
            hint="Prints, cuts, necklines and occasions - the tags on each enquiry."
            spec={barSpec(tags, enquiries)}
            height={280}
            footnote={`An enquiry can carry several tags, so these add to more than the number of enquiries.${
              tags.folded === 0 ? '' : ` ${tags.folded} more tags were folded in.`
            }`}
            empty="No tags recorded in this period."
          />
        </div>
      </Section>

      <Section id="pipeline" heading="Where it stands">
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Status"
            hint="The pipeline in the business's own order."
            spec={barSpec({ slices: report.byStatus, total: sum(report.byStatus) }, enquiries, {
              horizontal: false,
            })}
          />

          <ChartCard
            title="Intent"
            hint="How ready people said they were."
            spec={doughnutSpec(
              { slices: report.byUrgency, total: sum(report.byUrgency) },
              enquiries
            )}
          />
        </div>
      </Section>
    </>
  );
}

function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="eyebrow text-sm text-ink-secondary">
        {heading}
      </h2>
      {children}
    </section>
  );
}

function sum(slices: readonly Slice[]): number {
  return slices.reduce((total, slice) => total + slice.value, 0);
}

/** Says what the folded bar contains, so it is a summary rather than a mystery. */
function foldNote(folded: number, noun: string): string | undefined {
  if (folded === 0) return undefined;
  return `${folded} further ${noun} are counted under "Everything else".`;
}

/**
 * Accounts for the enquiries a chart leaves out.
 *
 * The charts that are a buying list drop the enquiries that named no value, because a
 * tall "Not stated" bar answers a different question. Saying how many were dropped keeps
 * that from being a silent omission - and a large number here is itself the finding: it
 * means the intake is not asking.
 */
function unstated(total: number, counted: number, noun: string): string | undefined {
  const missing = total - counted;
  if (missing <= 0) return undefined;

  return `${missing} of ${total} enquiries named no ${noun}.`;
}

function note(...parts: Array<string | undefined>): string | undefined {
  const written = parts.filter((part): part is string => part !== undefined);
  return written.length === 0 ? undefined : written.join(' ');
}
