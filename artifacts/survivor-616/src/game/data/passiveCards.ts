import type { BaseStats, CardPackId, CardVariant, MetaState, OwnedCardRecord } from '@/game/types';

export type PassiveCardType = 'scenario' | 'lokpet';
export type PassiveCardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export interface PassiveCardEffect { stat?: keyof BaseStats; statMult?: number; lokPetDamageMult?: number; lokPetHasteMult?: number; magnetMult?: number; creditMult?: number; packDropBonus?: number; propBounceMult?: number; unbreakableProps?: boolean; allElementLokPets?: boolean; clockworkSlow?: boolean }
export interface PassiveCardDef { id: string; name: string; type: PassiveCardType; rarity: PassiveCardRarity; description: string; effect: PassiveCardEffect; tags: string[] }
const scenario = (id: string, name: string, rarity: PassiveCardRarity, description: string, effect: PassiveCardEffect, tags: string[] = []): PassiveCardDef => ({ id: `lok.survivor-616.card.scenario-${id}`, name, type: 'scenario', rarity, description, effect, tags: ['scenario', ...tags] });
const pet = (id: string, name: string, rarity: PassiveCardRarity, description: string, effect: PassiveCardEffect, tags: string[] = []): PassiveCardDef => ({ id: `lok.survivor-616.card.lokpet-${id}`, name, type: 'lokpet', rarity, description, effect, tags: ['lokpet', ...tags] });

export const PASSIVE_CARDS: PassiveCardDef[] = [
  scenario('rubber-district', 'Rubber District', 'common', 'Street props kick back 25% harder.', { propBounceMult: 1.25 }, ['physics']),
  scenario('sealed-block', 'Sealed Block', 'legendary', 'Breakable street props cannot be destroyed.', { unbreakableProps: true }, ['physics']),
  scenario('open-frequency', 'Open Frequency', 'common', 'Pickup magnet range is 5% larger.', { magnetMult: 1.05 }, ['pickup']),
  scenario('night-market', 'Night Market', 'uncommon', 'Run Cred payout is 5% higher.', { creditMult: 1.05 }, ['economy']),
  scenario('loose-sleeves', 'Loose Sleeves', 'rare', 'Enemies have +0.35% chance to drop a Lock Pack.', { packDropBonus: 0.0035 }, ['packs']),
  scenario('glass-cannon-hour', 'Glass Cannon Hour', 'rare', 'Power is 8% higher.', { stat: 'power', statMult: 1.08 }, ['damage']),
  scenario('long-shadow', 'Long Shadow', 'uncommon', 'Attack area is 6% larger.', { stat: 'area', statMult: 1.06 }, ['area']),
  scenario('running-the-grid', 'Running the Grid', 'common', 'Move speed is 4% higher.', { stat: 'speed', statMult: 1.04 }, ['speed']),
  scenario('quiet-armor', 'Quiet Armor', 'rare', 'Armor is 3% stronger.', { stat: 'armor', statMult: 1.03 }, ['defense']),
  scenario('borrowed-seconds', 'Borrowed Seconds', 'epic', 'Cooldown time is 6% shorter.', { stat: 'haste', statMult: 0.94 }, ['haste']),
  scenario('wide-band', 'Wide Band', 'rare', 'Attack area and pickup reach both expand.', { stat: 'area', statMult: 1.035, magnetMult: 1.035 }, ['hybrid']),
  scenario('street-dividend', 'Street Dividend', 'epic', 'Earn 8% more Cred and slightly more pack drops.', { creditMult: 1.08, packDropBonus: 0.001 }, ['economy']),
  scenario('soft-concrete', 'Soft Concrete', 'uncommon', 'Props bounce 15% harder and speed rises 2.5%.', { propBounceMult: 1.15, stat: 'speed', statMult: 1.025 }, ['physics']),
  scenario('signal-vacuum', 'Signal Vacuum', 'epic', 'Pickup reach grows 12%.', { magnetMult: 1.12 }, ['pickup']),
  scenario('last-train-home', 'Last Train Home', 'legendary', 'Power and payout ride a 5% surge.', { stat: 'power', statMult: 1.05, creditMult: 1.05 }, ['hybrid']),
  scenario('red-sky-rule', 'Red Sky Rule', 'legendary', 'Power rises 10%.', { stat: 'power', statMult: 1.10 }, ['damage']),
  pet('pack-instinct', 'Pack Instinct', 'common', 'All LokPets deal 10% more damage.', { lokPetDamageMult: 1.10 }, ['damage']),
  pet('quick-paws', 'Quick Paws', 'uncommon', 'LokPets attack 8% faster.', { lokPetHasteMult: 0.92 }, ['haste']),
  pet('prismatic-barrage', 'Prismatic Barrage', 'legendary', 'LokPet hits cycle fire, freeze, and slow.', { allElementLokPets: true }, ['elements']),
  pet('unknown-clock-signal', 'Unknown Clock Signal', 'legendary', 'Clockwork LokPet hits release a slowing pulse.', { clockworkSlow: true }, ['clockwork']),
  pet('hungry-magnet', 'Hungry Magnet', 'common', 'LokPets tune pickup reach 4% wider.', { magnetMult: 1.04 }, ['pickup']),
  pet('collector-whistle', 'Collector Whistle', 'rare', 'Adds +0.25% pack-drop chance.', { packDropBonus: 0.0025 }, ['packs']),
  pet('feral-overclock', 'Feral Overclock', 'epic', 'LokPets attack 12% faster.', { lokPetHasteMult: 0.88 }, ['haste']),
  pet('heavy-teeth', 'Heavy Teeth', 'rare', 'LokPets deal 16% more damage.', { lokPetDamageMult: 1.16 }, ['damage']),
  pet('moth-lantern', 'Moth Lantern', 'uncommon', 'Pickup range grows 7%.', { magnetMult: 1.07 }, ['pickup']),
  pet('cipher-nose', 'Cipher Nose', 'epic', 'Adds +0.45% pack-drop chance.', { packDropBonus: 0.0045 }, ['packs']),
  pet('neon-leash', 'Neon Leash', 'common', 'LokPets deal 6% more damage and attack 3% faster.', { lokPetDamageMult: 1.06, lokPetHasteMult: 0.97 }, ['hybrid']),
  pet('salvage-fetch', 'Salvage Fetch', 'rare', 'Cred payout and pickup reach rise 4%.', { creditMult: 1.04, magnetMult: 1.04 }, ['economy']),
  pet('acid-memory', 'Acid Memory', 'epic', 'LokPet damage rises 12% with prismatic status cycling.', { lokPetDamageMult: 1.12, allElementLokPets: true }, ['elements']),
  pet('clock-beetle-oath', 'Clock Beetle Oath', 'epic', 'Clockwork slowing pulses and 5% faster pet attacks.', { clockworkSlow: true, lokPetHasteMult: 0.95 }, ['clockwork']),
  pet('alpha-sleeve', 'Alpha Sleeve', 'legendary', 'LokPets deal 20% more damage.', { lokPetDamageMult: 1.20 }, ['damage']),
  pet('every-color-at-once', 'Every Color at Once', 'legendary', 'Element cycling, +8% pet damage, and +5% pet speed.', { allElementLokPets: true, lokPetDamageMult: 1.08, lokPetHasteMult: 0.95 }, ['elements']),
];
export const PASSIVE_CARDS_BY_ID: Record<string, PassiveCardDef> = Object.fromEntries(PASSIVE_CARDS.map((card) => [card.id, card]));

