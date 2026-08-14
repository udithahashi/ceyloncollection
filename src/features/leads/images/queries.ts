/**
 * Reads for lead images.
 *
 * SERVER ONLY.
 */
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { leadImages } from '@/db/schema/lead-images';
import { leads } from '@/db/schema/leads';

export interface LeadImageRow {
  id: string;
  width: number;
  height: number;
  originalName: string | null;
  createdAt: string;
  uploadedById: string | null;
}

/** One lead's images, in display order. */
export async function listLeadImages(leadId: string): Promise<LeadImageRow[]> {
  return db
    .select({
      id: leadImages.id,
      width: leadImages.width,
      height: leadImages.height,
      originalName: leadImages.originalName,
      createdAt: leadImages.createdAt,
      uploadedById: leadImages.uploadedById,
    })
    .from(leadImages)
    .where(eq(leadImages.leadId, leadId))
    .orderBy(asc(leadImages.sortOrder), asc(leadImages.createdAt));
}

export interface ServableImage {
  fullKey: string;
  thumbKey: string;
  leadId: string;
  uploadedById: string | null;
}

/**
 * What the serving route needs, and nothing else.
 *
 * Joined to `leads` so that an image belonging to a soft-deleted lead stops being
 * served. Without the join, deleting a lead would hide it from every page while its
 * photos remained fetchable by anyone who had noted a URL - which is precisely the
 * data a soft delete is supposed to withdraw.
 */
export async function getServableImage(id: string): Promise<ServableImage | null> {
  const [row] = await db
    .select({
      fullKey: leadImages.fullKey,
      thumbKey: leadImages.thumbKey,
      leadId: leadImages.leadId,
      uploadedById: leadImages.uploadedById,
    })
    .from(leadImages)
    .innerJoin(leads, eq(leads.id, leadImages.leadId))
    .where(and(eq(leadImages.id, id), isNull(leads.deletedAt)))
    .limit(1);

  return row ?? null;
}

/** The next sort position for a lead, so new images land at the end. */
export async function nextSortOrder(leadId: string): Promise<number> {
  const [row] = await db
    .select({ highest: leadImages.sortOrder })
    .from(leadImages)
    .where(eq(leadImages.leadId, leadId))
    .orderBy(desc(leadImages.sortOrder))
    .limit(1);

  // Counted in tens, matching the taxonomy's ordering, so a value can later be
  // slotted between two others without renumbering the lot.
  return row === undefined ? 0 : row.highest + 10;
}
