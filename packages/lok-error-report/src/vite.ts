/**
 * Dev-only Vite plugin for LokErrorReport. It gives the browser a small endpoint
 * (`POST /__lok/error-report`) that
 *   1. maps the crash's frames back to the original source with the dev server's own source
 *      maps and returns the failing code (the "exact line" in the pop-up), and
 *   2. writes the crash to `docs/errors/<fingerprint>.md`, so crashes are documented on the
 *      repo as they happen.
 * It does nothing in a production build (`apply: 'serve'`), which also ships no source maps:
 * that is why a production crash says "LOK doesn't have access" instead of showing code.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { Plugin } from 'vite';

import { mergeIntoExisting, toMarkdown } from './format';
import { REPO_DOCS_ENDPOINT, REPO_DOCS_HEADER } from './sinks';
import type { ErrorReport, ResolvedFrame, ResolvedSource, StackFrame } from './types';

const MAX_BODY = 160_000;
const FINGERPRINT = /^[a-f0-9]{16}$/;
/** Messages starting like this are drills, not bugs. */
const SYNTHETIC = /^LokErrorReport test/;

export interface LokErrorReportPluginOptions {
  /** Where crash documents go, relative to the project root. Default `../../docs/errors` is up to the caller; the default is `docs/errors`. */
  outDir?: string;
  /** Stop writing new documents past this many (existing ones still update). */
  maxFiles?: number;
  /** Lines of code shown either side of the failing line. */
  radius?: number;
  endpoint?: string;
}

type Transform = (url: string) => Promise<{ code: string; map: unknown } | null>;

export interface HandlerDeps {
  /** Project root; sources outside it are never read. */
  root: string;
  outDir: string;
  maxFiles: number;
  radius: number;
  transform: Transform;
  io?: {
    read(file: string): Promise<string | null>;
    write(file: string, text: string): Promise<void>;
    list(dir: string): Promise<string[]>;
  };
  /** What count was last written for each crash this server run, so repeats add only the difference. */
  seen: Map<string, number>;
}

const realIo: NonNullable<HandlerDeps['io']> = {
  read: async (file) => { try { return await readFile(file, 'utf8'); } catch { return null; } },
  write: async (file, text) => { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, text); },
  list: async (dir) => { try { return await readdir(dir); } catch { return []; } },
};

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Rebuild a report from untrusted JSON, keeping only fields of the right type and size. */
export function coerceReport(input: unknown): ErrorReport | null {
  if (!input || typeof input !== 'object') return null;
  const r = input as Record<string, unknown>;
  const fingerprint = str(r.fingerprint, 32);
  if (!FINGERPRINT.test(fingerprint)) return null;
  const stack: StackFrame[] = Array.isArray(r.stack)
    ? r.stack.slice(0, 40).map((f): StackFrame => {
        const o = (f ?? {}) as Record<string, unknown>;
        return { raw: str(o.raw, 300), fn: str(o.fn, 120) || undefined, file: str(o.file, 300) || undefined, line: num(o.line), col: num(o.col), app: o.app === true };
      })
    : [];
  const ctx: ErrorReport['context'] = {};
  if (r.context && typeof r.context === 'object') {
    for (const [k, v] of Object.entries(r.context as Record<string, unknown>).slice(0, 30)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ctx[k.slice(0, 40)] = typeof v === 'string' ? v.slice(0, 160) : v;
    }
  }
  const kinds = ['render', 'error', 'rejection', 'resource', 'manual'] as const;
  const cats = ['render', 'script', 'network', 'storage', 'memory', 'resource', 'unknown'] as const;
  return {
    id: str(r.id, 20) || `LER-${fingerprint.slice(0, 6).toUpperCase()}`,
    fingerprint,
    kind: (kinds as readonly string[]).includes(str(r.kind, 12)) ? (r.kind as ErrorReport['kind']) : 'error',
    category: (cats as readonly string[]).includes(str(r.category, 12)) ? (r.category as ErrorReport['category']) : 'unknown',
    severity: r.severity === 'minor' ? 'minor' : 'crash',
    name: str(r.name, 60) || 'Error',
    message: str(r.message, 600),
    stack,
    componentStack: Array.isArray(r.componentStack) ? r.componentStack.slice(0, 20).map((c) => str(c, 200)) : undefined,
    appKey: str(r.appKey, 60),
    appVersion: str(r.appVersion, 30),
    buildId: str(r.buildId, 40),
    mode: 'dev',
    at: num(r.at) || Date.now(),
    lastAt: num(r.lastAt) || Date.now(),
    count: Math.max(1, Math.floor(num(r.count)) || 1),
    path: str(r.path, 200),
    userAgent: str(r.userAgent, 140),
    context: ctx,
    breadcrumbs: Array.isArray(r.breadcrumbs)
      ? r.breadcrumbs.slice(-30).map((b) => {
          const o = (b ?? {}) as Record<string, unknown>;
          return { at: num(o.at), type: (['error', 'nav', 'action', 'log'] as const).find((t) => t === o.type) ?? 'log', text: str(o.text, 160) };
        })
      : [],
  };
}

