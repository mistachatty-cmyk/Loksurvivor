// VENDORED from Lok-EcoSystsem/universe-sdk -- DO NOT EDIT HERE. Edit the SDK and run sync-sdk.sh.
import { RARITY_ORDER, type CardCombat } from "./types";

/** Placeholder tuning. Keep in sync with lok_cards_default_combat() in 04_cards_registry.sql. */
export const COMBAT_BY_TIER = [
  { hp: 40, attack: 6, speed: 1.0 },
  { hp: 60, attack: 9, speed: 1.0 },
  { hp: 90, attack: 13, speed: 1.05 },
  { hp: 130, attack: 18, speed: 1.1 },
  { hp: 190, attack: 26, speed: 1.15 },
  { hp: 260, attack: 36, speed: 1.2 },
  { hp: 320, attack: 44, speed: 1.25 },
];

export function combatForRarity(rarity: string, role: CardCombat["role"] = "hero"): CardCombat {
  const index = Math.max(0, RARITY_ORDER.indexOf(rarity as never));
  const base = COMBAT_BY_TIER[index]!;
  const scale = role === "enemy" ? { hp: 1.1, attack: 0.9 } : role === "companion" ? { hp: 0.8, attack: 0.8 } : { hp: 1, attack: 1 };
  return { role, tier: index + 1, hp: Math.round(base.hp * scale.hp), attack: Math.round(base.attack * scale.attack), speed: base.speed };
}
