/**
 * The activity log table.
 *
 * Same reasoning as `LeadTable`: plain HTML, filtering and paging already done in
 * Postgres, nothing for the browser to compute.
 */
import { Badge } from '@/components/ui/badge';
import type { ActivityLogRow } from '@/db/schema/activity-log';
import { formatDateTime } from '@/lib/time';

import { activityActionLabels } from '../labels';

export function ActivityTable({ rows }: { rows: readonly ActivityLogRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Activity, newest first.</caption>

        <thead className="bg-surface-inset">
          <tr className="border-b border-line-subtle text-left">
            <Th>When</Th>
            <Th>Who</Th>
            <Th>What</Th>
            <Th>Entity</Th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line-subtle last:border-0">
              <Td className="align-top whitespace-nowrap text-ink-secondary tabular-nums">
                {formatDateTime(row.createdAt)}
              </Td>

              <Td className="align-top text-ink-primary">{row.actorLabel ?? 'System'}</Td>

              <Td className="align-top">
                <Badge tone={actionTone(row.action)}>{activityActionLabels[row.action]}</Badge>
              </Td>

              <Td className="align-top text-ink-secondary">
                {row.entityLabel ?? (row.entityType ? humanizeEntityType(row.entityType) : '—')}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A quick visual read of "is this worth a second look" - failures and deletions
 * stand out, everyday recording and updating stays quiet.
 */
function actionTone(action: ActivityLogRow['action']): 'error' | 'warning' | 'success' | undefined {
  if (action.endsWith('Failed')) return 'error';
  if (action.endsWith('deleted') || action === 'user.disabled' || action === 'intake.rejected') {
    return 'warning';
  }
  if (action === 'lead.created' || action === 'intake.promoted') return 'success';
  return undefined;
}

/**
 * A fallback for the rare row with no `entityLabel` - `entityType` is an internal
 * identifier (`leadIntake`, `lead-statuses`), not copy, so it is reformatted
 * rather than shown as typed.
 */
function humanizeEntityType(entityType: string): string {
  const spaced = entityType
    .replace(/-/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="px-4 py-2.5 eyebrow text-xs text-ink-secondary">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className ?? ''}`}>{children}</td>;
}
