/**
 * Pulls result_url from each *-result.json in reference/generated-raw
 * and writes the PNG next to it. Windows curl needs --ssl-no-revoke.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const RAW = path.join(process.cwd(), 'reference', 'generated-raw');
const names = [
  'hero',
  'flower-frocks',
  'galle-wax',
  'batik-sarong',
  'mens-cotton',
  'womens-office',
  'mens-office',
  'offer-april',
];

for (const name of names) {
  const file = path.join(RAW, `${name}-result.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    process.stderr.write(`skip ${name}: no result json\n`);
    continue;
  }
  const job = Array.isArray(data) ? data[0] : data;
  const url = job?.result_url;
  if (!url) {
    process.stderr.write(`skip ${name}: no result_url\n`);
    continue;
  }
  const out = path.join(RAW, `${name}.png`);
  process.stderr.write(`downloading ${name}…\n`);
  execFileSync('curl.exe', ['--ssl-no-revoke', '-L', '-o', out, url]);
}

process.stderr.write(
  `also listing leftover json: ${readdirSync(RAW)
    .filter((n) => n.endsWith('-result.json'))
    .join(', ')}\n`
);
