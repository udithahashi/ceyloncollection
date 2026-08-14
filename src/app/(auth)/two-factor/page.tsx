import { redirect } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TwoFactorForm } from '@/features/auth/components/two-factor-form';
import { getSession } from '@/lib/auth/session';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * The two-factor challenge.
 *
 * Reached only after a correct password. At this point there is no session: the
 * two-factor plugin deleted the one the credential check created and left a
 * short-lived challenge cookie in its place, which the verify action reads.
 */
export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // A full session here means the challenge is already done - a back-button visit,
  // most likely. Send them on rather than asking for a code they do not need.
  const session = await getSession();
  if (session?.user.twoFactorEnabled) redirect(safeRedirect(next));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>Two-step verification</CardTitle>
          <CardDescription>
            Your password was accepted. Enter the code from your authenticator app to finish signing
            in.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <TwoFactorForm next={next} />
      </CardContent>
    </Card>
  );
}
