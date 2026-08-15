'use server';

/**
 * Taxonomy Server Actions.
 *
 * Every one of them starts with an authorisation check and ends with an
 * `activity_log` row, because these lists are the vocabulary every lead is
 * recorded in: a quiet rename changes the meaning of past data, and someone will
 * eventually need to know who did it.
 *
 * Three rules that are not obvious from the UI:
 *
 * - **The slug never changes.** Renaming "Lost/Cancelled" to "Closed" updates the
 *   label everywhere and leaves `lost-cancelled` alone, because the n8n intake and
 *   the CSV importer resolve incoming text through the slug. A slug that moves
 *   breaks integrations silently, months later.
 * - **Retiring is not deleting.** `isActive` false removes a value from the
 *   pickers and leaves it readable on every lead that already uses it. Deleting is
 *   for a value created by mistake, needs `taxonomy:delete`, and is refused if
 *   anything points at the row.
 * - **A category with sub-categories cannot be deleted.** The sub-categories would
 *   be orphaned, and the database would refuse it anyway; better to say so.
 */
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import { subcategories, taxonomyTables, type TaxonomyKey } from '@/db/schema/taxonomy';
import { logActivity } from '@/lib/activity';
import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { authorize } from '@/lib/auth/session';
import { uniqueSlug } from '@/lib/slug';
import { and, asc, eq, gt, isNull, lt, ne, sql, type SQL } from 'drizzle-orm';

import { countChildren, existingSlugs } from './queries';
import {
  taxonomyActiveSchema,
  taxonomyEditSchema,
  taxonomyKeySchema,
  taxonomyMoveSchema,
  taxonomyRowSchema,
  taxonomyValueSchema,
} from './schemas';

const basePath = (key: TaxonomyKey) => `/admin/taxonomy/${key}`;

/** Reads the taxonomy out of the form before the rest can be validated against it. */
function readKey(formData: FormData): TaxonomyKey | null {
  const parsed = taxonomyKeySchema.safeParse(formData.get('key'));
  return parsed.success ? parsed.data : null;
}

/**
 * The position after the last row, in steps of ten.
 *
 * Sub-categories are ordered inside their category, so the last row is the last
 * one of that parent rather than of the table.
 */
async function nextSortOrder(key: TaxonomyKey, categoryId?: string): Promise<number> {
  const table = taxonomyTables[key];

  const [row] = await db
    .select({ highest: sql<number | null>`max(${table.sortOrder})` })
    .from(table)
    .where(
      key === 'subcategories' && categoryId !== undefined
        ? eq(subcategories.categoryId, categoryId)
        : undefined
    );

  return (row?.highest ?? 0) + 10;
}

/** Adds a value. The slug is derived here, once, and then never touched again. */
export async function createTaxonomyValueAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('taxonomy.create', async () => {
    await authorize('taxonomy', 'create');

    const key = readKey(formData);
    if (key === null) return fail('That list does not exist.', { code: 'validation' });

    const parsed = parseInput(taxonomyValueSchema(key), formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { name, description, isActive, ...extras } = parsed.data;
    const categoryId = 'categoryId' in extras ? String(extras.categoryId) : undefined;

    // Uniqueness is enforced by an index; this only picks a slug that will pass it,
    // so a second "Cotton" becomes `cotton-2` rather than an error the user cannot act on.
    const slug = uniqueSlug(name, await existingSlugs(key, categoryId));

    // New values go to the end of the list. Nobody wants to type a sort number, and
    // the end is the only position that is right without being told.
    const sortOrder = await nextSortOrder(key, categoryId);

    const [created] = await db
      .insert(taxonomyTables[key])
      .values({ name, description, sortOrder, isActive, slug, ...extras } as never)
      .returning({ id: taxonomyTables[key].id, name: taxonomyTables[key].name });

    if (!created) return fail('The value could not be added.', { code: 'unexpected' });

    await logActivity({
      action: 'taxonomy.created',
      entityType: key,
      entityId: created.id,
      entityLabel: created.name,
      metadata: { slug, sortOrder, isActive, ...extras },
    });

    revalidatePath(basePath(key));
    return ok(undefined);
  });
}

/** What a successful edit returns, so the form knows to close itself. */
export interface SavedValue {
  id: string;
  name: string;
}

/**
 * Edits a value.
 *
 * Renaming is allowed and expected; the slug is deliberately left as it was. If
 * the name is so wrong that the slug is wrong too, the value was created by
 * mistake and should be deleted rather than renamed.
 */
export async function updateTaxonomyValueAction(
  _previous: ActionResult<SavedValue | undefined>,
  formData: FormData
): Promise<ActionResult<SavedValue | undefined>> {
  return runAction('taxonomy.update', async () => {
    await authorize('taxonomy', 'update');

    const key = readKey(formData);
    if (key === null) return fail('That list does not exist.', { code: 'validation' });

    const parsed = parseInput(taxonomyEditSchema(key), formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const table = taxonomyTables[key];
    const { id, name, description, isActive, ...extras } = parsed.data;

    const [before] = await db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!before) return fail('That value no longer exists.', { code: 'notFound' });

    // The extras are shaped by the taxonomy, so they are only known by name here.
    const extraValues = extras as Record<string, unknown>;

    // A status that both closes the lead and counts as a sale is the normal case
    // (Delivered); a status that counts as a sale without closing is not, and would
    // make the conversion figures disagree with the funnel.
    if (key === 'lead-statuses' && extraValues.isWon === true && extraValues.isTerminal !== true) {
      return fail('A status that counts as a sale must also close the lead.', {
        code: 'validation',
        fieldErrors: { isTerminal: ['Tick this as well, or untick "counts as a sale".'] },
      });
    }

    const [updated] = await db
      .update(table)
      .set({ name, description, isActive, ...extras, updatedAt: sql`now()` } as never)
      .where(eq(table.id, id))
      .returning({ id: table.id, name: table.name });

    if (!updated) return fail('That value no longer exists.', { code: 'notFound' });

    await logActivity({
      action: 'taxonomy.updated',
      entityType: key,
      entityId: id,
      entityLabel: name,
      metadata: {
        from: { name: before.name, isActive: before.isActive },
        to: { name, isActive, ...extras },
      },
    });

    revalidatePath(basePath(key));
    return ok({ id, name });
  });
}

