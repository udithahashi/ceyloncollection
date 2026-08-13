#!/usr/bin/env node
/**
 * Blocks until PostgreSQL is ready to accept queries, or gives up.
 *
 * Docker reports a container as "running" the moment the process starts, but
 * PostgreSQL needs a few more seconds before it will answer queries - and on a
 * fresh volume it also has to initialise the whole data directory first. Any
 * script that runs migrations immediately after `dev:up` will otherwise fail
 * intermittently, which is the worst kind of failure to debug.
 */
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '..');
const TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(2000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

async function loadDatabaseUrl() {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(projectRoot, '.env.local'), quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Run `npm run setup` first.');
    process.exit(1);
  }
  return url;
}

async function main() {
  const databaseUrl = await loadDatabaseUrl();
  const { hostname, port } = new URL(databaseUrl);
  const host = hostname || '127.0.0.1';
  const tcpPort = Number(port || 5432);

  const startedAt = Date.now();
  process.stdout.write(`Waiting for PostgreSQL on ${host}:${tcpPort}`);

  const { default: postgres } = await import('postgres');

  while (Date.now() - startedAt < TIMEOUT_MS) {
    if (await canConnect(host, tcpPort)) {
      // The port is open; now confirm it will actually serve a query.
      const sql = postgres(databaseUrl, {
        max: 1,
        connect_timeout: 5,
        idle_timeout: 1,
        onnotice: () => {},
      });
      try {
        await sql`select 1`;
        await sql.end({ timeout: 3 });
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        process.stdout.write(`\nPostgreSQL is ready after ${seconds}s.\n`);
        process.exit(0);
      } catch {
        await sql.end({ timeout: 3 }).catch(() => {});
      }
    }
    process.stdout.write('.');
    await sleep(RETRY_DELAY_MS);
  }

  process.stdout.write('\n');
  console.error(
    [
      `PostgreSQL did not become ready within ${TIMEOUT_MS / 1000}s.`,
      '',
      'Try these in order:',
      '  npm run dev:status      is the db container running?',
      '  npm run dev:logs        what is the container complaining about?',
      '  npm run doctor          full environment check',
    ].join('\n')
  );
  process.exit(1);
}

main().catch((error) => {
  console.error('\nwait-for-db crashed:', error);
  process.exit(1);
});
