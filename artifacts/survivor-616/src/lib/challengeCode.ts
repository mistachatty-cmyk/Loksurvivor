/**
 * Challenge codes: a short text that says "this block, this night". Anyone who enters the same code
 * gets the same seed, so waves, objectives and loot rolls come out the same, and you can compare how
 * far each of you got. Nothing is stored anywhere: a code is just the map id and the seed, with a
 * check character so a typo is caught. It travels by text, chat or paper, so no server is involved.
 *
 *   616.back-alley.1k3f.q
 */

const PREFIX = '616';
const MAX_SEED = 1_000_000;

function checkChar(areaId: string, seed: number): string {
  let sum = seed;
  for (let i = 0; i < areaId.length; i += 1) sum = (sum * 31 + areaId.charCodeAt(i)) % 1_000_003;
  return (sum % 36).toString(36);
}

/** Codes are lower case, so a map id like `bubbleWash` travels as `bubblewash` and is matched back by name. */
export function encodeChallenge(areaId: string, seed: number): string | null {
  if (!/^[A-Za-z0-9-]+$/.test(areaId)) return null;
  if (!Number.isInteger(seed) || seed < 0 || seed >= MAX_SEED) return null;
  const id = areaId.toLowerCase();
  return `${PREFIX}.${id}.${seed.toString(36)}.${checkChar(id, seed)}`;
}

export type ChallengeParse =
  | { ok: true; areaId: string; seed: number }
  | { ok: false; reason: 'format' | 'check' | 'area' };

/** Reads a typed or pasted code. `knownAreaIds` keeps codes for maps this build does not have out. */
export function decodeChallenge(input: string, knownAreaIds: Iterable<string>): ChallengeParse {
  const parts = input.trim().toLowerCase().split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return { ok: false, reason: 'format' };
  const [, areaId, seedText, check] = parts as [string, string, string, string];
  if (!/^[a-z0-9-]+$/.test(areaId) || !/^[a-z0-9]{1,5}$/.test(seedText) || !/^[a-z0-9]$/.test(check)) return { ok: false, reason: 'format' };
  const seed = parseInt(seedText, 36);
  if (!Number.isInteger(seed) || seed >= MAX_SEED) return { ok: false, reason: 'format' };
  if (checkChar(areaId, seed) !== check) return { ok: false, reason: 'check' };
  for (const known of knownAreaIds) if (known.toLowerCase() === areaId) return { ok: true, areaId: known, seed };
  return { ok: false, reason: 'area' };
}
