import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { LeadForm } from '@/features/leads/components/lead-form';
import { defaultStatusId, getLeadByReference, leadFormOptions } from '@/features/leads/queries';
import { authorize } from '@/lib/auth/session';
import { todayInBusinessTime } from '@/lib/time';

export async function generateMetadata({ params }: PageProps<'/admin/leads/[reference]/edit'>) {
  const { reference } = await params;
  return { title: `Edit lead ${reference}` };
}

/**
 * Editing an enquiry.
 *
 * The same form as recording one, given the lead. Corrections are the common reason to
 * be here - a size heard wrong, a fabric named later in the conversation - so nothing
 * about the layout changes; only the buttons and the fact that it does not clear itself
 * after saving.
 */
export default async function EditLeadPage({ params }: PageProps<'/admin/leads/[reference]/edit'>) {
  const { reference } = await params;

  const asNumber = Number.parseInt(reference, 10);
  if (!Number.isInteger(asNumber) || asNumber < 1) notFound();

  await authorize('leads', 'update');

  const [lead, options, statusId] = await Promise.all([
    getLeadByReference(asNumber),
    leadFormOptions(),
    defaultStatusId(),
  ]);

  if (lead === null) notFound();

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href={`/admin/leads/${lead.reference}`}
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          Back to lead {lead.reference}
        </Link>

        <PageHeader
          eyebrow={`Lead ${lead.reference}`}
          title="Edit this enquiry"
          description="Changing the contact number moves the enquiry to that customer, or creates them."
        />
      </div>

      <Card className="max-w-4xl">
        <CardContent className="py-5">
          <LeadForm
            options={options}
            today={todayInBusinessTime()}
            defaultStatusId={statusId}
            lead={lead}
          />
        </CardContent>
      </Card>
    </>
  );
}
