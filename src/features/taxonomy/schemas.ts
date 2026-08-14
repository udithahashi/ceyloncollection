/**
 * Validation for the taxonomy forms.
 *
 * Built from the registry rather than written ten times, so adding a taxonomy
 * cannot leave a field unvalidated. Every one of these is the trust boundary of a
 * Server Action, which is a public HTTP endpoint whatever the UI looks like.
 *
 * Safe on the client: Zod only.
 */
import { z } from 'zod';

import { isTaxonomyKey, sizeGroups, tagGroups, type TaxonomyKey } from '@/db/schema/taxonomy';
import { badgeTones } from '@/lib/theme/tones';

import { taxonomies } from './registry';

/**
 * A checkbox arrives as "on" when ticked and not at all when clear, so the field
 * has to be optional as well as coerced - an unticked box is a missing key, not a
 * false one.
 */
const flag = z
  .union([z.literal('on'), z.literal('true'), z.literal('false'), z.boolean()])
  .optional()
  .transform((value) => value === 'on' || value === 'true' || value === true);

const name = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(80, 'Keep the name under 80 characters - it has to fit in a dropdown.');

const description = z
  .string()
  .trim()
  .max(300, 'Keep the note under 300 characters.')
  .optional()
  .transform((value) => (value === undefined || value === '' ? null : value));

const uuid = z.string().uuid('That is not a valid reference.');

/** The URL segment, validated because it decides which table gets written to. */
export const taxonomyKeySchema = z.string().refine(isTaxonomyKey, 'Unknown taxonomy.') as z.ZodType<
  TaxonomyKey,
  string
>;

const tone = z.enum(badgeTones);
const sizeGroup = z.enum(sizeGroups);
const tagGroup = z.enum(tagGroups);

/**
 * The fields every taxonomy row has.
 *
 * `sortOrder` is deliberately absent. Position is changed by the move buttons,
 * which swap two rows in a transaction; if it were also a form field, saving an
 * edit with the field missing would silently reset the row to the top of the list.
 */
const sharedFields = {
  key: taxonomyKeySchema,
  name,
  description,
  isActive: flag,
};

/**
 * The schema for creating or editing a row of one taxonomy.
 *
 * The extras are added per taxonomy, so a `tone` sent to `fabrics` is stripped
 * rather than written, and a missing `categoryId` on a sub-category is a
 * validation error rather than a constraint violation.
 */
export function taxonomyValueSchema(key: TaxonomyKey) {
  const extras: Record<string, z.ZodTypeAny> = {};

  for (const extra of taxonomies[key].extras) {
    switch (extra.kind) {
      case 'flag':
        extras[extra.column] = flag;
        break;
      case 'tone':
        extras[extra.column] = tone;
        break;
      case 'choice':
        extras[extra.column] = extra.column === 'sizeGroup' ? sizeGroup : tagGroup;
        break;
      case 'parent':
        extras[extra.column] = uuid;
        break;
    }
  }

  return z.object({ ...sharedFields, ...extras });
}

/** Editing needs to know which row. */
export function taxonomyEditSchema(key: TaxonomyKey) {
  return taxonomyValueSchema(key).extend({ id: uuid });
}

/** Archiving, restoring and deleting need only the row and the taxonomy. */
export const taxonomyRowSchema = z.object({
  key: taxonomyKeySchema,
  id: uuid,
});

/** Retiring a value, or bringing it back. */
export const taxonomyActiveSchema = taxonomyRowSchema.extend({ isActive: flag });

/** Moving a row up or down the list. */
export const taxonomyMoveSchema = taxonomyRowSchema.extend({
  direction: z.enum(['up', 'down']),
});

export type TaxonomyValueInput = z.output<ReturnType<typeof taxonomyValueSchema>>;
