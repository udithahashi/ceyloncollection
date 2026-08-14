/**
 * Walks the whole authentication flow against the real database.
 *
 * The Server Actions in src/features/auth cannot be called from a test: they need a
 * Next.js request scope for `headers()` and `redirect()`. What they mostly do,
 * though, is orchestrate `auth.api.*` calls, and those are ordinary functions. This
 * script drives the same calls in the same order, threading cookies by hand the way
 * a browser would, and asserts the properties the design rests on:
 *
 *   - a wrong password is rejected
 *   - an enrolled user gets no session until the second factor is verified
 *   - a TOTP code derived from the shared secret is accepted
 *   - a backup code works once and only once
 *
 *   npm run auth:probe
 *
 * It creates its own throwaway account with a random password and deletes it at the
 * end, so it needs no credentials and touches nothing real. It is a script rather
 * than a Vitest suite because it needs Postgres running, and `npm run verify` has to
 * pass on a machine with no containers.
 */
// Must come first: it populates process.env before the env module validates it.
import './load-env.mts';

import { createHash, randomUUID } from 'node:crypto';

import { base32 } from '@better-auth/utils/base32';
import { createOTP } from '@better-auth/utils/otp';
import { eq, inArray } from 'drizzle-orm';

import { db, sql } from '../src/db/client';
// Imported from the modules rather than the barrel: Node cannot resolve a named
// import through a chain of `export *` re-exports in a script run by tsx.
import { appUser } from '../src/db/schema/auth';
import { invitation } from '../src/db/schema/invitation';
import { createAccount } from '../src/features/auth/create-account';
import {
  acceptInvitation,
  createInvitation,
  findLiveInvitation,
  InvitationExistsError,
  InvitationNotValidError,
  revokeInvitation,
} from '../src/features/team/invitations';
import { auth } from '../src/lib/auth';
import { redis } from '../src/lib/redis/client';

const email = `auth-probe+${randomUUID().slice(0, 8)}@ceyloncollection.invalid`;
const password = `probe-${randomUUID()}`;

let failures = 0;

function check(label: string, passed: boolean, detail?: unknown): void {
  if (passed) {
    console.log(`  ok    ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL  ${label}`);
  if (detail !== undefined) console.error(`        ${JSON.stringify(detail)}`);
}

function step(label: string): void {
  console.log(`\n${label}`);
}

/**
 * The browser's cookie jar, minus the parts that do not matter here: no domain or
 * path matching, because every request goes to one origin.
 */
class Jar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';');
      const separator = pair?.indexOf('=') ?? -1;
      if (!pair || separator < 1) continue;

      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      // An empty value, or Max-Age=0, is how a server deletes a cookie. The
      // two-factor plugin relies on this to revoke the session it created before it
      // noticed the account had an authenticator.
      if (value === '' || /max-age=0/i.test(header)) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  get header(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  has(fragment: string): boolean {
    return [...this.cookies.keys()].some((name) => name.includes(fragment));
  }

  clear(): void {
    this.cookies.clear();
  }
}

const jar = new Jar();

function requestHeaders(): Headers {
  const headers = new Headers();
  const cookie = jar.header;
  if (cookie) headers.set('cookie', cookie);
  return headers;
}

/**
 * Calls a Better Auth endpoint the way a browser would: cookies in, cookies out,
 * body parsed. Returns the status rather than throwing, so a rejection can be
 * asserted on instead of caught.
 */
async function call<T>(
  endpoint: unknown,
  body: Record<string, unknown> = {}
): Promise<{ status: number; body: T | undefined }> {
  // Better Auth types each endpoint with its own exact body shape, which is what you
  // want at a call site and unusable in a helper that drives eleven of them. The cast
  // is the price of one generic caller; the bodies below are checked against the real
  // endpoints by the assertions, not by the compiler.
  const invoke = endpoint as (args: {
    body: Record<string, unknown>;
    headers: Headers;
    asResponse: true;
  }) => Promise<Response>;

  let response: Response;

  try {
    response = await invoke({ body, headers: requestHeaders(), asResponse: true });
  } catch (error) {
    const status = (error as { statusCode?: number; status?: number }).statusCode ?? 500;
    return { status, body: undefined };
  }

  jar.absorb(response);

  const text = await response.text();
  try {
    return { status: response.status, body: text ? (JSON.parse(text) as T) : undefined };
  } catch {
    return { status: response.status, body: undefined };
  }
}

