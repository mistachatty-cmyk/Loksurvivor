/**
 * Props you can walk up to and tap along the hideout strip. A prop is a record: add a
 * row (and its text in `src/locales/en.json`) and it appears in its rooms. A new
 * look is one `drawProp` case in `ui/hideoutPropArt.ts`; nothing in the screen changes.
 *
 * Rewards are small on purpose and always go through `engine/hideoutRewards.ts`, which
 * owns the daily caps and the rare-find limits. A prop never writes to the save itself.
 */

import type { MessageKey } from '@/lib/i18n';
import type { HubPanel, UnlockRule } from '@/game/types';
import { bondDayKey } from '@/game/engine/petGrowth';
import type { SmallReward } from '@/game/engine/hideoutRewards';

export type PropArt = 'crate' | 'bell' | 'lamp' | 'scope' | 'jar' | 'stash' | 'seat' | 'jukebox' | 'cat' | 'npc' | 'door' | 'chest';

export interface PropRewardRow {
  weight: number;
  reward: SmallReward;
  /** Line shown with the payout, instead of the prop's usual line. */
  textKey?: MessageKey;
}

export interface PropRareFind {
  /** Chance before the bond luck multiplier. */
  baseChance: number;
  reward: SmallReward;
  /** Applied instead when the daily or per-item rare limits refuse it. */
  fallback?: SmallReward;
  textKey: MessageKey;
}

export type PropAction =
  /** Just a line of dialogue. */
  | { kind: 'talk' }
  /** Opens an existing hideout panel. */
  | { kind: 'panel'; panel: HubPanel }
  /** Starts a choice event from this pool (`data/choiceEvents.ts`). */
  | { kind: 'event'; pool: string }
  /** Looks at the sky (`data/skyEvents.ts`) and starts its boost when there is one. */
  | { kind: 'sky' }
  /** The Lucky Chest (`data/chestLoot.ts`): opens when it is out. */
  | { kind: 'chest' }
  /** A small payout, once per cooldown. */
  | { kind: 'reward'; table: PropRewardRow[]; rare?: PropRareFind };

export type PropCooldown = 'daily' | 'once' | number;

export interface HideoutPropDef {
  id: string;
  /** `HUB_ROOMS` ids this prop stands in. */
  roomIds: string[];
  /** Position along the strip, 0 (left) to 1 (right). */
  x: number;
  art: PropArt;
  /** For `art: 'npc'`: which `data/npcCast.ts` member stands here. */
  npcId?: 'jeremey-frogster' | 'jeramy-frogster' | 'luvitnot-keeper';
  accent: string;
  labelKey: MessageKey;
  /** One of these is shown per use. */
  lineKeys: MessageKey[];
  unlock?: UnlockRule;
  cooldown: PropCooldown;
  action: PropAction;
}

