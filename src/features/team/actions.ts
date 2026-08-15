'use server';

/**
 * Team management Server Actions.
 *
 * Two rules run through all of them:
 *
 * - Nobody may grant a role they do not themselves outrank, and nobody may act on an
 *   account senior to their own. Without that, `users:manage` is really
 *   `become-owner`.
 * - The last enabled owner cannot be demoted or disabled, by anyone, including
 *   themselves. Locking every administrator out of the system is a mistake with no
 *   in-app recovery.
 *
 * Accepting an invitation is the one action here that runs unauthenticated, so it
 * rate limits on the token and validates everything it is given.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { db } from '@/db/client';
import { appUser } from '@/db/schema';
import { logActivity } from '@/lib/activity';
import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { authorize } from '@/lib/auth/session';
import { outranks, roleLabels, type Role } from '@/lib/auth/roles';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRateLimitKey } from '@/lib/request-context';
import { eq } from 'drizzle-orm';

import { EmailAlreadyRegisteredError } from '../auth/create-account';
import {
  acceptInvitation,
  createInvitation,
  InvitationExistsError,
  InvitationNotValidError,
  revokeInvitation,
} from './invitations';
import { countActiveOwners } from './queries';
import {
  acceptInvitationSchema,
  changeRoleSchema,
  inviteSchema,
  revokeInvitationSchema,
  setAccountEnabledSchema,
} from './schemas';

const log = createLogger('team-actions');

const TEAM_PATH = '/admin/team';

/** What the invite form shows after a successful invitation. */
export interface IssuedInvitation {
  email: string;
  role: Role;
  /**
   * The link to send, shown once.
   *
   * There is no outbound email in this application, so the owner copies the link and
   * sends it by whatever channel they already use. That is a feature at this size:
   * one fewer service to configure, one fewer place for a token to sit unencrypted.
   */
  url: string;
  expiresAt: string;
}

