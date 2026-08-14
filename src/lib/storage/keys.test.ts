import { describe, expect, it } from 'vitest';

import { assertValidKey, InvalidKeyError, isValidKey, leadImageKey } from './keys';

const leadId = '3f7c8a52-2b0e-4a19-9b71-0d5c4c8b1e11';
const imageId = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

describe('leadImageKey', () => {
  it('puts both variants of an image under the lead', () => {
    expect(leadImageKey(leadId, imageId, 'full')).toBe(`leads/${leadId}/${imageId}-full.webp`);
    expect(leadImageKey(leadId, imageId, 'thumb')).toBe(`leads/${leadId}/${imageId}-thumb.webp`);
  });

  it('produces keys that pass validation', () => {
    expect(isValidKey(leadImageKey(leadId, imageId, 'full'))).toBe(true);
  });
});

describe('isValidKey', () => {
  it('accepts a nested key', () => {
    expect(isValidKey('leads/abc/def-full.webp')).toBe(true);
  });

  /**
   * The reason this module exists. Every one of these is a real technique for escaping
   * a storage root, and the pattern has to reject them rather than sanitise them:
   * stripping characters until a path looks safe is how the interesting bypasses work.
   */
  it.each([
    ['a traversal', '../secrets.webp'],
    ['a traversal in the middle', 'leads/../../.env'],
    ['an absolute path', '/etc/passwd'],
    ['a Windows path', 'leads\\abc\\photo.webp'],
    ['a drive letter', 'C:/windows/system32/config.webp'],
    ['a null byte, which truncates a C string', 'leads/abc/photo.webp\0.txt'],
    ['a home reference', '~/photo.webp'],
    ['a bare filename with no directory', 'photo.webp'],
    ['no extension', 'leads/abc/photo'],
    ['an empty key', ''],
    ['a trailing slash', 'leads/abc/'],
    ['uppercase, which differs by filesystem', 'Leads/ABC/Photo.webp'],
    ['a space', 'leads/abc/my photo.webp'],
    ['a URL', 'https://example.com/photo.webp'],
  ])('rejects %s', (_description, key) => {
    expect(isValidKey(key)).toBe(false);
  });

  it('rejects an absurdly long key', () => {
    expect(isValidKey(`leads/${'a'.repeat(500)}/photo.webp`)).toBe(false);
  });
});

describe('assertValidKey', () => {
  it('says nothing for a good key', () => {
    expect(() => assertValidKey('leads/abc/def-thumb.webp')).not.toThrow();
  });

  it('throws for a bad one', () => {
    expect(() => assertValidKey('../../.env')).toThrow(InvalidKeyError);
  });
});
