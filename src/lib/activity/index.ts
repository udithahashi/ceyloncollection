/**
 * Writing to the activity log.
 *
 * Call this from every Server Action that changes data. The log is the only thing
 * that can answer "who changed this and when", and a log with gaps in it is worse
 * than no log, because it invites false confidence.
 *
 * SERVER ONLY.
 */
import { db } from '@/db/client';
import { activityLog, type ActivityAction } from '@/db/schema';
import type { SessionUser } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';
import { getRequestContext } from '@/lib/request-context';

const log = createLogger('activity');

export interface LogActivityInput {
  action: ActivityAction;
  /**
   * Who did it. Omit only for events with no signed-in actor, such as a failed
   * sign-in against an address that does not exist.
   */
  actor?: Pick<SessionUser, 'id' | 'name' | 'email'> | null;
  entityType?: string;
  entityId?: string;
  /** How a human would name the thing, e.g. a customer name or a lead reference. */
  entityLabel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an event.
 *
 * Never throws. A failed audit write must not roll back the business change that
 * succeeded - losing one log line is bad, telling the user their lead was not
 * saved when it was is worse. The failure is logged at error level so it is
 * visible in the server log rather than silently swallowed.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const { ipAddress, userAgent } = await getRequestContext();

    await db.insert(activityLog).values({
      action: input.action,
      actorId: input.actor?.id ?? null,
      // Copied, not joined. If the account is later renamed or removed, the log
      // still says who did it, which is the whole point.
      actorLabel: input.actor ? `${input.actor.name} <${input.actor.email}>` : null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      entityLabel: input.entityLabel ?? null,
      metadata: input.metadata ?? null,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    log.error({ err: error, action: input.action }, 'failed to write activity log entry');
  }
}

/**
 * Describes a field change for the `metadata` column.
 *
 * Only the fields that actually differ are recorded, so reading the log tells you
 * what changed rather than making you diff two full records by eye.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  options: { redact?: readonly (keyof T)[] } = {}
): Record<string, { from: unknown; to: unknown }> {
  const redact = new Set(options.redact ?? []);
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [key, next] of Object.entries(after)) {
    const previous = before[key];
    if (Object.is(previous, next)) continue;

    changes[key] = redact.has(key)
      ? { from: '[redacted]', to: '[redacted]' }
      : { from: previous ?? null, to: next ?? null };
  }

  return changes;
}
