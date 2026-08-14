/**
 * The photos panel on a lead.
 *
 * A Server Component, so the two decisions that must not be made in the browser are
 * made here: which photos exist, and who may remove each one. The client components it
 * renders receive the answers and no way to influence them - and the actions they call
 * check the same rules again, because a prop is not access control.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { can } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';
import { formatDateTime } from '@/lib/time';

import { listLeadImages } from '../queries';

import { ImageGallery, type GalleryImage } from './image-gallery';
import { ImageUploader } from './image-uploader';

export async function LeadImagePanel({
  leadId,
  reference,
  user,
}: {
  leadId: string;
  reference: number;
  user: SessionUser;
}) {
  const rows = await listLeadImages(leadId);

  const mayUpload = can(user.role, 'leads', 'update');
  const mayRemoveAny = can(user.role, 'leads', 'delete');

  const images: GalleryImage[] = rows.map((row) => ({
    ...row,
    // Whoever added a photo may take it down, even if their role cannot delete leads:
    // the wrong customer's picture is a problem for the person who attached it to fix
    // now, not after finding a manager.
    canRemove: mayUpload && (mayRemoveAny || row.uploadedById === user.id),
    addedLabel: formatDateTime(row.createdAt),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {images.length === 0
            ? 'Photos'
            : `${images.length} ${images.length === 1 ? 'photo' : 'photos'}`}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {images.length === 0 ? (
          <p className="text-sm text-ink-secondary">
            {mayUpload
              ? 'Nothing yet. A screenshot of the post they asked about, or the picture they sent, is often clearer than any description.'
              : 'No photos on this enquiry.'}
          </p>
        ) : (
          <ImageGallery images={images} reference={reference} />
        )}

        {mayUpload ? <ImageUploader leadId={leadId} /> : null}
      </CardContent>
    </Card>
  );
}
