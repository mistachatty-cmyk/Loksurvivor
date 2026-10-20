import type { StackFrame } from './types';

const VENDOR = /\/node_modules\/|\/\.vite\/|\/@vite\/|\/@react-refresh|\/@id\/|\/chunk-[A-Za-z0-9]+\.|\/vendor[-.]|\/react-dom|\/scheduler\//;

/** Origin and query string off a script URL: `http://h:3000/src/a.tsx?t=9` becomes `/src/a.tsx`. */
export function normalizeFile(url: string): string {
  let out = url.replace(/^(?:https?|file):\/\/[^/]*/, '');
  out = out.replace(/[?#].*$/, '');
  return out || url;
}

export function isAppFile(file: string | undefined): boolean {
  if (!file) return false;
  if (file.startsWith('<') || file === 'native') return false;
  return !VENDOR.test(file);
}

const V8 = /^at (?:async )?(?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/;
const GECKO = /^(.*?)@(.*?):(\d+):(\d+)$/;

/** Parse an `Error.stack` from Chrome, Firefox or Safari into frames. Lines that are not frames are skipped. */
export function parseStack(stack: string | undefined, isApp: (file: string | undefined) => boolean = isAppFile): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const rawLine of stack.split('\n')) {
    const raw = rawLine.trim();
    if (!raw) continue;
    const m = V8.exec(raw) ?? GECKO.exec(raw);
    if (!m) continue;
    const file = normalizeFile(m[2] ?? '');
    const fn = (m[1] ?? '').trim() || undefined;
    frames.push({ raw, fn: fn === 'Object.<anonymous>' ? undefined : fn, file, line: Number(m[3]), col: Number(m[4]), app: isApp(file) });
    if (frames.length >= 40) break;
  }
  return frames;
}

/** The first frame in the game's or app's own code, if any. */
export function topAppFrame(frames: readonly StackFrame[]): StackFrame | undefined {
  return frames.find((f) => f.app);
}

/** React's component stack, one component per entry. */
export function parseComponentStack(stack: string | null | undefined): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .map((line) => line.trim().replace(/^at\s+/, '').replace(/https?:\/\/[^/\s)]+/g, '').replace(/\?[^:\s)]*(?=:\d)/g, ''))
    .filter(Boolean)
    .slice(0, 20);
}
