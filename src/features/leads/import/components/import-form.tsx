'use client';

/**
 * Upload, read, confirm.
 *
 * Two forms and one deliberate rule: nothing is written until the second one is
 * submitted. The first only ever produces a report, which is why the primary button on
 * this page says "Read the file" and not "Import".
 *
 * The confirmation carries the file's text in a hidden field. That is not a cache - the
 * server re-reads and re-checks it before writing - it is only how the file gets back
 * there, since no browser allows JavaScript to refill a file input.
 */
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { CheckCircle2, Download, FileUp } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, TextareaField, controlClasses, fieldWiring } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { initialActionState } from '@/lib/actions/result';

import { commitImportAction, planImportAction } from '../actions';
import type { ImportOutcome, ImportPlan } from '../types';
import { ImportReport } from './import-report';

export function ImportForm({ templateHref }: { templateHref: string }) {
  const [planState, plan] = useActionState(planImportAction, initialActionState<ImportPlan>());
  const [commitState, commit] = useActionState(
    commitImportAction,
    initialActionState<ImportOutcome>()
  );

  // Keeps the textarea controlled, so choosing a file after pasting can clear it and the
  // two inputs never disagree about what is being imported.
  const [pasted, setPasted] = useState('');

  const report = planState.ok ? planState.data : undefined;
  const outcome = commitState.ok ? commitState.data : undefined;

  const planErrors = planState.ok ? {} : (planState.fieldErrors ?? {});

  if (outcome !== undefined) {
    return <Done outcome={outcome} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={plan}>
        <Card>
          <CardHeader>
            <CardTitle>The spreadsheet</CardTitle>

            <Link
              href={templateHref}
              download
              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
            >
              <Download aria-hidden />
              Template
            </Link>
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <Field
              id="file"
              label="CSV file"
              hint="Export the sheet as CSV first. Nothing is written until you have seen the report."
              error={planErrors.file?.[0]}
            >
              <input
                {...fieldWiring({ id: 'file', error: planErrors.file?.[0] }).control}
                type="file"
                name="file"
                accept=".csv,text/csv"
                onChange={() => setPasted('')}
                className={`${controlClasses} py-1.5 file:mr-3 file:rounded-control file:border-0 file:bg-surface-inset file:px-3 file:py-1.5 file:text-sm file:text-ink-primary`}
              />
            </Field>

            <details className="text-sm">
              <summary className="cursor-pointer text-ink-secondary">
                Or paste a few rows instead
              </summary>

              <div className="pt-3">
                <TextareaField
                  name="csv"
                  label="Rows, including the heading line"
                  hint="Useful for checking the format before exporting the whole sheet."
                  rows={6}
                  spellCheck={false}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                  error={planErrors.csv?.[0]}
                  controlClassName="font-mono text-xs"
                />
              </div>
            </details>

            {planState.ok ? null : <FormMessage tone="error">{planState.error}</FormMessage>}
          </CardContent>

          <CardFooter>
            <SubmitButton variant="primary" pendingLabel="Reading...">
              <FileUp aria-hidden />
              Read the file
            </SubmitButton>
          </CardFooter>
        </Card>
      </form>

      {report === undefined ? null : (
        <>
          <ImportReport plan={report} />

          <form action={commit}>
            <input type="hidden" name="csv" value={report.csv} />

            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-ink-secondary">
                  {report.summary.ready === 0
                    ? 'Nothing in this file can be imported yet.'
                    : `Importing will add ${report.summary.ready} ${
                        report.summary.ready === 1 ? 'enquiry' : 'enquiries'
                      }${
                        report.summary.newCustomers === 0
                          ? ''
                          : ` and ${report.summary.newCustomers} new ${
                              report.summary.newCustomers === 1 ? 'customer' : 'customers'
                            }`
                      }. The file is read again first, so this is checked twice.`}
                </p>

                <SubmitButton
                  variant="primary"
                  disabled={report.summary.ready === 0}
                  pendingLabel="Importing..."
                >
                  Import {report.summary.ready} {report.summary.ready === 1 ? 'row' : 'rows'}
                </SubmitButton>
              </CardContent>
            </Card>

            {commitState.ok ? null : (
              <div className="pt-3">
                <FormMessage tone="error">{commitState.error}</FormMessage>
              </div>
            )}
          </form>
        </>
      )}
    </div>
  );
}

function Done({ outcome }: { outcome: ImportOutcome }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <span className="flex items-center gap-2 text-success-ink">
          <CheckCircle2 className="size-5" aria-hidden />
          <span className="font-medium">
            Imported {outcome.imported} {outcome.imported === 1 ? 'enquiry' : 'enquiries'}
          </span>
        </span>

        <p className="text-sm text-ink-secondary">
          {outcome.newCustomers} new {outcome.newCustomers === 1 ? 'customer' : 'customers'}.{' '}
          {outcome.skipped === 0
            ? 'Nothing was skipped.'
            : `${outcome.skipped} skipped as already recorded or repeated.`}{' '}
          {outcome.rejected === 0
            ? ''
            : `${outcome.rejected} could not be read - fix those rows and import the file again; the ones just added will be skipped.`}
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Link href="/admin/leads" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
            See the leads
          </Link>

          <Link
            href="/admin/analytics/demand"
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            Demand board
          </Link>

          <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
            Import another file
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
