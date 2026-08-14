import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { AddValueForm } from '@/features/taxonomy/components/add-value-form';
import { ValueRow } from '@/features/taxonomy/components/value-row';
import { listCategoryOptions, listTaxonomy } from '@/features/taxonomy/queries';
import { parentField, taxonomyFromSlug } from '@/features/taxonomy/registry';
import { authorize } from '@/lib/auth/session';
import { can } from '@/lib/auth/roles';

/**
 * One taxonomy: the list, and the form to add to it.
 *
 * All ten lists render through here. What differs between them - the extra
 * columns, the labels, whether rows hang off a parent - comes from the registry,
 * so the page is the same page whichever list you open.
 */
export async function generateMetadata({ params }: PageProps<'/taxonomy/[key]'>) {
  const { key } = await params;
  const definition = taxonomyFromSlug(key);

  return { title: definition?.plural ?? 'Taxonomy' };
}

export default async function TaxonomyDetailPage({ params }: PageProps<'/taxonomy/[key]'>) {
  const { key } = await params;
  const definition = taxonomyFromSlug(key);

  if (definition === null) notFound();

  const user = await authorize('taxonomy', 'read');

  const needsParent = parentField(definition.key) !== null;

  const [rows, categoryOptions] = await Promise.all([
    listTaxonomy(definition.key),
    needsParent ? listCategoryOptions() : Promise.resolve([]),
  ]);

  const canCreate = can(user.role, 'taxonomy', 'create');
  const canUpdate = can(user.role, 'taxonomy', 'update');
  const canDelete = can(user.role, 'taxonomy', 'delete');

  const options = categoryOptions.map((category) => ({
    value: category.id,
    label: category.name,
  }));

  // Move buttons are disabled at the ends of the list. For sub-categories that is
  // the end of the group they sit in, not of the whole table.
  const groupBounds = firstAndLastByGroup(rows);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/taxonomy"
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          All lists
        </Link>

        <PageHeader eyebrow="Taxonomy" title={definition.plural} description={definition.purpose} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>
              {rows.length} {rows.length === 1 ? 'value' : 'values'}
            </CardTitle>
          </CardHeader>

          {rows.length === 0 ? (
            <CardContent>
              <p className="text-sm text-ink-secondary">
                Nothing here yet. Add the first {definition.singular} on the right.
              </p>
            </CardContent>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-surface-inset">
                  <tr className="border-b border-line-subtle text-left">
                    <Th>Value</Th>
                    {needsParent ? <Th>Category</Th> : null}
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const bounds = groupBounds.get(row.parentId ?? '');

                    return (
                      <ValueRow
                        key={row.id}
                        row={row}
                        definition={definition}
                        categoryOptions={options}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        isFirst={bounds?.first === row.id}
                        isLast={bounds?.last === row.id}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {canCreate ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Add a {definition.singular}</CardTitle>
            </CardHeader>
            <CardContent>
              <AddValueForm definition={definition} categoryOptions={options} />
            </CardContent>
          </Card>
        ) : (
          <Card className="h-fit">
            <CardContent>
              <p className="text-sm text-ink-secondary">
                Your role can read this list but not change it.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

/**
 * The first and last row id of each group, so the move buttons know where the ends
 * are. Rows arrive already sorted, which is what makes one pass enough.
 */
function firstAndLastByGroup(
  rows: readonly { id: string; parentId: string | null }[]
): Map<string, { first: string; last: string }> {
  const bounds = new Map<string, { first: string; last: string }>();

  for (const row of rows) {
    const group = row.parentId ?? '';
    const existing = bounds.get(group);

    if (existing === undefined) {
      bounds.set(group, { first: row.id, last: row.id });
    } else {
      existing.last = row.id;
    }
  }

  return bounds;
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-2.5 eyebrow text-xs text-ink-secondary ${className ?? ''}`}>
      {children}
    </th>
  );
}
