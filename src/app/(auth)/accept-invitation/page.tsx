import type { Metadata } from 'next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormMessage } from '@/components/ui/form-message';
import { AcceptInvitationForm } from '@/features/team/components/accept-invitation-form';
import { findLiveInvitation } from '@/features/team/invitations';
import { roleDescriptions, roleLabels, type Role } from '@/lib/auth/roles';

export const metadata: Metadata = {
  title: 'Accept invitation',
  // Belt and braces alongside the `noindex` header: this URL contains a token.
  robots: { index: false, follow: false },
};

/**
 * Where an invitation link lands.
 *
 * The token is validated here, before the form is rendered, so an expired or spent
 * link never shows a form that cannot succeed. A missing, revoked, used and
 * fabricated token all produce the same message, because distinguishing them would
 * turn this page into a way to enumerate invitations.
 */
export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invitation = await findLiveInvitation(token ?? '');

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1.5">
            <CardTitle>This link is not usable</CardTitle>
            <CardDescription>
              Invitations expire after seven days and work only once.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <FormMessage>
            That invitation link is not valid, has expired, or has already been used.
          </FormMessage>
          <p className="text-sm text-ink-secondary">
            Ask whoever invited you to send a new link. If you already have an account,{' '}
            <a href="/login" className="text-action-ink underline underline-offset-4">
              sign in instead
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const role = invitation.role as Role;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1.5">
          <CardTitle>Set up your account</CardTitle>
          <CardDescription>
            You have been invited as <strong className="font-medium">{roleLabels[role]}</strong>.{' '}
            {roleDescriptions[role]}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <AcceptInvitationForm token={token ?? ''} email={invitation.email} />
      </CardContent>
    </Card>
  );
}