export interface PurchasableCardPack { id: CardPackId; name: string; description: string; cost: number; cards: number; pool: 'all' | PassiveCardType | 'operative'; rarityBoost: number }
export const CARD_SHOP_PACKS: PurchasableCardPack[] = [
  { id: 'street', name: 'Street Sleeve', description: 'One card from the full Survivor 616 catalog.', cost: 8, cards: 1, pool: 'all', rarityBoost: 0 },
  { id: 'operative', name: 'Roster Roll', description: 'Two character cards from the playable roster.', cost: 12, cards: 2, pool: 'operative', rarityBoost: 0.02 },
  { id: 'scenario', name: 'Beyond the Grid', description: 'Two rule-bending Scenario Cards.', cost: 14, cards: 2, pool: 'scenario', rarityBoost: 0.03 },
  { id: 'lokpet', name: 'LokPack', description: 'Two LokPet subject or passive cards.', cost: 14, cards: 2, pool: 'lokpet', rarityBoost: 0.03 },
  { id: 'collector', name: 'Collector Cache', description: 'Three mixed cards with stronger variant odds.', cost: 22, cards: 3, pool: 'all', rarityBoost: 0.08 },
  { id: 'cipher', name: 'Neon Cipher', description: 'Three passive cards with the best rare and Holo odds.', cost: 30, cards: 3, pool: 'all', rarityBoost: 0.16 },
];
export const CARD_SHOP_PACKS_BY_ID = Object.fromEntries(CARD_SHOP_PACKS.map((pack) => [pack.id, pack])) as Record<CardPackId, PurchasableCardPack>;
const VARIANT_VALUE: Record<CardVariant, number> = { standard: 1, foil: 2, neon: 4, glitch: 7, holo: 12 };
export const CARD_VARIANT_VALUE = VARIANT_VALUE;
export interface CardPull { cardId: string; variant: CardVariant; value: number }
export function rollCardPack(packId: CardPackId, rng: () => number, extraCardIds: string[] = []): CardPull[] {
  const pack = CARD_SHOP_PACKS_BY_ID[packId] ?? CARD_SHOP_PACKS_BY_ID.street;
  let pool = pack.pool === 'operative' ? extraCardIds.filter((id) => id.includes(':character-')) : PASSIVE_CARDS.filter((card) => pack.pool === 'all' || card.type === pack.pool).map((card) => card.id);
  if (pack.id === 'street' || pack.id === 'collector') pool = [...pool, ...extraCardIds];
  if (pack.id === 'lokpet') pool = [...pool, ...extraCardIds.filter((id) => id.includes(':pet-'))];
  if (!pool.length) return [];
  return Array.from({ length: pack.cards }, () => { const cardId = pool[Math.floor(rng() * pool.length)]!; const roll = rng() - pack.rarityBoost; const variant: CardVariant = roll < 0.025 ? 'holo' : roll < 0.075 ? 'glitch' : roll < 0.17 ? 'neon' : roll < 0.34 ? 'foil' : 'standard'; return { cardId, variant, value: VARIANT_VALUE[variant] }; });
}
export function mergeCardPulls(collection: OwnedCardRecord[], pulls: CardPull[]): OwnedCardRecord[] {
  const byId = new Map(collection.map((record) => [record.cardId, { ...record, variants: { ...record.variants } }]));
  for (const pull of pulls) { const current = byId.get(pull.cardId) ?? { cardId: pull.cardId, copies: 0, variants: {}, bestVariant: 'standard' as CardVariant, totalValue: 0 }; current.copies += 1; current.variants[pull.variant] = (current.variants[pull.variant] ?? 0) + 1; current.totalValue += pull.value; if (VARIANT_VALUE[pull.variant] > VARIANT_VALUE[current.bestVariant]) current.bestVariant = pull.variant; byId.set(pull.cardId, current); }
  return [...byId.values()];
}
export function passiveDeckSlots(meta: Pick<MetaState, 'lokCollectorRuns' | 'lokCollectorPetsFound'>): number { if (meta.lokCollectorRuns >= 25 || meta.lokCollectorPetsFound >= 20) return 5; if (meta.lokCollectorRuns >= 8 || meta.lokCollectorPetsFound >= 6) return 4; return 3; }
export interface ActiveCardEffects { statMults: Partial<Record<keyof BaseStats, number>>; lokPetDamageMult: number; lokPetHasteMult: number; magnetMult: number; creditMult: number; packDropBonus: number; propBounceMult: number; unbreakableProps: boolean; allElementLokPets: boolean; clockworkSlow: boolean }
export function activeCardEffects(meta: Pick<MetaState, 'activePassiveCardIds' | 'cardCollection' | 'lokCollectorRuns' | 'lokCollectorPetsFound'>): ActiveCardEffects {
  const owned = new Set(meta.cardCollection.filter((record) => record.copies > 0).map((record) => record.cardId)); const ids = meta.activePassiveCardIds.filter((id) => owned.has(id)).slice(0, passiveDeckSlots(meta));
  const result: ActiveCardEffects = { statMults: {}, lokPetDamageMult: 1, lokPetHasteMult: 1, magnetMult: 1, creditMult: 1, packDropBonus: 0, propBounceMult: 1, unbreakableProps: false, allElementLokPets: false, clockworkSlow: false };
  for (const id of ids) { const effect = PASSIVE_CARDS_BY_ID[id]?.effect; if (!effect) continue; if (effect.stat && effect.statMult) result.statMults[effect.stat] = (result.statMults[effect.stat] ?? 1) * effect.statMult; result.lokPetDamageMult *= effect.lokPetDamageMult ?? 1; result.lokPetHasteMult *= effect.lokPetHasteMult ?? 1; result.magnetMult *= effect.magnetMult ?? 1; result.creditMult *= effect.creditMult ?? 1; result.packDropBonus += effect.packDropBonus ?? 0; result.propBounceMult *= effect.propBounceMult ?? 1; result.unbreakableProps ||= effect.unbreakableProps === true; result.allElementLokPets ||= effect.allElementLokPets === true; result.clockworkSlow ||= effect.clockworkSlow === true; }
  return result;
}