/**
 * Retires a value, or brings it back.
 *
 * The common case by far, and the reason `isActive` exists: "Imo" stops being
 * offered without erasing the leads that arrived through it.
 */
export async function setTaxonomyActiveAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('taxonomy.setActive', async () => {
    await authorize('taxonomy', 'update');

    const parsed = parseInput(taxonomyActiveSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { key, id, isActive } = parsed.data;
    const table = taxonomyTables[key];

    const [updated] = await db
      .update(table)
      .set({ isActive, updatedAt: sql`now()` })
      .where(and(eq(table.id, id), isNull(table.deletedAt)))
      .returning({ name: table.name });

    if (!updated) return fail('That value no longer exists.', { code: 'notFound' });

    await logActivity({
      action: isActive ? 'taxonomy.restored' : 'taxonomy.retired',
      entityType: key,
      entityId: id,
      entityLabel: updated.name,
    });

    revalidatePath(basePath(key));
    return ok(undefined);
  });
}

/**
 * Soft-deletes a value created by mistake.
 *
 * Refused while anything references the row. Right now that means a category with
 * sub-categories; once leads exist, the same check will cover them, which is why
 * the reason is returned as a sentence rather than a boolean.
 */
export async function deleteTaxonomyValueAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('taxonomy.delete', async () => {
    await authorize('taxonomy', 'delete');

    const parsed = parseInput(taxonomyRowSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { key, id } = parsed.data;
    const table = taxonomyTables[key];

    if (key === 'categories') {
      const children = await countChildren(id);
      if (children > 0) {
        return fail(
          `This category still holds ${children} sub-categor${children === 1 ? 'y' : 'ies'}. ` +
            'Move or remove those first, or retire the category instead.',
          { code: 'conflict' }
        );
      }
    }

    const [deleted] = await db
      .update(table)
      .set({ deletedAt: sql`now()`, isActive: false, updatedAt: sql`now()` })
      .where(and(eq(table.id, id), isNull(table.deletedAt)))
      .returning({ name: table.name });

    if (!deleted) return fail('That value no longer exists.', { code: 'notFound' });

    await logActivity({
      action: 'taxonomy.deleted',
      entityType: key,
      entityId: id,
      entityLabel: deleted.name,
    });

    revalidatePath(basePath(key));
    return ok(undefined);
  });
}

/**
 * Swaps a row with its neighbour.
 *
 * Order matters here in a way it rarely does elsewhere: the status list is the
 * funnel, and a picker that lists "Delivered" above "Contacted" invites mistakes.
 * Two rows exchange `sortOrder` in one transaction so a failure halfway cannot
 * leave both rows on the same number.
 */
export async function moveTaxonomyValueAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('taxonomy.move', async () => {
    await authorize('taxonomy', 'update');

    const parsed = parseInput(taxonomyMoveSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { key, id, direction } = parsed.data;
    const table = taxonomyTables[key];
    const up = direction === 'up';

    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: table.id, sortOrder: table.sortOrder, name: table.name })
        .from(table)
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .limit(1);

      if (!row) return;

      // Sub-categories are ordered within their category, so the neighbour has to
      // come from the same parent rather than being the next row overall.
      let sameGroup: SQL | undefined;

      if (key === 'subcategories') {
        const [child] = await tx
          .select({ categoryId: subcategories.categoryId })
          .from(subcategories)
          .where(eq(subcategories.id, id))
          .limit(1);

        if (!child) return;
        sameGroup = eq(subcategories.categoryId, child.categoryId);
      }

      const [neighbour] = await tx
        .select({ id: table.id, sortOrder: table.sortOrder })
        .from(table)
        .where(
          and(
            isNull(table.deletedAt),
            ne(table.id, id),
            up ? lt(table.sortOrder, row.sortOrder) : gt(table.sortOrder, row.sortOrder),
            sameGroup
          )
        )
        .orderBy(up ? sql`${table.sortOrder} desc` : asc(table.sortOrder))
        .limit(1);

      // Already at the end of the list. Not an error - the button simply does nothing.
      if (!neighbour) return;

      await tx.update(table).set({ sortOrder: neighbour.sortOrder }).where(eq(table.id, row.id));
      await tx.update(table).set({ sortOrder: row.sortOrder }).where(eq(table.id, neighbour.id));

      await logActivity({
        action: 'taxonomy.reordered',
        entityType: key,
        entityId: id,
        entityLabel: row.name,
        metadata: { direction, from: row.sortOrder, to: neighbour.sortOrder },
      });
    });

    revalidatePath(basePath(key));
    return ok(undefined);
  });
}
