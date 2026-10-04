/**
 * Turns saved Forge designs into playable operators.
 *
 * A forged operator is a *new* roster entry. It borrows the stats, weapon and
 * ultimate of an authored operator (its "kit") and wears its own generated body,
 * palette, name and bio. The authored operator it borrowed from is never
 * modified: every field is copied into a fresh object, and the fresh object gets
 * a fresh rig built by the Forge.
 *
 * Because forged operators are registered into the same `CHARACTERS` array as
 * everyone else, the select screens, runs, mastery and unlock bookkeeping treat
 * them as ordinary operators without any special casing.
 */
import type { CharacterDef } from '@/game/types';
import { buildOperatorRig, FORGE_ID_PREFIX, type ForgedOperator } from '@/game/data/operatorForge';
import { loadRosterForgedOperators } from '@/game/state/operatorForgeStore';

/**
 * Kits that cannot be borrowed because the engine keys extra behavior on the
 * authored id itself (a copy under a new id would silently lose it).
 */
export const FORGE_KIT_BLOCKLIST: ReadonlySet<string> = new Set(['llama-mama', 'llama-overlord', 'cluck-616']);

/** Whether an authored operator can lend its kit to forged operators. */
export function isForgeKit(character: CharacterDef): boolean {
  if (character.id.startsWith(FORGE_ID_PREFIX)) return false;
  if (FORGE_KIT_BLOCKLIST.has(character.id)) return false;
  // Legendary operators stay a reward tier; a forged copy would skip the unlock.
  if (character.rarity === 'legendary') return false;
  return true;
}

/** The playable operator for a forged design, built on a copy of `kit`. */
export function buildForgedCharacter(op: ForgedOperator, kit: CharacterDef): CharacterDef {
  return {
    ...kit,
    id: op.id,
    name: op.name,
    handle: op.handle,
    tagline: op.tagline,
    bio: op.bio,
    palette: { ...op.design.palette },
    rig: buildOperatorRig(op.design),
    unlock: { kind: 'default' },
    // Identity fields that belong to the authored operator, not to the borrowed kit.
    rarity: undefined,
    signatureTraits: undefined,
    crew: undefined,
    referenceArt: undefined,
  };
}

/**
 * Appends every saved forged operator to the roster. Called once, at the end of
 * `data/characters.ts`. Operators whose kit no longer exists or is not
 * borrowable are skipped (they stay saved, and appear again if the kit returns).
 * Authored operators are never touched; this only adds entries.
 */
export function registerForgedOperators(
  characters: CharacterDef[],
  byId: Record<string, CharacterDef>,
  saved: ForgedOperator[] = loadRosterForgedOperators(),
): CharacterDef[] {
  const added: CharacterDef[] = [];
  for (const op of saved) {
    if (byId[op.id]) continue;
    const kit = byId[op.kitId];
    if (!kit || !isForgeKit(kit)) continue;
    const forged = buildForgedCharacter(op, kit);
    characters.push(forged);
    byId[forged.id] = forged;
    added.push(forged);
  }
  return added;
}
