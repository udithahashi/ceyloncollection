'use client';

import { useActionState } from 'react';

import { TextField } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { signInAction } from '../actions';

/**
 * The sign-in form.
 *
 * A client component only because `useActionState` needs to render the error the
 * action returned. The form itself submits without JavaScript - the action runs on
 * the server either way - so a failed hydration degrades to a normal form post
 * rather than to a dead page.
 */
export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, idleActionState);

  const error = state.ok ? undefined : state.error;
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {error ? <FormMessage>{error}</FormMessage> : null}

      <TextField
        name="email"
        type="email"
        label="Email address"
        required
        autoComplete="username"
        // The first field on the page someone came here to use.
        autoFocus
        // Phones default to a capitalised first letter, which breaks an email.
        autoCapitalize="none"
        spellCheck={false}
        error={fieldErrors?.email?.[0]}
      />

      <TextField
        name="password"
        type="password"
        label="Password"
        required
        autoComplete="current-password"
        error={fieldErrors?.password?.[0]}
      />

      <SubmitButton variant="primary" size="lg" pendingLabel="Signing in..." className="mt-1">
        Sign in
      </SubmitButton>
    </form>
  );
}
