import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { PageHeader } from '@/components/ui/page-header';
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
export default async function ReviewIntakePage({ params }: PageProps<'/intake/[id]'>) {
  await requirePermission('imports', 'create', '/intake');

  const { id } = await params;

  const [row, options, statusId] = await Promise.all([
    getIntakeById(id),
    leadFormOptions(),
    defaultStatusId(),
  ]);

  // Gone, or already reviewed by someone else since the queue page was loaded - either
  // way there is nothing left to do here.
  if (!row || row.status !== 'pending') notFound();

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
          href="/intake"
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
