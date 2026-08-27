/**
 * Commission the public-site campaign photography through the Higgsfield CLI.
 *
 * Why a script, not a handful of shell commands: PowerShell mangles long prompts,
 * and the house rule is to write the prompt to a file first. This reads those
 * files, submits the jobs, and writes the JSON results next to them.
 *
 *   node scripts/generate-campaign.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RAW = path.join(ROOT, 'reference', 'generated-raw');

mkdirSync(RAW, { recursive: true });

const SOULS = {
  maya: '162d4995-6ce8-42ca-803c-848f51768972',
  viana: 'e8730527-e452-4b1b-8a2b-6e2adf64de95',
  skyler: 'd1a83c1b-cdd9-4b4e-8bcf-9acb34611386',
};

function run(jobType, args, prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'higgsfield',
      ['generate', 'create', jobType, ...args, '--wait', '--wait-timeout', '15m', '--json'],
      { stdio: ['pipe', 'pipe', 'pipe'], shell: true }
    );

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
        reject(new Error(`${jobType} failed (${code}): ${stderr || stdout}`));
        return;
      }
      resolve(stdout);
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

const jobs = [
  {
    name: 'maya-anchor',
    type: 'soul_cinematic',
    args: ['--custom_reference_id', SOULS.maya, '--aspect_ratio', '3:4', '--quality', '2k'],
  },
  {
    name: 'viana-anchor',
    type: 'soul_cinematic',
    args: ['--custom_reference_id', SOULS.viana, '--aspect_ratio', '3:4', '--quality', '2k'],
  },
  {
    name: 'skyler-anchor',
    type: 'text2image_soul_v2',
    args: ['--custom_reference_id', SOULS.skyler, '--aspect_ratio', '3:4', '--quality', '2k'],
  },
  {
    name: 'arun-anchor',
    type: 'nano_banana_pro',
    args: ['--aspect_ratio', '3:4', '--resolution', '2k'],
  },
];

for (const job of jobs) {
  const prompt = readFileSync(path.join(RAW, `${job.name}.txt`), 'utf8').trim();
  process.stderr.write(`submitting ${job.name}…\n`);
  try {
    const stdout = await run(job.type, job.args, prompt);
    writeFileSync(path.join(RAW, `${job.name}-result.json`), stdout);
    process.stderr.write(`done ${job.name}\n`);
  } catch (error) {
    process.stderr.write(`failed ${job.name}: ${error.message}\n`);
    writeFileSync(path.join(RAW, `${job.name}-error.txt`), String(error));
  }
}
