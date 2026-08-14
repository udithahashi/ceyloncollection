'use client';

import { useActionState } from 'react';

import { TextField } from '@/components/ui/field';
import { FormMessage } from '@/components/ui/form-message';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState, initialActionState } from '@/lib/actions/result';

import {
  confirmTwoFactorEnrolmentAction,
  startTwoFactorEnrolmentAction,
  type TwoFactorEnrolment,
} from '../actions';

/**
 * Two-factor enrolment, in two steps on one page.
 *
 * Step one asks for the password, because generating a new secret for an already
 * signed-in session is exactly what someone who found an unlocked laptop would
 * want to do. Step two shows the QR code and the backup codes, and takes a code
 * back to prove the authenticator was really added.
 *
 * The backup codes are displayed once and never again. They are single-use secrets
 * and storing them anywhere retrievable would defeat their purpose.
 */
export function TwoFactorSetup() {
  const [startState, startAction] = useActionState(
    startTwoFactorEnrolmentAction,
    initialActionState<TwoFactorEnrolment>()
  );
  const [confirmState, confirmAction] = useActionState(
    confirmTwoFactorEnrolmentAction,
    idleActionState
  );

  const enrolment = startState.ok ? startState.data : undefined;

  if (!enrolment) {
    const error = startState.ok ? undefined : startState.error;
    const fieldErrors = startState.ok ? undefined : startState.fieldErrors;

    return (
      <form action={startAction} className="flex flex-col gap-5" noValidate>
        {error ? <FormMessage>{error}</FormMessage> : null}

        <TextField
          name="password"
          type="password"
          label="Confirm your password"
          hint="Confirming your password stops someone using an unattended session to add their own authenticator."
          required
          autoFocus
          autoComplete="current-password"
          error={fieldErrors?.password?.[0]}
        />

        <SubmitButton variant="primary" size="lg" pendingLabel="Preparing...">
          Continue
        </SubmitButton>
      </form>
    );
  }

  const confirmError = confirmState.ok ? undefined : confirmState.error;
  const confirmFieldErrors = confirmState.ok ? undefined : confirmState.fieldErrors;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-ink-primary">Step 1 &mdash; scan this code</h4>

        <div className="flex justify-center">
          {/*
            The SVG comes from our own server-side renderer over a value we
            generated, never from user input, so injecting it as markup is safe.
            It is inline rather than an <img> so the secret is never a URL that
            could end up in a proxy log or browser history.
          */}
          <div
            className="w-44 rounded-control bg-white p-2"
            aria-label="QR code for your authenticator app"
            role="img"
            dangerouslySetInnerHTML={{ __html: enrolment.qrSvg }}
          />
        </div>

        <p className="text-sm text-ink-secondary">
          Open Google Authenticator, Microsoft Authenticator, 1Password or Aegis and scan the code.
          If you cannot scan, add an account manually with this key:
        </p>

        <code className="rounded-control border border-line-subtle bg-surface-inset px-3 py-2 text-center font-mono text-sm break-all text-ink-primary">
          {enrolment.secret}
        </code>
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-sm font-semibold text-ink-primary">
          Step 2 &mdash; save your backup codes
        </h4>

        <FormMessage tone="info">
          These are shown once and cannot be recovered. Save them somewhere separate from your phone
          &mdash; each one signs you in a single time if you lose your authenticator.
        </FormMessage>

        <ul className="grid grid-cols-2 gap-2 rounded-control border border-line-subtle bg-surface-inset p-3">
          {enrolment.backupCodes.map((code) => (
            <li key={code} className="font-mono text-sm tracking-wide text-ink-primary">
              {code}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h4 className="text-sm font-semibold text-ink-primary">Step 3 &mdash; confirm</h4>

        <form action={confirmAction} className="flex flex-col gap-5" noValidate>
          {confirmError ? <FormMessage>{confirmError}</FormMessage> : null}

          <TextField
            name="code"
            label="Code from your app"
            hint="Two-factor is not switched on until this code is accepted."
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={7}
            error={confirmFieldErrors?.code?.[0]}
            controlClassName="text-center text-lg tracking-[0.4em]"
          />

          <SubmitButton variant="primary" size="lg" pendingLabel="Confirming...">
            Turn on two-factor
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
