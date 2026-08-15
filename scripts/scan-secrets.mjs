#!/usr/bin/env node
/**
 * Blocks commits that would leak a credential.
 *
 * Two modes:
 *   (default) scans staged content, for the pre-commit hook.
 *   --all     scans every tracked file, for CI.
 *
 * A secret committed once is compromised forever - rewriting history does not
 * help, because the value was already pushed, mirrored, and cached. So the only
 * cheap moment to catch it is before the commit exists.
 *
 * Two kinds of check:
 *   1. File names: no `.env` variant may ever be committed except `.env.example`.
 *   2. File contents: known credential shapes, plus long values assigned to
 *      suspiciously named variables.
 *
 * If a match is a genuine false positive, add the marker `secret-scan:allow` in
 * a comment on that line.
 *
 * Runs with no external tools so it works identically on Windows, macOS, Linux
 * and in CI. For a second opinion, CI additionally runs gitleaks.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const ALLOW_MARKER = 'secret-scan:allow';

/** Paths whose contents are exempt: this scanner, and the placeholder template. */
const EXEMPT_PATHS = [/^scripts\/scan-secrets\.mjs$/, /^\.env\.example$/, /^\.gitleaks\.toml$/];

/** Binary and generated files that are never worth scanning. */
const SKIP_EXTENSIONS =
  /\.(png|jpe?g|gif|webp|avif|ico|svg|pdf|woff2?|ttf|eot|zip|gz|tar|mp4|webm|lock)$/i;

const CREDENTIAL_PATTERNS = [
  {
    name: 'private key block',
    pattern: /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/,
  },
  {
    name: 'AWS access key id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
  {
    name: 'Slack token',
    pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}/,
  },
  {
    name: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: 'Stripe live key',
    pattern: /\bsk_live_[0-9a-zA-Z]{20,}\b/,
  },
  {
    name: 'OpenAI-style key',
    pattern: /\bsk-[A-Za-z0-9]{32,}\b/,
  },
  {
    name: 'signed JWT',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  },
  {
    name: 'database URL containing a password',
    // Matches a real embedded password but not the obvious placeholders.
    pattern: /\b(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^:@\s/]+:[^@\s/]{6,}@/,
    ignore: /CHANGE_ME|password|examplepass|user:pass|\$\{|<[^>]+>/i,
  },
  {
    name: 'credential assigned to a secret-sounding name',
    pattern:
      /\b(?:secret|password|passwd|token|api[_-]?key|auth[_-]?key|private[_-]?key|credential)\w*\s*[:=]\s*['"`]([^'"`\s]{16,})['"`]/i,
    // Placeholders, template interpolation, and env lookups are all fine.
    ignore:
      /CHANGE_ME|process\.env|import\.meta\.env|\$\{|\{\{|<[^>]+>|example|placeholder|redacted|xxxx|your[_-]?|dummy|sample|test[_-]?only|\b(?:null|undefined|true|false)\b/i,
  },
];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
}

const scanAll = process.argv.includes('--all');

function listFiles() {
  const args = scanAll
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'];

  return git(args)
    .split('\0')
    .map((name) => name.trim())
    .filter(Boolean);
}

function fileContent(file) {
  try {
    // In --all mode read the working tree, which is what CI has checked out.
    // Otherwise read `:file`, the staged version - the exact bytes a commit
    // would contain, which may differ from what is on disk.
    return scanAll ? readFileSync(file, 'utf8') : git(['show', `:${file}`]);
  } catch {
    return '';
  }
}

const findings = [];

function checkFileNames(files) {
  for (const file of files) {
    const base = file.split('/').pop() ?? file;
    const isEnvFile = base === '.env' || base.startsWith('.env.');
    // Any name ending `.example` is a documented placeholder template, the same
    // exception `.env.example` itself gets - see docker/.env.production.example,
    // which needs its own file because it configures Compose, not the app.
    if (isEnvFile && !base.endsWith('.example')) {
      findings.push({
        file,
        line: null,
        kind: 'environment file staged for commit',
        hint: [
          `${file} holds real configuration and must never be committed.`,
          `Unstage it with:  git restore --staged ${file}`,
          'It is already listed in .gitignore - it was probably added with `git add -f`.',
        ].join('\n'),
      });
    }
  }
}

function checkFileContents(files) {
  for (const file of files) {
    if (SKIP_EXTENSIONS.test(file)) continue;
    if (EXEMPT_PATHS.some((pattern) => pattern.test(file))) continue;

    const content = fileContent(file);
    if (!content || content.includes('\u0000')) continue;

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes(ALLOW_MARKER)) return;

      for (const { name, pattern, ignore } of CREDENTIAL_PATTERNS) {
        if (!pattern.test(line)) continue;
        if (ignore?.test(line)) continue;

        findings.push({
          file,
          line: index + 1,
          kind: name,
          hint: [
            'Move the value into .env.local and read it through src/lib/env instead.',
            `If this is genuinely not a secret, append a comment containing ${ALLOW_MARKER} to that line.`,
          ].join('\n'),
        });
        break;
      }
    });
  }
}

const files = listFiles();

if (files.length === 0) {
  process.exit(0);
}

checkFileNames(files);
checkFileContents(files);

if (findings.length === 0) {
  console.log(`Secret scan: ${files.length} ${scanAll ? 'tracked' : 'staged'} file(s) clean.`);
  process.exit(0);
}

console.error(
  scanAll
    ? '\nPossible credentials found in tracked files.\n'
    : '\nCommit blocked: possible credentials found in staged changes.\n'
);
for (const finding of findings) {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  console.error(`  ${location}`);
  console.error(`    ${finding.kind}`);
  for (const hintLine of finding.hint.split('\n')) {
    console.error(`    ${hintLine}`);
  }
  console.error('');
}
console.error(
  'If a secret has ALREADY been committed or pushed, rotate it immediately - removing it from\n' +
    'git history does not make the old value safe again.\n'
);
process.exit(1);