/** Invites someone. The role is fixed here, not chosen by the recipient. */
export async function inviteMemberAction(
  _previous: ActionResult<IssuedInvitation | undefined>,
  formData: FormData
): Promise<ActionResult<IssuedInvitation | undefined>> {
  return runAction('team.invite', async () => {
    const actor = await authorize('users', 'manage');

    const parsed = parseInput(inviteSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { email, role } = parsed.data;

    // An owner may invite another owner; nobody else may invite at their own level
    // or above, which is what would turn this endpoint into self-promotion.
    if (actor.role !== 'owner' && !outranks(actor.role, role)) {
      return fail(`You cannot invite someone as ${roleLabels[role]}.`, {
        code: 'forbidden',
        fieldErrors: { role: ['Choose a role below your own.'] },
      });
    }

    try {
      const invitation = await createInvitation({ email, role, invitedBy: actor.id });

      await logActivity({
        action: 'user.invited',
        actor,
        entityType: 'invitation',
        entityId: invitation.id,
        entityLabel: email,
        // The role is the interesting part. The token is deliberately absent: an
        // audit log is read by people and pasted into messages.
        metadata: { role },
      });

      revalidatePath(TEAM_PATH);

      return ok({
        email,
        role,
        url: invitation.url,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return fail('That email address already has an account.', {
          fieldErrors: { email: ['This person is already on the team.'] },
        });
      }
      if (error instanceof InvitationExistsError) {
        return fail('There is already an open invitation for that address.', {
          fieldErrors: { email: ['Withdraw the existing invitation first.'] },
        });
      }
      throw error;
    }
  });
}

/** Withdraws an invitation that has not been used. */
export async function revokeInvitationAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('team.revokeInvitation', async () => {
    const actor = await authorize('users', 'manage');

    const parsed = parseInput(revokeInvitationSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const revoked = await revokeInvitation(parsed.data.invitationId);
    if (!revoked) return fail('That invitation has already been used or withdrawn.');

    await logActivity({
      action: 'user.inviteRevoked',
      actor,
      entityType: 'invitation',
      entityId: parsed.data.invitationId,
      entityLabel: revoked.email,
    });

    revalidatePath(TEAM_PATH);

    return ok(undefined);
  });
}

/**
 * Creates an account from an invitation link.
 *
 * Unauthenticated by necessity: the whole point is that the person has no account
 * yet. The invitation token is the only credential, so it is rate limited by IP to
 * stop anyone working through guesses, and every failure returns the same message.
 */
export async function acceptInvitationAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('team.acceptInvitation', async () => {
    const limit = await checkRateLimit('signIn', await getRateLimitKey());
    if (!limit.allowed) {
      return fail('Too many attempts. Try again shortly.', { code: 'rateLimited' });
    }

    const parsed = parseInput(acceptInvitationSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { token, name, password } = parsed.data;

    try {
      const account = await acceptInvitation({ token, name, password });

      await logActivity({
        action: 'user.inviteAccepted',
        actor: { id: account.userId, name, email: account.email },
        entityType: 'appUser',
        entityId: account.userId,
        entityLabel: account.email,
        metadata: { role: account.role },
      });
    } catch (error) {
      if (error instanceof InvitationNotValidError) {
        return fail(error.message, { code: 'notFound' });
      }
      if (error instanceof EmailAlreadyRegisteredError) {
        return fail('That email address already has an account. Try signing in instead.');
      }
      throw error;
    }

    // Straight to the login page rather than signing them in: the first thing a new
    // account must do is enrol an authenticator, and that flow starts at sign-in.
    redirect('/login?reason=accountCreated');
  });
}

/** Changes someone's role. */
export async function changeRoleAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('team.changeRole', async () => {
    const actor = await authorize('users', 'manage');

    const parsed = parseInput(changeRoleSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { userId, role } = parsed.data;

    const [subject] = await db
      .select({
        id: appUser.id,
        name: appUser.name,
        email: appUser.email,
        role: appUser.role,
        disabledAt: appUser.disabledAt,
      })
      .from(appUser)
      .where(eq(appUser.id, userId));

    if (!subject) return fail('That account no longer exists.', { code: 'notFound' });

    const currentRole = subject.role as Role;
    if (currentRole === role) return ok(undefined);

    const refusal = await refuseIfProtected({
      actorRole: actor.role,
      actorId: actor.id,
      subjectId: subject.id,
      subjectRole: currentRole,
      targetRole: role,
      // Demoting the last owner is the same lockout as disabling them.
      losesOwner: currentRole === 'owner' && role !== 'owner' && !subject.disabledAt,
    });
    if (refusal) return refusal;

    await db.update(appUser).set({ role }).where(eq(appUser.id, userId));

    await logActivity({
      action: 'user.roleChanged',
      actor,
      entityType: 'appUser',
      entityId: subject.id,
      entityLabel: subject.email,
      metadata: { from: currentRole, to: role },
    });

    log.info({ actorId: actor.id, userId, from: currentRole, to: role }, 'role changed');

    revalidatePath(TEAM_PATH);

    return ok(undefined);
  });
}

/**
 * Disables or re-enables an account.
 *
 * Disabling also removes the account's sessions. Leaving them alive would mean a
 * dismissed member keeps working until their cookie expires.
 */
export async function setAccountEnabledAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('team.setAccountEnabled', async () => {
    const actor = await authorize('users', 'manage');

    const parsed = parseInput(setAccountEnabledSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { userId, enabled } = parsed.data;

    const [subject] = await db
      .select({
        id: appUser.id,
        email: appUser.email,
        role: appUser.role,
        disabledAt: appUser.disabledAt,
      })
      .from(appUser)
      .where(eq(appUser.id, userId));

    if (!subject) return fail('That account no longer exists.', { code: 'notFound' });

    const subjectRole = subject.role as Role;
    const alreadyInState = enabled === (subject.disabledAt === null);
    if (alreadyInState) return ok(undefined);

    const refusal = await refuseIfProtected({
      actorRole: actor.role,
      actorId: actor.id,
      subjectId: subject.id,
      subjectRole,
      losesOwner: !enabled && subjectRole === 'owner',
    });
    if (refusal) return refusal;

    await db
      .update(appUser)
      .set({ disabledAt: enabled ? null : new Date() })
      .where(eq(appUser.id, userId));

    if (!enabled) {
      // Best effort: the session guard already refuses a disabled account on the
      // next request, so a failure here narrows the window rather than opening one.
      const { auth } = await import('@/lib/auth');
      try {
        const context = await auth.$context;
        await context.internalAdapter.deleteSessions([userId]);
      } catch (error) {
        log.error({ err: error, userId }, 'failed to revoke sessions for disabled account');
      }
    }

    await logActivity({
      action: enabled ? 'user.enabled' : 'user.disabled',
      actor,
      entityType: 'appUser',
      entityId: subject.id,
      entityLabel: subject.email,
    });

    revalidatePath(TEAM_PATH);

    return ok(undefined);
  });
}

/**
 * The shared guards for acting on another account.
 *
 * Returns a failure to send back, or null to proceed. Kept in one place so the rules
 * cannot drift apart between changing a role and disabling an account.
 */
async function refuseIfProtected(input: {
  actorRole: Role;
  actorId: string;
  subjectId: string;
  subjectRole: Role;
  targetRole?: Role;
  losesOwner: boolean;
}): Promise<ActionResult<undefined> | null> {
  const { actorRole, actorId, subjectId, subjectRole, targetRole, losesOwner } = input;

  // Acting on a peer or a senior. An owner is allowed to act on another owner - with
  // the last-owner check below as the real safety net - because otherwise two owners
  // could never remove each other and a departed founder could not be removed at all.
  const sameLevel = subjectRole === actorRole;
  const mayAct = outranks(actorRole, subjectRole) || (actorRole === 'owner' && sameLevel);
  if (!mayAct) {
    return fail('You cannot change an account at or above your own level.', { code: 'forbidden' });
  }

  // Granting above your own level.
  if (targetRole && actorRole !== 'owner' && !outranks(actorRole, targetRole)) {
    return fail(`You cannot grant the ${roleLabels[targetRole]} role.`, { code: 'forbidden' });
  }

  if (losesOwner && (await countActiveOwners()) <= 1) {
    return fail(
      subjectId === actorId
        ? 'You are the only owner. Promote someone else to owner first.'
        : 'That is the only owner account. Promote someone else to owner first.'
    );
  }

  return null;
}
