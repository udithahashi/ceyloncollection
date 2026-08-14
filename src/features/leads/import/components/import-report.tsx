/**
 * The dry-run report.
 *
 * Ordered by what a person needs to decide with: the four counts first, then anything
 * that has to be fixed before importing, then the rows themselves. The point of the page
 * is the sentence "873 will be imported, 41 will not, and here is why" - a progress bar
 * that ends in "41 errors" would leave the same work to do with none of the information.
 *
 * Rendered inside a client component, so everything it imports must be safe there:
 * types, the column definitions, and presentational primitives. No queries, no
 * environment.
 */
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, CircleSlash, Copy } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { importColumns, type ImportField } from '../columns';
import type { ImportPlan, PlannedRow, RowVerdict } from '../types';

const verdicts: Record<
  RowVerdict,
  { label: string; tone: 'success' | 'neutral' | 'info' | 'error'; description: string }
> = {
  ready: {
    label: 'Will import',
    tone: 'success',
    description: 'Read cleanly and not recorded yet.',
  },
  duplicate: {
    label: 'Repeated in the file',
    tone: 'neutral',
    description: 'The same enquiry appears on an earlier line.',
  },
  present: {
    label: 'Already recorded',
    tone: 'info',
    description: 'We have this enquiry, so importing it again would double the demand it shows.',
  },
  rejected: {
    label: 'Cannot import',
    tone: 'error',
    description: 'Something in the row could not be read or could not be placed.',
  },
};

