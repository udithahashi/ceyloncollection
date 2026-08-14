/**
 * Session reading and access guards.
 *
 * Every page and every Server Action starts here. The rules this file enforces,
 * in order, are:
 *
 * 1. There is a valid session, or you go to the login page.
 * 2. The account is not disabled.
 * 3. Two-factor is enrolled, or you go to the enrolment page.
 * 4. The role permits the action, or you are refused.
 *
 * Being unreachable from the navigation is not access control. A Server Action is
 * a public HTTP endpoint no matter how much it looks like a function call, so the
 * check belongs in the action itself and not only in the page that renders its form.
 *
 * SERVER ONLY.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createLogger } from '@/lib/logger';

import { AccessDeniedError, NotAuthenticatedError } from './errors';
import { auth } from './index';
import { can, isRole, type Action, type Resource, type Role } from './roles';

// Re-exported so a Server Action can import its guard and the errors that guard
// throws from one place.
export { AccessDeniedError, NotAuthenticatedError };

const log = createLogger('session');

/** Where an unauthenticated visitor is sent. */
export const LOGIN_PATH = '/login';
/** Where someone without a TOTP authenticator is sent. */
export const TWO_FACTOR_SETUP_PATH = '/setup-two-factor';
/** Where someone whose role forbids the page is sent. */
export const ACCESS_DENIED_PATH = '/access-denied';

/** The subset of the user record the application actually uses. */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  disabledAt: Date | null;
}

export interface CurrentSession {
  user: SessionUser;
  /** Present so callers can show "signed in from" detail and revoke sessions. */
  sessionId: string;
  expiresAt: Date;
}

/**
 * Reads the session for this request, or null.
 *
 * Wrapped in React's `cache`, so a layout, a page and three components asking for
 * the current user in the same render produce one lookup rather than five.
 */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;

  const { user, session } = result;

  // A role we do not recognise means the database was edited by hand or a
  // migration went wrong. Refuse rather than guess: guessing here means guessing
  // about permissions.
  if (!isRole(user.role)) {
    log.error({ userId: user.id, role: user.role }, 'session rejected: unknown role');
    return null;
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      disabledAt: user.disabledAt ?? null,
    },
    sessionId: session.id,
    expiresAt: session.expiresAt,
  };
});

/**
 * Requires a signed-in, enabled, two-factor-enrolled user, and returns them.
 *
 * Redirects rather than returning null, so a caller cannot accidentally proceed by
 * ignoring the result.
 *
 * @param returnTo path to come back to after signing in
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const session = await getSession();

  if (!session) {
    redirect(returnTo ? `${LOGIN_PATH}?next=${encodeURIComponent(returnTo)}` : LOGIN_PATH);
  }

  if (session.user.disabledAt) {
    // Deactivated while signed in. Sessions are also revoked when an owner
    // disables an account; this covers the window before that completes.
    log.warn({ userId: session.user.id }, 'disabled account attempted access');
    redirect(`${LOGIN_PATH}?reason=disabled`);
  }

  if (!session.user.twoFactorEnabled) {
    redirect(TWO_FACTOR_SETUP_PATH);
  }

  return session.user;
}

/**
 * Requires a user who may perform `action` on `resource`.
 *
 * On refusal this redirects to a page that explains why. A true 403 would be more
 * correct, but Next.js only offers `forbidden()` behind an experimental flag, and
 * the core authorisation path is not the place to depend on one. Nothing here is
 * indexed or cached, so the status code costs us nothing in practice.
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
  returnTo?: string
): Promise<SessionUser> {
  const user = await requireUser(returnTo);

  if (!can(user.role, resource, action)) {
    log.warn(
      { userId: user.id, role: user.role, resource, action },
      'access denied by permission check'
    );
    redirect(`${ACCESS_DENIED_PATH}?resource=${resource}&action=${action}`);
  }

  return user;
}

/**
 * The Server Action counterpart of the guards above: returns the current user, or
 * throws.
 *
 * Actions must not redirect on an authorisation failure. A form post that silently
 * navigates away loses whatever the user typed, and tells an attacker which
 * endpoints exist. So this throws, and `runAction` in @/lib/actions turns the throw
 * into a result the form can display.
 */
export async function authorize(resource: Resource, action: Action): Promise<SessionUser> {
  const session = await getSession();

  if (!session || session.user.disabledAt || !session.user.twoFactorEnabled) {
    throw new NotAuthenticatedError();
  }

  if (!can(session.user.role, resource, action)) {
    log.warn(
      { userId: session.user.id, role: session.user.role, resource, action },
      'server action denied by permission check'
    );
    throw new AccessDeniedError(resource, action);
  }

  return session.user;
}
