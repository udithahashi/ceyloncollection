/**
 * Invitations: the only route to an account.
 *
 * There is no sign-up form. An owner creates an invitation, sends the link out of
 * band, and the recipient sets their own password. Three properties matter, and each
 * one is enforced here rather than in the calling action:
 *
 * 1. The token is only ever stored as a SHA-256 hash. A leaked backup of this table
 *    does not let anyone create an account.
 * 2. An invitation is single-use. Acceptance claims the row with a conditional
 *    update, so two people following the same link at the same moment cannot both
 *    get an account.
 * 3. The role comes from the invitation, never from the form the invitee fills in.
 *
 * SERVER ONLY.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { and, eq, isNull, sql as raw } from 'drizzle-orm';

import { db } from '@/db/client';
import { appUser, invitation, type Invitation } from '@/db/schema';
import type { Role } from '@/lib/auth/roles';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

import { createAccount, EmailAlreadyRegisteredError } from '../auth/create-account';

const log = createLogger('invitations');

/**
 * How long a link stays usable.
 *
 * Long enough to survive a weekend and a missed message; short enough that a link
 * forwarded to the wrong person, or sitting in an old chat, stops working.
 */
const INVITATION_TTL_DAYS = 7;

/** 32 bytes, so guessing is not a strategy. */
const TOKEN_BYTES = 32;

export class InvitationNotValidError extends Error {
  constructor() {
    super('That invitation link is not valid, has expired, or has already been used.');
    this.name = 'InvitationNotValidError';
  }
}

export class InvitationExistsError extends Error {
  constructor(readonly email: string) {
    super('There is already an open invitation for that email address.');
    this.name = 'InvitationExistsError';
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compares two hex digests without leaking where they first differ.
 *
 * The lookup is by hash and hits a unique index, so this is belt and braces rather
 * than the main defence - but a timing signal on a token comparison is exactly the
 * kind of thing that is free to prevent and expensive to discover later.
 */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export interface CreateInvitationInput {
  email: string;
  role: Role;
  invitedBy: string;
}

export interface CreatedInvitation {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  /**
   * The plaintext token, returned exactly once. It is not stored and cannot be
   * recovered: if the link is lost, the invitation is revoked and reissued.
   */
  token: string;
  /** The full link to send. */
  url: string;
}

/**
 * Issues an invitation.
 *
 * @throws EmailAlreadyRegisteredError if the address already has an account
 * @throws InvitationExistsError if an unexpired, unused invitation is outstanding
 */
export async function createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
  const email = input.email.trim().toLowerCase();

  const [existingAccount] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(raw`lower(${appUser.email})`, email));

  if (existingAccount) throw new EmailAlreadyRegisteredError(email);

  const [outstanding] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.email, email),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        raw`${invitation.expiresAt} > now()`
      )
    );

  if (outstanding) throw new InvitationExistsError(email);

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(invitation)
    .values({
      email,
      role: input.role,
      tokenHash: hashToken(token),
      expiresAt: expiresAt.toISOString(),
      invitedBy: input.invitedBy,
    })
    .returning({ id: invitation.id, expiresAt: invitation.expiresAt });

  if (!row) throw new Error('failed to create invitation');

  log.info({ invitationId: row.id, role: input.role }, 'invitation created');

  return {
    id: row.id,
    email,
    role: input.role,
    expiresAt: row.expiresAt,
    token,
    url: invitationUrl(token),
  };
}

/** The link to send. Built from APP_URL so it is right in every environment. */
export function invitationUrl(token: string): string {
  const url = new URL('/accept-invitation', env.APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Looks up a live invitation by its plaintext token.
 *
 * "Live" means not accepted, not revoked, and not expired. Returns null for all
 * three, and for a token that never existed, so the page cannot be used to tell
 * a revoked invitation from a fabricated one.
 */
export async function findLiveInvitation(token: string): Promise<Invitation | null> {
  if (!token) return null;

  const digest = hashToken(token);

  const [row] = await db.select().from(invitation).where(eq(invitation.tokenHash, digest));

  if (!row) return null;
  if (!digestsMatch(row.tokenHash, digest)) return null;
  if (row.acceptedAt || row.revokedAt) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;

  return row;
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  password: string;
}

/**
 * Accepts an invitation and creates the account.
 *
 * The invitation is claimed before the account is created, with an update whose
 * WHERE clause requires it to still be unused. Two simultaneous submissions of the
 * same link therefore produce one account and one error, rather than two accounts or
 * a duplicate-email crash. If account creation then fails, the claim is released so
 * the invitee can try again.
 *
 * @throws InvitationNotValidError if the link is not usable
 * @throws EmailAlreadyRegisteredError if the address was claimed in the meantime
 */
export async function acceptInvitation(
  input: AcceptInvitationInput
): Promise<{ userId: string; email: string; role: Role }> {
  const live = await findLiveInvitation(input.token);
  if (!live) throw new InvitationNotValidError();

  const [claimed] = await db
    .update(invitation)
    .set({ acceptedAt: new Date().toISOString() })
    .where(
      and(
        eq(invitation.id, live.id),
        isNull(invitation.acceptedAt),
        isNull(invitation.revokedAt),
        raw`${invitation.expiresAt} > now()`
      )
    )
    .returning({ id: invitation.id, email: invitation.email, role: invitation.role });

  if (!claimed) throw new InvitationNotValidError();

  try {
    const account = await createAccount({
      name: input.name,
      email: claimed.email,
      password: input.password,
      // From the invitation, not from anything the invitee submitted. This is the
      // line that stops a recipient promoting themselves to owner.
      role: claimed.role,
    });

    await db
      .update(invitation)
      .set({ acceptedUserId: account.id })
      .where(eq(invitation.id, claimed.id));

    log.info({ invitationId: claimed.id, userId: account.id }, 'invitation accepted');

    return { userId: account.id, email: claimed.email, role: claimed.role };
  } catch (error) {
    await db.update(invitation).set({ acceptedAt: null }).where(eq(invitation.id, claimed.id));

    log.warn({ err: error, invitationId: claimed.id }, 'invitation claim released');
    throw error;
  }
}

/** Withdraws an unused invitation. Returns null if there was nothing to withdraw. */
export async function revokeInvitation(id: string): Promise<{ email: string } | null> {
  const [row] = await db
    .update(invitation)
    .set({ revokedAt: new Date().toISOString() })
    .where(and(eq(invitation.id, id), isNull(invitation.acceptedAt), isNull(invitation.revokedAt)))
    .returning({ email: invitation.email });

  return row ?? null;
}
