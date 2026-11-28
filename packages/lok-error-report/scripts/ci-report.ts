/**
 * Run a command; if it fails, document the crash: annotate the failing files and lines on the
 * pull request, write a markdown report, and add it to the job summary. Exit code is preserved.
 *   tsx scripts/ci-report.ts --step typecheck --out crash-report.md -- pnpm run typecheck
 */
import { spawn } from 'node:child_process';
import { appendFile, writeFile } from 'node:fs/promises';

import { parseCiLog, renderCiReport } from '../src/ci';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const flags = split >= 0 ? argv.slice(0, split) : argv;
const command = split >= 0 ? argv.slice(split + 1) : [];
const flag = (name: string, fallback: string): string => {
  const at = flags.indexOf(`--${name}`);
  return at >= 0 && flags[at + 1] ? flags[at + 1]! : fallback;
};

if (command.length === 0) {
  console.error('usage: ci-report.ts --step <name> [--out file] -- <command...>');
  process.exit(2);
}

const step = flag('step', command.join(' ').slice(0, 40));
const out = flag('out', `crash-report-${step.replace(/[^a-z0-9]+/gi, '-')}.md`);

const child = spawn(command.join(' '), { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (chunk: Buffer) => { process.stdout.write(chunk); log += chunk.toString('utf8'); });
child.stderr.on('data', (chunk: Buffer) => { process.stderr.write(chunk); log += chunk.toString('utf8'); });

const code: number = await new Promise((resolve) => child.on('close', (c) => resolve(c ?? 1)));

if (code !== 0) {
  const findings = parseCiLog(log, process.cwd());
  const run = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined;
  const report = renderCiReport({ step, exitCode: code, findings, tail: log.slice(-6000), run });
  await writeFile(out, report);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  // GitHub turns these into annotations on the exact file and line in the pull request.
  for (const f of findings) {
    if (f.file) console.log(`::error file=${f.file}${f.line ? `,line=${f.line}` : ''}${f.col ? `,col=${f.col}` : ''},title=${f.code ?? f.tool}::${f.message.replace(/\r?\n/g, ' ').slice(0, 300)}`);
  }
  console.error(`\nCrash report written to ${out}`);
}
process.exit(code);
