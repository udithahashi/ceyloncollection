/**
 * What a file actually is, read from its first bytes.
 *
 * The browser's `file.type` and the filename extension are both claims made by
 * whoever uploaded the file. This module ignores both and looks at the content,
 * because the interesting attack is a file called `photo.jpg`, declared
 * `image/jpeg`, that is really an HTML document or a PHP script: if it is ever
 * served back with a guessed content type, it runs in our origin.
 *
 * Three defences stack up, and this is the first:
 *   1. this check, which refuses anything that is not a picture;
 *   2. re-encoding through sharp, which produces new bytes from the decoded pixels,
 *      so nothing from the original file survives into what we store;
 *   3. `X-Content-Type-Options: nosniff` plus an explicit `Content-Type` on the way
 *      out, so the browser cannot decide for itself.
 *
 * Pure: no imports, so it is trivially testable.
 */

/** The formats sharp can decode and that people actually send. */
export const acceptedImageTypes = ['jpeg', 'png', 'webp', 'heic', 'gif'] as const;

export type ImageType = (typeof acceptedImageTypes)[number];

/** Human wording for a refusal message. */
export const acceptedImageLabel = 'JPEG, PNG, WebP, HEIC or GIF';

/** What a browser file picker should offer. Not a security control. */
export const acceptedImageAccept =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif';

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/**
 * The image format these bytes are, or null.
 *
 * Only the signatures are checked, not the whole structure - a truncated JPEG is
 * recognised here and then fails in sharp, which is the right division of labour:
 * this function decides whether the file is worth handing to a decoder at all.
 */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  // JPEG: SOI marker. Every variant, JFIF and EXIF alike, starts this way.
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';

  // PNG: the signature includes \r\n and \x1a specifically to detect mangling by
  // text-mode transfers.
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';

  // WebP: RIFF container with a WEBP form type. Both markers are needed - RIFF
  // alone is also WAV and AVI.
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === 'WEBP') {
    return 'webp';
  }

  // GIF: "GIF87a" or "GIF89a".
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'gif';

  /*
   * HEIC, which is what an iPhone produces unless the owner has changed a setting.
   * An ISO base media file: a box named `ftyp` at offset 4, then a brand. The HEIF
   * brands are listed rather than matched loosely, because `ftyp` also introduces
   * MP4 and QuickTime video, and a 200MB video is exactly the upload this should
   * refuse.
   */
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (
      ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(
        brand
      )
    ) {
      return 'heic';
    }
  }

  return null;
}
