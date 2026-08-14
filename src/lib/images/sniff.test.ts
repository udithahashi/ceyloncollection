import { describe, expect, it } from 'vitest';

import { sniffImageType } from './sniff';

/** Builds a buffer beginning with the given bytes, padded to a plausible length. */
function file(...bytes: number[]): Uint8Array {
  const buffer = new Uint8Array(64);
  buffer.set(bytes);
  return buffer;
}

function withAscii(offset: number, text: string, ...leading: number[]): Uint8Array {
  const buffer = file(...leading);
  for (let index = 0; index < text.length; index += 1) {
    buffer[offset + index] = text.charCodeAt(index);
  }
  return buffer;
}

describe('sniffImageType', () => {
  it('recognises a JPEG', () => {
    expect(sniffImageType(file(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
  });

  it('recognises a PNG', () => {
    expect(sniffImageType(file(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
  });

  it('recognises a WebP', () => {
    expect(sniffImageType(withAscii(8, 'WEBP', 0x52, 0x49, 0x46, 0x46))).toBe('webp');
  });

  it('recognises a GIF', () => {
    expect(sniffImageType(withAscii(0, 'GIF89a'))).toBe('gif');
  });

  it('recognises an iPhone HEIC', () => {
    const heic = withAscii(4, 'ftyp');
    const brand = 'heic';
    for (let index = 0; index < brand.length; index += 1) {
      heic[8 + index] = brand.charCodeAt(index);
    }
    expect(sniffImageType(heic)).toBe('heic');
  });

  /**
   * The case the whole module exists for. A RIFF header is also WAV and AVI, and an
   * `ftyp` box is also MP4 - matching either loosely would accept a video as a photo.
   */
  it('refuses a RIFF file that is not WebP', () => {
    expect(sniffImageType(withAscii(8, 'WAVE', 0x52, 0x49, 0x46, 0x46))).toBeNull();
  });

  it('refuses an MP4, which shares the HEIC container', () => {
    const mp4 = withAscii(4, 'ftyp');
    const brand = 'isom';
    for (let index = 0; index < brand.length; index += 1) {
      mp4[8 + index] = brand.charCodeAt(index);
    }
    expect(sniffImageType(mp4)).toBeNull();
  });

  it('refuses HTML pretending to be a photo', () => {
    expect(sniffImageType(withAscii(0, '<!DOCTYPE html><script>'))).toBeNull();
  });

  it('refuses a PDF', () => {
    expect(sniffImageType(withAscii(0, '%PDF-1.7'))).toBeNull();
  });

  it('refuses an SVG, which is a document that can carry script', () => {
    expect(sniffImageType(withAscii(0, '<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
  });

  it('does not read past the end of a very short file', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });
});
