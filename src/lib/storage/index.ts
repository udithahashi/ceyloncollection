/**
 * Where uploaded files are kept.
 *
 * One small interface - put, read, remove, remove a prefix - with a local-disk
 * implementation behind it. The interface exists because the destination will change:
 * a Docker volume on the VPS now, object storage when there are enough photos that
 * backing up the volume stops being pleasant. Every caller works in terms of a key
 * like `leads/<uuid>/<uuid>-full.webp`, so that move is one new file here.
 *
 * WHAT THIS IS NOT
 * Not a CDN, and not a public directory. Nothing under `STORAGE_LOCAL_DIR` is served
 * by Next.js: `public/` is world-readable by design, and a customer's photo is not
 * public. Bytes reach the browser only through the route that checks the session -
 * see `src/app/lead-images`.
 *
 * SERVER ONLY.
 */
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';

import { assertValidKey } from './keys';

export { assertValidKey, InvalidKeyError, isValidKey, leadImageKey } from './keys';

const log = createLogger('storage');

export interface StoredObject {
  /** The bytes, as a stream, so a large file is not held in memory to serve it. */
  body: ReadableStream<Uint8Array>;
  byteSize: number;
}

export interface Storage {
  put(key: string, bytes: Buffer): Promise<void>;
  /** Null when the object is not there, which is not an error at this level. */
  read(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
  /** Removes everything under a prefix. Used when a lead is deleted for good. */
  removePrefix(prefix: string): Promise<void>;
}

/**
 * The root of the local store, absolute.
 *
 * Resolved once from the working directory, which in production is the app's own
 * directory inside the container, with the volume mounted at
 * `STORAGE_LOCAL_DIR`.
 *
 * `turbopackIgnore` because the bundler sees a filesystem path built from a value it
 * cannot know at build time and conservatively decides the whole project might need
 * tracing into the standalone output. This directory is a runtime concern - a mounted
 * volume - and never a build input, so there is nothing to trace.
 */
const localRoot = path.resolve(/* turbopackIgnore: true */ process.cwd(), env.STORAGE_LOCAL_DIR);

/**
 * A key's place on disk.
 *
 * The key is validated first, and the result is then checked to be inside the root
 * anyway. Belt and braces: the pattern already forbids `..`, and this catches any
 * future key builder that forgets to go through `assertValidKey`. Path traversal is
 * cheap to prevent twice and expensive to get wrong once.
 */
function localPath(key: string): string {
  assertValidKey(key);

  // Ignored by the bundler for the same reason as `localRoot` above: a runtime path,
  // not a module to include.
  const resolved = path.resolve(/* turbopackIgnore: true */ localRoot, key);
  const root = localRoot.endsWith(path.sep) ? localRoot : localRoot + path.sep;

  if (!resolved.startsWith(root)) {
    throw new Error('Refusing to touch a path outside the storage root.');
  }

  return resolved;
}

const localStorage: Storage = {
  async put(key, bytes) {
    const destination = localPath(key);
    await mkdir(path.dirname(destination), { recursive: true });

    /*
     * Written to a temporary name and renamed into place, because `rename` within a
     * filesystem is atomic. Without it, a crash halfway through a write leaves a
     * truncated file that looks like a valid object: the row exists, the thumbnail
     * half-draws, and nothing reports an error.
     */
    const temporary = `${destination}.${crypto.randomUUID()}.part`;

    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  },

  async read(key) {
    const source = localPath(key);

    let byteSize: number;
    try {
      const stats = await stat(source);
      if (!stats.isFile()) return null;
      byteSize = stats.size;
    } catch {
      return null;
    }

    return {
      body: Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>,
      byteSize,
    };
  },

  async remove(key) {
    // `force` so removing something already gone is a success. Deletion is often a
    // retry of a half-finished one, and making that throw turns a tidy-up into an
    // error the user has to think about.
    await rm(localPath(key), { force: true });
  },

  async removePrefix(prefix) {
    // Only ever called with a directory prefix we built, e.g. `leads/<uuid>`. Made
    // to look like a key so the same validation applies before a recursive delete.
    const directory = localPath(`${prefix}/placeholder.webp`);
    await rm(path.dirname(directory), { recursive: true, force: true });
  },
};

/**
 * The unimplemented driver.
 *
 * `STORAGE_DRIVER=s3` is accepted by the environment schema because the day it is
 * needed is foreseeable, but nothing implements it yet. Failing loudly on the first
 * call is better than quietly writing customer photos to a container's local disk
 * where the next deploy will discard them.
 */
const s3Storage: Storage = {
  put: notImplemented,
  read: notImplemented,
  remove: notImplemented,
  removePrefix: notImplemented,
};

function notImplemented(): never {
  throw new Error(
    'STORAGE_DRIVER=s3 is not implemented yet. Set STORAGE_DRIVER=local, or add the driver in src/lib/storage.'
  );
}

export const storage: Storage = env.STORAGE_DRIVER === 's3' ? s3Storage : localStorage;

/** Where the local driver is writing. Reported by `npm run doctor` and at startup. */
export function storageLocation(): string {
  return env.STORAGE_DRIVER === 'local' ? localRoot : `s3 (not implemented)`;
}

/**
 * Removes objects, and reports rather than throws.
 *
 * Used after a database transaction has already committed. By then the row is gone
 * and the request has succeeded; a failure to unlink is a disk problem for the
 * operator, not something to show the user as a failed deletion. Logged at `warn`
 * with the key, so orphaned bytes can be found later.
 */
export async function removeQuietly(keys: readonly string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await storage.remove(key);
      } catch (error) {
        log.warn(
          { key, error: error instanceof Error ? error.message : String(error) },
          'could not remove a stored object; it is now orphaned'
        );
      }
    })
  );
}
