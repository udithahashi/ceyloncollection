/**
 * Activity log.
 *
 * One row for every action that changes data, plus the security events worth
 * knowing about even when they change nothing: sign-ins, failed sign-ins, role
 * changes. Append-only by convention - the permission model grants no role a
 * write on it, and nothing in the app updates or deletes a row.
 *
 * This is the record you will want when a lead's status is wrong and nobody
 * remembers touching it.
 */
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { appUser } from './auth';
import { primaryId, timestamps } from './columns';

/**
 * What happened, as `subject.verb`. Kept as a plain text column rather than a
 * Postgres enum so that adding an action later is a code change, not a migration
 * that locks the table.
 */
export const activityActions = [
  'auth.signIn',
  'auth.signInFailed',
  'auth.signOut',
  'auth.twoFactorEnabled',
  'auth.twoFactorFailed',
  'auth.passwordChanged',
  'user.invited',
  'user.inviteRevoked',
  'user.inviteAccepted',
  'user.roleChanged',
  'user.disabled',
  'user.enabled',
  'lead.created',
  'lead.updated',
  'lead.deleted',
  'lead.restored',
  'lead.imageAdded',
  'lead.imageRemoved',
  'customer.updated',
  'customer.merged',
  'taxonomy.created',
  'taxonomy.updated',
  'taxonomy.deleted',
  'taxonomy.reordered',
  // Retiring is not deleting: the value stays readable on every lead that used it,
  // it simply stops being offered. Worth its own action because it is the common
  // case and "deleted" in a log would misdescribe it.
  'taxonomy.retired',
  'taxonomy.restored',
  'import.completed',
  'intake.received',
  'intake.promoted',
  'intake.rejected',
  'settings.updated',
] as const;

export type ActivityAction = (typeof activityActions)[number];

export const activityLog = pgTable(
  'activity_log',
  {
    id: primaryId(),

    action: text('action').$type<ActivityAction>().notNull(),

    /**
     * Who did it. Null for an anonymous event, such as a failed sign-in against an
     * email that does not exist. `set null` on delete rather than cascade: losing
     * the actor is acceptable, losing the record of the action is not.
     */
    actorId: uuid('actor_id').references(() => appUser.id, { onDelete: 'set null' }),

    /**
     * The actor's name and email at the time, copied rather than joined. If an
     * account is later renamed or removed, the log still says who did it - which
     * is the entire point of a log.
     */
    actorLabel: text('actor_label'),

    /** What it was done to: `lead`, `customer`, `invitation`, and so on. */
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),

    /** Human-readable identity of the entity, for the same reason as `actorLabel`. */
    entityLabel: text('entity_label'),

    /**
     * Structured detail: changed fields, before and after values, the reason given.
     *
     * Never put a password, token, or full phone number in here. This column is
     * read by people and copied into support conversations.
     */
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    ...timestamps,
  },
  (table) => [
    // "What happened recently" - the default view, so it gets a descending index.
    index('activity_log_created_at_idx').on(table.createdAt.desc()),
    // "Everything that touched this lead."
    index('activity_log_entity_idx').on(table.entityType, table.entityId),
    // "Everything this person did."
    index('activity_log_actor_idx').on(table.actorId),
    index('activity_log_action_idx').on(table.action),
  ]
);

export type ActivityLogRow = typeof activityLog.$inferSelect;
export type NewActivityLog = typeof activityLog.$inferInsert;
