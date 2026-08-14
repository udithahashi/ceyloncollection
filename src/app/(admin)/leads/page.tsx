import Link from 'next/link';
import { Plus, Upload } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { LeadFilterBar } from '@/features/leads/components/lead-filter-bar';
import { LeadTable } from '@/features/leads/components/lead-table';
import { hasActiveFilters, parseLeadFilters, toSearchParams } from '@/features/leads/filters';
import { leadFormOptions, listLeads } from '@/features/leads/queries';
import { can } from '@/lib/auth/roles';
import { authorize } from '@/lib/auth/session';
import { todayInBusinessTime } from '@/lib/time';

export const metadata = { title: 'Leads' };

/**
 * The leads list: the page this system exists for.
 *
 * Everything about the view - which filters, which order, which page - is in the URL,
 * read here and passed to Postgres. So the first paint is already the right rows, the
 * back button works, and a filtered view can be sent to someone as a link.
 *
 * `searchParams` makes this route dynamic, which is correct: the contents change with
 * every enquiry recorded, and a cached list of leads would be a list of yesterday's.
 */
export default async function LeadsPage({ searchParams }: PageProps<'/leads'>) {
  const user = await authorize('leads', 'read');

  const filters = parseLeadFilters(await searchParams);

  // The options are the same ten taxonomy lists the form uses, so this is one query
  // pair rather than a fetch per picker.
  const [page, options] = await Promise.all([listLeads(filters), leadFormOptions()]);

  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        eyebrow="Demand"
        title="Leads"
        description="Every enquiry, from every channel. Filter it, then work the top of the list."
        actions={
          <>
            {can(user.role, 'imports', 'create') ? (
              <Link href="/leads/import" className={buttonVariants({ variant: 'secondary' })}>
                <Upload aria-hidden="true" />
                Import a spreadsheet
              </Link>
            ) : null}

            {can(user.role, 'leads', 'create') ? (
              <Link href="/leads/new" className={buttonVariants({ variant: 'primary' })}>
                <Plus aria-hidden="true" />
                Record a lead
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent>
          <LeadFilterBar options={options} filters={filters} today={todayInBusinessTime()} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {page.rows.length === 0 ? (
          <CardContent className="py-12">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-ink-primary">
                {filtered ? 'Nothing matches those filters' : 'No leads yet'}
              </p>

              <p className="text-sm text-ink-secondary">
                {filtered
                  ? 'Widen the date range or clear a filter or two.'
                  : 'The first enquiry from a Facebook post goes here. Record it and the customer, the demand and the repeat counts all follow from it.'}
              </p>

              {filtered ? (
                <Link
                  href="/leads"
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  Clear filters
                </Link>
              ) : (
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {can(user.role, 'leads', 'create') ? (
                    <Link
                      href="/leads/new"
                      className={buttonVariants({ variant: 'primary', size: 'sm' })}
                    >
                      Record the first lead
                    </Link>
                  ) : null}

                  {/* On an empty list this is usually the one people want: the history
                      already exists, in a spreadsheet. */}
                  {can(user.role, 'imports', 'create') ? (
                    <Link
                      href="/leads/import"
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Import a spreadsheet
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </CardContent>
        ) : (
          <>
            <LeadTable rows={page.rows} />

            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              hrefFor={(next) => `/leads${toSearchParams(filters, { page: next })}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
