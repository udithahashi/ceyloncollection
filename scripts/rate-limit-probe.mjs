/**
 * Exercises the sliding-window rate limit script against the real Redis instance.
 *
 * The unit tests cover the in-memory store; this proves the Lua path behaves the
 * same way, which is the path production actually uses. Run it after touching the
 * script:
 *
 *   node scripts/rate-limit-probe.mjs
 */
import { config } from 'dotenv';
import Redis from 'ioredis';

config({ path: '.env.local', quiet: true });

const url = process.env.REDIS_URL;
if (!url) {
  console.error('REDIS_URL is not set in .env.local.');
  process.exit(1);
}

const LUA = (await import('node:fs')).readFileSync('src/lib/rate-limit/store.ts', 'utf8');
const script = LUA.split('export const SLIDING_WINDOW_SCRIPT = `')[1]?.split('`;')[0];

if (!script) {
  console.error('Could not find SLIDING_WINDOW_SCRIPT in src/lib/rate-limit/store.ts.');
  process.exit(1);
}

const redis = new Redis(url, { maxRetriesPerRequest: 2 });
redis.defineCommand('slidingWindow', { numberOfKeys: 1, lua: script });

const key = `rl:probe:${Date.now()}`;
const windowMs = 1_000;
const limit = 3;
let failures = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const call = (now) =>
  redis.slidingWindow(key, String(now), String(windowMs), String(limit), `${now}-probe`);

try {
  check('first attempt allowed, 2 left', await call(0), [1, 2, 0]);
  check('second attempt allowed, 1 left', await call(10), [1, 1, 0]);
  check('third attempt allowed, 0 left', await call(20), [1, 0, 0]);
  check('fourth attempt denied, retry in 970ms', await call(30), [0, 0, 970]);
  // A fixed window would have cleared all three attempts at 1000 and handed out a
  // fresh allowance of three. A sliding window opens exactly one slot, because
  // only the attempt at 0 has aged out.
  check('window slides: one slot opens at 1001', await call(1_001), [1, 0, 0]);
  check('and closes again immediately', await call(1_002), [0, 0, 8]);

  await redis.del(key);
  check('reset clears the window', await call(2_000), [1, 2, 0]);
} finally {
  await redis.del(key);
  redis.disconnect();
}

console.log(failures === 0 ? '\nAll probes passed.' : `\n${failures} probe(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
