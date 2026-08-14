/**
 * Validation for automated intake.
 *
 * Two boundaries, two schemas. `intakePayloadSchema` is what n8n's HTTP request has to
 * satisfy - deliberately thin, because nobody has built taxonomy extraction from a raw
 * message yet, so there is nothing structured to validate beyond who sent it and what
 * they said. `promoteIntakeSchema` is what the review form submits, which is the
 * ordinary lead schema plus the id of the staged row it came from - one definition of a
 * valid lead, not a second one that has to be kept in step with the first.
 *
 * Safe on the client: Zod only, same as ../schemas.
 */
import { z } from 'zod';

import { createLeadSchema } from '../schemas';

const uuid = z.string().uuid();

export const intakePayloadSchema = z.object({
  /** n8n's id for the message, so a retried delivery lands on the same staged row. */
  externalId: z.string().trim().min(1).max(200).optional(),
  /** Free text - "whatsapp", "instagram-dm" - matched against the platforms taxonomy
   * at review time, never trusted as an id here. */
  platform: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(1).max(40).optional(),
  name: z.string().trim().min(1).max(80).optional(),
  message: z.string().trim().min(1, 'A message is required.').max(2000),
  /** When the message itself arrived, if different from now - a replay or a backfill. */
  receivedAt: z.string().datetime().optional(),
});

export type IntakePayload = z.output<typeof intakePayloadSchema>;

export const promoteIntakeSchema = createLeadSchema.extend({ intakeId: uuid });

export const rejectIntakeSchema = z.object({
  intakeId: uuid,
  reason: z
    .string()
    .trim()
    .min(1, 'Say why, so the next person reviewing the queue knows not to repeat it.')
    .max(300),
});