async function currentSession(): Promise<{ userId: string; role: string } | null> {
  const session = await auth.api.getSession({ headers: requestHeaders() });
  if (!session) return null;
  return { userId: session.user.id, role: (session.user as { role?: string }).role ?? '' };
}

/**
 * Derives the code an authenticator app would be showing right now.
 *
 * The `secret` parameter in an otpauth URI is base32, which is what phone apps
 * expect, but Better Auth signs with the undecoded secret string. So this decodes
 * the URI's secret back to that string, exactly as a phone does before signing. If
 * the two ever disagree, every code a real authenticator produces would be rejected
 * - which is precisely the bug this step exists to catch.
 */
function totpFrom(uri: string): Promise<string> {
  const encoded = new URL(uri).searchParams.get('secret');
  if (!encoded) throw new Error('no secret in the otpauth URI');
  const secret = new TextDecoder().decode(base32.decode(encoded));
  return createOTP(secret, { digits: 6, period: 30 }).totp();
}

/**
 * Fetches an invitation link, or null if nothing is listening.
 *
 * Follows no redirects, because being redirected is the interesting failure: it is
 * what happens when the proxy does not know the path is public.
 */
async function fetchInvitationPage(url: string): Promise<{ status: number; html: string } | null> {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    return { status: response.status, html: await response.text() };
  } catch {
    return null;
  }
}

let accountId = '';
/** Everything the probe creates, so the finally block can remove all of it. */
const invitationIds: string[] = [];
const inviteeIds: string[] = [];

