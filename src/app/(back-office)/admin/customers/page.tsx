import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { CustomerFilterBar } from '@/features/customers/components/customer-filter-bar';
import { CustomerTable } from '@/features/customers/components/customer-table';
import {
  hasActiveFilters,
  parseCustomerFilters,
  toSearchParams,
} from '@/features/customers/filters';
import { customerFilterOptions, listCustomers } from '@/features/customers/queries';
import { authorize } from '@/lib/auth/session';

export const metadata = { title: 'Customers' };

/**
 * The customers list: the same enquiries as /leads, collapsed by phone number.
 *
 * Two lists over one set of records, because two different questions get asked of them.
 * The leads list answers "what is being asked for" - it is where demand is read. This
 * one answers "who should I talk to today", and it is the list that makes a second sale
 * to someone who already bought once.
 */
export default async function CustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  await authorize('customers', 'read');

  const filters = parseCustomerFilters(await searchParams);

  const [page, options] = await Promise.all([listCustomers(filters), customerFilterOptions()]);

  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        eyebrow="Demand"
        title="Customers"
        description="One row per phone number, with everything that number has ever asked for."
      />

      <Card>
        <CardContent>
          <CustomerFilterBar options={options} filters={filters} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {page.rows.length === 0 ? (
          <CardContent className="py-12">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-ink-primary">
                {filtered ? 'Nobody matches those filters' : 'No customers yet'}
              </p>

              <p className="text-sm text-ink-secondary">
                {filtered
                  ? 'Try a longer quiet period, or clear a filter.'
                  : 'Customers appear here on their own: recording a lead against a phone number creates the customer behind it.'}
              </p>

              <Link
                href={filtered ? '/admin/customers' : '/admin/leads/new'}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                {filtered ? 'Clear filters' : 'Record a lead'}
              </Link>
            </div>
          </CardContent>
        ) : (
          <>
            <CustomerTable rows={page.rows} />

            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              noun={{ one: 'customer', many: 'customers' }}
              hrefFor={(next) => `/admin/customers${toSearchParams(filters, { page: next })}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
