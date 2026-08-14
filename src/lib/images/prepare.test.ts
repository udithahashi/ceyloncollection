import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ImageRejected, prepareImage } from './prepare';

/** A plain photo-shaped JPEG. */
async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 90, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

/**
 * A JPEG carrying the metadata a phone attaches, including a location.
 *
 * Written as an EXIF block rather than trusted to a helper, because the point of the
 * test is that this specific data does not survive.
 */
async function jpegWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .withExif({
      IFD0: { Make: 'Apple', Model: 'iPhone 15', Software: 'ceylon-test' },
      IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
    })
    .jpeg()
    .toBuffer();
}

describe('prepareImage', () => {
  it('produces a WebP pair from a JPEG', async () => {
    const result = await prepareImage(await jpeg(1200, 800));

    expect(result.sourceType).toBe('jpeg');

    const full = await sharp(result.full.bytes).metadata();
    const thumb = await sharp(result.thumb.bytes).metadata();

    expect(full.format).toBe('webp');
    expect(thumb.format).toBe('webp');
    expect(result.full.width).toBe(1200);
    expect(result.thumb.width).toBe(480);
  });

  it('caps the long edge and keeps the shape', async () => {
    const result = await prepareImage(await jpeg(4000, 3000));

    expect(result.full.width).toBe(2000);
    expect(result.full.height).toBe(1500);
    expect(result.thumb.width).toBe(480);
    expect(result.thumb.height).toBe(360);
  });

  it('does not enlarge a small photo', async () => {
    const result = await prepareImage(await jpeg(240, 180));

    expect(result.full.width).toBe(240);
    expect(result.thumb.width).toBe(240);
  });

  /**
   * The privacy claim in one test: a customer sending a picture of a dress has not
   * agreed to tell us where they were standing.
   */
  it('strips the camera and location metadata', async () => {
    const source = await jpegWithExif();

    // The fixture has to actually carry EXIF, or the assertion below proves nothing.
    expect((await sharp(source).metadata()).exif).toBeDefined();

    const result = await prepareImage(source);

    expect((await sharp(result.full.bytes).metadata()).exif).toBeUndefined();
    expect((await sharp(result.thumb.bytes).metadata()).exif).toBeUndefined();
  });

  /**
   * Orientation is the subtle half of stripping metadata: the tag that says "rotate
   * this" is itself metadata, so discarding it without applying it first turns every
   * portrait phone photo on its side.
   */
  it('applies the EXIF rotation before discarding it', async () => {
    const rotated = await sharp({
      create: { width: 400, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      // 6 means "rotate 90° clockwise on display", which swaps the sides. It has to be
      // set through `withMetadata`: `withExif` ignores the Orientation tag, which makes
      // for a fixture that silently proves nothing.
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    expect((await sharp(rotated).metadata()).orientation).toBe(6);

    const result = await prepareImage(rotated);

    expect(result.full.width).toBe(200);
    expect(result.full.height).toBe(400);
  });

  it('refuses an empty file', async () => {
    await expect(prepareImage(Buffer.alloc(0))).rejects.toThrow(ImageRejected);
  });

  it('refuses something that is not an image', async () => {
    await expect(prepareImage(Buffer.from('%PDF-1.7\n1 0 obj'))).rejects.toThrow(
      /not an image we can read/
    );
  });

  /** Passes the signature check, fails in the decoder. Same message to the user. */
  it('refuses a truncated JPEG', async () => {
    const whole = await jpeg(600, 400);
    await expect(prepareImage(whole.subarray(0, 40))).rejects.toThrow(ImageRejected);
  });

  it('refuses a file over the size limit before decoding it', async () => {
    // Starts with the JPEG signature, so it is the size that stops it, not the sniff.
    const huge = Buffer.alloc(16 * 1024 * 1024);
    huge.set([0xff, 0xd8, 0xff, 0xe0]);

    await expect(prepareImage(huge)).rejects.toThrow(/larger than 15MB/);
  });
});