export function ImportReport({ plan }: { plan: ImportPlan }) {
  const { summary } = plan;

  if (plan.missingRequired.length > 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>That file is missing a column the import needs</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          <ul className="flex flex-col gap-2">
            {plan.missingRequired.map((field) => (
              <li key={field} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error-ink" aria-hidden />
                <span>
                  <strong className="font-medium text-ink-primary">
                    {importColumns[field].label}
                  </strong>{' '}
                  <span className="text-ink-secondary">{importColumns[field].hint}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="text-ink-secondary">
            {plan.columns.length === 0
              ? 'No heading row was found at all. The first line of the file has to name the columns.'
              : `The headings found were: ${plan.columns.map((column) => column.heading).join(', ')}.`}
          </p>

          {plan.columns.length === 1 ? (
            <p className="text-ink-secondary">
              Only one column was found in the heading row, so the whole line was read as a single
              heading. Saving the sheet again as &quot;CSV (comma delimited)&quot; usually fixes
              that.
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (summary.rows === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-ink-secondary">
          That file has headings but no rows under them.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Count
          label="Will import"
          value={summary.ready}
          tone="success"
          icon={<Check className="size-4" aria-hidden />}
        />
        <Count
          label="Already recorded"
          value={summary.present}
          tone="info"
          icon={<ArrowRight className="size-4" aria-hidden />}
        />
        <Count
          label="Repeated in the file"
          value={summary.duplicate}
          tone="neutral"
          icon={<Copy className="size-4" aria-hidden />}
        />
        <Count
          label="Cannot import"
          value={summary.rejected}
          tone="error"
          icon={<CircleSlash className="size-4" aria-hidden />}
        />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <Fact label="New customers" value={String(summary.newCustomers)} />
          <Fact label="Returning customers" value={String(summary.returningCustomers)} />
          <Fact
            label="Enquiries dated"
            value={
              summary.earliestDay === null
                ? 'nothing to date'
                : summary.earliestDay === summary.latestDay
                  ? summary.earliestDay
                  : `${summary.earliestDay} to ${summary.latestDay}`
            }
          />
          <Fact label="Rows read" value={String(summary.rows)} />
        </CardContent>
      </Card>

      {plan.truncated ? (
        <Notice tone="warning">
          Only the first rows of that file were read. Split it and import the rest afterwards - the
          second import will skip whatever the first one already added.
        </Notice>
      ) : null}

      {plan.unplaced.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Values that are not in the lists yet</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-ink-secondary">
              These are never created automatically: one misspelling would become a permanent second
              spelling in every report. Add the ones that are real, correct the ones that are typos
              in the sheet, then read the file again.
            </p>

            <ul className="flex flex-col divide-y divide-line-subtle">
              {plan.unplaced.map((value) => (
                <li
                  key={`${value.taxonomy}-${value.value}`}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-ink-primary">{value.value}</span>{' '}
                    <span className="text-ink-secondary">
                      in {value.taxonomy.toLowerCase()}, on {value.rows}{' '}
                      {value.rows === 1 ? 'row' : 'rows'}
                    </span>
                  </span>

                  <Link
                    href={value.href}
                    className="focus-visible:ring-action-ring shrink-0 rounded-control text-sm text-ink-accent underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Add it
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {plan.unrecognised.length > 0 ? (
        <Notice tone="neutral">
          Ignored these columns, which matched nothing: {plan.unrecognised.join(', ')}.
        </Notice>
      ) : null}

      <ColumnTable plan={plan} />

      <RowTable rows={plan.rows} />
    </div>
  );
}

function Count({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: 'success' | 'info' | 'neutral' | 'error';
  icon: React.ReactNode;
}) {
  const tint = {
    success: 'text-success-ink',
    info: 'text-info-ink',
    neutral: 'text-ink-secondary',
    error: 'text-error-ink',
  }[tone];

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${tint}`}>
          {icon}
          {label}
        </span>

        <span className="text-2xl font-semibold text-ink-primary tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className="font-medium text-ink-primary tabular-nums">{value}</span>
    </span>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'neutral'; children: React.ReactNode }) {
  const classes =
    tone === 'warning'
      ? 'border-warning-line bg-warning-bg text-warning-ink'
      : 'border-line-subtle bg-surface-inset text-ink-secondary';

  return <p className={`rounded-panel border px-4 py-3 text-sm ${classes}`}>{children}</p>;
}

/** What each column in the file was taken to mean. */
function ColumnTable({ plan }: { plan: ImportPlan }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How the columns were read</CardTitle>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-inset">
            <tr className="border-y border-line-subtle text-left">
              <Th>Column in your file</Th>
              <Th>Taken as</Th>
              <Th>Notes</Th>
            </tr>
          </thead>

          <tbody>
            {plan.columns.map((column, index) => (
              <tr
                key={`${column.heading}-${index}`}
                className="border-b border-line-subtle last:border-0"
              >
                <Td className="font-medium text-ink-primary">{column.heading || '(no heading)'}</Td>

                <Td>
                  {column.field === null ? (
                    <span className="text-ink-secondary">Ignored</span>
                  ) : (
                    importColumns[column.field].label
                  )}
                </Td>

                <Td className="text-ink-secondary">
                  {column.derived ??
                    (column.field === null ? '' : importColumns[column.field].hint)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * Every row, worst first.
 *
 * Rejected rows lead because they are the only ones anyone has to act on, and a hundred
 * green rows above them would hide the four that matter.
 */
function RowTable({ rows }: { rows: readonly PlannedRow[] }) {
  const order: RowVerdict[] = ['rejected', 'duplicate', 'present', 'ready'];
  const sorted = [...rows].sort(
    (a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.line - b.line
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Row by row</CardTitle>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Every row in the file, problems first, with the line number to look for.
          </caption>

          <thead className="bg-surface-inset">
            <tr className="border-y border-line-subtle text-left">
              <Th>Line</Th>
              <Th>Verdict</Th>
              <Th>Customer</Th>
              <Th>Date</Th>
              <Th>Asked about</Th>
              <Th>What needs attention</Th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((row) => (
              <tr key={row.line} className="border-b border-line-subtle last:border-0">
                <Td className="text-ink-secondary tabular-nums">{row.line}</Td>

                <Td>
                  <Badge
                    tone={verdicts[row.verdict].tone}
                    title={verdicts[row.verdict].description}
                  >
                    {verdicts[row.verdict].label}
                  </Badge>
                </Td>

                <Td>
                  <span className="flex flex-col">
                    <span className="text-ink-primary">{row.preview.name ?? 'No name'}</span>
                    <span className="text-xs text-ink-secondary tabular-nums">
                      {row.preview.phone ?? 'No number'}
                      {row.verdict === 'ready' && row.preview.newCustomer ? ' - new' : ''}
                    </span>
                  </span>
                </Td>

                <Td className="text-ink-secondary tabular-nums">{row.preview.day ?? '-'}</Td>

                <Td>
                  {row.preview.interest ?? <span className="text-ink-secondary">Not stated</span>}
                  {row.preview.quantity === null ? null : (
                    <span className="text-ink-secondary"> x{row.preview.quantity}</span>
                  )}
                </Td>

                <Td>
                  {row.problems.length === 0 ? (
                    <span className="text-ink-secondary">Nothing</span>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {row.problems.map((problem, index) => (
                        <li key={index}>
                          {problem.field === null ? null : (
                            <span className="text-ink-secondary">
                              {columnLabel(problem.field)}:{' '}
                            </span>
                          )}
                          <span className="text-ink-primary">{problem.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function columnLabel(field: ImportField): string {
  return importColumns[field].label;
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-2.5 text-xs font-medium text-ink-secondary">
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-top ${className ?? ''}`}>{children}</td>;
}
