/**
 * Writes the animation data the GSix hub's LokDex needs to draw this game's
 * cards as moving pixel models (`apps/hub/public/lokdex/survivor616.art.json`
 * in the Gsixhub repo).
 *
 *   node --import tsx scripts/export-lokdex-art.ts <output.json>
 *
 * This is the same procedural data the game draws its own binder from (a rig
 * of pixel rectangles plus a palette, idle/walk clips only) -- never a bitmap
 * and never the reference sheets in public/art. Rigs are de-duplicated: every
 * LokPet of one silhouette shares a single rig and only differs by palette.
 * Re-run and copy the file whenever cards or rigs change.
 */
import { writeFileSync } from 'node:fs';
import { CARD_MANIFESTS, type LokDeckCardMetadata } from '../src/game/data/cards';
import { ALLIES, allyRig } from '../src/game/data/progression';
import { CHARACTERS } from '../src/game/data/characters';
import { ENEMIES } from '../src/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID, lokPetSpritePalette } from '../src/game/data/lokPets';
import { evolvedRig } from '../src/game/engine/petEvolution';
import type { SpriteRig } from '../src/game/types';
import { LOKDEX_APP_KEY } from '../src/lib/lokDexSnapshot';

type SlimRig = Pick<SpriteRig, 'pixelHeight' | 'parts'> & { anims: Pick<SpriteRig['anims'], 'idle' | 'walk'> };
const slim = (rig: SpriteRig): SlimRig => ({ pixelHeight: rig.pixelHeight, parts: rig.parts, anims: { idle: rig.anims.idle, walk: rig.anims.walk } });

const rigs: Record<string, SlimRig> = {};
const cards: Record<string, { rig: string; palette: object; anim: 'idle' | 'walk' }> = {};

function add(cardId: string, rigKey: string, rig: SpriteRig, palette: object, anim: 'idle' | 'walk') {
  rigs[rigKey] ??= slim(rig);
  cards[cardId] = { rig: rigKey, palette, anim };
}

for (const card of CARD_MANIFESTS) {
  const meta = card.metadata as LokDeckCardMetadata;
  const id = meta.subjectId;
  if (meta.subjectType === 'character') {
    const character = CHARACTERS.find((entry) => entry.id === id);
    if (character) add(card.id, `character:${id}`, character.rig, character.palette, 'idle');
  } else if (meta.subjectType === 'enemy') {
    const enemy = ENEMIES.find((entry) => entry.id === id);
    if (enemy) add(card.id, `enemy:${id}`, enemy.rig, enemy.palette, 'walk');
  } else if (meta.subjectType === 'ally') {
    const ally = ALLIES.find((entry) => entry.id === id);
    if (ally) add(card.id, `ally:${id}`, allyRig(ally), ally.palette, 'idle');
  } else if (meta.subjectType === 'lokpet') {
    const variant = LOKPET_VARIANTS_BY_ID[id];
    if (variant) add(card.id, `pet:${variant.silhouette}`, evolvedRig(variant.silhouette, undefined), lokPetSpritePalette(variant.palette), 'idle');
  }
  // Endless discoveries are not creatures; the hub draws its crest for them.
}

const out = process.argv[2];
if (!out) throw new Error('usage: export-lokdex-art.ts <output.json>');
const file = { schema: 'lok.dex-art', version: 1, appKey: LOKDEX_APP_KEY, rigs, cards };
writeFileSync(out, JSON.stringify(file));
console.log(`wrote ${Object.keys(cards).length} cards on ${Object.keys(rigs).length} rigs to ${out}`);