try {
  step('0. create a throwaway account');
  {
    const created = await createAccount({
      name: 'Auth Probe',
      email,
      password,
      role: 'manager',
    });
    accountId = created.id;
    check(`created ${email}`, accountId !== '');

    const [row] = await db
      .select({ role: appUser.role, verified: appUser.emailVerified })
      .from(appUser)
      .where(eq(appUser.id, accountId));
    check('the requested role was stored', row?.role === 'manager', row);
    check('email is pre-verified, since an admin created the account', row?.verified === true);
  }

  step('1. wrong password');
  {
    const { status } = await call(auth.api.signInEmail, { email, password: `${password}-wrong` });
    check('rejected', status === 401 || status === 403, { status });
    check('no session cookie was set', !jar.has('session_token'));
  }

  step('2. correct password, no authenticator enrolled');
  {
    jar.clear();
    const { status, body } = await call<{ twoFactorRedirect?: boolean }>(auth.api.signInEmail, {
      email,
      password,
    });
    check('accepted', status === 200, { status });
    check('not sent to the two-factor prompt', body?.twoFactorRedirect !== true);
    check('session cookie was set', jar.has('session_token'));

    const session = await currentSession();
    check('session resolves to the right account', session?.userId === accountId);
    check(`role is carried on the session (${session?.role})`, session?.role === 'manager');
  }

  step('3. enrol two-factor');
  let totpURI = '';
  let backupCodes: string[] = [];
  {
    const wrong = await call(auth.api.enableTwoFactor, { password: `${password}-wrong` });
    check('a wrong password cannot start enrolment', wrong.status >= 400, { status: wrong.status });

    const { status, body } = await call<{ totpURI: string; backupCodes: string[] }>(
      auth.api.enableTwoFactor,
      { password }
    );
    check('enrolment started', status === 200, { status });

    totpURI = body?.totpURI ?? '';
    backupCodes = body?.backupCodes ?? [];

    check('returned an otpauth URI', totpURI.startsWith('otpauth://totp/'));
    check('URI carries a secret', new URL(totpURI).searchParams.get('secret') !== null);
    check('URI names the issuer', decodeURIComponent(totpURI).includes('Ceylon Collection'));
    check(`returned backup codes (${backupCodes.length})`, backupCodes.length > 0);
  }

  step('4. confirm enrolment with a code derived from the secret');
  {
    const bad = await call(auth.api.verifyTOTP, { code: '000000' });
    check('a wrong code is rejected', bad.status >= 400, { status: bad.status });

    const { status } = await call(auth.api.verifyTOTP, { code: await totpFrom(totpURI) });
    check('the right code is accepted', status === 200, { status });

    const [row] = await db
      .select({ enabled: appUser.twoFactorEnabled })
      .from(appUser)
      .where(eq(appUser.id, accountId));
    check('two-factor is now active on the account', row?.enabled === true);
  }

  step('5. sign out');
  {
    const { status } = await call(auth.api.signOut);
    check('signed out', status === 200, { status });
    check('no session remains', (await currentSession()) === null);
  }

  step('6. sign in with two-factor enrolled');
  {
    jar.clear();
    const { status, body } = await call<{ twoFactorRedirect?: boolean }>(auth.api.signInEmail, {
      email,
      password,
    });
    check('password accepted', status === 200, { status });
    check('sent to the two-factor prompt', body?.twoFactorRedirect === true);

    // The property the whole design rests on: a correct password alone is not a
    // session.
    check('password alone grants no session', (await currentSession()) === null);
  }

  step('7. complete sign-in with a TOTP code');
  {
    const { status } = await call(auth.api.verifyTOTP, { code: await totpFrom(totpURI) });
    check('code accepted', status === 200, { status });
    check('session established', (await currentSession())?.userId === accountId);
  }

  step('8. a backup code works once');
  {
    await call(auth.api.signOut);
    jar.clear();

    const signIn = await call<{ twoFactorRedirect?: boolean }>(auth.api.signInEmail, {
      email,
      password,
    });
    check('challenged again', signIn.body?.twoFactorRedirect === true);

    const code = backupCodes[0] ?? '';
    const first = await call(auth.api.verifyBackupCode, { code });
    check('backup code accepted', first.status === 200, { status: first.status });
    check('session established', (await currentSession())?.userId === accountId);

    await call(auth.api.signOut);
    jar.clear();
    await call(auth.api.signInEmail, { email, password });

    const second = await call(auth.api.verifyBackupCode, { code });
    check('the same backup code is refused the second time', second.status >= 400, {
      status: second.status,
    });
    check('still no session', (await currentSession()) === null);
  }

  step('9. invitations');
  {
    const invitee = `auth-probe+invitee-${randomUUID().slice(0, 8)}@ceyloncollection.invalid`;

    const issued = await createInvitation({
      email: invitee,
      role: 'viewer',
      invitedBy: accountId,
    });
    invitationIds.push(issued.id);

    check('link points at the accept page', new URL(issued.url).pathname === '/accept-invitation');
    check('link carries the token', new URL(issued.url).searchParams.get('token') === issued.token);

    const [stored] = await db
      .select({ tokenHash: invitation.tokenHash })
      .from(invitation)
      .where(eq(invitation.id, issued.id));

    // The property that makes a leaked backup of this table harmless.
    check('only a hash of the token is stored', stored?.tokenHash !== issued.token);
    check(
      'the stored value is a sha-256 digest',
      stored?.tokenHash === createHash('sha256').update(issued.token).digest('hex')
    );

    check(
      'a fabricated token finds nothing',
      (await findLiveInvitation('not-a-real-token')) === null
    );
    check('the real token resolves', (await findLiveInvitation(issued.token))?.id === issued.id);

    const duplicate = await createInvitation({
      email: `auth-probe+dup-${randomUUID().slice(0, 8)}@ceyloncollection.invalid`,
      role: 'staff',
      invitedBy: accountId,
    }).then(
      (row) => {
        invitationIds.push(row.id);
        return 'created';
      },
      () => 'refused'
    );
    check('a second, different invitation is fine', duplicate === 'created');

    let secondForSameEmail = 'created';
    try {
      const row = await createInvitation({ email: invitee, role: 'staff', invitedBy: accountId });
      invitationIds.push(row.id);
    } catch (error) {
      secondForSameEmail = error instanceof InvitationExistsError ? 'refused' : 'threw';
    }
    check('a second open invitation for one address is refused', secondForSameEmail === 'refused');

    const accepted = await acceptInvitation({
      token: issued.token,
      name: 'Probe Invitee',
      // Deliberately not the role in the form: there is no role in the form.
      password: `invitee-${randomUUID()}`,
    });
    inviteeIds.push(accepted.userId);

    check('the account was created', accepted.userId !== '');
    check('the role came from the invitation, not the form', accepted.role === 'viewer');

    const [inviteeRow] = await db
      .select({ role: appUser.role, email: appUser.email })
      .from(appUser)
      .where(eq(appUser.id, accepted.userId));
    check('stored with the invited role', inviteeRow?.role === 'viewer');
    check('email taken from the invitation', inviteeRow?.email === invitee);

    // Single use. This is the check that matters if a link is forwarded.
    let reuse = 'accepted';
    try {
      await acceptInvitation({
        token: issued.token,
        name: 'Second Comer',
        password: `second-${randomUUID()}`,
      });
    } catch (error) {
      reuse = error instanceof InvitationNotValidError ? 'refused' : 'threw';
    }
    check('the same link cannot be used twice', reuse === 'refused');
    check('and no longer resolves', (await findLiveInvitation(issued.token)) === null);

    // A withdrawn invitation is dead even though its token is still valid-looking.
    const toRevoke = await createInvitation({
      email: `auth-probe+revoked-${randomUUID().slice(0, 8)}@ceyloncollection.invalid`,
      role: 'staff',
      invitedBy: accountId,
    });
    invitationIds.push(toRevoke.id);

    check('resolves before withdrawal', (await findLiveInvitation(toRevoke.token)) !== null);
    check(
      'withdrawal reports the address',
      (await revokeInvitation(toRevoke.id))?.email !== undefined
    );
    check('does not resolve after withdrawal', (await findLiveInvitation(toRevoke.token)) === null);
    check('withdrawing twice is refused', (await revokeInvitation(toRevoke.id)) === null);

    // An expired invitation, aged by hand rather than by waiting seven days.
    const stale = await createInvitation({
      email: `auth-probe+stale-${randomUUID().slice(0, 8)}@ceyloncollection.invalid`,
      role: 'staff',
      invitedBy: accountId,
    });
    invitationIds.push(stale.id);

    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(invitation.id, stale.id));

    check(
      'an expired invitation does not resolve',
      (await findLiveInvitation(stale.token)) === null
    );

    // The page itself, if a dev server happens to be up. Skipped rather than failed
    // when it is not: this script's job is the data layer, and requiring a running
    // server to run it would make it useless in the situation you most want it.
    const live = await createInvitation({
      email: `auth-probe+page-${randomUUID().slice(0, 8)}@ceyloncollection.invalid`,
      role: 'staff',
      invitedBy: accountId,
    });
    invitationIds.push(live.id);

    const page = await fetchInvitationPage(live.url);

    if (!page) {
      console.log('  skip  the accept page (no server on that URL)');
    } else {
      check('the accept page is reachable without a session', page.status === 200, {
        status: page.status,
      });
      check('it renders the password fields', page.html.includes('name="confirmPassword"'));
      check('it shows the invited address', page.html.includes(live.email));
      // The token has to be in the form to be submitted back, and it is already in
      // the URL, so this is not a leak. What would be a leak is the page linking
      // anywhere off-site while the token sits in the referrer, hence the noindex
      // and the strict referrer policy set in next.config.
      check('it carries the token in the form', page.html.includes('name="token"'));
      check('it asks search engines not to index', /noindex/.test(page.html));
    }
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
} finally {
  // In dependency order. `invitation.invited_by` is ON DELETE RESTRICT, so the
  // invitations have to go before the account that issued them - which is the
  // constraint doing its job: an invitation must always name who sent it.
  if (invitationIds.length > 0) {
    await db.delete(invitation).where(inArray(invitation.id, invitationIds));
  }
  if (inviteeIds.length > 0) {
    await db.delete(appUser).where(inArray(appUser.id, inviteeIds));
  }
  // Foreign keys cascade from app_user, so removing the row removes the session,
  // credential and two-factor rows with it.
  if (accountId) await db.delete(appUser).where(eq(appUser.id, accountId));

  // Both connections, then a natural exit. Calling process.exit() here instead
  // aborts the process while libuv is still closing the sockets, which on Windows
  // surfaces as an assertion failure from inside Node rather than as our result.
  await sql.end();
  await redis?.quit();
}

process.exitCode = failures === 0 ? 0 : 1;
