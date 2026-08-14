'use server';

/**
 * Adding and removing a lead's reference photos.
 *
 * TWO WRITES THAT HAVE TO AGREE
 * Every upload touches two stores - bytes on disk, a row in Postgres - and there is no
 * transaction spanning both. So the order is chosen for which failure is survivable:
 * the file is written first and the row second. A file with no row is invisible and
 * costs some disk; a row with no file is a broken image on the page, and the page
 * cannot tell why. Deletion is the same argument reversed: the row goes first, and the
 * bytes are unlinked afterwards.
 *
 * ONE FILE AT A TIME, INDEPENDENTLY JUDGED
 * Selecting five photos and having the whole upload refused because one of them is a
 * PDF is the behaviour of a system that has not thought about people. Each file is
 * handled on its own and the result says exactly which ones were refused and why.
 */
import { revalidatePath } from 'next/cache';

import { db } from '@/db/client';
import { leadImages } from '@/db/schema/lead-images';
import { leads } from '@/db/schema/leads';
import { parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { logActivity } from '@/lib/activity';
import { can } from '@/lib/auth/roles';
import { authorize } from '@/lib/auth/session';
import {
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_TOTAL_BYTES,
  megabytes,
} from '@/lib/images/limits';
import { ImageRejected, prepareImage } from '@/lib/images/prepare';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { leadImageKey, removeQuietly, storage } from '@/lib/storage';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { nextSortOrder } from './queries';

const log = createLogger('lead-images');

const leadIdSchema = z.object({
  leadId: z.string().uuid('That is not a lead.'),
});

const imageIdSchema = z.object({
  imageId: z.string().uuid('That is not an image.'),
});

export interface UploadOutcome {
  added: number;
  /** One line per refused file, naming the file, ready to show as-is. */
  refused: string[];
}

/** Adds photos to a lead. */
export async function uploadLeadImagesAction(
  _previous: ActionResult<UploadOutcome | undefined>,
  formData: FormData
): Promise<ActionResult<UploadOutcome | undefined>> {
  return runAction('lead.images.upload', async () => {
    const user = await authorize('leads', 'update');

    const parsed = parseInput(leadIdSchema, { leadId: formData.get('leadId') });
    if (!parsed.ok) return parsed.result;

    const files = formData
      .getAll('files')
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length === 0) {
      return fail('Choose a photo first.', { code: 'validation' });
    }

    if (files.length > MAX_FILES_PER_UPLOAD) {
      return fail(`Up to ${MAX_FILES_PER_UPLOAD} photos at a time, please.`, {
        code: 'validation',
      });
    }

    const total = files.reduce((sum, file) => sum + file.size, 0);

    if (total > MAX_UPLOAD_TOTAL_BYTES) {
      return fail(
        `Those add up to ${megabytes(total)}. Send up to ${megabytes(MAX_UPLOAD_TOTAL_BYTES)} at a time.`,
        { code: 'validation' }
      );
    }

    // Per user rather than per IP: this is a signed-in action, and what is being
    // rationed is the re-encoding work, which belongs to whoever asked for it.
    const decision = await checkRateLimit('upload', user.id);
    if (!decision.allowed) {
      return fail('That is a lot of uploads at once. Give it a few minutes.', {
        code: 'rateLimited',
      });
    }

    const lead = await liveLead(parsed.data.leadId);
    if (lead === null) return fail('That lead no longer exists.', { code: 'validation' });

    let sortOrder = await nextSortOrder(lead.id);
    const refused: string[] = [];
    let added = 0;

    for (const file of files) {
      const name = displayName(file.name);

      if (file.size > MAX_UPLOAD_BYTES) {
        refused.push(`${name}: larger than ${megabytes(MAX_UPLOAD_BYTES)}.`);
        continue;
      }

      try {
        const prepared = await prepareImage(Buffer.from(await file.arrayBuffer()));

        const imageId = crypto.randomUUID();
        const fullKey = leadImageKey(lead.id, imageId, 'full');
        const thumbKey = leadImageKey(lead.id, imageId, 'thumb');

        await storage.put(fullKey, prepared.full.bytes);
        await storage.put(thumbKey, prepared.thumb.bytes);

        try {
          await db.insert(leadImages).values({
            id: imageId,
            leadId: lead.id,
            fullKey,
            thumbKey,
            width: prepared.full.width,
            height: prepared.full.height,
            byteSize: prepared.full.bytes.byteLength,
            originalName: name,
            sourceType: prepared.sourceType,
            sortOrder,
            uploadedById: user.id,
          });
        } catch (error) {
          // The row is what makes the bytes reachable, so bytes without a row are
          // rubbish. Removed here rather than left for a cleanup job that does not
          // exist yet.
          await removeQuietly([fullKey, thumbKey]);
          throw error;
        }

        sortOrder += 10;
        added += 1;

        await logActivity({
          action: 'lead.imageAdded',
          actor: user,
          entityType: 'lead',
          entityId: lead.id,
          entityLabel: `Lead ${lead.reference}`,
          metadata: {
            imageId,
            originalName: name,
            sourceType: prepared.sourceType,
            byteSize: prepared.full.bytes.byteLength,
          },
        });
      } catch (error) {
        if (error instanceof ImageRejected) {
          refused.push(`${name}: ${lowerFirst(error.message)}`);
          continue;
        }

        // An unexpected failure on one file must not lose the files that worked, so
        // it is logged and reported alongside them rather than thrown.
        log.error({ err: error, leadId: lead.id }, 'could not store an uploaded image');
        refused.push(`${name}: could not be saved. Try again.`);
      }
    }

    revalidatePath(`/leads/${lead.reference}`);

    if (added === 0) {
      // The per-file reasons go in `fieldErrors` so the form lists them under the file
      // input, next to the control that has to be used again.
      return fail(
        files.length === 1
          ? 'That photo could not be used.'
          : 'None of those photos could be used.',
        { code: 'validation', fieldErrors: { files: refused } }
      );
    }

    return ok({ added, refused });
  });
}

