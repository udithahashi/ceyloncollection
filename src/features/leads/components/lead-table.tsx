/**
 * The leads table.
 *
 * A server component rendering plain HTML. There is no table library here, and that is
 * a decision rather than an omission: filtering, sorting and paging all happen in
 * Postgres against real indexes, so the browser has nothing left to do but lay out
 * twenty-five rows. A client-side table would add a dependency to re-implement work
 * the database has already done, on data it would first have to download in full.
 *
 * WHAT EACH ROW HAS TO ANSWER
 * Who, when, what, how urgent, where it stands - readable in one pass, without
 * horizontal scrolling on a laptop. Everything else is on the lead's own page. The
 * columns the business listed as computed - days since contact, repeat or new - are
 * derived here at render time.
 */
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { isBadgeTone, type BadgeTone } from '@/lib/theme/tones';
import { formatPhone } from '@/lib/phone';
import { formatDate, formatDaysSince } from '@/lib/time';

import type { LeadListRow } from '../queries';

export function LeadTable({ rows }: { rows: readonly LeadListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Leads, newest first unless another order is chosen. Each row links to the full enquiry.
        </caption>

        <thead className="bg-surface-inset">
          <tr className="border-b border-line-subtle text-left">
            <Th className="w-16">Ref</Th>
            <Th>Customer</Th>
            <Th>Contacted</Th>
            <Th>Asked for</Th>
            <Th>Urgency</Th>
            <Th>Status</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-line-subtle last:border-0 hover:bg-surface-panel-raised"
            >
              <Td className="align-top">
                <Link
                  href={`/admin/leads/${row.reference}`}
                  className="focus-visible:ring-action-ring rounded-control font-medium text-ink-primary tabular-nums underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {row.reference}
                </Link>
              </Td>

              <Td className="align-top">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-primary">{row.customerName ?? 'Name not given'}</span>

                  <span className="text-xs text-ink-secondary tabular-nums">
                    {formatPhone(row.customerPhone)}
                  </span>

                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                    {row.cityName ?? 'City not given'}
                    {row.customerRequestCount > 1 ? (
                      // The signal the whole exercise is aimed at: they came back.
                      <Badge tone="accent">Repeat · {row.customerRequestCount}</Badge>
                    ) : null}
                  </span>
                </div>
              </Td>

              <Td className="align-top whitespace-nowrap">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-primary tabular-nums">
                    {formatDate(row.contactedAt)}
                  </span>
                  {/* "Days Since Contact" from the business's column list, counted in
                      Doha calendar days rather than in elapsed hours. */}
                  <span className="text-xs text-ink-secondary">
                    {formatDaysSince(row.contactedAt)}
                  </span>
                  <span className="text-xs text-ink-secondary">{row.platformName}</span>
                </div>
              </Td>

              <Td className="align-top">
                <div className="flex flex-col gap-0.5">
                  <span className="text-ink-primary">
                    {row.subcategoryName ?? row.categoryName ?? 'Not specified'}
                  </span>

                  <span className="text-xs text-ink-secondary">
                    {[
                      row.fabricName,
                      row.genderName,
                      row.sizeName,
                      row.quantity === null ? null : `${row.quantity} pcs`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>

                  {row.request === null ? null : (
                    <span className="line-clamp-1 max-w-[24ch] text-xs text-ink-secondary italic">
                      “{row.request}”
                    </span>
                  )}
                </div>
              </Td>

              <Td className="align-top">
                {row.urgencyName === null ? (
                  <span className="text-xs text-ink-secondary">—</span>
                ) : (
                  <Badge tone={asTone(row.urgencyTone)}>{row.urgencyName}</Badge>
                )}
              </Td>

              <Td className="align-top">
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={asTone(row.statusTone)}>{row.statusName}</Badge>

                  {row.statusIsTerminal ? null : (
                    <span className="text-xs text-ink-secondary">
                      {formatDaysSince(row.statusChangedAt)} in this status
                    </span>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The tone column is `text` in the database, so it arrives as a string.
 *
 * A check constraint keeps it to the six tones the Badge knows, but this is the
 * boundary where that guarantee is re-established in TypeScript rather than assumed.
 */
function asTone(tone: string | null): BadgeTone {
  return isBadgeTone(tone) ? tone : 'neutral';
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-2.5 eyebrow text-xs text-ink-secondary ${className ?? ''}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
