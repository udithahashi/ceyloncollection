import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, MessageCircle, Pencil, Phone } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { DeleteLeadButton } from '@/features/leads/components/delete-lead-button';
import { StatusChanger } from '@/features/leads/components/status-changer';
import { LeadImagePanel } from '@/features/leads/images/components/image-panel';
import { getLeadByReference, leadFormOptions, listCustomerHistory } from '@/features/leads/queries';
import { can } from '@/lib/auth/roles';
import { authorize } from '@/lib/auth/session';
import { formatPhone } from '@/lib/phone';
import type { BadgeTone } from '@/lib/theme/tones';
import { isBadgeTone } from '@/lib/theme/tones';
import { formatDate, formatDateTime, formatDaysSince } from '@/lib/time';

export async function generateMetadata({ params }: PageProps<'/admin/leads/[reference]'>) {
  const { reference } = await params;
  return { title: `Lead ${reference}` };
}

/**
 * One enquiry, and the conversation it belongs to.
 *
 * The layout answers two different questions. On the left, what was asked for - the
 * record. On the right, what to do about it: the status control, and every earlier
 * enquiry from the same number. The second panel is the reason the phone number is the
 * customer's identity; without it, the fourth message from someone reads like a first.
 */
export default async function LeadPage({ params }: PageProps<'/admin/leads/[reference]'>) {
  const { reference } = await params;

  // The reference is a number in a string-shaped route. A URL like /leads/abc is a
  // 404 rather than a database error.
  const asNumber = Number.parseInt(reference, 10);
  if (!Number.isInteger(asNumber) || asNumber < 1) notFound();

  const user = await authorize('leads', 'read');

  const lead = await getLeadByReference(asNumber);
  if (lead === null) notFound();

  const [options, history] = await Promise.all([
    can(user.role, 'leads', 'update') ? leadFormOptions() : Promise.resolve(null),
    listCustomerHistory(lead.customerId, lead.id),
  ]);

  const whatsapp = lead.customerWhatsappNumber ?? lead.customerPhone;

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
          eyebrow={`Lead ${lead.reference}`}
          title={lead.customerName ?? formatPhone(lead.customerPhone)}
          description={`${lead.platformName} · ${formatDate(lead.contactedAt)} · ${formatDaysSince(
            lead.contactedAt
          )}`}
          actions={
            <>
              {can(user.role, 'leads', 'update') ? (
                <Link
                  href={`/admin/leads/${lead.reference}/edit`}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              ) : null}

              {can(user.role, 'leads', 'delete') ? (
                <DeleteLeadButton leadId={lead.id} reference={lead.reference} />
              ) : null}
            </>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>What they asked for</CardTitle>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone(lead.statusTone)}>{lead.statusName}</Badge>
                {lead.urgencyName === null ? null : (
                  <Badge tone={tone(lead.urgencyTone)}>{lead.urgencyName}</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Detail label="Category" value={lead.categoryName} />
                <Detail label="Product" value={lead.subcategoryName} />
                <Detail label="Who it is for" value={lead.genderName} />
                <Detail label="Fabric" value={lead.fabricName} />
                <Detail label="Size" value={lead.sizeName} />
                <Detail
                  label="Quantity"
                  value={lead.quantity === null ? null : `${lead.quantity} pieces`}
                />
              </dl>

              {lead.request === null ? null : (
                <div className="mt-5 flex flex-col gap-1.5 border-t border-line-subtle pt-4">
                  <dt className="eyebrow text-xs text-ink-secondary">In their words</dt>
                  <dd className="text-sm whitespace-pre-line text-ink-primary italic">
                    “{lead.request}”
                  </dd>
                </div>
              )}

              {lead.tags.length === 0 ? null : (
                <div className="mt-5 flex flex-col gap-2 border-t border-line-subtle pt-4">
                  <p className="eyebrow text-xs text-ink-secondary">Details</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.tags.map((leadTag) => (
                      <Badge key={leadTag.id} tone="neutral" title={leadTag.group}>
                        {leadTag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <LeadImagePanel leadId={lead.id} reference={lead.reference} user={user} />

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>

            <CardContent>
              {lead.notes === null || lead.notes === '' ? (
                <p className="text-sm text-ink-secondary">
                  Nothing yet. Notes added with a status change land here, dated.
                </p>
              ) : (
                <p className="text-sm whitespace-pre-line text-ink-primary">{lead.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
            </CardHeader>

            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <Detail label="Contacted" value={formatDate(lead.contactedAt)} />
                <Detail
                  label="Status changed"
                  value={`${formatDate(lead.statusChangedAt)} · ${formatDaysSince(
                    lead.statusChangedAt
                  )}`}
                />
                <Detail label="Entered by" value={lead.createdByName} />
                <Detail
                  label="Came in"
                  value={lead.source === 'manual' ? 'Typed in' : lead.source}
                />
                <Detail label="Created" value={formatDateTime(lead.createdAt)} />
                <Detail label="Last changed" value={formatDateTime(lead.updatedAt)} />
              </dl>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {options === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Move it on</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusChanger
                  leadId={lead.id}
                  statusId={lead.statusId}
                  statuses={options.statuses}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-ink-primary">{lead.customerName ?? 'Name not given'}</p>

                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-ink-secondary tabular-nums">
                    {formatPhone(lead.customerPhone)}
                  </span>
                  <CopyButton value={lead.customerPhone} label="Copy the number" />
                </div>

                <p className="text-xs text-ink-secondary">{lead.cityName ?? 'City not given'}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${lead.customerPhone}`}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  <Phone aria-hidden="true" />
                  Call
                </a>

                {lead.customerOnWhatsapp ? (
                  <a
                    href={`https://wa.me/${whatsapp.replace('+', '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : null}
              </div>

              <Link
                href={`/admin/customers/${lead.customerId}`}
                className="text-xs text-ink-accent underline-offset-2 hover:underline"
              >
                Open the customer
              </Link>

              {lead.customerNotes === null || lead.customerNotes === '' ? null : (
                <p className="border-t border-line-subtle pt-3 text-xs whitespace-pre-line text-ink-secondary">
                  {lead.customerNotes}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                {history.length === 0
                  ? 'First enquiry'
                  : `${history.length} earlier ${history.length === 1 ? 'enquiry' : 'enquiries'}`}
              </CardTitle>
            </CardHeader>

            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-ink-secondary">
                  This number has not written before. If they come back, this is where you will see
                  it.
                </p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {history.map((row) => (
                    <li key={row.id} className="flex flex-col gap-1">
                      <Link
                        href={`/admin/leads/${row.reference}`}
                        className="text-sm text-ink-primary underline-offset-2 hover:underline"
                      >
                        {row.interest ?? `Lead ${row.reference}`}
                      </Link>

                      <span className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                        {formatDate(row.contactedAt)}
                        <Badge tone={tone(row.statusTone)}>{row.statusName}</Badge>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** One term and its value, with a dash where the customer said nothing. */
function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="eyebrow text-xs text-ink-secondary">{label}</dt>
      <dd className={value === null ? 'text-sm text-ink-secondary' : 'text-sm text-ink-primary'}>
        {value ?? 'Not specified'}
      </dd>
    </div>
  );
}

/** The tone column is `text` in the database; this is where it becomes a Badge tone. */
function tone(value: string | null): BadgeTone {
  return isBadgeTone(value) ? value : 'neutral';
}