/**
 * Removes one photo, and the file behind it.
 *
 * Who may: anyone with `leads:delete`, and additionally whoever uploaded it. Staff
 * cannot delete a lead, deliberately, but a member of staff who has just attached the
 * wrong customer's photo should not have to find a manager - the mistake is theirs to
 * undo, and waiting is the outcome with the real privacy cost.
 */
export async function removeLeadImageAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('lead.images.remove', async () => {
    const user = await authorize('leads', 'update');

    const parsed = parseInput(imageIdSchema, { imageId: formData.get('imageId') });
    if (!parsed.ok) return parsed.result;

    const [image] = await db
      .select({
        id: leadImages.id,
        leadId: leadImages.leadId,
        fullKey: leadImages.fullKey,
        thumbKey: leadImages.thumbKey,
        originalName: leadImages.originalName,
        uploadedById: leadImages.uploadedById,
        reference: leads.reference,
      })
      .from(leadImages)
      .innerJoin(leads, eq(leads.id, leadImages.leadId))
      .where(eq(leadImages.id, parsed.data.imageId))
      .limit(1);

    // Already gone is a success. The usual cause is a second click on a button whose
    // page had not caught up, and an error there would be about our timing, not theirs.
    if (image === undefined) return ok(undefined);

    const mine = image.uploadedById !== null && image.uploadedById === user.id;

    if (!can(user.role, 'leads', 'delete') && !mine) {
      return fail('Only the person who added a photo, or a manager, can remove it.', {
        code: 'forbidden',
      });
    }

    await db.delete(leadImages).where(eq(leadImages.id, image.id));

    // After the row, and never inside a transaction: unlinking a file cannot be
    // rolled back, so doing it first would destroy the bytes of a delete that then
    // failed to commit.
    await removeQuietly([image.fullKey, image.thumbKey]);

    await logActivity({
      action: 'lead.imageRemoved',
      actor: user,
      entityType: 'lead',
      entityId: image.leadId,
      entityLabel: `Lead ${image.reference}`,
      metadata: { imageId: image.id, originalName: image.originalName },
    });

    revalidatePath(`/leads/${image.reference}`);

    return ok(undefined);
  });
}

/** The lead, if it is there and not soft-deleted. */
async function liveLead(id: string): Promise<{ id: string; reference: number } | null> {
  const [row] = await db
    .select({ id: leads.id, reference: leads.reference })
    .from(leads)
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)))
    .limit(1);

  return row ?? null;
}

/**
 * The filename, made safe to display.
 *
 * Never used to build a path - see @/lib/storage/keys - so this is about the page, not
 * the filesystem: control characters stripped so a crafted name cannot disturb the
 * layout or the logs, and a length cap because a 300-character name breaks a card.
 */
function displayName(raw: string): string | null {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .trim()
    .slice(0, 120);

  return cleaned === '' ? null : cleaned;
}

/** "That file is empty." reads badly after a colon. */
function lowerFirst(message: string): string {
  return message.charAt(0).toLowerCase() + message.slice(1);
}
