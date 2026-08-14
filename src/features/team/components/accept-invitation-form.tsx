'use client';

import { useActionState } from 'react';

import { TextField } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { acceptInvitationAction } from '../actions';
import { MIN_PASSWORD_LENGTH } from '../schemas';

/**
 * Where a new member sets their name and password.
 *
 * The email and role are not fields here: both come from the invitation, server-side.
 * Rendering them as disabled inputs would be friendlier looking and would also mean
 * shipping values the form has no business submitting.
 */
export function AcceptInvitationForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvitationAction, idleActionState);

  const error = state.ok ? undefined : state.error;
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {error ? <FormMessage>{error}</FormMessage> : null}

      <p className="text-sm text-ink-secondary">
        Setting up the account for <strong className="font-medium text-ink-primary">{email}</strong>
        .
      </p>

      <TextField
        name="name"
        label="Your name"
        required
        autoComplete="name"
        autoFocus
        hint="Shown against everything you record, and in the activity log."
        error={fieldErrors?.name?.[0]}
      />

      <TextField
        name="password"
        type="password"
        label="Password"
        required
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence you will remember beats a short password you will not.`}
        error={fieldErrors?.password?.[0]}
      />

      <TextField
        name="confirmPassword"
        type="password"
        label="Password again"
        required
        autoComplete="new-password"
        error={fieldErrors?.confirmPassword?.[0]}
      />

      <p className="text-xs text-ink-secondary">
        After signing in you will be asked to set up an authenticator app. Two-factor authentication
        is required for every account.
      </p>

      <SubmitButton variant="primary" size="lg" pendingLabel="Creating account...">
        Create account
      </SubmitButton>
    </form>
  );
}
