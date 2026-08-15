import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { InviteForm } from '@/features/team/components/invite-form';
import {
  AccessControl,
  RevokeInvitationControl,
  RoleControl,
} from '@/features/team/components/member-controls';
import {
  listMembers,
  listPendingInvitations,
  type PendingInvitation,
  type TeamMember,
} from '@/features/team/queries';
import { requirePermission } from '@/lib/auth/session';
import { outranks, roleLabels, roles, type Role } from '@/lib/auth/roles';
import { formatDate, formatDaysSince } from '@/lib/time';

export const metadata: Metadata = { title: 'Team' };

/**
 * Which roles this person may hand out.
 *
 * An owner may create another owner - otherwise the business would have a single
 * point of failure in the form of one person's phone. Everyone else may only grant
 * below themselves, which is what stops `users:manage` becoming self-promotion.
 */
function assignableRoles(actorRole: Role): readonly Role[] {
  if (actorRole === 'owner') return roles;
  return roles.filter((role) => outranks(actorRole, role));
}

export default async function TeamPage() {
  // The gate for the whole page. Only `owner` holds `users:manage`.
  const actor = await requirePermission('users', 'manage', '/admin/team');

  const [members, invitations] = await Promise.all([listMembers(), listPendingInvitations()]);

  const assignable = assignableRoles(actor.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Team"
        description="Accounts are created by invitation only. Every account needs an authenticator app before it can be used."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* `overflow-hidden` clips the table's inset header row to the card's
            rounded corners; without it the top two come out square. */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-1">
              <CardTitle>People</CardTitle>
              <CardDescription>
                {members.length === 1 ? '1 account' : `${members.length} accounts`}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <MemberTable members={members} actorId={actor.id} actorRole={actor.role} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle>Invite someone</CardTitle>
                <CardDescription>
                  Creates a single-use link, valid for seven days. Send it however you normally
                  message them.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent>
              <InviteForm assignableRoles={assignable} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle>Pending invitations</CardTitle>
                <CardDescription>
                  {invitations.length === 0
                    ? 'Nothing outstanding.'
                    : `${invitations.length} waiting to be accepted.`}
                </CardDescription>
              </div>
            </CardHeader>

            {invitations.length > 0 ? (
              <CardContent className="flex flex-col gap-4">
                {invitations.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} />
                ))}
              </CardContent>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MemberTable({
  members,
  actorId,
  actorRole,
}: {
  members: TeamMember[];
  actorId: string;
  actorRole: Role;
}) {
  const assignable = assignableRoles(actorRole);
  const ownerCount = members.filter(
    (member) => member.role === 'owner' && !member.disabledAt
  ).length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Everyone with an account, their role, and whether their account is active
        </caption>

        <thead className="bg-surface-inset">
          <tr className="border-b border-line-subtle text-left">
            <Th>Name</Th>
            <Th>Role</Th>
            <Th>Two-factor</Th>
            <Th>Last signed in</Th>
            <Th className="text-right">Access</Th>
          </tr>
        </thead>

        <tbody>
          {members.map((member) => {
            const isSelf = member.id === actorId;
            // The last owner standing keeps their role and their access, whoever asks.
            const isLastOwner = member.role === 'owner' && !member.disabledAt && ownerCount <= 1;
            const mayAct =
              !isLastOwner &&
              (outranks(actorRole, member.role) || (actorRole === 'owner' && !isSelf));

            return (
              <tr key={member.id} className="border-b border-line-subtle last:border-0">
                <Td>
                  <span className="block text-ink-primary">{member.name}</span>
                  <span className="block text-xs text-ink-secondary">{member.email}</span>
                  {isSelf ? (
                    <span className="mt-1 inline-block text-xs text-ink-secondary">
                      This is you
                    </span>
                  ) : null}
                </Td>

                <Td>
                  {mayAct ? (
                    <RoleControl
                      userId={member.id}
                      currentRole={member.role}
                      assignableRoles={assignable}
                    />
                  ) : (
                    <span className="text-ink-primary">{roleLabels[member.role]}</span>
                  )}
                </Td>

                <Td>
                  {member.twoFactorEnabled ? (
                    <Badge tone="success">Enrolled</Badge>
                  ) : (
                    <Badge tone="warning">Not set up</Badge>
                  )}
                </Td>

                <Td className="text-ink-secondary">
                  {member.lastSignInAt ? (
                    <>
                      <span className="block text-ink-primary">
                        {formatDate(member.lastSignInAt)}
                      </span>
                      <span className="text-xs">{formatDaysSince(member.lastSignInAt)}</span>
                    </>
                  ) : (
                    <span className="text-xs">Never</span>
                  )}
                </Td>

                <Td className="text-right">
                  {member.disabledAt ? (
                    <div className="flex flex-col items-end gap-2">
                      <Badge tone="error">Deactivated</Badge>
                      {mayAct ? (
                        <AccessControl userId={member.id} name={member.name} enabled={false} />
                      ) : null}
                    </div>
                  ) : mayAct ? (
                    <AccessControl userId={member.id} name={member.name} enabled />
                  ) : (
                    <span className="text-xs text-ink-secondary">
                      {isLastOwner ? 'Only owner' : 'Active'}
                    </span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-subtle pb-4 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-primary">{invitation.email}</p>
        <p className="text-xs text-ink-secondary">
          {roleLabels[invitation.role]} · expires {formatDate(invitation.expiresAt)}
          {invitation.invitedByLabel ? ` · invited by ${invitation.invitedByLabel}` : ''}
        </p>
      </div>

      <RevokeInvitationControl invitationId={invitation.id} email={invitation.email} />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-2.5 eyebrow text-xs text-ink-secondary ${className ?? ''}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className ?? ''}`}>{children}</td>;
}
