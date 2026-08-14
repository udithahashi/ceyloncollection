'use server';

/**
 * Authentication Server Actions.
 *
 * Better Auth's HTTP handler is deliberately not mounted at `/api/auth/*`. Doing
 * so would publish thirty-odd endpoints to the browser when this application needs
 * five, and the project has one rule about HTTP APIs: there aren't any except the
 * signed n8n routes. Instead each flow calls `auth.api.*` server-side, and the
 * `nextCookies()` plugin flushes the cookies Better Auth sets into the Next.js
 * response.
 *
 * Every action here is reachable by anyone who can reach the login page, so each
 * one validates its input and consumes a rate limit before touching a password.
 */
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { logActivity } from '@/lib/activity';
import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { auth } from '@/lib/auth';
import { getSession, TWO_FACTOR_SETUP_PATH } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';
import { renderQrSvg } from '@/lib/qr';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getRateLimitKey } from '@/lib/request-context';
import { safeRedirect } from '@/lib/safe-redirect';

import {
  backupCodeSchema,
  confirmTwoFactorSchema,
  enableTwoFactorSchema,
  signInSchema,
  twoFactorSchema,
} from './schemas';

const log = createLogger('auth-actions');

/** Where a signed-in user with 2FA pending is sent. */
const TWO_FACTOR_PATH = '/two-factor';

/**
 * Deliberately identical for "no such account" and "wrong password".
 *
 * Distinguishing them turns the login form into a tool for discovering which
 * email addresses have accounts, which is the first step of a targeted attack.
 */
const INVALID_CREDENTIALS = 'That email address and password do not match.';

/** Formats the wait as something a person can act on. */
function retryMessage(retryAfterMs: number): string {
  const seconds = Math.ceil(retryAfterMs / 1000);
  if (seconds <= 90) return `Too many attempts. Try again in ${seconds} seconds.`;
  return `Too many attempts. Try again in ${Math.ceil(seconds / 60)} minutes.`;
}

/**
 * Signs in with email and password.
 *
 * On success the user is redirected: to the two-factor prompt if they have an
 * authenticator, to enrolment if they do not. There is no path that ends with a
 * usable session and no second factor.
 */
export async function signInAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('auth.signIn', async () => {
    const parsed = parseInput(signInSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const { email, password, next } = parsed.data;
    const ipKey = await getRateLimitKey();

    // Two limits, because either alone is bypassable. Per-IP stops one machine
    // grinding through a list of accounts; per-account stops a botnet grinding
    // through passwords for one target.
    const byIp = await checkRateLimit('signIn', ipKey);
    if (!byIp.allowed) return fail(retryMessage(byIp.retryAfterMs), { code: 'rateLimited' });

    const byAccount = await checkRateLimit('signInAccount', email);
    if (!byAccount.allowed) {
      return fail(retryMessage(byAccount.retryAfterMs), { code: 'rateLimited' });
    }

    const requestHeaders = await headers();
    let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;

    try {
      result = await auth.api.signInEmail({
        body: { email, password },
        headers: requestHeaders,
      });
    } catch (error) {
      // Better Auth throws APIError for bad credentials and for a disabled
      // account. The user gets one message; the log gets the detail.
      log.warn({ err: error, email }, 'sign-in rejected');
      await logActivity({
        action: 'auth.signInFailed',
        entityType: 'appUser',
        // The email is the identifier being attacked, so it belongs in the log.
        entityLabel: email,
        metadata: { reason: 'invalidCredentials' },
      });
      return fail(INVALID_CREDENTIALS, { code: 'unauthenticated' });
    }

    // A correct password clears the counters, so two typos earlier in the day do
    // not count against someone who then signs in successfully.
    await Promise.all([resetRateLimit('signIn', ipKey), resetRateLimit('signInAccount', email)]);

    const destination = safeRedirect(next);

    // The two-factor plugin intercepts sign-in for enrolled users: it deletes the
    // session it just created, sets a short-lived challenge cookie, and reports
    // back here. There is no session yet at this point.
    if ('twoFactorRedirect' in result && result.twoFactorRedirect) {
      redirect(`${TWO_FACTOR_PATH}?next=${encodeURIComponent(destination)}`);
    }

    // No authenticator enrolled yet. Two-factor is mandatory, so the only place to
    // go is enrolment.
    await logActivity({
      action: 'auth.signIn',
      actor: { id: result.user.id, name: result.user.name, email: result.user.email },
      metadata: { twoFactor: false },
    });

    redirect(TWO_FACTOR_SETUP_PATH);
  });
}

/** Completes sign-in with a TOTP code from the authenticator app. */
export async function verifyTwoFactorAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('auth.verifyTwoFactor', async () => {
    const parsed = parseInput(twoFactorSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limit = await checkRateLimit('twoFactor', await getRateLimitKey());
    if (!limit.allowed) return fail(retryMessage(limit.retryAfterMs), { code: 'rateLimited' });

    try {
      await auth.api.verifyTOTP({
        body: { code: parsed.data.code },
        headers: await headers(),
      });
    } catch (error) {
      log.warn({ err: error }, 'two-factor verification failed');
      await logActivity({ action: 'auth.twoFactorFailed', metadata: { method: 'totp' } });
      return fail('That code is not valid. Codes expire after 30 seconds.', {
        fieldErrors: { code: ['Check the current code in your authenticator app.'] },
      });
    }

    const session = await getSession();
    if (session) {
      await logActivity({
        action: 'auth.signIn',
        actor: session.user,
        metadata: { twoFactor: 'totp' },
      });
    }

    redirect(safeRedirect(parsed.data.next));
  });
}

