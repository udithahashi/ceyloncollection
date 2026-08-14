/**
 * The shape every Server Action returns.
 *
 * This file is imported by client components, so it must stay free of imports.
 * Nothing here may reach `next/headers`, the logger, or the database - the moment
 * it does, every form that shows an error drags the server into the browser bundle
 * and the build fails with an import trace that takes a while to read.
 *
 * The server-side helpers that produce these values live in `./index`.
 */

/** Errors keyed by field name, in the shape Zod produces and forms consume. */
export type FieldErrors = Record<string, string[]>;

/**
 * Machine-readable reasons a caller may want to branch on, as opposed to the
 * message, which is for humans and may be reworded at any time.
 */
export type ActionErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'validation'
  | 'rateLimited'
  | 'conflict'
  | 'notFound'
  | 'unexpected';

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors; code?: ActionErrorCode };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  error: string,
  options: { fieldErrors?: FieldErrors; code?: ActionErrorCode } = {}
): ActionResult<never> {
  return { ok: false, error, ...options };
}

/**
 * The initial state for `useActionState`.
 *
 * Typed as a success carrying nothing, so a form renders in its neutral state
 * before anything has been submitted.
 */
export const idleActionState: ActionResult<undefined> = { ok: true, data: undefined };

/** The same, for an action whose success carries data. */
export function initialActionState<T>(): ActionResult<T | undefined> {
  return { ok: true, data: undefined };
}
