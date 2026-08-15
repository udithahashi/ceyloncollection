import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { countTaxonomies } from '@/features/taxonomy/queries';
import { taxonomies, taxonomySections } from '@/features/taxonomy/registry';
import { authorize } from '@/lib/auth/session';

/**
 * The index of the ten lists.
 *
 * Grouped rather than alphabetical: someone arriving here wants either "how leads
 * are described" or "how garments are described", and the two rarely overlap in
 * one sitting.
 */
export const metadata = { title: 'Taxonomy' };

export default async function TaxonomyPage() {
  await authorize('taxonomy', 'read');

  const counts = await countTaxonomies();

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Taxonomy"
        description="The vocabulary every lead is recorded in. Editing a list here changes what the forms offer; it never changes a lead that has already been recorded."
      />

      {taxonomySections.map((section) => (
        <section
          key={section.heading}
          aria-labelledby={section.heading}
          className="flex flex-col gap-3"
        >
          <h2 id={section.heading} className="eyebrow text-sm text-ink-secondary">
            {section.heading}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {section.keys.map((key) => {
              const definition = taxonomies[key];

              return (
                <Card key={key} className="relative transition-colors hover:border-line-strong">
                  <CardContent className="flex h-full flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-base font-semibold text-ink-primary">
                        <Link
                          href={`/admin/taxonomy/${key}`}
                          className="focus-visible:ring-action-ring rounded-control focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page focus-visible:outline-none"
                        >
                          {/* Stretches the hit area to the whole card without nesting
                              the card inside a link, which would swallow the buttons
                              a card may hold later. */}
                          <span className="absolute inset-0" aria-hidden="true" />
                          {definition.plural}
                        </Link>
                      </h3>
                      <span className="numeric text-sm text-ink-secondary">{counts[key]}</span>
                    </div>

                    <p className="text-xs text-ink-secondary">{definition.purpose}</p>

                    <p className="mt-auto flex items-center gap-1 text-xs text-ink-accent">
                      Open
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
