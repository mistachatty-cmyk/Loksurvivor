/**
 * Turn the output of a failed CI step (typecheck, tests, build) into findings and a markdown
 * crash report, so a red build documents itself with the file and line that broke it.
 */

export interface CiFinding {
  tool: 'tsc' | 'node-test' | 'build' | 'other';
  file?: string;
  line?: number;
  col?: number;
  code?: string;
  message: string;
}

const TSC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const TSC_PRETTY = /^(.+?):(\d+):(\d+) - error (TS\d+): (.*)$/;
const NOT_OK = /^\s*not ok \d+ - (.*)$/;
const AT_FILE = /\(?(?:file:\/\/)?(\/[^\s():]+\.[a-z]+):(\d+):(\d+)\)?\s*$/;
const BUILD = /^(?:\[vite\]|error during build:|✗ Build failed)(.*)$/i;
const ERROR_LINE = /^\s*(?:error|message): ['"]?(.*?)['"]?,?$/;

/** Make absolute runner paths repo-relative. */
export function relativize(file: string, cwd: string): string {
  const base = cwd.endsWith('/') ? cwd : `${cwd}/`;
  return file.startsWith(base) ? file.slice(base.length) : file.replace(/^.*\/(?:work\/[^/]+\/[^/]+\/)/, '');
}

export function parseCiLog(log: string, cwd = ''): CiFinding[] {
  const findings: CiFinding[] = [];
  const lines = log.split('\n').map((l) => l.replace(/\r$/, ''));
  let currentTest: string | null = null;
  let currentMessage = '';
  for (const line of lines) {
    const tsc = TSC.exec(line) ?? TSC_PRETTY.exec(line);
    if (tsc) {
      findings.push({ tool: 'tsc', file: relativize(tsc[1]!, cwd), line: Number(tsc[2]), col: Number(tsc[3]), code: tsc[4], message: tsc[5]! });
    } else if (NOT_OK.test(line)) {
      currentTest = NOT_OK.exec(line)![1]!;
      currentMessage = '';
    } else if (currentTest) {
      const err = ERROR_LINE.exec(line);
      if (err && !currentMessage) currentMessage = err[1]!;
      const at = AT_FILE.exec(line);
      if (at && !/node_modules|node:internal/.test(line)) {
        findings.push({ tool: 'node-test', file: relativize(at[1]!, cwd), line: Number(at[2]), col: Number(at[3]), message: `${currentTest}${currentMessage ? `: ${currentMessage}` : ''}` });
        currentTest = null;
      }
    } else {
      const build = BUILD.exec(line);
      if (build) findings.push({ tool: 'build', message: (build[1] ?? '').trim() || line.trim() });
    }
    if (findings.length >= 40) break;
  }
  if (findings.length === 0) {
    const tail = lines.filter((l) => /error|failed/i.test(l)).slice(0, 5).join(' | ');
    if (tail) findings.push({ tool: 'other', message: tail.slice(0, 400) });
  }
  return findings;
}

export function renderCiReport(input: { step: string; exitCode: number; findings: readonly CiFinding[]; tail: string; run?: string }): string {
  const lines = [
    `# CI crash: ${input.step}`,
    '',
    `The \`${input.step}\` step failed (exit code ${input.exitCode}).${input.run ? ` Run: ${input.run}` : ''}`,
    '',
  ];
  if (input.findings.length > 0) {
    lines.push('## Where', '', '| Tool | Location | What |', '| --- | --- | --- |');
    for (const f of input.findings) {
      const where = f.file ? `\`${f.file}${f.line ? `:${f.line}` : ''}${f.col ? `:${f.col}` : ''}\`` : '-';
      lines.push(`| ${f.tool} | ${where} | ${f.code ? `${f.code}: ` : ''}${f.message.replace(/\|/g, '\\|').slice(0, 220)} |`);
    }
    lines.push('');
  }
  lines.push('## Last lines of output', '', '```', input.tail.split('\n').slice(-40).join('\n'), '```', '');
  return lines.join('\n');
}
