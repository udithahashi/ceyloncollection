'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';
import { roleLabels, type Role } from '@/lib/auth/roles';

import { changeRoleAction, revokeInvitationAction, setAccountEnabledAction } from '../actions';

/**
 * The per-row controls on the Team page.
 *
 * Each is its own form so that a failure is reported next to the thing that failed,
 * rather than at the top of a page listing ten people. They all submit to actions
 * that re-check the caller's permission: these controls are hidden when they do not
 * apply, and hiding is not enforcement.
 */

/** Changes a role. Submits on change, since a separate Save button for one select is noise. */
export function RoleControl({
  userId,
  currentRole,
  assignableRoles,
  disabled,
}: {
  userId: string;
  currentRole: Role;
  assignableRoles: readonly Role[];
  disabled?: boolean;
}) {
  const [state, action] = useActionState(changeRoleAction, idleActionState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />

      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>

      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={currentRole}
        disabled={disabled}
        // Submitting on change relies on JavaScript. Without it the select still
        // posts when the button below is used, so the control degrades rather than
        // breaks.
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-9 w-full border border-line-strong bg-surface-panel px-2 text-sm text-ink-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {assignableRoles.map((role) => (
          <option key={role} value={role}>
            {roleLabels[role]}
          </option>
        ))}
      </select>

      <noscript>
        <Button type="submit" variant="secondary" size="sm">
          Save role
        </Button>
      </noscript>

      {error ? (
        <p role="alert" className="text-xs text-error-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Disables or re-enables an account. */
export function AccessControl({
  userId,
  name,
  enabled,
}: {
  userId: string;
  name: string;
  enabled: boolean;
}) {
  const [state, action] = useActionState(setAccountEnabledAction, idleActionState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />

      <SubmitButton
        variant={enabled ? 'danger' : 'secondary'}
        size="sm"
        pendingLabel={enabled ? 'Deactivating...' : 'Restoring...'}
        // The name is in the accessible label because "Deactivate" repeated down a
        // table tells a screen reader user nothing about which row they are on.
        aria-label={enabled ? `Deactivate ${name}` : `Restore access for ${name}`}
      >
        {enabled ? 'Deactivate' : 'Restore'}
      </SubmitButton>

      {error ? (
        <p role="alert" className="text-right text-xs text-error-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Withdraws a pending invitation. */
export function RevokeInvitationControl({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const [state, action] = useActionState(revokeInvitationAction, idleActionState);
  const error = state.ok ? undefined : state.error;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="invitationId" value={invitationId} />

      <SubmitButton
        variant="ghost"
        size="sm"
        pendingLabel="Withdrawing..."
        aria-label={`Withdraw the invitation for ${email}`}
      >
        Withdraw
      </SubmitButton>

      {error ? (
        <p role="alert" className="text-right text-xs text-error-ink">
          {error}
        </p>
      ) : null}
    </form>
  );
}
