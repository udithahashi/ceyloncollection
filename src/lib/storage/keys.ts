/**
 * Object keys: the names files are stored under.
 *
 * Kept in their own module, with no imports, so the rules can be tested without a
 * disk or a bucket - and so the validation is one function rather than a check
 * repeated in every driver.
 *
 * A key is a relative path built from ids we generated: `leads/<uuid>/<uuid>.webp`.
 * Nothing a user typed ever reaches it, which is deliberate. The uploaded filename
 * is kept in the database for display only; using it as a key would mean deciding
 * what to do about "../../.env", spaces, Unicode look-alikes and two customers who
 * both send "IMG_0042.jpg".
 */

/**
 * The shape every key must have: lowercase segments, one file extension, nothing
 * clever. Anchored at both ends, so a traversal attempt fails the whole match
 * rather than being stripped and allowed through in a mangled form.
 */
const KEY_PATTERN = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*\/[a-z0-9-]+\.[a-z0-9]{2,5}$/;

export class InvalidKeyError extends Error {
  constructor(key: string) {
    // The key is included because these are our own generated strings, never user
    // input, so this can only ever be a bug in this codebase.
    super(`Not a valid storage key: ${JSON.stringify(key)}`);
    this.name = 'InvalidKeyError';
  }
}

/**
 * Whether a key is safe to hand to a driver.
 *
 * The pattern already excludes `..`, backslashes, leading slashes and null bytes,
 * but the explicit checks below are cheap and say what they are defending against.
 */
export function isValidKey(key: string): boolean {
  if (key.length === 0 || key.length > 400) return false;
  if (key.includes('..') || key.includes('\\') || key.includes('\0')) return false;
  return KEY_PATTERN.test(key);
}

/** Throws unless the key is safe. Call before touching a filesystem or a bucket. */
export function assertValidKey(key: string): void {
  if (!isValidKey(key)) throw new InvalidKeyError(key);
}

/**
 * Where one lead's images live.
 *
 * Grouped by lead rather than dumped in one directory, and by variant within that,
 * so removing a lead's images is one directory and a directory listing stays a
 * reasonable size. `full` and `thumb` are separate objects rather than one file
 * resized on demand: resizing costs CPU on every view, and a list of forty leads
 * would ask for forty resizes to draw forty thumbnails.
 */
export function leadImageKey(
  leadId: string,
  imageId: string,
  variant: 'full' | 'thumb'
): string {
  return `leads/${leadId}/${imageId}-${variant}.webp`;
}
