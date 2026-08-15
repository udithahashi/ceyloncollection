import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { LeadForm } from '@/features/leads/components/lead-form';
import { defaultStatusId, leadFormOptions } from '@/features/leads/queries';
import { authorize } from '@/lib/auth/session';
import { todayInBusinessTime } from '@/lib/time';

export const metadata = { title: 'Record a lead' };

/**
 * Recording one enquiry.
 *
 * Its own page rather than a dialog on the list. Fifteen fields do not belong in a
 * modal, and a URL that can be bookmarked is worth having for the screen someone opens
 * twenty times an evening.
 *
 * Today's date and the opening status are resolved here, on the server: the date so it
 * is Doha's today rather than the laptop's, and the status by looking up the first
 * non-terminal one so renaming "New Inquiry" cannot break the default.
 */
export default async function NewLeadPage() {
  await authorize('leads', 'create');

  const [options, statusId] = await Promise.all([leadFormOptions(), defaultStatusId()]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/leads"
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          All leads
        </Link>

        <PageHeader
          eyebrow="Demand"
          title="Record a lead"
          description="Only the contact number, the date, the platform and the status are required. Leave the rest blank if they did not say."
        />
      </div>

      <Card className="max-w-4xl">
        <CardContent className="py-5">
          <LeadForm options={options} today={todayInBusinessTime()} defaultStatusId={statusId} />
        </CardContent>
      </Card>
    </>
  );
}
