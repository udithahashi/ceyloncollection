#!/usr/bin/env node
/**
 * Preflight health check for local development.
 *
 *     npm run doctor
 *
 * Checks everything that commonly goes wrong when setting this project up, and
 * for each problem prints the specific command that fixes it. Run this first
 * whenever the app misbehaves - it is faster than reading a stack trace.
 *
 * Deliberately written in plain JavaScript with no build step and no TypeScript,
 * so it still works even when the toolchain itself is broken.
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, '..');

// --- output helpers ----------------------------------------------------------

const supportsColour = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code, text) => (supportsColour ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = (t) => paint('1', t);
const dim = (t) => paint('2', t);
const green = (t) => paint('32', t);
const yellow = (t) => paint('33', t);
const red = (t) => paint('31', t);

const results = [];

function record(status, label, detail, fix) {
  results.push({ status, label, detail, fix });
  const marker =
    status === 'ok' ? green('[ ok ]') : status === 'warn' ? yellow('[warn]') : red('[fail]');
  console.log(`${marker} ${label}${detail ? dim(` - ${detail}`) : ''}`);
  if (fix && status !== 'ok') {
    for (const line of fix.split('\n')) console.log(`       ${yellow('fix:')} ${line}`);
  }
}

const ok = (label, detail) => record('ok', label, detail);
const warn = (label, detail, fix) => record('warn', label, detail, fix);
const fail = (label, detail, fix) => record('fail', label, detail, fix);

function section(title) {
  console.log(`\n${bold(title)}`);
}

// --- small utilities ---------------------------------------------------------

async function run(command, args, options = {}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      cwd: projectRoot,
      windowsHide: true,
      timeout: options.timeout ?? 20_000,
      ...options,
    });
    return { success: true, stdout: stdout.toString().trim() };
  } catch (error) {
    return {
      success: false,
      stdout: (error.stdout ?? '').toString().trim(),
      stderr: (error.stderr ?? error.message ?? '').toString().trim(),
    };
  }
}

/**
 * `docker compose ps --format json` emits a JSON array on newer Compose
 * versions and newline-delimited objects on older ones. Handle both rather than
 * betting on the user's version.
 */
function parseComposePs(stdout) {
  if (!stdout) return [];
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
}

