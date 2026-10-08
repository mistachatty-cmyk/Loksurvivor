/**
 * Procedural crew dialogue. A tiny template expander in the spirit of Rant
 * (rant-lang/rant), see .agents/memory/crew-dialogue-rant.md.
 *
 *   {a|b|c}      pick one branch; branches may nest and may be empty: {a|}
 *   {3*a|b}      weighted branch (weight 3 vs the default 1)
 *   <slot>       fill from the context pools (weather, room, food, crew ...)
 *
 * Pure and seeded: same rng gives the same line, so it is testable.
 */

export type Tone = 'family' | 'wry';

export interface CrewVoice {
  /** Opening clause. */
  openers: string[];
  /** The body of the line. Slots allowed. */
  topics: string[];
  /** Optional trailing clause. */
  closers: string[];
  /** Drier, more grown-up lines. Only used in the wry tone; still kid-safe. */
  wry: string[];
  /** Character-only fill-ins, available as <own>. */
  own: string[];
}

export type Pools = Record<string, readonly string[]>;

export interface TalkContext {
  pools: Pools;
  tone: Tone;
}

const MAX_DEPTH = 8;

interface Branch { weight: number; text: string }

/** Split on top-level `|` only, leaving nested braces alone. */
function splitBranches(body: string): Branch[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === '|' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((raw) => {
    const m = /^(\d+)\*/.exec(raw);
    return m ? { weight: Number(m[1]), text: raw.slice(m[0].length) } : { weight: 1, text: raw };
  });
}

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;
}

function expandInner(src: string, ctx: TalkContext, rng: () => number, depth: number): string {
  if (depth > MAX_DEPTH) return '';
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '{') {
      let level = 1;
      let j = i + 1;
      while (j < src.length && level > 0) {
        if (src[j] === '{') level += 1;
        if (src[j] === '}') level -= 1;
        j += 1;
      }
      const branches = splitBranches(src.slice(i + 1, j - 1));
      const total = branches.reduce((n, b) => n + b.weight, 0);
      let roll = rng() * total;
      let chosen = branches[branches.length - 1]!;
      for (const b of branches) { roll -= b.weight; if (roll < 0) { chosen = b; break; } }
      out += expandInner(chosen.text, ctx, rng, depth + 1);
      i = j;
    } else if (ch === '<') {
      const end = src.indexOf('>', i);
      if (end < 0) { out += ch; i += 1; continue; }
      const pool = ctx.pools[src.slice(i + 1, end)];
      out += pool && pool.length > 0 ? expandInner(pick(pool, rng), ctx, rng, depth + 1) : '';
      i = end + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/** Collapse spaces, fix spacing before punctuation, capitalize sentence starts. */
export function tidy(text: string): string {
  const flat = text.replace(/\s+/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
  return flat.replace(/(^|[.!?]\s+)([a-z])/g, (_m, lead: string, c: string) => lead + c.toUpperCase());
}

export function expandTemplate(src: string, ctx: TalkContext, rng: () => number): string {
  return tidy(expandInner(src, ctx, rng, 0));
}

/** Render a single line for one voice. Re-rolls to avoid anything in `recent`. */
export function generateCrewLine(
  voice: CrewVoice,
  baseCtx: TalkContext,
  rng: () => number,
  recent: readonly string[] = [],
): string {
  const ctx: TalkContext = { ...baseCtx, pools: { ...baseCtx.pools, own: voice.own } };
  let line = '';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const useWry = ctx.tone === 'wry' && voice.wry.length > 0 && rng() < 0.4;
    const template = useWry
      ? pick(voice.wry, rng)
      : `${pick(voice.openers, rng)} ${pick(voice.topics, rng)} {2*|{${pick(voice.closers, rng)}}}`;
    line = expandTemplate(template, ctx, rng);
    if (line && !recent.includes(line)) return line;
  }
  return line;
}
