/**
 * Exports every 616 Survivor customization as rows for the Lok customization table (Lok-EcoSystsem/docs/customization).
 *   pnpm exec tsx scripts/export-customization-table.ts <out.json>
 * Rows come from the game's own data, so the table can never drift from what ships.
 */
import { writeFileSync } from 'node:fs';
import { validateRows, type CustomRow, type CustomKind, type CustomEffect } from '../../../lib/lok-universe/src';
import { THEMED_PALETTES } from '../src/game/data/themedPalettes';
import { RUN_AURAS } from '../src/game/data/runAuras';
import { HATS } from '../src/game/data/hats';
import { CELEBRATIONS } from '../src/game/data/celebrations';
import { DROP_PACKS } from '../src/game/data/dropPacks';
import { LOK_SHOP_UNLOCKS } from '../src/game/data/lokShopUnlocks';
import { LOK_SHOP_PERKS } from '../src/game/data/lokShopPerks';
import { UI_THEMES } from '../src/game/data/uiThemes';
import { PACK_SKINS, CARD_BACKS, CARD_FRAMES } from '../src/game/data/cardCosmetics';
import { LOKTOKEN_PRICE_BY_TIER, catalogSku, type StoreItemKind } from '../src/lib/lokStoreCatalog';

const APP = 'survivor616';
type Src = { id: string; name: string; description: string; tier?: string; cost?: number };
const rows: CustomRow[] = [];
const add = (kind: CustomKind, list: ReadonlyArray<Src>, o: { store?: StoreItemKind; effect?: CustomEffect; concept?: string; conceptFor?: Record<string, string>; effectFor?: Record<string, CustomEffect>; scope?: (id: string) => 'shared' | 'game'; access?: (s: Src) => CustomRow['access'] } = {}): void => {
  for (const s of list) {
    const tier = s.tier ?? 'standard', sold = !!o.store && (s.cost ?? 0) > 0;
    rows.push({
      app: APP, kind, id: s.id, name: s.name, description: s.description, tier,
      access: o.access ? o.access(s) : (s.cost ?? 0) > 0 ? 'buy' : 'free',
      ...(sold ? { price: LOKTOKEN_PRICE_BY_TIER[tier] ?? LOKTOKEN_PRICE_BY_TIER.standard!, sku: catalogSku(o.store!, s.id) } : {}),
      scope: o.scope ? o.scope(s.id) : 'game', effect: o.effectFor?.[s.id] ?? o.effect ?? 'cosmetic',
      ...((o.conceptFor?.[s.id] ?? o.concept) ? { concept: o.conceptFor?.[s.id] ?? o.concept } : {}),
    });
  }
};

add('palette', THEMED_PALETTES, { store: 'palette', concept: 'world-palette' });
add('aura', RUN_AURAS, { store: 'aura', concept: 'run-aura' });
add('hat', HATS, { store: 'hat', concept: 'wearable-hat' });
add('celebration', CELEBRATIONS, { store: 'celebration', concept: 'win-celebration' });
add('drop-pack', DROP_PACKS, { store: 'dropPack', concept: 'pickup-style' });
for (const u of LOK_SHOP_UNLOCKS) add('feature-key', [u], { store: u.kind, effect: 'feature', concept: u.id === 'field-guide' ? 'collection-guide' : undefined });
add('perk', LOK_SHOP_PERKS, {
  store: 'perkUnlock', effect: 'world',
  conceptFor: { 'rider-saddle': 'pet-mount', ball: 'pet-play', 'chest-pass': 'bonus-chance' },
  effectFor: { 'lok-pass': 'feature', passport: 'feature', lifetime: 'feature' },
});
add('menu-theme', UI_THEMES.map((t) => ({ id: t.id, name: t.name, description: t.description, tier: t.tier, cost: t.cost })), {
  concept: 'ui-theme', scope: (id) => (id.startsWith('lok-') ? 'shared' : 'game'),
  access: (s) => (s.cost ?? 0) === 0 ? 'free' : 'earn',
});
add('pack-skin', PACK_SKINS, { concept: 'card-sleeve' });
add('card-back', CARD_BACKS, { concept: 'card-sleeve' });
add('card-frame', CARD_FRAMES, { concept: 'card-sleeve' });

const problems = validateRows(rows);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
writeFileSync(process.argv[2] ?? 'survivor616.customization.json', JSON.stringify({ app: APP, rows }, null, 1));
console.log(`${rows.length} rows`);
