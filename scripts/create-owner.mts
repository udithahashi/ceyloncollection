/**
 * Creates the first owner account.
 *
 * There is no sign-up page, so the very first account has to be made from a
 * terminal by someone with access to the server:
 *
 *   npm run auth:create-owner
 *
 * It refuses to run if any account already exists. After that, accounts are made by
 * inviting them from the Team page, which is the path that leaves an audit trail.
 *
 * Answers can also be piped in, four lines in this order - name, email, password,
 * password again - for provisioning a server without a person sitting at it:
 *
 *   printf 'Name\nme@example.com\nlong passphrase\nlong passphrase\n' | npm run auth:create-owner
 *
 * Prefer the interactive form where you can. A piped password is one that was
 * written down somewhere first.
 */
// Must come first: it populates process.env before the env module validates it.
import './load-env.mts';

import { stdin, stdout } from 'node:process';
import { createInterface, type Interface } from 'node:readline';

import { sql } from '../src/db/client';
import { countAccounts, createAccount } from '../src/features/auth/create-account';
import { roles } from '../src/lib/auth/roles';

const MIN_PASSWORD_LENGTH = 12;

type Validator = (value: string) => string | null;

interface Prompter {
  ask(question: string, validate: Validator, options?: { secret?: boolean }): Promise<string>;
  close(): void;
}

/**
 * Reads answers from a terminal, re-asking until each one is valid.
 *
 * Secret answers are masked. Node's readline echoes whatever is typed, which for a
 * password means leaving it on screen in an office, in a screen share, and in the
 * scrollback of whoever uses the terminal next.
 */
function createTtyPrompter(): Prompter {
  let masking = false;

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });

  // Replacing the writer is the documented way to mask input: readline routes every
  // echoed keystroke through it.
  const readline = rl as Interface & {
    _writeToOutput?: (value: string) => void;
    output?: { write: (value: string) => void };
  };
  readline._writeToOutput = (value: string) => {
    if (!masking) {
      readline.output?.write(value);
      return;
    }
    // Keep the prompt itself visible, mask everything after it.
    if (value.includes('\n')) readline.output?.write('\n');
    else readline.output?.write('*');
  };

  const question = (text: string): Promise<string> =>
    new Promise((resolve) => rl.question(text, resolve));

  return {
    async ask(text, validate, options = {}) {
      for (;;) {
        masking = options.secret ?? false;
        const answer = (await question(text)).trim();
        masking = false;
        if (options.secret) stdout.write('\n');

        const problem = validate(answer);
        if (!problem) return answer;
        console.error(`  ${problem}`);
      }
    },
    close: () => rl.close(),
  };
}

/**
 * Reads answers from piped input.
 *
 * The whole of stdin is read up front rather than line by line. A pipe reaches
 * end-of-file almost immediately, and a reader that asks for one line at a time
 * finds the stream already closed by the time it gets to the second question.
 */
async function createPipedPrompter(): Promise<Prompter> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));

  const lines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  let index = 0;

  return {
    async ask(text, validate) {
      const answer = (lines[index++] ?? '').trim();
      const problem = validate(answer);
      if (problem) {
        throw new Error(`Piped answer ${index} (${text.trim()}) is not usable: ${problem}`);
      }
      return answer;
    },
    close: () => {},
  };
}

async function main(): Promise<void> {
  const existing = await countAccounts();

  if (existing > 0) {
    console.error(
      `\nThere ${existing === 1 ? 'is already 1 account' : `are already ${existing} accounts`} in this database.\n` +
        'Create further accounts by inviting them from the Team page, so the action is logged.\n'
    );
    process.exitCode = 1;
    return;
  }

  const prompter = stdin.isTTY ? createTtyPrompter() : await createPipedPrompter();

  try {
    console.log('\nCreating the first owner account.');
    console.log('This account can do everything, including inviting other people.\n');

    const name = await prompter.ask('Full name: ', (value) =>
      value.length < 2 ? 'Enter at least 2 characters.' : null
    );

    const email = await prompter.ask('Email address: ', (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'That does not look like an email address.'
    );

    const password = await prompter.ask(
      `Password (at least ${MIN_PASSWORD_LENGTH} characters, a short sentence works well): `,
      (value) =>
        value.length < MIN_PASSWORD_LENGTH
          ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
          : null,
      { secret: true }
    );

    await prompter.ask(
      'Type it again to confirm: ',
      (value) => (value === password ? null : 'Those do not match.'),
      { secret: true }
    );

    const { id } = await createAccount({ name, email, password, role: roles[0] });

    console.log(`\nOwner account created for ${email} (${id}).`);
    console.log('Sign in at /login. You will be asked to set up two-factor immediately.\n');
  } finally {
    prompter.close();
  }
}

try {
  await main();
} catch (error) {
  console.error('\nCould not create the account:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  // Without this the pool keeps the process alive and the script appears to hang.
  await sql.end({ timeout: 5 });
}
