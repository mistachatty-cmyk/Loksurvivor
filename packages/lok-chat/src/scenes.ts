/**
 * Crew-to-crew scenes: small scripted exchanges between people, picked by the day so they are the same
 * for one device all day and different tomorrow. Pure and seeded. Opinion scenes are built for free from
 * `cast.relations` (A says what they think of B, B answers), so every authored opinion becomes a scene.
 */
import { expandTemplate, type Pools, type Tone } from './template';
import type { ChatCast, SceneDef, TimeBucket } from './types';

export interface ScenePerson { id: string; name: string; role: string; room?: string }

export interface SceneInput {
  /** Whole days since a fixed date; the seed for the day's picks. */
  day: number;
  people: readonly ScenePerson[];
  weather: string;
  hour: number;
  tone: Tone;
  lastRun?: { cleared: boolean; areaName: string };
  /** Scene ids shown lately, to avoid repeating. */
  used: readonly string[];
  /** How many scenes to produce. */
  count: number;
  /** Words for the weather, from `cast.weatherWords` (looked up by the caller or here). */
  rng?: () => number;
}

export interface RenderedScene { id: string; lines: Array<{ from: string; text: string }> }

const bucket = (hour: number): TimeBucket => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night');

function seeded(day: number, salt: number): () => number {
  let s = (Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const pick = <T>(items: readonly T[], rng: () => number): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;

/** Every opinion pair in the cast, as a scene id and its two speakers. */
function opinionPairs(cast: ChatCast, present: ReadonlySet<string>): Array<{ id: string; a: string; b: string }> {
  const out: Array<{ id: string; a: string; b: string }> = [];
  for (const [a, map] of Object.entries(cast.relations)) {
    if (!present.has(a)) continue;
    for (const b of Object.keys(map)) if (present.has(b)) out.push({ id: `opinion:${a}>${b}`, a, b });
  }
  return out;
}

export function pickScenes(cast: ChatCast, input: SceneInput): RenderedScene[] {
  const rng = seeded(input.day, 1);
  const present = new Set(input.people.map((p) => p.id));
  const byId = new Map(input.people.map((p) => [p.id, p] as const));
  const time = bucket(input.hour);
  const used = new Set(input.used);

  const fits = (scene: SceneDef): boolean => {
    if (scene.between && !scene.between.every((id) => present.has(id))) return false;
    if (scene.when?.weather && !scene.when.weather.includes(input.weather)) return false;
    if (scene.when?.time && !scene.when.time.includes(time)) return false;
    if (scene.when?.run && (!input.lastRun || input.lastRun.cleared !== (scene.when.run === 'cleared'))) return false;
    return true;
  };

  const authored = (cast.scenes ?? []).filter(fits);
  type Candidate = { id: string; build: () => RenderedScene };
  const candidates: Candidate[] = [];

  const render = (scene: SceneDef, aId: string, bId: string, cId?: string): RenderedScene => {
    const a = byId.get(aId)!; const b = byId.get(bId)!; const c = cId ? byId.get(cId) : undefined;
    const pools: Pools = {
      ...cast.sharedPools,
      a: [a.name], b: [b.name], c: [c?.name ?? 'someone'],
      weather: cast.weatherWords[input.weather] ?? [input.weather],
      area: [input.lastRun?.areaName ?? 'the last run'],
      time: cast.timeWords[time],
      room: [a.room ?? 'the room'],
    };
    return {
      id: scene.id,
      lines: scene.lines.map((line) => ({
        from: line.who === 'a' ? aId : line.who === 'b' ? bId : (cId ?? bId),
        text: expandTemplate(line.text, { tone: input.tone, pools }, rng),
      })),
    };
  };

  const others = (exclude: readonly string[]): string[] => input.people.map((p) => p.id).filter((id) => !exclude.includes(id));
  for (const scene of authored) {
    candidates.push({
      id: scene.id,
      build: () => {
        const [fa, fb, fc] = scene.between ?? [];
        const pool = others([]);
        const a = fa ?? pick(pool, rng);
        const b = fb ?? pick(others([a]), rng);
        const c = fc ?? (scene.lines.some((l) => l.who === 'c') ? pick(others([a, b]), rng) : undefined);
        return render(scene, a, b, c);
      },
    });
  }
  const replies = cast.sceneReplies ?? [];
  if (replies.length > 0) {
    for (const pair of opinionPairs(cast, present)) {
      candidates.push({
        id: pair.id,
        build: () => {
          const back = cast.relations[pair.b]?.[pair.a];
          return {
            id: pair.id,
            lines: [
              { from: pair.a, text: cast.relations[pair.a]![pair.b]! },
              { from: pair.b, text: back ?? expandTemplate(pick(replies, rng), { tone: input.tone, pools: { ...cast.sharedPools, a: [byId.get(pair.a)!.name], b: [byId.get(pair.b)!.name] } }, rng) },
            ],
          };
        },
      });
    }
  }

  const fresh = candidates.filter((c) => !used.has(c.id));
  const pool = fresh.length >= input.count ? fresh : candidates;
  const chosen: RenderedScene[] = [];
  const taken = new Set<string>();
  for (let guard = 0; guard < 40 && chosen.length < input.count && pool.length > 0; guard += 1) {
    const candidate = pick(pool, rng);
    if (taken.has(candidate.id)) continue;
    taken.add(candidate.id);
    chosen.push(candidate.build());
  }
  return chosen;
}
