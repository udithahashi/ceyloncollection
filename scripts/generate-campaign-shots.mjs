/**
 * Fashion-campaign shots through Nano Banana Pro, using the character anchors
 * as likeness references. Prompts live in reference/generated-raw/<name>.txt.
 *
 *   node scripts/generate-campaign-shots.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RAW = path.join(ROOT, 'reference', 'generated-raw');

function run(args, prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('higgsfield', args, { stdio: ['pipe', 'pipe', 'pipe'], shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const shots = [
  { name: 'hero', ref: 'maya-anchor.png', ratio: '3:4' },
  { name: 'flower-frocks', ref: 'maya-anchor.png', ratio: '3:4' },
  { name: 'galle-wax', ref: 'maya-anchor.png', ratio: '3:4' },
  { name: 'batik-sarong', ref: 'arun-anchor.png', ratio: '3:4' },
  { name: 'womens-cotton', ref: 'skyler-anchor.png', ratio: '3:4' },
  { name: 'mens-cotton', ref: 'arun-anchor.png', ratio: '3:4' },
  { name: 'womens-office', ref: 'viana-anchor.png', ratio: '3:4' },
  { name: 'mens-office', ref: 'arun-anchor.png', ratio: '3:4' },
];

for (const shot of shots) {
  const prompt = readFileSync(path.join(RAW, `${shot.name}.txt`), 'utf8').trim();
  const image = path.join(RAW, shot.ref);
  process.stderr.write(`submitting ${shot.name}…\n`);
  try {
    const stdout = await run(
      [
        'generate',
        'create',
        'nano_banana_pro',
        '--aspect_ratio',
        shot.ratio,
        '--resolution',
        '2k',
        '--image',
        image,
        '--wait',
        '--wait-timeout',
        '15m',
        '--json',
      ],
      prompt
    );
    writeFileSync(path.join(RAW, `${shot.name}-result.json`), stdout);
    process.stderr.write(`done ${shot.name}\n`);
  } catch (error) {
    writeFileSync(path.join(RAW, `${shot.name}-error.txt`), String(error));
    process.stderr.write(`failed ${shot.name}: ${error.message}\n`);
  }
}