function canConnect(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

function parseEnvFile(filePath) {
  const values = {};
  if (!existsSync(filePath)) return values;
  for (const rawLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

// --- checks ------------------------------------------------------------------

function checkNode() {
  section('Runtime');
  const major = Number(process.versions.node.split('.')[0]);
  if (Number.isNaN(major) || major < 22) {
    fail(
      'Node.js version',
      `found v${process.versions.node}, need v22 or newer`,
      'Install the current LTS from https://nodejs.org and reopen your terminal.'
    );
  } else {
    ok('Node.js version', `v${process.versions.node}`);
  }
}

function checkDependencies() {
  if (!existsSync(path.join(projectRoot, 'node_modules'))) {
    fail('Dependencies installed', 'node_modules is missing', 'npm install');
    return false;
  }
  ok('Dependencies installed', 'node_modules present');
  return true;
}

function checkEnvFile() {
  section('Configuration');
  const envPath = path.join(projectRoot, '.env.local');

  if (!existsSync(envPath)) {
    fail(
      '.env.local exists',
      'not found',
      'npm run setup    (creates .env.local with freshly generated secrets)'
    );
    return null;
  }
  ok('.env.local exists');

  const values = parseEnvFile(envPath);
  const required = [
    'APP_URL',
    'DATABASE_URL',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'N8N_WEBHOOK_SECRET',
  ];

  const missing = required.filter((key) => !values[key]);
  if (missing.length > 0) {
    fail(
      'Required variables present',
      `missing: ${missing.join(', ')}`,
      'Compare .env.local against .env.example and fill in the gaps.'
    );
  } else {
    ok('Required variables present', `${required.length} checked`);
  }

  const placeholders = Object.entries(values)
    .filter(([, value]) => /CHANGE_ME/i.test(value))
    .map(([key]) => key);
  if (placeholders.length > 0) {
    fail(
      'No placeholder values',
      `still placeholders: ${placeholders.join(', ')}`,
      "Generate a real secret with:\n  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  } else {
    ok('No placeholder values');
  }

  for (const key of ['BETTER_AUTH_SECRET', 'N8N_WEBHOOK_SECRET']) {
    const value = values[key];
    if (value && value.length < 32) {
      fail(
        `${key} length`,
        `${value.length} characters, need at least 32`,
        "node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
      );
    }
  }

  // The compose file builds the database container from POSTGRES_*, while the
  // app connects using DATABASE_URL. If they drift apart you get an
  // authentication failure that looks like a Docker problem but is not.
  if (values.DATABASE_URL && values.POSTGRES_USER && values.POSTGRES_PASSWORD) {
    const expected = `${values.POSTGRES_USER}:${values.POSTGRES_PASSWORD}@`;
    if (!values.DATABASE_URL.includes(expected)) {
      fail(
        'DATABASE_URL matches POSTGRES_* credentials',
        'they disagree',
        'Make DATABASE_URL use the same user and password as POSTGRES_USER / POSTGRES_PASSWORD,\notherwise the app cannot log in to the database container it just created.'
      );
    } else {
      ok('DATABASE_URL matches POSTGRES_* credentials');
    }
  }

  checkUploadDirectory(values);

  return values;
}

/**
 * Where lead photos will be written, and whether we can write there.
 *
 * Worth a check of its own because the failure is late and looks unrelated: everything
 * works until someone attaches a photo, and then one upload fails with a permission
 * error from deep inside the storage layer. On the VPS this directory is a mounted
 * volume, which is exactly the kind of thing that comes up owned by root.
 */
function checkUploadDirectory(values) {
  const driver = values.STORAGE_DRIVER ?? 'local';

  if (driver !== 'local') {
    warn('Upload directory', `STORAGE_DRIVER is "${driver}", so nothing is written locally`);
    return;
  }

  const configured = values.STORAGE_LOCAL_DIR ?? './storage/uploads';
  const directory = path.resolve(projectRoot, configured);

  try {
    mkdirSync(directory, { recursive: true });

    // Created and removed rather than merely checked for existence: on Windows and in a
    // container, a directory can exist and still not be writable by this process.
    const probe = path.join(directory, `.doctor-${Date.now()}`);
    writeFileSync(probe, 'ok');
    rmSync(probe);

    ok('Upload directory writable', directory);
  } catch (error) {
    fail(
      'Upload directory writable',
      `${directory}: ${error instanceof Error ? error.message : String(error)}`,
      'Lead photos are written here. Create it and give your user write access,\nor point STORAGE_LOCAL_DIR somewhere you can write.'
    );
  }
}

async function checkDocker() {
  section('Docker');

  const version = await run('docker', ['--version']);
  if (!version.success) {
    fail(
      'Docker installed',
      'the `docker` command was not found',
      'Install Docker Desktop from https://docker.com/products/docker-desktop then reopen your terminal.'
    );
    return false;
  }
  ok('Docker installed', version.stdout.replace('Docker version ', 'v'));

  const info = await run('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (!info.success) {
    fail(
      'Docker engine running',
      'the daemon did not respond',
      'Start Docker Desktop and wait for the tray whale to stop animating, then run this again.\nIf it hangs on "Starting...", run: wsl --shutdown   and reopen Docker Desktop.'
    );
    return false;
  }
  ok('Docker engine running', `engine v${info.stdout}`);

  const ps = await run('docker', [
    'compose',
    '--env-file',
    '.env.local',
    '-f',
    'docker/compose.dev.yml',
    'ps',
    '--all',
    '--format',
    'json',
  ]);

  const containers = parseComposePs(ps.stdout);
  if (!ps.success || containers.length === 0) {
    fail('Dev containers running', 'no containers found for this project', 'npm run dev:up');
    return false;
  }

  const states = new Map(
    containers.map((container) => [
      container.Service ?? container.service,
      (container.State ?? container.state ?? '').toLowerCase(),
    ])
  );

  for (const service of ['db', 'cache']) {
    const state = states.get(service);
    if (state === 'running') {
      ok(`Container "${service}"`, 'running');
    } else {
      fail(`Container "${service}"`, state ? `state is ${state}` : 'not running', 'npm run dev:up');
    }
  }

  return true;
}

async function checkServices(envValues) {
  section('Services');

  const dbReachable = await canConnect('127.0.0.1', 5433);
  if (dbReachable) {
    ok('PostgreSQL port 5433', 'accepting connections');
  } else {
    fail(
      'PostgreSQL port 5433',
      'nothing listening',
      'npm run dev:up\nIf that succeeds but this still fails, something else may hold the port:\n  netstat -ano | findstr :5433'
    );
  }

  const redisDisabled = /^(true|1|yes|on)$/i.test(envValues?.DISABLE_REDIS ?? '');
  if (redisDisabled) {
    warn(
      'Redis port 6380',
      'skipped because DISABLE_REDIS=true',
      'Fine for local work. Must be false in production.'
    );
  } else if (await canConnect('127.0.0.1', 6380)) {
    ok('Redis port 6380', 'accepting connections');
  } else {
    fail('Redis port 6380', 'nothing listening', 'npm run dev:up');
  }

  if (!dbReachable || !envValues?.DATABASE_URL) return;

  // A port being open only proves something is listening. Running a real query
  // proves the credentials and database name are right too.
  try {
    const { default: postgres } = await import('postgres');
    const sql = postgres(envValues.DATABASE_URL, {
      max: 1,
      connect_timeout: 5,
      idle_timeout: 1,
      onnotice: () => {},
    });
    try {
      const [row] = await sql`select current_database() as db, version() as version`;
      const versionLabel = String(row.version).split(' ').slice(0, 2).join(' ');
      ok('Database query', `connected to "${row.db}" on ${versionLabel}`);
    } finally {
      await sql.end({ timeout: 3 });
    }
  } catch (error) {
    fail(
      'Database query',
      error.message?.split('\n')[0] ?? 'connection failed',
      'Check that DATABASE_URL in .env.local matches the credentials in the same file,\nthen recreate the container from scratch with: npm run dev:reset'
    );
  }
}

// --- main --------------------------------------------------------------------

async function main() {
  console.log(bold('\nCeylon Collection - environment check'));
  console.log(dim(projectRoot));

  checkNode();
  const hasDependencies = checkDependencies();
  const envValues = checkEnvFile();

  const dockerUsable = await checkDocker();
  if (dockerUsable && hasDependencies) {
    await checkServices(envValues);
  }

  const failures = results.filter((r) => r.status === 'fail');
  const warnings = results.filter((r) => r.status === 'warn');

  console.log('');
  if (failures.length === 0) {
    console.log(
      green(bold('Everything checks out.')) +
        (warnings.length > 0 ? dim(` ${warnings.length} warning(s) above.`) : '')
    );
    console.log(dim('Start the app with: npm run dev'));
    console.log('');
    process.exit(0);
  }

  console.log(red(bold(`${failures.length} problem(s) need fixing:`)));
  for (const failure of failures) console.log(`  - ${failure.label}`);
  console.log(dim('\nWork through the "fix:" lines above, then run npm run doctor again.'));
  console.log('');
  process.exit(1);
}

main().catch((error) => {
  console.error(red('\nThe check itself crashed, which is a bug in scripts/doctor.mjs:'));
  console.error(error);
  process.exit(1);
});