export const HIDEOUT_PROPS: HideoutPropDef[] = [
  {
    id: 'bell-cord', roomIds: ['main-floor'], x: 0.1, art: 'bell', accent: '#fbbf24',
    labelKey: 'hideout.prop.bell-cord.label',
    lineKeys: ['hideout.prop.bell-cord.line.1', 'hideout.prop.bell-cord.line.2'],
    cooldown: 'daily',
    action: { kind: 'reward', table: [{ weight: 1, reward: { cred: 5 } }] },
  },
  {
    id: 'relay-crate', roomIds: ['main-floor'], x: 0.86, art: 'crate', accent: '#22d3ee',
    labelKey: 'hideout.prop.relay-crate.label',
    lineKeys: ['hideout.prop.relay-crate.line.1', 'hideout.prop.relay-crate.line.2'],
    cooldown: 'daily',
    action: {
      kind: 'reward',
      table: [{ weight: 7, reward: { cred: 8 } }, { weight: 3, reward: { cardCredits: 1 } }],
      rare: { baseChance: 0.04, reward: { lokPetTreats: 1 }, fallback: { cred: 6 }, textKey: 'hideout.prop.relay-crate.rare' },
    },
  },
  {
    id: 'window-seat', roomIds: ['main-floor'], x: 0.5, art: 'seat', accent: '#a78bfa',
    labelKey: 'hideout.prop.window-seat.label',
    lineKeys: ['hideout.prop.window-seat.line.1', 'hideout.prop.window-seat.line.2', 'hideout.prop.window-seat.line.3'],
    cooldown: 0,
    action: { kind: 'talk' },
  },
  {
    id: 'fire-escape-stash', roomIds: ['the-alley'], x: 0.8, art: 'stash', accent: '#fb923c',
    labelKey: 'hideout.prop.fire-escape-stash.label',
    lineKeys: ['hideout.prop.fire-escape-stash.line.1', 'hideout.prop.fire-escape-stash.line.2'],
    cooldown: 'daily',
    action: {
      kind: 'reward',
      table: [{ weight: 1, reward: { cred: 6 } }],
      rare: { baseChance: 0.03, reward: { petElixirs: 1 }, fallback: { cred: 6 }, textKey: 'hideout.prop.fire-escape-stash.rare' },
    },
  },
  {
    id: 'stoop-cat', roomIds: ['the-alley'], x: 0.3, art: 'cat', accent: '#f9a8d4',
    labelKey: 'hideout.prop.stoop-cat.label',
    lineKeys: ['hideout.prop.stoop-cat.line.1', 'hideout.prop.stoop-cat.line.2'],
    cooldown: 'daily',
    action: { kind: 'event', pool: 'alley' },
  },
  {
    id: 'beacon-lamp', roomIds: ['rooftop-perch'], x: 0.3, art: 'lamp', accent: '#fde68a',
    labelKey: 'hideout.prop.beacon-lamp.label',
    lineKeys: ['hideout.prop.beacon-lamp.line.1', 'hideout.prop.beacon-lamp.line.2'],
    cooldown: 'daily',
    action: { kind: 'reward', table: [{ weight: 1, reward: { cred: 6 } }] },
  },
  {
    id: 'lucky-chest', roomIds: ['main-floor'], x: 0.68, art: 'chest', accent: '#facc15',
    labelKey: 'hideout.prop.lucky-chest.label',
    lineKeys: ['hideout.prop.lucky-chest.line.1', 'hideout.prop.lucky-chest.line.2'],
    cooldown: 0,
    action: { kind: 'chest' },
  },
  {
    id: 'lok-shop-counter', roomIds: ['main-floor'], x: 0.2, art: 'door', accent: '#c084fc',
    labelKey: 'hideout.prop.lok-shop-counter.label',
    lineKeys: ['hideout.prop.lok-shop-counter.line.1', 'hideout.prop.lok-shop-counter.line.2'],
    cooldown: 0,
    action: { kind: 'panel', panel: 'lok-shop' },
  },
  {
    id: 'sky-spyglass', roomIds: ['rooftop-perch'], x: 0.4, art: 'scope', accent: '#fbbf24',
    labelKey: 'hideout.prop.sky-spyglass.label',
    lineKeys: ['hideout.prop.sky-spyglass.line.1', 'hideout.prop.sky-spyglass.line.2'],
    cooldown: 0,
    action: { kind: 'sky' },
  },
  {
    id: 'old-telescope', roomIds: ['rooftop-perch'], x: 0.75, art: 'scope', accent: '#67e8f9',
    labelKey: 'hideout.prop.old-telescope.label',
    lineKeys: ['hideout.prop.old-telescope.line.1', 'hideout.prop.old-telescope.line.2'],
    cooldown: 'daily',
    action: { kind: 'event', pool: 'rooftop' },
  },
  {
    id: 'static-jar', roomIds: ['the-cellar'], x: 0.5, art: 'jar', accent: '#c084fc',
    labelKey: 'hideout.prop.static-jar.label',
    lineKeys: ['hideout.prop.static-jar.line.1', 'hideout.prop.static-jar.line.2'],
    cooldown: 'daily',
    action: {
      kind: 'reward',
      table: [{ weight: 1, reward: { cred: 5 } }],
      rare: { baseChance: 0.03, reward: { cardCredits: 2 }, fallback: { cred: 5 }, textKey: 'hideout.prop.static-jar.rare' },
    },
  },
  {
    id: 'luvitnot-keeper', roomIds: ['grpd-station'], x: 0.25, art: 'npc', npcId: 'luvitnot-keeper', accent: '#fde68a',
    labelKey: 'hideout.prop.luvitnot-keeper.label',
    lineKeys: ['hideout.prop.luvitnot-keeper.line.1', 'hideout.prop.luvitnot-keeper.line.2'],
    cooldown: 0,
    action: { kind: 'panel', panel: 'grpd-armory' },
  },
  {
    id: 'pulse-jukebox', roomIds: ['the-sound-booth'], x: 0.5, art: 'jukebox', accent: '#f472b6',
    labelKey: 'hideout.prop.pulse-jukebox.label',
    lineKeys: ['hideout.prop.pulse-jukebox.line.1', 'hideout.prop.pulse-jukebox.line.2'],
    cooldown: 0,
    action: { kind: 'panel', panel: 'music' },
  },
];

export const HIDEOUT_PROPS_BY_ID: Record<string, HideoutPropDef> = Object.fromEntries(HIDEOUT_PROPS.map((prop) => [prop.id, prop]));

export function propsForRoom(roomId: string): HideoutPropDef[] {
  return HIDEOUT_PROPS.filter((prop) => prop.roomIds.includes(roomId));
}

/** Claim key used for a prop in `hideoutClaims`. */
export const propClaimKey = (id: string): string => `prop.${id}`;

/** True when the prop's cooldown has passed (a prop with no payout never has one). */
export function propReady(def: HideoutPropDef, claims: Record<string, number> | undefined, now: number): boolean {
  if (def.cooldown === 0) return true;
  const last = claims?.[propClaimKey(def.id)];
  if (last === undefined) return true;
  if (def.cooldown === 'once') return false;
  if (def.cooldown === 'daily') return bondDayKey(last) !== bondDayKey(now);
  return now - last >= def.cooldown;
}

export interface PropRewardRoll {
  reward: SmallReward;
  fallback?: SmallReward;
  rare: boolean;
  textKey?: MessageKey;
}

/**
 * Rolls what a reward prop hands over. `luck` (from `bondLuck`) only scales the rare
 * chance. Always rolls in the same order so a seed gives the same result everywhere.
 */
export function resolvePropReward(def: HideoutPropDef, rng: () => number, luck: number): PropRewardRoll | null {
  if (def.action.kind !== 'reward') return null;
  const { table, rare } = def.action;
  const rareRoll = rng();
  const rowRoll = rng();
  if (rare && rareRoll < Math.min(0.5, rare.baseChance * Math.max(1, luck))) {
    return { reward: rare.reward, fallback: rare.fallback, rare: true, textKey: rare.textKey };
  }
  const total = table.reduce((sum, row) => sum + Math.max(0, row.weight), 0);
  let pick = rowRoll * total;
  for (const row of table) {
    pick -= Math.max(0, row.weight);
    if (pick <= 0) return { reward: row.reward, rare: false, textKey: row.textKey };
  }
  const last = table[table.length - 1];
  return last ? { reward: last.reward, rare: false, textKey: last.textKey } : null;
}
