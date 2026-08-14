/**
 * Authorisation failures, as error types.
 *
 * A separate file from `session.ts` because that module imports `next/headers` and
 * therefore cannot be reached from anything that might be bundled for the browser.
 * These are plain classes with no imports, so both the action wrapper and the
 * session guards can use them.
 */
import type { Action, Resource } from './roles';

/** No valid session, or a session belonging to a disabled or un-enrolled account. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('You are not signed in.');
    this.name = 'NotAuthenticatedError';
  }
}

/** A valid session whose role does not permit the attempted action. */
export class AccessDeniedError extends Error {
  constructor(
    readonly resource: Resource,
    readonly action: Action
  ) {
    super('You do not have permission to do that.');
    this.name = 'AccessDeniedError';
  }
}
