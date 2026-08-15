import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormMessage } from '@/components/ui/form-message';
import { SignInForm } from '@/features/auth/components/sign-in-form';
import { getSession, TWO_FACTOR_SETUP_PATH } from '@/lib/auth/session';
import { safeRedirect } from '@/lib/safe-redirect';

/** Reasons the app may have sent someone back here, and what to tell them. */
const REASONS: Record<string, string> = {
  disabled: 'That account has been deactivated. Ask an owner to restore it.',
  expired: 'Your session expired. Please sign in again.',
  signedOut: 'You have been signed out.',
  accountCreated: 'Your account is ready. Sign in to set up your authenticator app.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  // Already signed in: there is nothing to do here. Sent onwards rather than
  // shown a form that would confuse.
  const session = await getSession();
  if (session && !session.user.disabledAt) {
    redirect(session.user.twoFactorEnabled ? safeRedirect(next) : TWO_FACTOR_SETUP_PATH);
  }

  const notice = reason ? REASONS[reason] : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the email address your invitation was sent to. You will be asked for a code from
            your authenticator app next.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {notice ? <FormMessage tone="info">{notice}</FormMessage> : null}
        <SignInForm next={next} />
      </CardContent>
    </Card>
  );
}
