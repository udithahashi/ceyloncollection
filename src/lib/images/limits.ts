/**
 * How much may be uploaded at once.
 *
 * These live in their own module with no imports for two reasons. The uploader is a
 * client component and needs them to warn before a submission that cannot succeed;
 * `next.config.ts` needs them to size the Server Action body limit. A number
 * duplicated in three places is a number that will disagree with itself, and the
 * symptom would be an upload rejected by the framework before any of our code runs -
 * with a message about bytes rather than about photos.
 */

const MB = 1024 * 1024;

/** The largest single photo. A phone picture is 2-6MB; HEIC is smaller still. */
export const MAX_UPLOAD_BYTES = 15 * MB;

/**
 * Photos per submission.
 *
 * The constraint is CPU, not disk: re-encoding a 12-megapixel HEIC takes a few hundred
 * milliseconds, and one request that decodes dozens of them holds a worker long enough
 * for every other page to feel broken.
 */
export const MAX_FILES_PER_UPLOAD = 6;

/**
 * The most one request may carry, all files together.
 *
 * Deliberately less than `MAX_FILES_PER_UPLOAD * MAX_UPLOAD_BYTES`. Six files at the
 * per-file maximum would be 90MB, and reserving that much body allowance for a case
 * that does not occur - six 15MB photos - would mean accepting a 90MB POST from anyone
 * with a session. Realistic six-photo uploads are well under this.
 */
export const MAX_UPLOAD_TOTAL_BYTES = 40 * MB;

/** "15MB", for a message. Whole megabytes: nobody needs "14.31MB" in a warning. */
export function megabytes(bytes: number): string {
  return `${Math.round(bytes / MB)}MB`;
}
