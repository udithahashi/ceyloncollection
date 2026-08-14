'use client';

/**
 * Choosing photos and sending them.
 *
 * Deliberately not drag-and-drop-first. The realistic case is someone on a phone, in a
 * WhatsApp conversation, who has just been sent a picture of a dress: what they need is
 * the system file picker and their camera roll, which is what a plain file input opens.
 * `capture` is not set, so the picker offers the camera as well as the library rather
 * than forcing one of them.
 *
 * The previews are local `blob:` URLs, shown before anything is uploaded. They exist so
 * a mistake is caught here rather than after a round trip - "that is the wrong
 * screenshot" is obvious from a thumbnail and invisible from a filename.
 */
import { ImagePlus, Upload, X } from 'lucide-react';
import { useActionState, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/ui/submit-button';
import { initialActionState, type ActionResult } from '@/lib/actions/result';
import {
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_TOTAL_BYTES,
  megabytes,
} from '@/lib/images/limits';
import { acceptedImageAccept, acceptedImageLabel } from '@/lib/images/sniff';

import { uploadLeadImagesAction, type UploadOutcome } from '../actions';

interface Chosen {
  name: string;
  size: number;
  /** Object URL for the preview. Revoked when the selection changes. */
  url: string;
}

export function ImageUploader({ leadId }: { leadId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<Chosen[]>([]);

  /*
   * The server action is wrapped rather than passed directly, so that clearing the
   * previews happens where the result arrives. The alternative - an effect watching the
   * result - would be a second source of truth for "has this been sent", and React
   * rightly complains about setting state from an effect.
   *
   * The input is cleared only after the action resolves. Clearing it earlier would empty
   * the control whose files are being submitted.
   */
  const [state, action] = useActionState(
    async (previous: ActionResult<UploadOutcome | undefined>, formData: FormData) => {
      const result = await uploadLeadImagesAction(previous, formData);

      if (result.ok && (result.data?.added ?? 0) > 0) {
        setChosen([]);
        if (inputRef.current !== null) inputRef.current.value = '';
      }

      return result;
    },
    initialActionState<UploadOutcome>()
  );

  /*
   * Object URLs hold the file in memory until revoked. Without this, picking ten
   * photos, changing your mind, and picking ten more leaks all twenty for as long as
   * the page is open.
   */
  useEffect(() => {
    return () => {
      for (const item of chosen) URL.revokeObjectURL(item.url);
    };
  }, [chosen]);

  const refused = state.ok ? (state.data?.refused ?? []) : (state.fieldErrors?.files ?? []);

  /*
   * Checked here as well as on the server, because this is the one limit whose server
   * check can be skipped: a body over the framework's limit is rejected before the
   * action runs, and the browser is left with a network error nobody can act on. So the
   * button is disabled and the reason is on screen instead.
   */
  const total = chosen.reduce((sum, item) => sum + item.size, 0);

  const tooMuch =
    chosen.length > MAX_FILES_PER_UPLOAD
      ? `That is ${chosen.length} photos. Up to ${MAX_FILES_PER_UPLOAD} at a time.`
      : total > MAX_UPLOAD_TOTAL_BYTES
        ? `Those add up to ${megabytes(total)}. Send up to ${megabytes(MAX_UPLOAD_TOTAL_BYTES)} at a time.`
        : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="leadId" value={leadId} />

      <input
        ref={inputRef}
        id="lead-images-files"
        type="file"
        name="files"
        multiple
        accept={acceptedImageAccept}
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          setChosen(
            files.map((file) => ({
              name: file.name,
              size: file.size,
              url: URL.createObjectURL(file),
            }))
          );
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          Choose photos
        </Button>

        {chosen.length === 0 ? (
          <p className="text-xs text-ink-secondary">
            {acceptedImageLabel}, up to {megabytes(MAX_UPLOAD_BYTES)} each.
          </p>
        ) : (
          <>
            <SubmitButton size="sm" pendingLabel="Uploading..." disabled={tooMuch !== null}>
              <Upload aria-hidden="true" />
              Upload {chosen.length === 1 ? 'the photo' : `${chosen.length} photos`}
            </SubmitButton>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setChosen([]);
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              <X aria-hidden="true" />
              Clear
            </Button>
          </>
        )}
      </div>

      {chosen.length === 0 ? null : (
        <ul className="flex flex-wrap gap-2">
          {chosen.map((item) => (
            <li key={item.url} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL cannot go through the image optimiser */}
              <img
                src={item.url}
                alt=""
                className="size-20 rounded-control border border-line-subtle object-cover"
              />
              <span className="max-w-20 truncate text-[0.6875rem] text-ink-secondary">
                {item.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {tooMuch === null ? null : (
        <p role="alert" className="text-xs text-error-ink">
          {tooMuch}
        </p>
      )}

      {!state.ok ? (
        <p role="alert" className="text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}

      {refused.length === 0 ? null : (
        <ul className="flex flex-col gap-1" aria-live="polite">
          {refused.map((line) => (
            <li key={line} className="text-xs text-error-ink">
              {line}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
