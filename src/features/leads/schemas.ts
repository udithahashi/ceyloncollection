/**
 * Validation for the lead form.
 *
 * This is the trust boundary. A Server Action is a public HTTP endpoint whatever the
 * UI looks like, so nothing below trusts that the request came from the form: every
 * id is checked as a uuid before it reaches a query, every string has a length limit,
 * and unknown keys are dropped rather than passed through.
 *
 * Safe on the client - Zod and the pure phone helper, nothing else. In particular no
 * `@/lib/time`, which reads the validated environment and belongs on the server.
 */
import { z } from 'zod';

import { InvalidPhoneNumberError, normalisePhone } from '@/lib/phone';

const uuid = z.string().uuid('That is not a valid choice.');

/** An optional reference: an empty picker submits an empty string, not nothing. */
const optionalUuid = z
  .union([uuid, z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

/** Optional free text, trimmed, with an empty string stored as null rather than ''. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `Keep ${label} under ${max} characters.`)
    .optional()
    .transform((value) => (value === undefined || value === '' ? null : value));

/** A checkbox: "on" when ticked, absent when clear. */
const flag = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((value) => value === 'on' || value === 'true' || value === true);

/**
 * The customer's number, normalised to E.164 here rather than in the action.
 *
 * Doing it in the schema means every caller - the form, the CSV import, the n8n
 * intake - gets the same identity for the same person, and the failure arrives as a
 * field error on the phone input rather than as a unique-constraint violation.
 */
const phone = z
  .string()
  .trim()
  .min(1, 'Enter a phone number.')
  .transform((value, ctx) => {
    try {
      return normalisePhone(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message:
          error instanceof InvalidPhoneNumberError ? error.message : 'Check the phone number.',
      });

      return z.NEVER;
    }
  });

/** A second WhatsApp number, when it differs from the contact number. */
const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === '') return null;

    try {
      return normalisePhone(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message:
          error instanceof InvalidPhoneNumberError ? error.message : 'Check the WhatsApp number.',
      });

      return z.NEVER;
    }
  });

/**
 * The contact date, as a calendar day in business time.
 *
 * A date and not a timestamp because that is all anyone knows: the WhatsApp message
 * said Tuesday, and inventing 14:23 to go with it would be fabrication. The action
 * turns this into an instant - see ./contact-date.
 */
const contactedOn = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date as YYYY-MM-DD.'), z.literal('')])
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

/**
 * Pieces wanted.
 *
 * Blank means they did not say, which is different from zero and must stay different:
 * a zero would be counted as a real quantity by every demand total.
 */
const quantity = z
  .union([z.literal(''), z.coerce.number().int('Enter a whole number.')])
  .optional()
  .superRefine((value, ctx) => {
    if (typeof value !== 'number') return;

    if (value < 1) {
      ctx.addIssue({ code: 'custom', message: 'Enter at least 1, or leave it blank.' });
    }

    // Not a database limit - a typing-mistake limit. Nobody in this business is
    // asking for ten thousand pieces, and "1000" with a stray zero would distort
    // every chart it appeared in.
    if (value > 5000) {
      ctx.addIssue({ code: 'custom', message: 'That looks like a typo. Enter 5000 or fewer.' });
    }
  })
  .transform((value) => (typeof value === 'number' ? value : null));

/**
 * Tag ids from a checkbox group.
 *
 * One ticked box arrives as a string and several as an array, so both shapes are
 * accepted and normalised. Duplicates are removed because the join table's primary
 * key would otherwise reject the whole insert.
 */
const tagIds = z
  .union([uuid, z.array(uuid), z.literal('')])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return [];
    const list = Array.isArray(value) ? value : [value];
    return [...new Set(list)];
  })
  .refine((value) => value.length <= 25, 'That is more than 25 tags. Choose the ones that matter.');

/** The fields shared by creating and editing a lead. */
const leadFields = {
  /* The customer. Matched on the phone number, created if new. */
  phone,
  customerName: optionalText(80, 'the name'),
  whatsappNumber: optionalPhone,
  onWhatsapp: flag,
  cityId: optionalUuid,

  /* The enquiry. */
  contactedOn,
  platformId: uuid,
  statusId: uuid,

  /* What they asked for. All optional: a first message rarely says. */
  categoryId: optionalUuid,
  subcategoryId: optionalUuid,
  clothGenderId: optionalUuid,
  fabricId: optionalUuid,
  sizeId: optionalUuid,
  urgencyId: optionalUuid,
  quantity,
  request: optionalText(500, 'the request'),
  notes: optionalText(2000, 'the notes'),
  tags: tagIds,
};

export const createLeadSchema = z.object(leadFields);

export const updateLeadSchema = z.object({ ...leadFields, id: uuid });

/**
 * Moving a lead to another status on its own.
 *
 * A separate, tiny schema because this is the action people will use twenty times a
 * day from the list, and it must not require every other field to be present.
 */
export const changeStatusSchema = z.object({
  id: uuid,
  statusId: uuid,
  note: optionalText(300, 'the note'),
});

export const leadRowSchema = z.object({ id: uuid });

export type CreateLeadInput = z.output<typeof createLeadSchema>;
export type UpdateLeadInput = z.output<typeof updateLeadSchema>;
