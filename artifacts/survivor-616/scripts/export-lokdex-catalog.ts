/**
 * Writes this game's card catalog as the JSON the GSix hub's LokDex renders
 * against (`apps/hub/lib/lokdex/catalog-survivor616.json` in the Gsixhub repo).
 *
 *   node --import tsx scripts/export-lokdex-catalog.ts <output.json>
 *
 * Re-run and copy the file whenever cards are added. The hub only ever shows
 * the colour/rarity/name here -- 616 Survivor's characters are drawn by its own
 * procedural rigs and no art leaves the game.
 */
import { writeFileSync } from 'node:fs';
import { CARD_MANIFESTS, CARD_PACKS, type LokDeckCardMetadata } from '../src/game/data/cards';
import { CHARACTERS } from '../src/game/data/characters';
import { ENEMIES } from '../src/game/data/enemies';
import { LOKPET_VARIANTS_BY_ID } from '../src/game/data/lokPets';
import { LOKDEX_APP_KEY } from '../src/lib/lokDexSnapshot';

const KIND_SUBTITLE: Record<LokDeckCardMetadata['subjectType'], string> = {
  character: 'Operative',
  enemy: 'Night shift threat',
  ally: 'Hideout crew',
  lokpet: 'LokPet',
  discovery: 'Endless discovery',
};

function accentFor(subjectType: LokDeckCardMetadata['subjectType'], subjectId: string): string | undefined {
  if (subjectType === 'lokpet') return LOKPET_VARIANTS_BY_ID[subjectId]?.palette.accent;
  const record = subjectType === 'character'
    ? CHARACTERS.find((entry) => entry.id === subjectId)
    : subjectType === 'enemy'
      ? ENEMIES.find((entry) => entry.id === subjectId)
      : undefined;
  return (record as { palette?: { accent?: string } } | undefined)?.palette?.accent;
}

const catalog = {
  appKey: LOKDEX_APP_KEY,
  name: '616 Survivor',
  sets: CARD_PACKS.map((pack) => ({ id: pack.id, name: pack.name })),
  cards: CARD_MANIFESTS.map((card) => {
    const meta = card.metadata as LokDeckCardMetadata;
    return {
      id: card.id,
      number: meta.cardNumber,
      name: card.name,
      subtitle: KIND_SUBTITLE[meta.subjectType],
      description: card.description,
      rarity: card.rarity,
      kind: meta.subjectType,
      set: meta.setId,
      tags: (card.tags ?? []).slice(0, 3),
      accent: accentFor(meta.subjectType, meta.subjectId),
    };
  }),
};

const out = process.argv[2];
if (!out) throw new Error('usage: export-lokdex-catalog.ts <output.json>');
writeFileSync(out, `${JSON.stringify(catalog, null, 1)}\n`);
console.log(`wrote ${catalog.cards.length} cards in ${catalog.sets.length} sets to ${out}`);
