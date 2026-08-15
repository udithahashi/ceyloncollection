import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, MessageCircle, Phone, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { PageHeader } from '@/components/ui/page-header';
import { getCustomer, listLeadsForCustomer } from '@/features/customers/queries';
import {
  customerActionDescriptions,
  customerActionLabels,
  customerActionTones,
  customerType,
  suggestedAction,
} from '@/features/customers/summary';
import { can } from '@/lib/auth/roles';
import { authorize } from '@/lib/auth/session';
import { formatPhone } from '@/lib/phone';
import { isBadgeTone, type BadgeTone } from '@/lib/theme/tones';
import { daysSince, formatDate, formatDaysSince } from '@/lib/time';

export async function generateMetadata({ params }: PageProps<'/admin/customers/[id]'>) {
  const { id } = await params;
  const customer = await getCustomer(id);

  return { title: customer?.name ?? 'Customer' };
}

/**
 * One customer, and every enquiry they have ever made.
 *
 * The figures across the top are the business's own customer columns; the timeline below
 * is what they are computed from. Both come from `customer_summary`, so the number in the
 * header and the number of rows underneath it cannot disagree.
 */
export default async function CustomerPage({ params }: PageProps<'/admin/customers/[id]'>) {
  const { id } = await params;

  const user = await authorize('customers', 'read');

  const customer = await getCustomer(id);
  if (customer === null) notFound();

  const leads = await listLeadsForCustomer(customer.id);

  const action = suggestedAction({
    totalRequests: customer.totalRequests,
    openRequests: customer.openRequests,
    openReadyToBuyRequests: customer.openReadyToBuyRequests,
    quietForDays: customer.lastContactAt === null ? null : daysSince(customer.lastContactAt),
    latestIsWon: customer.latestStatusIsWon ?? false,
    latestIsTerminal: customer.latestStatusIsTerminal ?? false,
  });

  const whatsapp = customer.whatsappNumber ?? customer.phone;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/customers"
          className="focus-visible:ring-action-ring -ml-1 inline-flex w-fit items-center gap-1 rounded-control px-1 text-xs text-ink-secondary transition-colors hover:text-ink-primary focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          All customers
        </Link>

        <PageHeader
          eyebrow={
            customerType(customer.totalRequests) === 'Repeat' ? 'Repeat customer' : 'Customer'
          }
          title={customer.name ?? formatPhone(customer.phone)}
          description={[
            customer.cityName ?? 'City not given',
            customer.firstPlatformName === null ? null : `came from ${customer.firstPlatformName}`,
            customer.firstContactAt === null
              ? null
              : `first wrote ${formatDate(customer.firstContactAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          actions={
            can(user.role, 'leads', 'create') ? (
              <Link href="/admin/leads/new" className={buttonVariants({ variant: 'primary' })}>
                <Plus aria-hidden="true" />
                Record a lead
              </Link>
            ) : null
          }
        />
      </div>

      {customer.blockedAt === null ? null : (
        <Card className="border-error-line">
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm font-medium text-error-ink">
              Blocked {formatDate(customer.blockedAt)}
            </p>
            <p className="text-sm text-ink-secondary">
              {customer.blockedReason ?? 'No reason recorded.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>The numbers</CardTitle>
              <Badge tone={customerActionTones[action]}>{customerActionLabels[action]}</Badge>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-ink-secondary">{customerActionDescriptions[action]}</p>

              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                <Figure label="Requests" value={customer.totalRequests} />
                <Figure label="Still open" value={customer.openRequests} />
                <Figure label="Said ready to buy" value={customer.readyToBuyRequests} />
                <Figure label="Ended in a sale" value={customer.wonRequests} />
                <Figure label="Lost or cancelled" value={customer.lostRequests} />
                <Figure
                  label="Pieces asked for"
                  value={customer.totalQuantity ?? '—'}
                  hint="Across every enquiry that named a quantity."
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>
                {leads.length === 0
                  ? 'No enquiries'
                  : `${leads.length} ${leads.length === 1 ? 'enquiry' : 'enquiries'}`}
              </CardTitle>

              {customer.lastContactAt === null ? null : (
                <span className="text-xs text-ink-secondary">
                  Last contact {formatDaysSince(customer.lastContactAt)}
                </span>
              )}
            </CardHeader>

            {leads.length === 0 ? (
              <CardContent>
                <p className="text-sm text-ink-secondary">
                  This customer is on file with nothing recorded against them yet.
                </p>
              </CardContent>
            ) : (
              /**
               * A timeline rather than a table. There are usually two or three of these,
               * and they are read as a conversation - what they asked for, then what
               * happened - which is a shape a row of columns does not have.
               */
              <ol className="flex flex-col">
                {leads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex flex-col gap-1.5 border-b border-line-subtle px-5 py-4 last:border-0"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <Link
                        href={`/admin/leads/${lead.reference}`}
                        className="text-sm font-medium text-ink-primary underline-offset-2 hover:underline"
                      >
                        {lead.interest ?? 'Not specified'}
                      </Link>

                      <span className="text-xs text-ink-secondary tabular-nums">
                        {formatDate(lead.contactedAt)} · {lead.platformName} · lead {lead.reference}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={tone(lead.statusTone)}>{lead.statusName}</Badge>
                      {lead.urgencyName === null ? null : (
                        <Badge tone={tone(lead.urgencyTone)}>{lead.urgencyName}</Badge>
                      )}
                      {[
                        lead.fabricName,
                        lead.sizeName,
                        lead.quantity === null ? null : `${lead.quantity} pcs`,
                      ]
                        .filter(Boolean)
                        .map((detail) => (
                          <span key={detail} className="text-xs text-ink-secondary">
                            {detail}
                          </span>
                        ))}
                    </div>

                    {lead.request === null ? null : (
                      <p className="text-xs text-ink-secondary italic">“{lead.request}”</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Reach them</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink-primary tabular-nums">
                  {formatPhone(customer.phone)}
                </span>
                <CopyButton value={customer.phone} label="Copy the number" />
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${customer.phone}`}
                  className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                >
                  <Phone aria-hidden="true" />
                  Call
                </a>

                {customer.onWhatsapp ? (
                  <a
                    href={`https://wa.me/${whatsapp.replace('+', '')}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-ink-secondary">Not on WhatsApp.</span>
                )}
              </div>

              {customer.whatsappNumber === null ||
              customer.whatsappNumber === customer.phone ? null : (
                <p className="text-xs text-ink-secondary tabular-nums">
                  WhatsApp on {formatPhone(customer.whatsappNumber)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About them</CardTitle>
            </CardHeader>

            <CardContent>
              {customer.notes === null || customer.notes === '' ? (
                <p className="text-sm text-ink-secondary">
                  Nothing recorded. Notes about the person - sizes, family, preferences - belong
                  here rather than on one enquiry.
                </p>
              ) : (
                <p className="text-sm whitespace-pre-line text-ink-primary">{customer.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All their enquiries</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/admin/leads?customer=${customer.id}`}
                className={buttonVariants({ variant: 'secondary', size: 'sm' })}
              >
                Open in the leads list
              </Link>
              <p className="mt-2 text-xs text-ink-secondary">
                Where the full set of filters and orderings applies.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** One derived figure, in tabular numerals so a column of them lines up. */
function Figure({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="eyebrow text-xs text-ink-secondary">{label}</dt>
      <dd className="text-xl text-ink-primary tabular-nums">{value}</dd>
      {hint ? <p className="text-xs text-ink-secondary">{hint}</p> : null}
    </div>
  );
}

function tone(value: string | null): BadgeTone {
  return isBadgeTone(value) ? value : 'neutral';
}