function inside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Map the crash's app frames to original file/line and attach a few lines of code around each. */
export async function resolveFrames(frames: readonly StackFrame[], deps: Pick<HandlerDeps, 'root' | 'radius' | 'transform' | 'io'>): Promise<ResolvedSource> {
  const io = deps.io ?? realIo;
  const out: ResolvedFrame[] = [];
  for (const frame of frames.filter((f) => f.app && f.file && f.file.startsWith('/') && f.line).slice(0, 6)) {
    try {
      const transformed = await deps.transform(frame.file!);
      if (!transformed || !transformed.map) continue;
      const map = new TraceMap(transformed.map as ConstructorParameters<typeof TraceMap>[0]);
      const pos = originalPositionFor(map, { line: frame.line!, column: Math.max(0, (frame.col ?? 1) - 1) });
      if (!pos.source || pos.line == null) continue;
      // Vite maps name sources relative to the module's own folder; absolute ones are used as they are.
      const absolute = path.isAbsolute(pos.source) ? pos.source : path.join(deps.root, path.dirname(frame.file!), pos.source);
      const display = inside(deps.root, absolute) ? path.relative(deps.root, absolute).split(path.sep).join('/') : pos.source;
      let content = map.sourcesContent?.[map.sources.indexOf(pos.source)] ?? null;
      if (content == null && inside(deps.root, absolute)) content = await io.read(absolute);
      const resolved: ResolvedFrame = { file: display, line: pos.line, col: (pos.column ?? 0) + 1, fn: frame.fn };
      if (content != null) {
        const lines = content.split('\n');
        const start = Math.max(1, pos.line - deps.radius);
        const end = Math.min(lines.length, pos.line + deps.radius);
        resolved.snippet = { startLine: start, lines: lines.slice(start - 1, end).map((l) => l.slice(0, 200)), highlight: pos.line - start };
      }
      out.push(resolved);
    } catch { /* an unreadable module just has no exact location */ }
  }
  return { frames: out };
}

export interface HandlerResult { status: number; body: unknown }

/** The whole endpoint, minus the HTTP plumbing, so it can be tested with fakes. */
export async function handleReportPost(rawBody: string, deps: HandlerDeps): Promise<HandlerResult> {
  if (rawBody.length > MAX_BODY) return { status: 413, body: { error: 'too large' } };
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return { status: 400, body: { error: 'bad json' } }; }
  const report = coerceReport((parsed as { report?: unknown } | null)?.report);
  if (!report) return { status: 400, body: { error: 'bad report' } };

  const io = deps.io ?? realIo;
  const source = await resolveFrames(report.stack, deps);
  report.source = source;

  // The file name comes from the validated hash, never from the request.
  const dir = path.resolve(deps.root, deps.outDir);
  const file = path.join(dir, `${report.fingerprint}.md`);
  if (!inside(dir, file)) return { status: 400, body: { error: 'bad path' } };

  // Crashes made on purpose (the dev test hooks) are shown but never written to the repo.
  if (SYNTHETIC.test(report.message)) return { status: 200, body: { source } };

  const before = deps.seen.get(report.fingerprint) ?? 0;
  const more = Math.max(1, report.count - before);
  deps.seen.set(report.fingerprint, report.count);
  const existing = await io.read(file);
  if (existing != null) {
    await io.write(file, mergeIntoExisting(existing, report, more));
  } else {
    const count = (await io.list(dir)).filter((n) => n.endsWith('.md') && n !== 'README.md').length;
    if (count < deps.maxFiles) await io.write(file, toMarkdown(report));
  }
  return { status: 200, body: { source } };
}

export function lokErrorReportPlugin(options: LokErrorReportPluginOptions = {}): Plugin {
  const endpoint = options.endpoint ?? REPO_DOCS_ENDPOINT;
  return {
    name: 'lok-error-report',
    apply: 'serve',
    configureServer(server) {
      const seen = new Map<string, number>();
      server.middlewares.use(endpoint, (req, res, next) => {
        if (req.method !== 'POST') { next(); return; }
        // A custom header makes this a non-simple request, which other sites' pages cannot send without a preflight we never answer.
        if (req.headers[REPO_DOCS_HEADER] !== '1') { res.statusCode = 403; res.end(); return; }
        const origin = req.headers.origin;
        if (origin && req.headers.host && new URL(origin).host !== req.headers.host) { res.statusCode = 403; res.end(); return; }
        const chunks: Buffer[] = [];
        let size = 0;
        req.on('data', (chunk: Buffer) => { size += chunk.length; if (size <= MAX_BODY + 1) chunks.push(chunk); });
        req.on('end', () => {
          const root = server.config.root;
          void handleReportPost(Buffer.concat(chunks).toString('utf8'), {
            root,
            outDir: options.outDir ?? 'docs/errors',
            maxFiles: options.maxFiles ?? 200,
            radius: options.radius ?? 3,
            seen,
            transform: async (url) => {
              const result = await server.transformRequest(url);
              return result && result.map ? { code: result.code, map: result.map } : null;
            },
          }).then((result) => {
            res.statusCode = result.status;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result.body));
          }, () => { res.statusCode = 500; res.end(); });
        });
      });
    },
  };
}
