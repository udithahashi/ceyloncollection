/**
 * Guards the one number `next.config.mjs` has to write down twice.
 *
 * The config used to import `MAX_UPLOAD_TOTAL_BYTES` directly. It cannot any more: the
 * config became `.mjs` so that it loads on a host whose glibc is too old for Next's
 * native compiler (the reasoning is at the top of `next.config.mjs`), and a `.mjs` file
 * cannot import a `.ts` one at runtime.
 *
 * So the number is duplicated, and this test is the thing that makes the duplication
 * safe. Without it, raising the limit in `src/lib/images/limits.ts` alone would leave
 * the framework rejecting uploads the uploader believes are fine - a failure that
 * happens before any application code runs, and reports bytes rather than photos.
 */
import { describe, expect, it } from 'vitest';

import { MAX_UPLOAD_TOTAL_BYTES } from '@/lib/images/limits';

import nextConfig from '../next.config.mjs';

describe('next.config.mjs', () => {
  it('sizes the Server Action body limit from the same number the uploader uses', () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe(MAX_UPLOAD_TOTAL_BYTES);
  });

  it('still builds the standalone output the production hosts run', () => {
    // `scripts/prepare-standalone.mjs` and the Dockerfile both assume `.next/standalone`
    // exists. Turning this off would break both silently at deploy time rather than here.
    expect(nextConfig.output).toBe('standalone');
  });
});
