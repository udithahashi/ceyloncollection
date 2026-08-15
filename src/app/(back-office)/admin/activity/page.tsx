import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SelectField } from '@/components/ui/field';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { activityActions } from '@/db/schema/activity-log';
import { ActivityTable } from '@/features/activity-log/components/activity-table';
import { parseActivityFilters, toSearchParams } from '@/features/activity-log/filters';
import { activityActionLabels } from '@/features/activity-log/labels';
import { listActivity } from '@/features/activity-log/queries';
import { authorize } from '@/lib/auth/session';

export const metadata = { title: 'Activity' };

/**
 * The activity log: who did what, and when.
 *
 * Read-only and unfiltered by role beyond the page-level `activityLog:read` check
 * - owner and manager only, per `@/lib/auth/roles`. Everything else about the view
 * lives in the URL, the same reasoning as the leads list: a filtered page can be
 * bookmarked, and the server renders the right rows on the first request.
 */
export default async function ActivityPage({ searchParams }: PageProps<'/admin/activity'>) {
  await authorize('activityLog', 'read');

  const filters = parseActivityFilters(await searchParams);
  const page = await listActivity(filters);

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Activity"
        description="Every action that changed data, and the sign-ins worth knowing about. This is the record for when something looks wrong and nobody remembers touching it."
      />

      <Card>
        <CardContent>
          {/* A plain GET form: no client JS needed for a single filter, and the
              result is a real, bookmarkable URL like every other list in the app. */}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <SelectField
              name="action"
              label="Action"
              defaultValue={filters.action ?? ''}
              className="max-w-xs"
            >
              <option value="">Every action</option>
              {activityActions.map((action) => (
                <option key={action} value={action}>
                  {activityActionLabels[action]}
                </option>
              ))}
            </SelectField>

            <Button type="submit" variant="secondary" size="sm">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {page.rows.length === 0 ? (
          <CardContent className="py-12">
            <p className="text-center text-sm text-ink-secondary">
              {filters.action ? 'Nothing recorded for that action yet.' : 'Nothing recorded yet.'}
            </p>
          </CardContent>
        ) : (
          <>
            <ActivityTable rows={page.rows} />

            <Pagination
              page={page.page}
              pageCount={page.pageCount}
              pageSize={page.pageSize}
              total={page.total}
              hrefFor={(next) => `/admin/activity${toSearchParams(filters, { page: next })}`}
              noun={{ one: 'entry', many: 'entries' }}
            />
          </>
        )}
      </Card>
    </>
  );
}
