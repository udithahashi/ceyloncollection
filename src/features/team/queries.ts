/**
 * Reads for the Team page.
 *
 * Server Components call these directly. There is no HTTP layer in between, which
 * is the point: the page's own authorisation check is the only gate that has to hold.
 *
 * SERVER ONLY.
 */
import { and, asc, desc, eq, isNull, sql as raw } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '@/db/client';
import { appUser, invitation } from '@/db/schema';
import type { Role } from '@/lib/auth/roles';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  disabledAt: Date | null;
  createdAt: Date;
  lastSignInAt: Date | null;
}

/** Everyone with an account, most privileged first. */
export async function listMembers(): Promise<TeamMember[]> {
  const rows = await db
    .select({
      id: appUser.id,
      name: appUser.name,
      email: appUser.email,
      role: appUser.role,
      twoFactorEnabled: appUser.twoFactorEnabled,
      disabledAt: appUser.disabledAt,
      createdAt: appUser.createdAt,
      // The most recent sign-in, taken from the activity log rather than kept as a
      // column on the user: one fewer write on the hot sign-in path, and the log is
      // the record of truth for it anyway.
      lastSignInAt: raw<Date | null>`(
        select max(al.created_at)
        from activity_log al
        where al.actor_id = ${appUser.id} and al.action = 'auth.signIn'
      )`,
    })
    .from(appUser)
    .orderBy(
      // owner, manager, staff, viewer - the order the roles are declared in, spelled
      // out here because alphabetical would be meaningless to read.
      raw`case ${appUser.role}
            when 'owner' then 0
            when 'manager' then 1
            when 'staff' then 2
            else 3
          end`,
      asc(appUser.createdAt)
    );

  return rows.map((row) => ({
    ...row,
    role: row.role as Role,
    // The column is nullable because Better Auth's schema makes it so; an absent
    // value means "not enrolled".
    twoFactorEnabled: row.twoFactorEnabled ?? false,
  }));
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  createdAt: Date;
  invitedByLabel: string | null;
}

/** Invitations that could still be accepted right now. */
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const inviter = alias(appUser, 'inviter');

  const rows = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      invitedByLabel: inviter.name,
    })
    .from(invitation)
    .leftJoin(inviter, eq(inviter.id, invitation.invitedBy))
    .where(
      and(
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        raw`${invitation.expiresAt} > now()`
      )
    )
    .orderBy(desc(invitation.createdAt));

  return rows.map((row) => ({
    ...row,
    role: row.role as Role,
    expiresAt: new Date(row.expiresAt),
    createdAt: new Date(row.createdAt),
  }));
}

/** How many owners are enabled. Used to refuse removing the last one. */
export async function countActiveOwners(): Promise<number> {
  const [row] = await db
    .select({ count: raw<number>`count(*)::int` })
    .from(appUser)
    .where(and(eq(appUser.role, 'owner'), isNull(appUser.disabledAt)));

  return row?.count ?? 0;
}
