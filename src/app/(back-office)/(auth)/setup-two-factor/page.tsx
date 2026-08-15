import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoFactorSetup } from '@/features/auth/components/two-factor-setup';
import { getSession, LOGIN_PATH } from '@/lib/auth/session';

/**
 * Mandatory two-factor enrolment.
 *
 * Every account passes through here once. Two-factor is not optional: a password
 * alone protects the entire customer list, and passwords get reused.
 */
export default async function SetupTwoFactorPage() {
  const session = await getSession();

  if (!session) redirect(LOGIN_PATH);
  if (session.user.disabledAt) redirect(`${LOGIN_PATH}?reason=disabled`);

  // Already enrolled. Nothing to do here, and re-enrolling should be a deliberate
  // action from the account settings page rather than a URL anyone can revisit.
  if (session.user.twoFactorEnabled) redirect('/admin');

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>Set up two-step verification</CardTitle>
          <CardDescription>
            Required before you can use the system. It takes about a minute and means a stolen
            password on its own is not enough to sign in as you.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <TwoFactorSetup />
      </CardContent>
    </Card>
  );
}
