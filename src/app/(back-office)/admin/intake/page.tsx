import Link from 'next/link';
import { Inbox } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { listPendingIntake } from '@/features/leads/intake/queries';
import { requirePermission } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/time';

export const metadata = { title: 'Intake queue' };

/**
 * Messages n8n has staged, waiting for a person.
 *
 * `imports:create` rather than `imports:read` or `leads:read`: reviewing this queue is
 * part of the same elevated-trust write path as promoting a row, the same reasoning
 * `/admin/leads/import` already uses for the CSV importer. See docs/CONCEPTS.md for why the
 * messages land here instead of straight in `leads`.
 */
export default async function IntakeQueuePage({ searchParams }: PageProps<'/admin/intake'>) {
  await requirePermission('imports', 'create', '/admin/intake');

  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);

  const queue = await listPendingIntake(page);

  return (
    <>
      <PageHeader
        eyebrow="Demand"
        title="Intake queue"
        description="Messages n8n has staged from social media. Nothing here is a lead yet - open one to record it, or dismiss it."
      />

      <Card className="overflow-hidden">
        {queue.rows.length === 0 ? (
          <CardContent className="py-12">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-center">
              <Inbox aria-hidden="true" className="size-8 text-ink-secondary" />
              <p className="text-sm font-medium text-ink-primary">Nothing waiting</p>
              <p className="text-sm text-ink-secondary">
                Every staged message has been recorded or dismissed. New ones appear here as n8n
                forwards them.
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line-subtle text-xs text-ink-secondary">
                  <tr>
                    <th className="px-4 py-2 font-medium">Received</th>
                    <th className="px-4 py-2 font-medium">Platform</th>
                    <th className="px-4 py-2 font-medium">Who</th>
                    <th className="px-4 py-2 font-medium">Message</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-line-subtle">
                  {queue.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-panel-raised">
                      <td className="px-4 py-2 align-top whitespace-nowrap text-ink-secondary">
                        <Link href={`/admin/intake/${row.id}`} className="hover:underline">
                          {formatDateTime(row.receivedAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-2 align-top text-ink-primary">
                        {row.platformRaw ?? '—'}
                      </td>
                      <td className="px-4 py-2 align-top text-ink-primary">
                        {row.customerNameRaw ?? row.phoneRaw ?? '—'}
                      </td>
                      <td className="max-w-md px-4 py-2 align-top text-ink-primary">
                        <span className="line-clamp-2">{row.messageText}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={queue.page}
              pageCount={queue.pageCount}
              pageSize={queue.pageSize}
              total={queue.total}
              hrefFor={(next) => `/admin/intake?page=${next}`}
            />
          </>
        )}
      </Card>
    </>
  );
}
