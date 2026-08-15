import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import type { LeadIntakeRow } from '@/db/schema';
import type { LeadFormSeed } from '@/features/leads/components/lead-form';
import { IntakeReviewForm } from '@/features/leads/intake/components/intake-review-form';
import { getIntakeById } from '@/features/leads/intake/queries';
import { matchKey } from '@/features/leads/import/lookups';
import { defaultStatusId, leadFormOptions } from '@/features/leads/queries';
import { requirePermission } from '@/lib/auth/session';
import { InvalidPhoneNumberError, normalisePhone } from '@/lib/phone';
import { formatDateTime, todayInBusinessTime } from '@/lib/time';

export const metadata = { title: 'Review a message' };

/**
 * Turning one staged message into a lead.
 *
 * The guesswork happens here, on the server, against whatever the taxonomy looks like
 * right now - never something decided once when the message arrived and trusted stale.
 * Only two fields are worth guessing at all: the platform, matched by name the same way
 * the CSV importer matches a column value (see @/features/leads/import/lookups), and the
 * phone number, normalised the same way every other entry point normalises one. Nothing
 * else is inferred from a raw sentence - see docs/CONCEPTS.md for why.
 */
export default async function ReviewIntakePage({ params }: PageProps<'/admin/intake/[id]'>) {
  await requirePermission('imports', 'create', '/admin/intake');

  const { id } = await params;

  const [detail, options, statusId] = await Promise.all([
    getIntakeById(id),
    leadFormOptions(),
    defaultStatusId(),
  ]);

  // No such message. A 404 is the honest answer only for this case.
  if (!detail) notFound();

  const { row, promotedLeadReference } = detail;

  /*
   * Already dealt with. This is the ordinary path immediately after promoting one: a
   * Server Action re-renders the route it was called from, and by then the row is no
   * longer `pending`. 404ing here made a successful save look like a broken link, and
   * hid the lead reference the person had just earned. It is also what a colleague sees
   * when they open a message someone else has just handled.
   */
  if (row.status !== 'pending') {
    return <IntakeOutcome row={row} promotedLeadReference={promotedLeadReference} />;
  }

  const guessedPlatformId =
    row.platformRaw !== null
      ? (options.platforms.find((option) => matchKey(option.label) === matchKey(row.platformRaw!))
          ?.value ?? null)
      : null;

  const guessedPhone = (() => {
    if (row.phoneRaw === null) return '';
    try {
      return normalisePhone(row.phoneRaw);
    } catch (error) {
      if (error instanceof InvalidPhoneNumberError) return '';
      throw error;
    }
  })();

  const seed: LeadFormSeed = {
    customerPhone: guessedPhone,
    customerName: row.customerNameRaw,
    customerCityId: null,
    customerOnWhatsapp: true,
    contactedAt: row.receivedAt,
    platformId: guessedPlatformId ?? '',
    statusId: statusId ?? '',
    urgencyId: null,
    categoryId: null,
    subcategoryId: null,
    clothGenderId: null,
    fabricId: null,
    sizeId: null,
    quantity: null,
    request: row.messageText,
    notes: null,
    tags: [],
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/intake"
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          Intake queue
        </Link>

        <PageHeader
          eyebrow="Demand"
          title="Review a message"
          description="Everything below is a guess except the message itself. Check it, fix what is wrong, and record it - or dismiss it if it never was an enquiry."
        />
      </div>

      <IntakeReviewForm
        intakeId={row.id}
        receivedAt={formatDateTime(row.receivedAt)}
        messageText={row.messageText}
        phoneRaw={row.phoneRaw}
        customerNameRaw={row.customerNameRaw}
        platformRaw={row.platformRaw}
        seed={seed}
        options={options}
        today={todayInBusinessTime()}
      />
    </>
  );
}

/** What a message that has already been promoted or dismissed shows instead of the form. */
function IntakeOutcome({
  row,
  promotedLeadReference,
}: {
  row: LeadIntakeRow;
  promotedLeadReference: number | null;
}) {
  const promoted = row.status === 'promoted';

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/intake"
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          Intake queue
        </Link>

        <PageHeader
          eyebrow="Demand"
          title={promoted ? 'Recorded' : 'Dismissed'}
          description={
            promoted
              ? 'This message has been recorded as a lead.'
              : 'This message was dismissed, so nothing was recorded.'
          }
        />
      </div>

      <Card className="max-w-4xl">
        <CardContent className="flex flex-col items-start gap-4 py-6">
          <p className="text-sm whitespace-pre-wrap text-ink-secondary">{row.messageText}</p>

          {row.rejectionReason !== null ? (
            <p className="text-sm text-ink-primary">
              <span className="text-ink-secondary">Reason: </span>
              {row.rejectionReason}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {promoted && promotedLeadReference !== null ? (
              <Link
                href={`/admin/leads/${promotedLeadReference}`}
                className={buttonVariants({ variant: 'primary' })}
              >
                Open lead {promotedLeadReference}
              </Link>
            ) : null}

            <Link href="/admin/intake" className={buttonVariants({ variant: 'secondary' })}>
              Back to the queue
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
