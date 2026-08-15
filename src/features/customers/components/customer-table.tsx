/**
 * The customers table.
 *
 * This is the business's second list - the same people as the leads table, collapsed by
 * phone number, with the derived figures they asked for: total requests, first and last
 * contact, days since, latest status, repeat or new, ready-to-buy count, last interest,
 * and what to do about it.
 *
 * The action column is the point of the page. It is computed here, per row, from the
 * facts in `customer_summary` and today's date in Doha - see `../summary.ts` for the
 * thresholds and why they live in TypeScript.
 */
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { formatPhone } from '@/lib/phone';
import { isBadgeTone, type BadgeTone } from '@/lib/theme/tones';
import { daysSince, formatDate, formatDaysSince } from '@/lib/time';

import type { CustomerRow } from '../queries';
import {
  customerActionLabels,
  customerActionTones,
  customerType,
  suggestedAction,
} from '../summary';

export function CustomerTable({ rows }: { rows: readonly CustomerRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Customers, one row per phone number. Each row links to their full history.
        </caption>

        <thead className="bg-surface-inset">
          <tr className="border-b border-line-subtle text-left">
            <Th>Customer</Th>
            <Th>Came from</Th>
            <Th>Enquiries</Th>
            <Th>Last contact</Th>
            <Th>Last interest</Th>
            <Th>Next step</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const action = suggestedAction({
              totalRequests: row.totalRequests,
              openRequests: row.openRequests,
              openReadyToBuyRequests: row.openReadyToBuyRequests,
              // Counted here, in business time, because the policy module is deliberately
              // free of any dependency on the clock or the timezone.
              quietForDays: row.lastContactAt === null ? null : daysSince(row.lastContactAt),
              latestIsWon: row.latestStatusIsWon ?? false,
              latestIsTerminal: row.latestStatusIsTerminal ?? false,
            });

            return (
              <tr
                key={row.id}
                className="border-b border-line-subtle last:border-0 hover:bg-surface-panel-raised"
              >
                <Td className="align-top">
                  <div className="flex flex-col gap-0.5">
                    <Link
                      href={`/admin/customers/${row.id}`}
                      className="focus-visible:ring-action-ring rounded-control font-medium text-ink-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {row.name ?? formatPhone(row.phone)}
                    </Link>

                    {row.name === null ? null : (
                      <span className="text-xs text-ink-secondary tabular-nums">
                        {formatPhone(row.phone)}
                      </span>
                    )}

                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-secondary">
                      {row.cityName ?? 'City not given'}
                      {row.blockedAt === null ? null : <Badge tone="error">Blocked</Badge>}
                    </span>
                  </div>
                </Td>

                <Td className="align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-ink-primary">{row.firstPlatformName ?? '—'}</span>
                    <span className="text-xs text-ink-secondary">
                      {row.firstContactAt === null
                        ? 'No enquiry yet'
                        : `since ${formatDate(row.firstContactAt)}`}
                    </span>
                  </div>
                </Td>

                <Td className="align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-ink-primary tabular-nums">
                      {row.totalRequests}{' '}
                      <span className="text-xs text-ink-secondary">
                        {row.totalRequests === 1 ? 'request' : 'requests'}
                      </span>
                    </span>

                    <span className="text-xs text-ink-secondary tabular-nums">
                      {row.openRequests} open
                      {row.readyToBuyRequests > 0
                        ? ` · ${row.readyToBuyRequests} ready to buy`
                        : ''}
                    </span>

                    <Badge tone={row.isRepeat ? 'accent' : 'neutral'}>
                      {customerType(row.totalRequests)}
                    </Badge>
                  </div>
                </Td>

                <Td className="align-top whitespace-nowrap">
                  {row.lastContactAt === null ? (
                    <span className="text-xs text-ink-secondary">—</span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ink-primary tabular-nums">
                        {formatDate(row.lastContactAt)}
                      </span>
                      <span className="text-xs text-ink-secondary">
                        {formatDaysSince(row.lastContactAt)}
                      </span>
                      {row.latestStatusName === null ? null : (
                        <Badge tone={tone(row.latestStatusTone)}>{row.latestStatusName}</Badge>
                      )}
                    </div>
                  )}
                </Td>

                <Td className="align-top">
                  <span
                    className={
                      row.lastInterest === null ? 'text-ink-secondary' : 'text-ink-primary'
                    }
                  >
                    {row.lastInterest ?? 'Not specified'}
                  </span>
                </Td>

                <Td className="align-top">
                  <Badge tone={customerActionTones[action]}>{customerActionLabels[action]}</Badge>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function tone(value: string | null): BadgeTone {
  return isBadgeTone(value) ? value : 'neutral';
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