/**
 * Completes sign-in with a single-use backup code, for a lost or wiped phone.
 *
 * Shares the two-factor rate limit on purpose: an attacker should not get a fresh
 * allowance of guesses simply by switching form.
 */
export async function verifyBackupCodeAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('auth.verifyBackupCode', async () => {
    const parsed = parseInput(backupCodeSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limit = await checkRateLimit('twoFactor', await getRateLimitKey());
    if (!limit.allowed) return fail(retryMessage(limit.retryAfterMs), { code: 'rateLimited' });

    try {
      await auth.api.verifyBackupCode({
        body: { code: parsed.data.code },
        headers: await headers(),
      });
    } catch (error) {
      log.warn({ err: error }, 'backup code verification failed');
      await logActivity({ action: 'auth.twoFactorFailed', metadata: { method: 'backupCode' } });
      return fail('That backup code is not valid, or has already been used.', {
        fieldErrors: { code: ['Each backup code works once.'] },
      });
    }

    const session = await getSession();
    if (session) {
      await logActivity({
        action: 'auth.signIn',
        actor: session.user,
        metadata: { twoFactor: 'backupCode' },
      });
    }

    redirect(safeRedirect(parsed.data.next));
  });
}

/** What the enrolment page needs to show once a secret has been generated. */
export interface TwoFactorEnrolment {
  /** Inline SVG of the QR code, rendered server-side. */
  qrSvg: string;
  /** The shared secret, for typing in by hand when a camera is not available. */
  secret: string;
  /** Single-use codes. Shown exactly once, here. */
  backupCodes: string[];
}

/**
 * Starts two-factor enrolment: generates a secret and returns the QR code plus
 * backup codes.
 *
 * The secret is not active until a code from it has been verified, so an enrolment
 * abandoned halfway cannot lock anyone out.
 */
export async function startTwoFactorEnrolmentAction(
  _previous: ActionResult<TwoFactorEnrolment | undefined>,
  formData: FormData
): Promise<ActionResult<TwoFactorEnrolment | undefined>> {
  return runAction('auth.startTwoFactorEnrolment', async () => {
    const session = await getSession();
    if (!session) return fail('Please sign in again.', { code: 'unauthenticated' });

    const parsed = parseInput(enableTwoFactorSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limit = await checkRateLimit('twoFactor', session.user.id);
    if (!limit.allowed) return fail(retryMessage(limit.retryAfterMs), { code: 'rateLimited' });

    let totpURI: string;
    let backupCodes: string[];

    try {
      const result = await auth.api.enableTwoFactor({
        body: { password: parsed.data.password },
        headers: await headers(),
      });
      totpURI = result.totpURI;
      backupCodes = result.backupCodes;
    } catch (error) {
      log.warn({ err: error, userId: session.user.id }, 'two-factor enrolment rejected');
      return fail('That password is not correct.', {
        fieldErrors: { password: ['Check your password and try again.'] },
      });
    }

    return ok({
      qrSvg: await renderQrSvg(totpURI),
      secret: extractTotpSecret(totpURI),
      backupCodes,
    });
  });
}

/**
 * Pulls the base32 secret out of an `otpauth://` URI, for the "enter it manually"
 * fallback. Returns an empty string rather than throwing: a missing manual code is
 * a small inconvenience, a crashed enrolment page is not.
 */
function extractTotpSecret(totpURI: string): string {
  try {
    return new URL(totpURI).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

/** Confirms enrolment by verifying the first code, which activates two-factor. */
export async function confirmTwoFactorEnrolmentAction(
  _previous: ActionResult<undefined>,
  formData: FormData
): Promise<ActionResult<undefined>> {
  return runAction('auth.confirmTwoFactorEnrolment', async () => {
    const session = await getSession();
    if (!session) return fail('Please sign in again.', { code: 'unauthenticated' });

    const parsed = parseInput(confirmTwoFactorSchema, formToObject(formData));
    if (!parsed.ok) return parsed.result;

    const limit = await checkRateLimit('twoFactor', session.user.id);
    if (!limit.allowed) return fail(retryMessage(limit.retryAfterMs), { code: 'rateLimited' });

    try {
      await auth.api.verifyTOTP({
        body: { code: parsed.data.code },
        headers: await headers(),
      });
    } catch (error) {
      log.warn({ err: error, userId: session.user.id }, 'two-factor enrolment code rejected');
      return fail('That code is not valid.', {
        fieldErrors: { code: ['Enter the current 6-digit code shown in your app.'] },
      });
    }

    await logActivity({ action: 'auth.twoFactorEnabled', actor: session.user });

    redirect('/');
  });
}

/** Signs out and clears the session cookie. */
export async function signOutAction(): Promise<never> {
  const session = await getSession();

  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    // Nothing useful to tell the user: they wanted to leave, and the cookie is
    // being cleared either way.
    log.warn({ err: error }, 'sign-out failed');
  }

  if (session) {
    await logActivity({ action: 'auth.signOut', actor: session.user });
  }

  redirect('/login');
}
