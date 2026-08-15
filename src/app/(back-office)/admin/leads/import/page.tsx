import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ImportForm } from '@/features/leads/import/components/import-form';
import { MAX_IMPORT_ROWS } from '@/features/leads/import/plan';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'Import leads' };

/**
 * Bringing the existing spreadsheet in.
 *
 * The one job that has to be got right the first time: everything recorded before this
 * system existed arrives through here, and it arrives once. Which is why the page reads
 * the file and reports on it before it will write anything, and why importing the same
 * file twice adds nothing the second time.
 *
 * `imports:create` rather than `leads:create`. Someone doing data entry should be able to
 * record enquiries all day and not be able to load a thousand rows in one click.
 */
export default async function ImportLeadsPage() {
  await requirePermission('imports', 'create', '/admin/leads/import');

  return (
    <>
      <PageHeader
        eyebrow="Demand"
        title="Import leads"
        description="Read a spreadsheet, check what it will do, then import it. Nothing is written until you say so."
        actions={
          <Link href="/admin/leads" className={buttonVariants({ variant: 'secondary' })}>
            <ChevronLeft aria-hidden />
            Back to leads
          </Link>
        }
      />

      <ImportForm templateHref="/lead-import-template.csv" />

      <Card>
        <CardHeader>
          <CardTitle>What to expect</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 text-sm text-ink-secondary">
          <p>
            The headings are matched loosely, so &quot;Contact Number&quot;,
            &quot;contact_number&quot; and &quot;Phone&quot; are all the same column. Only two are
            required: the contact number and the date. Everything else is optional, because a first
            message rarely says much.
          </p>

          <p>
            Dates written with slashes are read <strong>day first</strong>, so 09/03/2026 is the
            ninth of March. The report shows every date as it was understood, so a misunderstanding
            is visible before anything is saved.
          </p>

          <p>
            Words like a fabric or a platform must already exist under Settings. A value that
            matches nothing is reported with a link to add it - never created automatically, because
            one misspelling would become a permanent second spelling in every report afterwards.
          </p>

          <p>
            Columns the system works out for itself - days since contact, requests by customer,
            repeat or new, sub-category demand - are ignored if the sheet has them. Up to{' '}
            {MAX_IMPORT_ROWS.toLocaleString('en-GB')} rows per file.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
