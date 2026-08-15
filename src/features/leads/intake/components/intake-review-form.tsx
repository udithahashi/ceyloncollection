'use client';

/**
 * Turning one staged message into a lead, or dismissing it.
 *
 * Two separate `<form>`s sharing a page, not one form with two submit buttons: promote
 * validates and requires the full set of lead fields, reject requires only a reason,
 * and a browser applies `required` validation per form, not per button. Keeping them
 * apart also means a slip of the mouse cannot submit fifteen empty fields toward a
 * rejection.
 *
 * The field set itself is `LeadFields` from the manual lead form, reused rather than
 * rebuilt - see the note on `LeadFormSeed` there. What is different here is everything
 * around it: this screen does not stay open and clear itself after a save the way
 * `LeadForm` does, because the next thing to do is look at the next queued message, not
 * type the same customer in twice.
 */
import { useActionState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextareaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { LeadFields, type LeadFormSeed } from '../../components/lead-form';
import type { LeadFormOptions } from '../../queries';
import { promoteIntakeAction, rejectIntakeAction } from '../actions';

export interface IntakeReviewFormProps {
  intakeId: string;
  receivedAt: string;
  messageText: string;
  phoneRaw: string | null;
  customerNameRaw: string | null;
  platformRaw: string | null;
  /** Built on the server from the raw fields above, matched against the current
   * taxonomy - see src/app/(admin)/intake/[id]/page.tsx. Never trusted as final: every
   * field here is exactly as editable as it would be on a fresh manual lead. */
  seed: LeadFormSeed;
  options: LeadFormOptions;
  today: string;
}

export function IntakeReviewForm({
  intakeId,
  receivedAt,
  messageText,
  phoneRaw,
  customerNameRaw,
  platformRaw,
  seed,
  options,
  today,
}: IntakeReviewFormProps) {
  const [promoteState, promoteAction] = useActionState(promoteIntakeAction, idleActionState);
  const [rejectState, rejectAction] = useActionState(rejectIntakeAction, idleActionState);

  const fieldErrors = promoteState.ok ? {} : (promoteState.fieldErrors ?? {});

  /*
   * Only failures are rendered here. On success the staged row stops being `pending`,
   * so the Server Action's re-render of this route replaces this whole component with
   * the outcome panel on the page itself - which can say "lead 289" with a link,
   * survives a refresh, and is also what a colleague sees if they had the same message
   * open. Repeating that here would be a second implementation of it that only ever
   * showed for a fraction of a second.
   */
  const promoteFailure = promoteState.ok ? null : promoteState;
  const rejectFailure = rejectState.ok ? null : rejectState;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>What arrived</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 text-sm">
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-secondary">Received</dt>
              <dd className="text-ink-primary">{receivedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-secondary">Platform, as sent</dt>
              <dd className="text-ink-primary">{platformRaw ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-secondary">Phone, as sent</dt>
              <dd className="text-ink-primary">{phoneRaw ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-secondary">Name, as sent</dt>
              <dd className="text-ink-primary">{customerNameRaw ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="text-xs text-ink-secondary">Message</p>
            <p className="whitespace-pre-wrap text-ink-primary">{messageText}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record as a lead</CardTitle>
        </CardHeader>

        <CardContent className="py-5">
          <form action={promoteAction} className="flex flex-col gap-6">
            <input type="hidden" name="intakeId" value={intakeId} />

            <LeadFields
              options={options}
              today={today}
              defaultStatusId={seed.statusId}
              lead={seed}
              fieldErrors={fieldErrors}
            />

            {promoteFailure !== null ? (
              <p role="alert" className="text-sm text-error-ink">
                {promoteFailure.error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <SubmitButton variant="primary">Promote to lead</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Not a lead</CardTitle>
        </CardHeader>

        <CardContent className="py-5">
          <form action={rejectAction} className="flex flex-col gap-4">
            <input type="hidden" name="intakeId" value={intakeId} />

            <TextareaField
              name="reason"
              label="Why"
              rows={2}
              maxLength={300}
              hint="Spam, a wrong number, a question that is not an enquiry - whatever it was."
              error={rejectFailure?.fieldErrors?.reason?.[0]}
            />

            {rejectFailure !== null ? (
              <p role="alert" className="text-sm text-error-ink">
                {rejectFailure.error}
              </p>
            ) : null}

            <div>
              <SubmitButton variant="secondary">Dismiss this message</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
