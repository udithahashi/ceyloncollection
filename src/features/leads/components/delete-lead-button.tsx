'use client';

/**
 * Removing a lead.
 *
 * A soft delete, so this is recoverable, and it still asks first - the confirmation is
 * not about the data being unrecoverable but about the click being cheap. Only roles
 * with `leads:delete` see the button at all; the action checks the same permission
 * again, because a hidden button is not access control.
 */
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { useActionState } from 'react';

import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { deleteLeadAction } from '../actions';

export function DeleteLeadButton({ leadId, reference }: { leadId: string; reference: number }) {
  const router = useRouter();
  const [state, action] = useActionState(deleteLeadAction, idleActionState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Remove lead ${reference}?\n\n` +
            'It comes off the lists and the reports. Ask an owner if you need it back.'
        );

        if (!confirmed) {
          event.preventDefault();
          return;
        }

        // Navigating on submit rather than on the result: the action revalidates
        // /leads, so by the time the browser gets there the row is already gone.
        router.push('/admin/leads');
      }}
    >
      <input type="hidden" name="id" value={leadId} />

      <SubmitButton variant="danger" size="sm" pendingLabel="Removing...">
        <Trash2 aria-hidden="true" />
        Remove lead
      </SubmitButton>

      {!state.ok ? (
        <p role="alert" className="mt-1 text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
