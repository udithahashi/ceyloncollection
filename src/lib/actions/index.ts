/**
 * Server-side helpers for Server Actions: validation, form parsing, and the
 * wrapper that turns a thrown error into a returned result.
 *
 * SERVER ONLY. This module imports the logger, so importing it from a client
 * component fails the build. Client components want `./result`, which holds the
 * types and the two constructors and imports nothing.
 *
 * Actions never throw at the boundary. A thrown error in a Server Action reaches
 * the browser as an opaque "an error occurred" plus a digest, which tells the user
 * nothing and tells us nothing either. Every failure becomes a value the form can
 * render next to the field that caused it.
 */
import { type z } from 'zod';

import { AccessDeniedError, NotAuthenticatedError } from '@/lib/auth/errors';
import { createLogger } from '@/lib/logger';

import { fail, type ActionResult, type FieldErrors } from './result';

const log = createLogger('action');

/**
 * Validates input against a schema, returning either the parsed value or a result
 * carrying per-field messages.
 *
 * A Server Action is a public HTTP endpoint. Anything reaching it - including
 * fields your form does not render - came from outside and is untrusted until it
 * has been through here.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown
): { ok: true; data: z.output<Schema> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);

  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    // `_form` collects issues that belong to the submission rather than a field,
    // such as a cross-field check that two passwords match.
    const key = issue.path.join('.') || '_form';
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return {
    ok: false,
    result: fail('Please correct the highlighted fields.', { fieldErrors, code: 'validation' }),
  };
}

/** Turns a `FormData` into a plain object, so Zod can validate it. */
export function formToObject(formData: FormData): Record<string, unknown> {
  const entries: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    // File values are handled by the upload pipeline, not by generic parsing.
    if (value instanceof File) continue;

    const existing = entries[key];
    if (existing === undefined) {
      entries[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      // A repeated name, such as a multi-select or a checkbox group.
      entries[key] = [existing, value];
    }
  }

  return entries;
}

/**
 * Runs an action body and converts anything it throws into a result.
 *
 * `redirect()` and `notFound()` work by throwing control-flow errors that Next.js
 * catches upstream, so those are re-thrown untouched. Swallowing them would break
 * every redirect in the application in a way that is genuinely hard to diagnose.
 */
export async function runAction<T>(
  name: string,
  body: () => Promise<ActionResult<T>>
): Promise<ActionResult<T>> {
  try {
    return await body();
  } catch (error) {
    if (isFrameworkControlFlow(error)) throw error;

    if (error instanceof NotAuthenticatedError) {
      return fail('Your session has expired. Please sign in again.', { code: 'unauthenticated' });
    }

    if (error instanceof AccessDeniedError) {
      return fail('You do not have permission to do that.', { code: 'forbidden' });
    }

    // Deliberately vague to the user, fully detailed in the log. An error message
    // that quotes a database constraint is a free schema disclosure.
    log.error({ err: error, action: name }, 'server action failed');
    return fail('Something went wrong. Please try again.', { code: 'unexpected' });
  }
}

/**
 * Next.js signals redirects and 404s by throwing objects carrying a `digest`
 * string. There is no exported type for these, so the shape is checked directly.
 */
function isFrameworkControlFlow(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_')
  );
}
