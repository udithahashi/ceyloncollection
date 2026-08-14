'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { verifyBackupCodeAction, verifyTwoFactorAction } from '../actions';

/**
 * The second step of sign-in: a code from the authenticator app, or a backup code
 * if the phone is lost.
 *
 * Two separate actions rather than one with a mode flag, so neither path has to
 * reason about which kind of code it received.
 */
export function TwoFactorForm({ next }: { next?: string }) {
  const [useBackupCode, setUseBackupCode] = useState(false);

  const [totpState, totpAction] = useActionState(verifyTwoFactorAction, idleActionState);
  const [backupState, backupAction] = useActionState(verifyBackupCodeAction, idleActionState);

  const state = useBackupCode ? backupState : totpState;
  const error = state.ok ? undefined : state.error;
  const fieldErrors = state.ok ? undefined : state.fieldErrors;

  return (
    <div className="flex flex-col gap-5">
      {error ? <FormMessage>{error}</FormMessage> : null}

      {useBackupCode ? (
        <form action={backupAction} className="flex flex-col gap-5" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <TextField
            name="code"
            label="Backup code"
            hint="One of the codes you saved when you set up two-factor. Each one works once."
            required
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            error={fieldErrors?.code?.[0]}
          />

          <SubmitButton variant="primary" size="lg" pendingLabel="Checking...">
            Use backup code
          </SubmitButton>
        </form>
      ) : (
        <form action={totpAction} className="flex flex-col gap-5" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}

          <TextField
            name="code"
            label="Authentication code"
            hint="The 6-digit code currently shown in your authenticator app."
            required
            autoFocus
            // `one-time-code` lets iOS and Android offer the code from the keyboard.
            autoComplete="one-time-code"
            // `numeric` shows a number pad without rejecting a pasted code.
            inputMode="numeric"
            // Six digits plus a space, since some apps display `123 456`.
            maxLength={7}
            error={fieldErrors?.code?.[0]}
            controlClassName="text-center text-lg tracking-[0.4em]"
          />

          <SubmitButton variant="primary" size="lg" pendingLabel="Verifying...">
            Verify
          </SubmitButton>
        </form>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="self-center"
        onClick={() => setUseBackupCode((current) => !current)}
      >
        {useBackupCode ? 'Use my authenticator app' : 'I have lost my phone'}
      </Button>
    </div>
  );
}
