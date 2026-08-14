/**
 * Invitations.
 *
 * The only route to an account. An owner creates a row here, sends the link, and
 * the recipient sets a password. There is no public sign-up form to harden,
 * because there is no public sign-up form.
 */
import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { appUser, roleCheck, roleColumn } from './auth';
import { instant, primaryId, timestamps } from './columns';

export const invitation = pgTable(
  'invitation',
  {
    id: primaryId(),

    email: text('email').notNull(),

    /** The role the account will be created with. Chosen by the inviter, not the invitee. */
    role: roleColumn('role').notNull(),

    /**
     * SHA-256 of the token, never the token itself.
     *
     * The plaintext token exists only in the invitation link. Storing the hash
     * means a copy of this table - a leaked backup, a screenshot of a query - does
     * not let anyone create an account.
     */
    tokenHash: text('token_hash').notNull(),

    expiresAt: instant('expires_at').notNull(),

    /** Set when the invitation is used. A second use is refused. */
    acceptedAt: instant('accepted_at'),

    /** Set when an owner withdraws an invitation before it is used. */
    revokedAt: instant('revoked_at'),

    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => appUser.id, { onDelete: 'restrict' }),

    /** The account created by accepting this invitation, for the audit trail. */
    acceptedUserId: uuid('accepted_user_id').references(() => appUser.id, {
      onDelete: 'set null',
    }),

    ...timestamps,
  },
  (table) => [
    roleCheck('invitation', 'role'),
    // The lookup path when someone follows a link, so it must be fast and unique.
    uniqueIndex('invitation_token_hash_key').on(table.tokenHash),
    index('invitation_email_idx').on(table.email),
    index('invitation_expires_at_idx').on(table.expiresAt),
  ]
);

export type Invitation = typeof invitation.$inferSelect;
export type NewInvitation = typeof invitation.$inferInsert;
