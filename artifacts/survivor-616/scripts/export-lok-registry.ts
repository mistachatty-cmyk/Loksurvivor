/**
 * Publisher for the LOK Card Universe. Maps this game's content onto the
 * shared SDK's `PublishCard` / `PublishItem` shapes; the SDK builds the SQL.
 * Everything platform-specific is in the two mapping functions below -- that
 * is the whole integration (see Lok-EcoSystsem/LokToken EcoSystem/LOK_PLATFORMS.md).
 *
 *   pnpm exec tsx scripts/export-lok-registry.ts <outDir>
 *
 * Writes `survivor616.cards.sql` and `survivor616.catalog.sql`. Idempotent:
 * re-run after content changes and apply the output.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCardsSql, buildCatalogSql, type PlatformManifest, type PublishCard, type PublishItem } from '../../../lib/lok-universe/src';
import { CARD_MANIFESTS, CARD_PACKS } from '../src/game/data/cards';
import { artRecipeFor } from '../src/game/data/cardArt';
import { THEMED_PALETTES } from '../src/game/data/themedPalettes';
import { RUN_AURAS } from '../src/game/data/runAuras';
import { HATS } from '../src/game/data/hats';
import { CELEBRATIONS } from '../src/game/data/celebrations';
import { DROP_PACKS } from '../src/game/data/dropPacks';
import { LOK_SHOP_UNLOCKS } from '../src/game/data/lokShopUnlocks';
import { LOKTOKEN_PRICE_BY_TIER, PASSPORT_TIERS, catalogSku, type StoreItemKind } from '../src/lib/lokStoreCatalog';

const platform = JSON.parse(readFileSync(new URL('../lok.universe.json', import.meta.url), 'utf8')) as PlatformManifest;

const cards: PublishCard[] = CARD_MANIFESTS.map((card) => {
  const meta = (card.metadata ?? {}) as { setId?: string; cardNumber?: string; subjectType?: string };
  const setId = meta.setId ?? 'misc';
  return {
    slug: card.slug,
    name: card.name,
    description: card.description,
    rarity: card.rarity,
    setId,
    setName: CARD_PACKS.find((pack) => pack.id === setId)?.name,
    cardNumber: meta.cardNumber,
    tags: card.tags,
    role: meta.subjectType === 'enemy' ? 'enemy' : meta.subjectType === 'lokpet' ? 'companion' : 'hero',
    art: artRecipeFor(card),
    acquisition: card.acquisition,
    metadata: { subjectType: meta.subjectType },
  };
});

type Priced = { id: string; name: string; description: string; tier?: string; cost: number };
const items = (kind: StoreItemKind, itemType: string, list: Priced[]): PublishItem[] =>
  list
    .filter((entry) => entry.cost > 0)
    .map((entry) => {
      const tier = entry.tier ?? 'standard';
      return {
        sku: catalogSku(kind, entry.id),
        name: entry.name,
        description: entry.description,
        price: LOKTOKEN_PRICE_BY_TIER[tier] ?? LOKTOKEN_PRICE_BY_TIER.standard!,
        rarity: tier === 'standard' ? 'common' : tier,
        itemType,
        payload: { kind, id: entry.id },
      };
    });

// Passport tiers have their own explicit prices, not the standard/rare/legendary
// ladder the other kinds use -- built directly rather than through `items()`.
const passportTiers: PublishItem[] = PASSPORT_TIERS.map((tier) => ({
  sku: catalogSku('passportTier', tier.skuId),
  name: tier.name,
  description: tier.blurb,
  price: tier.price,
  rarity: 'legendary',
  itemType: 'boost',
  payload: { kind: 'passportTier', id: tier.skuId },
}));

const catalog = [
  ...items('palette', 'theme', THEMED_PALETTES),
  ...items('aura', 'cosmetic', RUN_AURAS),
  ...items('hat', 'cosmetic', HATS),
  ...items('celebration', 'cosmetic', CELEBRATIONS),
  ...items('dropPack', 'cosmetic', DROP_PACKS),
  ...passportTiers,
  // Feature unlocks, not cosmetics -- each entry has its own StoreItemKind, so it goes
  // through `items()` one kind at a time rather than as one uniformly-kinded list.
  // itemType 'boost' is the closest fit in lib/lok-universe's lok_item_type enum
  // (theme/cursor/ui_kit/motion_pack/tool/boost/badge/sfx/title/frame/pet/cosmetic --
  // there is no literal "unlock" or "feature" value).
  ...LOK_SHOP_UNLOCKS.flatMap((unlock) => items(unlock.kind, 'boost', [unlock])),
];

const outDir = process.argv[2] ?? '.';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'survivor616.cards.sql'), buildCardsSql(platform, cards));
writeFileSync(join(outDir, 'survivor616.catalog.sql'), buildCatalogSql(platform, catalog));
console.log(`${cards.length} cards, ${catalog.length} catalog items -> ${outDir}`);
