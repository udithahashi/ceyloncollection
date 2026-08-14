'use client';

/* eslint-disable @next/next/no-img-element --
 * These are private images behind a session check. next/image would proxy them through
 * the optimiser, which fetches the URL server-side without the browser's cookie, so
 * every photo would come back as a 404. Plain <img> with explicit dimensions and lazy
 * loading is the correct tool here.
 */

/**
 * A lead's photos: thumbnails, and one large view.
 *
 * The large view is a native `<dialog>` rather than a hand-built overlay, because the
 * browser then provides the things people forget: Escape closes it, focus is trapped
 * inside it and returned afterwards, and the rest of the page is inert to assistive
 * technology while it is open.
 *
 * Only `thumb` is requested for the grid. The `full` variant is fetched when a photo is
 * opened, which on a phone is the difference between loading 40KB and 400KB per photo
 * to draw a row of squares.
 */
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { removeLeadImageAction } from '../actions';
import type { LeadImageRow } from '../queries';

export interface GalleryImage extends LeadImageRow {
  /** Whether this viewer may remove this particular photo. Decided on the server. */
  canRemove: boolean;
  /**
   * "9 March 2026, 14:20" - already in Qatar time.
   *
   * Formatted on the server rather than here. The formatter needs the configured
   * timezone, which lives in the validated environment, and that module is server-only:
   * a client component reaching for it is the import leak that took down /customers
   * once already. Dates arrive as text.
   */
  addedLabel: string;
}

export function ImageGallery({ images, reference }: { images: GalleryImage[]; reference: number }) {
  /*
   * Which photo is open is held as an id, not a position in the list. The list is a
   * prop, so removing a photo re-renders this component with a shorter one: an index
   * would then point at whichever photo shifted into that slot, and the viewer would
   * be looking at a different picture than the one they had open. An id that is no
   * longer present simply means nothing is open, which is what should happen.
   */
  const [openId, setOpenId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openIndex = openId === null ? -1 : images.findIndex((image) => image.id === openId);
  const open = openIndex === -1 ? null : images[openIndex]!;

  // The `<dialog>` element is an external system with its own open state, which is
  // exactly what an effect is for: React's state is the source of truth and this keeps
  // the DOM in step with it, in both directions - `onClose` below feeds back.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open === null) {
      if (dialog.open) dialog.close();
    } else if (!dialog.open) {
      dialog.showModal();
    }
  }, [open]);

  function step(by: number) {
    const next = images[openIndex + by];
    if (next !== undefined) setOpenId(next.id);
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((image) => (
          <li key={image.id} className="group relative">
            <button
              type="button"
              onClick={() => setOpenId(image.id)}
              className="focus-visible:ring-action-ring block w-full overflow-hidden rounded-control border border-line-subtle focus-visible:ring-2 focus-visible:outline-none"
            >
              <img
                src={`/lead-images/${image.id}/thumb`}
                alt={image.originalName ?? `Reference photo for lead ${reference}`}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full bg-surface-inset object-cover transition-opacity group-hover:opacity-90"
              />
              <span className="sr-only">Open this photo</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpenId(null)}
        /*
         * Clicking the backdrop closes it. The backdrop is the dialog element itself -
         * its children sit on top - so a click whose target is the dialog is a click
         * outside the content.
         */
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpenId(null);
        }}
        className="max-h-[92vh] max-w-[92vw] rounded-panel border border-line-subtle bg-surface-panel p-0 text-ink-primary shadow-overlay backdrop:bg-black/70"
      >
        {open === null ? null : (
          <div className="flex flex-col gap-3 p-3">
            <img
              src={`/lead-images/${open.id}/full`}
              alt={open.originalName ?? `Reference photo for lead ${reference}`}
              width={open.width}
              height={open.height}
              className="max-h-[70vh] w-auto rounded-control bg-surface-inset object-contain"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-sm text-ink-primary">
                  {open.originalName ?? `Photo ${openIndex + 1}`}
                </span>
                <span className="text-xs text-ink-secondary">
                  Added {open.addedLabel} · {open.width} × {open.height}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {images.length < 2 ? null : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => step(-1)}
                      disabled={openIndex === 0}
                      aria-label="Previous photo"
                    >
                      <ChevronLeft aria-hidden="true" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => step(1)}
                      disabled={openIndex === images.length - 1}
                      aria-label="Next photo"
                    >
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  </>
                )}

                {open.canRemove ? <RemoveImage imageId={open.id} /> : null}

                <Button type="button" variant="secondary" size="sm" onClick={() => setOpenId(null)}>
                  <X aria-hidden="true" />
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

/**
 * Removing one photo.
 *
 * It asks first, and says that the file goes for good, because unlike a lead this is
 * not recoverable - the bytes are unlinked. Saying so is the difference between a
 * confirmation that informs and one people learn to click through.
 */
function RemoveImage({ imageId }: { imageId: string }) {
  const [state, action] = useActionState(removeLeadImageAction, idleActionState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          'Remove this photo?\n\nThe file is deleted for good. Only the log entry remains.'
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="imageId" value={imageId} />

      <SubmitButton variant="danger" size="sm" pendingLabel="Removing...">
        <Trash2 aria-hidden="true" />
        Remove
      </SubmitButton>

      {!state.ok ? (
        <p role="alert" className="mt-1 text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
