/**
 * Creating an account.
 *
 * The one place accounts come into existence, used by two callers: accepting an
 * invitation, and the bootstrap script that creates the very first owner. Better
 * Auth's own sign-up endpoint is switched off (`disableSignUp`), so this works
 * through its internal adapter instead.
 *
 * Not a Server Action, deliberately. It is a plain module so `scripts/create-owner`
 * can import it, and so nothing here is reachable over HTTP. Every caller is
 * responsible for having established that the account is allowed to exist -
 * a valid unexpired invitation, or a human at a terminal.
 *
 * SERVER ONLY.
 */
import { auth } from '@/lib/auth';
import type { Role } from '@/lib/auth/roles';
import { createLogger } from '@/lib/logger';

const log = createLogger('create-account');

export interface CreateAccountInput {
  name: string;
  /** Lower-cased before use, so sign-in is not case sensitive. */
  email: string;
  password: string;
  role: Role;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor(readonly email: string) {
    super('An account with that email address already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

/**
 * Creates a user and its password credential.
 *
 * @throws EmailAlreadyRegisteredError if the address is taken
 */
export async function createAccount(input: CreateAccountInput): Promise<{ id: string }> {
  const context = await auth.$context;
  const email = input.email.trim().toLowerCase();

  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) throw new EmailAlreadyRegisteredError(email);

  // Hashed with whatever Better Auth is configured to use, rather than a hash of
  // our own choosing. One implementation means one thing to get right, and it
  // stays in step if the library changes its default.
  const hash = await context.password.hash(input.password);

  const user = await context.internalAdapter.createUser({
    name: input.name.trim(),
    email,
    // There is no email verification flow: an invitation link proves control of
    // the address more directly than a second email would.
    emailVerified: true,
    role: input.role,
  });

  try {
    await context.internalAdapter.linkAccount({
      userId: user.id,
      // For password sign-in Better Auth expects the user's own id as accountId
      // and the literal provider `credential`.
      accountId: user.id,
      providerId: 'credential',
      password: hash,
    });
  } catch (error) {
    // A user row with no credential cannot sign in and cannot be repaired through
    // the UI, so undo rather than leave a broken account behind.
    log.error({ err: error, userId: user.id }, 'failed to link credential, removing user');
    await context.internalAdapter.deleteUser(user.id);
    throw error;
  }

  log.info({ userId: user.id, role: input.role }, 'account created');

  return { id: user.id };
}

/** How many accounts exist. Used by the bootstrap script to refuse a second owner. */
export async function countAccounts(): Promise<number> {
  const context = await auth.$context;
  return context.internalAdapter.countTotalUsers();
}
