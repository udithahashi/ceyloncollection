'use client';

import { useActionState } from 'react';

import { CopyButton } from '@/components/ui/copy-button';
import { SelectField, TextField } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { initialActionState } from '@/lib/actions/result';
import { roleDescriptions, roleLabels, type Role } from '@/lib/auth/roles';

import { inviteMemberAction, type IssuedInvitation } from '../actions';

/**
 * The invite form.
 *
 * On success it shows the link once and then never again: only a hash of the token is
 * stored, so there is nothing to show a second time. If the link is lost, the
 * invitation is withdrawn and a new one issued - which is the behaviour you want,
 * since a link that can be re-displayed is a link that can be re-stolen.
 */
export function InviteForm({ assignableRoles }: { assignableRoles: readonly Role[] }) {
  const [state, action] = useActionState(
    inviteMemberAction,
    initialActionState<IssuedInvitation>()
  );

  const error = state.ok ? undefined : state.error;
  const fieldErrors = state.ok ? undefined : state.fieldErrors;
  const issued = state.ok ? state.data : undefined;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5" noValidate>
        {error ? <FormMessage>{error}</FormMessage> : null}

        <TextField
          name="email"
          type="email"
          label="Email address"
          required
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          hint="They will set their own password from the link."
          error={fieldErrors?.email?.[0]}
        />

        <SelectField
          name="role"
          label="Role"
          required
          defaultValue="staff"
          error={fieldErrors?.role?.[0]}
        >
          {assignableRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]} — {roleDescriptions[role]}
            </option>
          ))}
        </SelectField>

        <SubmitButton variant="primary" pendingLabel="Creating link...">
          Create invitation
        </SubmitButton>
      </form>

      {issued ? <IssuedLink invitation={issued} /> : null}
    </div>
  );
}

function IssuedLink({ invitation }: { invitation: IssuedInvitation }) {
  const expires = new Date(invitation.expiresAt);

  return (
    <div className="border border-success-line bg-success-bg p-4">
      <p className="eyebrow text-[0.66rem] text-success-ink">Invitation ready</p>

      <p className="mt-2 text-sm text-ink-primary">
        Send this link to <strong className="font-medium">{invitation.email}</strong>. It works
        once, and expires on{' '}
        {expires.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
      </p>

      <div className="mt-3 flex items-start gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto border border-line-subtle bg-surface-inset px-3 py-2 text-xs text-ink-primary">
          {invitation.url}
        </code>
        <CopyButton value={invitation.url} label="Copy invitation link" />
      </div>

      <p className="mt-3 text-xs text-ink-secondary">
        This is the only time the link is shown. If it is lost, withdraw the invitation and create
        another.
      </p>
    </div>
  );
}
