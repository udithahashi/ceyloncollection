/**
 * Turning an uploaded file into the two images we keep.
 *
 * Every upload is decoded and re-encoded rather than stored as it arrived. That one
 * decision does four things at once, which is why it is not optional:
 *
 * - **Removes the metadata.** A phone photo carries GPS coordinates, the device, and
 *   the exact second. A customer sending a picture of a dress has not agreed to hand
 *   over their home address, and we have no use for it. sharp drops all of it unless
 *   asked to keep it, and this code never asks.
 * - **Neutralises the file.** What we store is generated from decoded pixels, so a
 *   script, an HTML payload or a malformed chunk in the original cannot survive into
 *   the bytes we later serve.
 *   Note the orientation subtlety: EXIF is what says "this photo is rotated 90°", so
 *   `rotate()` has to be applied *before* the metadata is discarded, or every second
 *   iPhone picture ends up sideways.
 * - **Makes the size predictable.** A 12-megapixel HEIC becomes a WebP of a few
 *   hundred kilobytes. On a phone, on Qatari mobile data, that is the difference
 *   between a gallery that loads and one nobody waits for.
 * - **Gives us a thumbnail.** Lists show the small one; only a click loads the large
 *   one.
 *
 * SERVER ONLY - sharp is a native module.
 */
import sharp, { type Metadata, type Sharp } from 'sharp';

import { MAX_UPLOAD_BYTES, megabytes } from './limits';
import { acceptedImageLabel, sniffImageType, type ImageType } from './sniff';

/** Longest edge of the image we keep. */
const FULL_EDGE = 2000;
/** Longest edge of the thumbnail. */
const THUMB_EDGE = 480;

/**
 * The largest picture we will decode, in pixels.
 *
 * A decompression bomb is a small file that decodes to an enormous bitmap - a 10KB
 * PNG can claim 30,000 by 30,000 pixels, which is 3.6GB of memory once decoded and
 * takes the process down. sharp has its own default limit; this is lower and stated
 * here, because 50 megapixels is already far beyond any phone camera.
 */
const MAX_PIXELS = 50_000_000;

export interface PreparedVariant {
  bytes: Buffer;
  width: number;
  height: number;
}

export interface PreparedImage {
  full: PreparedVariant;
  thumb: PreparedVariant;
  /** What the file turned out to be, for the record. Not what the browser claimed. */
  sourceType: ImageType;
}

/** A refusal a person can act on, as opposed to an internal failure. */
export class ImageRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageRejected';
  }
}

/**
 * Prepares one upload, or explains why it cannot be used.
 *
 * @throws ImageRejected when the file is not a usable picture. The message is
 * written to be shown to whoever chose the file.
 */
export async function prepareImage(bytes: Buffer): Promise<PreparedImage> {
  if (bytes.byteLength === 0) throw new ImageRejected('That file is empty.');

  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageRejected(
      `That file is larger than ${megabytes(MAX_UPLOAD_BYTES)}. A photo from a phone is usually well under it.`
    );
  }

  const sourceType = sniffImageType(bytes);

  if (sourceType === null) {
    throw new ImageRejected(`That is not an image we can read. Use ${acceptedImageLabel}.`);
  }

  /*
   * `animated: false` reads the first frame only. An animated WebP or GIF would
   * otherwise be resized frame by frame - hundreds of them, in one request - and the
   * point of these images is to see the garment.
   */
  const source = sharp(bytes, { limitInputPixels: MAX_PIXELS, animated: false });

  const metadata = await readMetadata(source);

  if (!metadata.width || !metadata.height) {
    throw new ImageRejected('That image seems to be damaged: it has no readable size.');
  }

  const full = await encode(source, FULL_EDGE, 82);
  const thumb = await encode(source, THUMB_EDGE, 68);

  return { full, thumb, sourceType };
}

async function readMetadata(source: Sharp): Promise<Metadata> {
  try {
    return await source.metadata();
  } catch (error) {
    // sharp throws here for a file that passed the signature check but is truncated
    // or internally malformed. To the person uploading it, that is the same problem.
    throw new ImageRejected(
      `That image could not be read: ${error instanceof Error ? error.message : 'unknown reason'}`
    );
  }
}

/**
 * One variant.
 *
 * `clone()` because a sharp instance is a pipeline that can only be consumed once,
 * and both variants come from the same decoded input - decoding a 12-megapixel HEIC
 * twice would double the most expensive part of the work.
 *
 * `withoutEnlargement` because a 300px photo stretched to 2000px is a bigger file
 * that shows less. Small images are simply kept small, and the two variants are then
 * near enough identical, which is not worth a special case.
 */
async function encode(source: Sharp, edge: number, quality: number): Promise<PreparedVariant> {
  const { data, info } = await source
    .clone()
    // Applies the EXIF orientation. Must precede the encode, since the tag that
    // describes the rotation is about to be discarded.
    .rotate()
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return { bytes: data, width: info.width, height: info.height };
}
