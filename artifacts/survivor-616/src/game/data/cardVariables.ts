/**
 * Card Variables, Matrix & TCG Stats Layer
 * Provides multidimensional classification for all Lock Deck cards:
 * - Elements (10 Digi-Thematic elements)
 * - Data Types (Vaccine, Virus, Data, Cyber, Quantum)
 * - Fighting Styles (Striker, Blaster, Bastion, Trickster, Speedster, Weaver)
 * - Special Powers & Card Moves (Authentic TCG attacks with energy costs)
 * - Collector Serial Numbering & Rarity Symbols
 * - Multidimensional Synergy & Cross-Table Calculations
 */

import { CARD_MANIFESTS } from './cards';
import { PASSIVE_CARDS } from './passiveCards';
import type { LokAssetManifest } from '@/game/lok/types';
import type { MetaState } from '@/game/types';

export type CardElement =
  | 'none'
  | 'fire'
  | 'freeze'
  | 'slow'
  | 'volt'
  | 'glitch'
  | 'terra'
  | 'aero'
  | 'light'
  | 'dark';

export type CardDataType = 'vaccine' | 'virus' | 'data' | 'cyber' | 'quantum';

export type CardFightingStyle =
  | 'striker'
  | 'blaster'
  | 'bastion'
  | 'trickster'
  | 'speedster'
  | 'weaver';

export interface CardSpecialPower {
  id: string;
  name: string;
  description: string;
  effectBadge: string;
}

export interface CardMove {
  name: string;
  energyCost: number;
  damage: number;
  description: string;
  element: CardElement;
}

export interface CardCombatStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spCost: number;
  throwPower: number;
}

export interface CardVariableProfile {
  cardId: string;
  name: string;
  element: CardElement;
  elementLabel: string;
  elementColor: string;
  hasDualElement: boolean;
  secondaryElement?: CardElement;
  secondaryElementLabel?: string;
  secondaryElementColor?: string;
  elements: CardElement[];
  dataType: CardDataType;
  dataTypeLabel: string;
  dataTypeAdvantage: string;
  hasDualData: boolean;
  secondaryDataType?: CardDataType;
  secondaryDataTypeLabel?: string;
  dataTypes: CardDataType[];
  fightingStyle: CardFightingStyle;
  fightingStyleLabel: string;
  fightingStylePerk: string;
  hasDualStyle: boolean;
  secondaryFightingStyle?: CardFightingStyle;
  secondaryFightingStyleLabel?: string;
  fightingStyles: CardFightingStyle[];
  specialPower: CardSpecialPower;
  specialPowers: CardSpecialPower[];
  rarity: string;
  stars: string;
  stats: CardCombatStats;
  weakness: CardElement;
  resistance: CardElement;
  collectorNumber: string;
  moves: [CardMove, CardMove];
  foilKind: 'standard' | 'foil' | 'neon' | 'glitch' | 'holo' | 'secret-gold';
  evolutionStage: 'Basic' | 'Stage 1' | 'Stage 2' | 'Apex EX' | 'Mega Burst';
  bodySilhouette: string;
  flavorText: string;
  illustrator: string;
  expansionSymbol: string;
  firstEdition: boolean;
  retreatCost: number;
}

export const ELEMENT_METADATA: Record<
  CardElement,
  { label: string; color: string; bgGradient: string; icon: string; strongVs: CardElement[]; weakVs: CardElement[] }
> = {
  none: {
    label: 'Kinetic',
    color: '#e2e8f0',
    bgGradient: 'from-slate-700/60 to-slate-900/80',
    icon: '●',
    strongVs: [],
    weakVs: ['dark'],
  },
  fire: {
    label: 'Pyro-Bit Fire',
    color: '#ff5533',
    bgGradient: 'from-rose-600/60 to-amber-900/80',
    icon: '🔥',
    strongVs: ['freeze', 'terra'],
    weakVs: ['slow', 'aero', 'dark'],
  },
  freeze: {
    label: 'Cryo-Byte Freeze',
    color: '#38bdf8',
    bgGradient: 'from-sky-600/60 to-slate-950/80',
    icon: '❄️',
    strongVs: ['slow', 'aero'],
    weakVs: ['fire', 'terra'],
  },
  slow: {
    label: 'Chrono-Lag Slow',
    color: '#c084fc',
    bgGradient: 'from-purple-700/60 to-indigo-950/80',
    icon: '⏳',
    strongVs: ['fire', 'volt'],
    weakVs: ['freeze', 'aero'],
  },
  volt: {
    label: 'Volt-Surge Electric',
    color: '#facc15',
    bgGradient: 'from-amber-500/60 to-yellow-950/80',
    icon: '⚡',
    strongVs: ['freeze', 'aero'],
    weakVs: ['terra', 'slow'],
  },
  glitch: {
    label: 'Null-Glitch Corrupt',
    color: '#ff2fd0',
    bgGradient: 'from-fuchsia-600/60 to-pink-950/80',
    icon: '👾',
    strongVs: ['volt', 'light'],
    weakVs: ['terra', 'dark'],
  },
  terra: {
    label: 'Solid-Core Terra',
    color: '#ca8a04',
    bgGradient: 'from-amber-700/60 to-stone-900/80',
    icon: '🛡️',
    strongVs: ['volt', 'glitch'],
    weakVs: ['aero', 'fire'],
  },
  aero: {
    label: 'Gale-Packet Aero',
    color: '#14b8a6',
    bgGradient: 'from-teal-600/60 to-cyan-950/80',
    icon: '🌪️',
    strongVs: ['terra', 'slow'],
    weakVs: ['volt', 'freeze'],
  },
  light: {
    label: 'Photon-Array Light',
    color: '#fef08a',
    bgGradient: 'from-yellow-300/60 to-amber-950/80',
    icon: '✨',
    strongVs: ['glitch', 'dark'],
    weakVs: ['terra', 'dark'],
  },
  dark: {
    label: 'Void-Sector Dark',
    color: '#818cf8',
    bgGradient: 'from-indigo-600/60 to-slate-950/80',
    icon: '🌑',
    strongVs: ['light'],
    weakVs: ['light', 'glitch'],
  },
};

export const DATA_TYPE_METADATA: Record<
  CardDataType,
  { label: string; advantage: string; badge: string; color: string; desc: string }
> = {
  vaccine: {
    label: 'Vaccine',
    advantage: 'Dominates Virus (+25% DMG)',
    badge: 'VAC',
    color: '#38bdf8',
    desc: 'Purified system security code. Resists infection and purges malware.',
  },
  virus: {
    label: 'Virus',
    advantage: 'Dominates Data (+25% DMG)',
    badge: 'VIR',
    color: '#f43f5e',
    desc: 'Aggressive payload designed to corrupt and rewrite rival codeblocks.',
  },
  data: {
    label: 'Data',
    advantage: 'Dominates Vaccine (+25% DMG)',
    badge: 'DAT',
    color: '#10b981',
    desc: 'Stable core logic. Grounded routines that overpower pure vaccine filters.',
  },
  cyber: {
    label: 'Cyber',
    advantage: 'Overclocked Hardware Armor',
    badge: 'CYB',
    color: '#ca8a04',
    desc: 'Physical titanium & silicon infrastructure that resists physical damage.',
  },
  quantum: {
    label: 'Quantum',
    advantage: 'Superposition (Shield Piercing)',
    badge: 'QTM',
    color: '#a855f7',
    desc: 'Probability-shifting anomalies that bypass conventional defenses.',
  },
};

export const FIGHTING_STYLE_METADATA: Record<
  CardFightingStyle,
  { label: string; perk: string; icon: string; statFocus: string }
> = {
  striker: {
    label: 'Striker',
    perk: '+20% Critical Burst Damage',
    icon: '⚔️',
    statFocus: 'High Attack Power',
  },
  blaster: {
    label: 'Blaster',
    perk: '+25% Elemental AoE Splash',
    icon: '💥',
    statFocus: 'Ranged Damage & Area',
  },
  bastion: {
    label: 'Bastion',
    perk: '+30% Damage Barrier & Spikes',
    icon: '🛡️',
    statFocus: 'High HP & Armor',
  },
  trickster: {
    label: 'Trickster',
    perk: '+20% Evasion & Status Freeze',
    icon: '🃏',
    statFocus: 'Ailments & Disruption',
  },
  speedster: {
    label: 'Speedster',
    perk: '+35% Action Haste & Multi-Hit',
    icon: '⚡',
    statFocus: 'Speed & Cooldowns',
  },
  weaver: {
    label: 'Weaver',
    perk: '+25% Team Aura & Energy Recharge',
    icon: '🔮',
    statFocus: 'Buffs & SP Recovery',
  },
};

/** Deterministic pseudo-hash of string to index */
function strHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Assign rich variable profile to any card in the game */
export function getCardVariableProfile(card: LokAssetManifest | { id: string; name: string; rarity?: string; description?: string }): CardVariableProfile {
  const hash = strHash(card.id);
  const idLower = card.id.toLowerCase();

  // 1. Determine Primary & Secondary Elements (Dual Element support)
  let element: CardElement = 'none';
  if (idLower.includes('fire') || idLower.includes('cinder') || idLower.includes('ember') || idLower.includes('pyro')) {
    element = 'fire';
  } else if (idLower.includes('freeze') || idLower.includes('frost') || idLower.includes('ice') || idLower.includes('sub-zero') || idLower.includes('rain')) {
    element = 'freeze';
  } else if (idLower.includes('slow') || idLower.includes('chrono') || idLower.includes('time') || idLower.includes('clock') || idLower.includes('tachyon')) {
    element = 'slow';
  } else if (idLower.includes('volt') || idLower.includes('spark') || idLower.includes('electric') || idLower.includes('kirin') || idLower.includes('ion')) {
    element = 'volt';
  } else if (idLower.includes('glitch') || idLower.includes('null') || idLower.includes('byte') || idLower.includes('matrix') || idLower.includes('chimera')) {
    element = 'glitch';
  } else if (idLower.includes('terra') || idLower.includes('stone') || idLower.includes('pangolin') || idLower.includes('colossus') || idLower.includes('gargoyle')) {
    element = 'terra';
  } else if (idLower.includes('aero') || idLower.includes('raptor') || idLower.includes('wing') || idLower.includes('pegasus') || idLower.includes('griffin')) {
    element = 'aero';
  } else if (idLower.includes('light') || idLower.includes('solar') || idLower.includes('photon') || idLower.includes('seraph') || idLower.includes('prism') || idLower.includes('moth')) {
    element = 'light';
  } else if (idLower.includes('dark') || idLower.includes('abyss') || idLower.includes('void') || idLower.includes('shadow') || idLower.includes('behemoth') || idLower.includes('dusk')) {
    element = 'dark';
  } else {
    const fallbackElements: CardElement[] = ['none', 'fire', 'freeze', 'slow', 'volt', 'glitch', 'terra', 'aero', 'light', 'dark'];
    element = fallbackElements[hash % fallbackElements.length];
  }

  // Dual Element logic: high-tier cards & ~35% of all cards possess a secondary element
  const allElementsList: CardElement[] = ['fire', 'freeze', 'slow', 'volt', 'glitch', 'terra', 'aero', 'light', 'dark'];
  const hasDualElement = (hash % 3 === 0) || idLower.includes('apex') || idLower.includes('chimera') || idLower.includes('kirin') || idLower.includes('seraph') || idLower.includes('valkyrie') || idLower.includes('behemoth') || idLower.includes('leviathan');
  let secondaryElement: CardElement | undefined = undefined;
  if (hasDualElement) {
    const filtered = allElementsList.filter((e) => e !== element);
    secondaryElement = filtered[(hash >> 3) % filtered.length];
  }
  const elements: CardElement[] = secondaryElement ? [element, secondaryElement] : [element];

  // 2. Determine Data Type & Secondary Data Type
  let dataType: CardDataType = 'data';
  if (element === 'light' || idLower.includes('angel') || idLower.includes('seraph') || idLower.includes('shepherd')) {
    dataType = 'vaccine';
  } else if (element === 'glitch' || element === 'dark' || idLower.includes('virus') || idLower.includes('abyss')) {
    dataType = 'virus';
  } else if (idLower.includes('quantum') || idLower.includes('tachyon') || idLower.includes('chimera')) {
    dataType = 'quantum';
  } else if (idLower.includes('cyber') || idLower.includes('pangolin') || idLower.includes('mechanical') || idLower.includes('gear')) {
    dataType = 'cyber';
  } else {
    const types: CardDataType[] = ['vaccine', 'virus', 'data', 'cyber', 'quantum'];
    dataType = types[(hash >> 2) % types.length];
  }

  const allDataList: CardDataType[] = ['vaccine', 'virus', 'data', 'cyber', 'quantum'];
  const hasDualData = (hash % 4 === 0) || idLower.includes('apex') || idLower.includes('quantum') || idLower.includes('cyber');
  let secondaryDataType: CardDataType | undefined = undefined;
  if (hasDualData) {
    const filtered = allDataList.filter((d) => d !== dataType);
    secondaryDataType = filtered[(hash >> 4) % filtered.length];
  }
  const dataTypes: CardDataType[] = secondaryDataType ? [dataType, secondaryDataType] : [dataType];

  // 3. Determine Fighting Style & Secondary Style (Hybrid Stances)
  let fightingStyle: CardFightingStyle = 'striker';
  if (idLower.includes('colossus') || idLower.includes('gargoyle') || idLower.includes('pangolin') || idLower.includes('behemoth') || idLower.includes('bastion')) {
    fightingStyle = 'bastion';
  } else if (idLower.includes('owl') || idLower.includes('seraph') || idLower.includes('hydra') || idLower.includes('blaster') || idLower.includes('shot')) {
    fightingStyle = 'blaster';
  } else if (idLower.includes('hare') || idLower.includes('raptor') || idLower.includes('pegasus') || idLower.includes('speed') || idLower.includes('greyhound')) {
    fightingStyle = 'speedster';
  } else if (idLower.includes('fox') || idLower.includes('moth') || idLower.includes('ghost') || idLower.includes('trick') || idLower.includes('jelly')) {
    fightingStyle = 'trickster';
  } else if (idLower.includes('axolotl') || idLower.includes('valkyrie') || idLower.includes('weaver') || idLower.includes('hive')) {
    fightingStyle = 'weaver';
  } else {
    const styles: CardFightingStyle[] = ['striker', 'blaster', 'bastion', 'trickster', 'speedster', 'weaver'];
    fightingStyle = styles[(hash >> 4) % styles.length];
  }

  const allStylesList: CardFightingStyle[] = ['striker', 'blaster', 'bastion', 'trickster', 'speedster', 'weaver'];
  const hasDualStyle = (hash % 3 === 1) || idLower.includes('apex') || idLower.includes('valkyrie') || idLower.includes('behemoth');
  let secondaryFightingStyle: CardFightingStyle | undefined = undefined;
  if (hasDualStyle) {
    const filtered = allStylesList.filter((s) => s !== fightingStyle);
    secondaryFightingStyle = filtered[(hash >> 5) % filtered.length];
  }
  const fightingStyles: CardFightingStyle[] = secondaryFightingStyle ? [fightingStyle, secondaryFightingStyle] : [fightingStyle];

  // 4. Rarity & Stars
  const rarity = (card as LokAssetManifest).rarity || 'common';
  let stars = '●';
  if (rarity === 'uncommon') stars = '◆';
  else if (rarity === 'rare') stars = '★';
  else if (rarity === 'epic') stars = '★★';
  else if (rarity === 'legendary') stars = '★★★';
  else if (rarity === 'mythic' || rarity === 'secret') stars = 'Apex ★★★★';

  // 5. Special Powers (Ability & Passive Bursts)
  const powers: CardSpecialPower[] = [
    { id: 'pwr-thermal-burn', name: 'Thermal Superheat', description: 'Attacks inflict lasting burn ticks and melt armor.', effectBadge: 'BURN' },
    { id: 'pwr-cryo-stasis', name: 'Sub-Zero Shiver', description: 'Incoming enemy attacks are slowed by 30%.', effectBadge: 'CHILL' },
    { id: 'pwr-tachyon-flux', name: 'Temporal Slipstream', description: 'Recharges partner move gauge 20% faster.', effectBadge: 'HASTE' },
    { id: 'pwr-overclock-arc', name: 'Chain Surge', description: 'Discharges electric arc to nearby opponents on contact.', effectBadge: 'SHOCK' },
    { id: 'pwr-quantum-phase', name: 'Phase Displacement', description: '25% chance to completely dodge heavy strikes.', effectBadge: 'DODGE' },
    { id: 'pwr-tectonic-wall', name: 'Granite Firewall', description: 'Negates the first hit received in each wave.', effectBadge: 'AEGIS' },
    { id: 'pwr-photon-dawn', name: 'Radiant Dawn', description: 'Purifies negative status effects automatically.', effectBadge: 'PURIFY' },
    { id: 'pwr-singularity-maw', name: 'Graviton Vortex', description: 'Pulls scattered projectiles inward to power up attacks.', effectBadge: 'VORTEX' },
  ];
  const primaryPower = powers[(hash >> 3) % powers.length];
  const hasMultiPower = (hash % 4 === 1) || rarity === 'legendary' || rarity === 'mythic' || rarity === 'secret';
  const secondaryPower = hasMultiPower ? powers[((hash >> 3) + 3) % powers.length] : undefined;
  const specialPowers: CardSpecialPower[] = secondaryPower ? [primaryPower, secondaryPower] : [primaryPower];

  // 6. Base Combat Stats
  const rarityMult =
    rarity === 'mythic' || rarity === 'secret' ? 2.4 :
    rarity === 'legendary' ? 2.0 :
    rarity === 'epic' ? 1.6 :
    rarity === 'rare' ? 1.3 :
    rarity === 'uncommon' ? 1.1 : 1.0;

  const baseHp = (120 + (hash % 100)) * rarityMult;
  const baseAtk = (18 + ((hash >> 2) % 35)) * rarityMult;
  const baseDef = (12 + ((hash >> 3) % 25)) * rarityMult;
  const baseSpd = 100 + ((hash >> 4) % 60);
  const throwPower = Math.round(baseAtk * 1.5);

  const stats: CardCombatStats = {
    hp: Math.round(baseHp),
    attack: Math.round(baseAtk),
    defense: Math.round(baseDef),
    speed: Math.round(baseSpd),
    spCost: Math.min(85, Math.max(20, Math.round(25 + (hash % 45)))),
    throwPower,
  };

  const elemMeta = ELEMENT_METADATA[element];
  const weakness = elemMeta.weakVs[0] || 'dark';
  const resistance = elemMeta.strongVs[0] || 'none';

  // 7. Authentic TCG Card Moves
  const moves: [CardMove, CardMove] = [
    {
      name: `${elemMeta.label.split(' ')[0]} Strike`,
      energyCost: Math.round(stats.spCost * 0.4),
      damage: Math.round(stats.attack * 0.75),
      description: `Basic ${elemMeta.label.toLowerCase()} strike dealing direct damage.`,
      element,
    },
    {
      name: primaryPower.name,
      energyCost: stats.spCost,
      damage: Math.round(stats.attack * 1.6),
      description: primaryPower.description,
      element: secondaryElement || element,
    },
  ];

  const collectorNumber = `№ ${String((hash % 150) + 1).padStart(3, '0')}/150`;

  const foilKind =
    rarity === 'mythic' || rarity === 'secret' ? 'secret-gold' :
    rarity === 'legendary' ? 'holo' :
    rarity === 'epic' ? 'glitch' :
    rarity === 'rare' ? 'neon' :
    rarity === 'uncommon' ? 'foil' : 'standard';

  // 8. Body Silhouettes & Evolution Stages (Digital Battler Archetypes)
  const SILHOUETTES = [
    'Bipedal Drake',
    'Avian Wyvern',
    'Colossal Golem',
    'Astral Seraph',
    'Deep Void Titan',
    'Tachyon Valkyrie',
    'Phase Kirin',
    'Cyber Pangolin',
    'Gargoyle Sentinel',
    'Glitch Dragon',
    'Solar Phoenix',
    'Chrono Lynx',
  ];
  const bodySilhouette = SILHOUETTES[(hash >> 2) % SILHOUETTES.length];

  const evolutionStage: 'Basic' | 'Stage 1' | 'Stage 2' | 'Apex EX' | 'Mega Burst' =
    rarity === 'mythic' || rarity === 'secret' ? 'Apex EX' :
    rarity === 'legendary' ? 'Mega Burst' :
    rarity === 'epic' ? 'Stage 2' :
    rarity === 'rare' ? 'Stage 1' : 'Basic';

  // Flavor lore
  const FLAVOR_LORES = [
    'Synthesized from deep sector core code, it emits a harmonic pulse that synchronizes nearby logic gates.',
    'Forged in the overclocked sub-levels of Sector 616. Its digital mantle deflects high-yield energy bursts.',
    'A rare polymorphic anomaly. When provoked, it phases between dimensional packet layers with blinding haste.',
    'Archived in the high-security LokVault. Legends state its signature attack can rewrite corrupted firmware.',
    'Observed hovering above neon terminals, it absorbs stray electromagnetic discharge to fuel its tactical burst.',
    'A sovereign digital entity whose existence defies conventional packet architecture. Revered across the arenas.',
  ];
  const flavorText = FLAVOR_LORES[(hash >> 1) % FLAVOR_LORES.length];

  const retreatCost = Math.min(3, Math.max(1, Math.round(1 + ((hash >> 5) % 3))));

  return {
    cardId: card.id,
    name: card.name,
    element,
    elementLabel: elemMeta.label,
    elementColor: elemMeta.color,
    hasDualElement,
    secondaryElement,
    secondaryElementLabel: secondaryElement ? ELEMENT_METADATA[secondaryElement].label : undefined,
    secondaryElementColor: secondaryElement ? ELEMENT_METADATA[secondaryElement].color : undefined,
    elements,
    dataType,
    dataTypeLabel: DATA_TYPE_METADATA[dataType].label,
    dataTypeAdvantage: DATA_TYPE_METADATA[dataType].advantage,
    hasDualData,
    secondaryDataType,
    secondaryDataTypeLabel: secondaryDataType ? DATA_TYPE_METADATA[secondaryDataType].label : undefined,
    dataTypes,
    fightingStyle,
    fightingStyleLabel: FIGHTING_STYLE_METADATA[fightingStyle].label,
    fightingStylePerk: FIGHTING_STYLE_METADATA[fightingStyle].perk,
    hasDualStyle,
    secondaryFightingStyle,
    secondaryFightingStyleLabel: secondaryFightingStyle ? FIGHTING_STYLE_METADATA[secondaryFightingStyle].label : undefined,
    fightingStyles,
    specialPower: primaryPower,
    specialPowers,
    rarity,
    stars,
    stats,
    weakness,
    resistance,
    collectorNumber,
    moves,
    foilKind,
    evolutionStage,
    bodySilhouette,
    flavorText,
    illustrator: 'Illus. Digi-Lab 616 · Neon Studio',
    expansionSymbol: '616',
    firstEdition: (hash % 5 === 0) || rarity === 'mythic' || rarity === 'legendary',
    retreatCost,
  };
}

/** Deck Active Synergy definition */
export interface DeckSynergyBonus {
  id: string;
  title: string;
  description: string;
  badge: string;
  active: boolean;
}

/** Evaluates bonuses when assembling active decks */
export function calculateDeckSynergies(cardIds: string[]): DeckSynergyBonus[] {
  const profiles = cardIds.map((id) => {
    const card = CARD_MANIFESTS.find((c) => c.id === id) || PASSIVE_CARDS.find((c) => c.id === id) || { id, name: 'Card' };
    return getCardVariableProfile(card);
  });

  const elementCounts = new Map<CardElement, number>();
  const dataCounts = new Map<CardDataType, number>();
  const styleCounts = new Map<CardFightingStyle, number>();

  for (const p of profiles) {
    elementCounts.set(p.element, (elementCounts.get(p.element) || 0) + 1);
    dataCounts.set(p.dataType, (dataCounts.get(p.dataType) || 0) + 1);
    styleCounts.set(p.fightingStyle, (styleCounts.get(p.fightingStyle) || 0) + 1);
  }

  const distinctElements = [...elementCounts.keys()].filter((e) => e !== 'none');
  const distinctData = [...dataCounts.keys()];
  const hasApex = profiles.some((p) => p.rarity === 'legendary' || p.rarity === 'mythic' || p.rarity === 'secret');

  const synergies: DeckSynergyBonus[] = [
    {
      id: 'elemental-harmony',
      title: 'Elemental Harmonizer',
      description: 'Deck contains 3+ distinct digital elements (+18% Elemental Procs).',
      badge: 'HARMONY',
      active: distinctElements.length >= 3,
    },
    {
      id: 'dual-resonance',
      title: 'Dual Type Resonance',
      description: 'Deck pairs 2+ matching elemental affinities (+15% Element Damage).',
      badge: 'RESONANCE',
      active: [...elementCounts.values()].some((c) => c >= 2),
    },
    {
      id: 'striker-rush',
      title: 'Striker Vanguard',
      description: 'Deck features 2+ Strikers (+20% Critical Burst Damage).',
      badge: 'VANGUARD',
      active: (styleCounts.get('striker') || 0) >= 2,
    },
    {
      id: 'bastion-fortress',
      title: 'Aegis Firewall',
      description: 'Deck features a Bastion unit (+25% Damage Barrier).',
      badge: 'FORTRESS',
      active: (styleCounts.get('bastion') || 0) >= 1,
    },
    {
      id: 'speed-overdrive',
      title: 'Tachyon Overdrive',
      description: 'Deck features 2+ Speedsters (+30% Action Recovery).',
      badge: 'OVERDRIVE',
      active: (styleCounts.get('speedster') || 0) >= 2,
    },
    {
      id: 'quantum-link',
      title: 'Quantum Entanglement',
      description: 'Deck includes Quantum data units (Pierces shield armor).',
      badge: 'ENTANGLED',
      active: (dataCounts.get('quantum') || 0) >= 1,
    },
    {
      id: 'apex-sovereign',
      title: 'Apex Sovereign Presence',
      description: 'Deck contains an Apex or Mythic card (+10% All Combat Stats).',
      badge: 'APEX',
      active: hasApex,
    },
  ];

  return synergies;
}

/** Comprehensive matrix summary across player collection */
export function generateVariableMatrix(meta: MetaState) {
  const ownedSet = new Set(meta.cardCollection.filter((r) => r.copies > 0).map((r) => r.cardId));

  const allCards = CARD_MANIFESTS;
  const allProfiles = allCards.map((c) => ({
    card: c,
    profile: getCardVariableProfile(c),
    owned: ownedSet.has(c.id),
  }));

  const byElement: Record<CardElement, { count: number; total: number; label: string; color: string }> = {
    none: { count: 0, total: 0, label: 'Kinetic', color: '#e2e8f0' },
    fire: { count: 0, total: 0, label: 'Pyro-Bit Fire', color: '#ff5533' },
    freeze: { count: 0, total: 0, label: 'Cryo-Byte Freeze', color: '#38bdf8' },
    slow: { count: 0, total: 0, label: 'Chrono-Lag Slow', color: '#c084fc' },
    volt: { count: 0, total: 0, label: 'Volt-Surge Electric', color: '#facc15' },
    glitch: { count: 0, total: 0, label: 'Null-Glitch Corrupt', color: '#ff2fd0' },
    terra: { count: 0, total: 0, label: 'Solid-Core Terra', color: '#ca8a04' },
    aero: { count: 0, total: 0, label: 'Gale-Packet Aero', color: '#14b8a6' },
    light: { count: 0, total: 0, label: 'Photon-Array Light', color: '#fef08a' },
    dark: { count: 0, total: 0, label: 'Void-Sector Dark', color: '#818cf8' },
  };

  const byDataType: Record<CardDataType, { count: number; total: number; label: string; color: string }> = {
    vaccine: { count: 0, total: 0, label: 'Vaccine', color: '#38bdf8' },
    virus: { count: 0, total: 0, label: 'Virus', color: '#f43f5e' },
    data: { count: 0, total: 0, label: 'Data', color: '#10b981' },
    cyber: { count: 0, total: 0, label: 'Cyber', color: '#ca8a04' },
    quantum: { count: 0, total: 0, label: 'Quantum', color: '#a855f7' },
  };

  const byFightingStyle: Record<CardFightingStyle, { count: number; total: number; label: string; icon: string }> = {
    striker: { count: 0, total: 0, label: 'Striker', icon: '⚔️' },
    blaster: { count: 0, total: 0, label: 'Blaster', icon: '💥' },
    bastion: { count: 0, total: 0, label: 'Bastion', icon: '🛡️' },
    trickster: { count: 0, total: 0, label: 'Trickster', icon: '🃏' },
    speedster: { count: 0, total: 0, label: 'Speedster', icon: '⚡' },
    weaver: { count: 0, total: 0, label: 'Weaver', icon: '🔮' },
  };

  const byRarity: Record<string, { count: number; total: number }> = {
    common: { count: 0, total: 0 },
    uncommon: { count: 0, total: 0 },
    rare: { count: 0, total: 0 },
    epic: { count: 0, total: 0 },
    legendary: { count: 0, total: 0 },
    mythic: { count: 0, total: 0 },
  };

  // Cross-Table: Element x Style
  const elementByStyleGrid: Record<string, Record<string, number>> = {};
  for (const elem of Object.keys(byElement)) {
    elementByStyleGrid[elem] = {};
    for (const style of Object.keys(byFightingStyle)) {
      elementByStyleGrid[elem][style] = 0;
    }
  }

  const byEvolutionStage: Record<string, { count: number; total: number }> = {
    'Basic': { count: 0, total: 0 },
    'Stage 1': { count: 0, total: 0 },
    'Stage 2': { count: 0, total: 0 },
    'Mega Burst': { count: 0, total: 0 },
    'Apex EX': { count: 0, total: 0 },
  };

  const multiVariableBreakdown = {
    dualElements: { count: 0, total: 0 },
    dualStyles: { count: 0, total: 0 },
    dualData: { count: 0, total: 0 },
    multiPowers: { count: 0, total: 0 },
    firstEdition: { count: 0, total: 0 },
    hasAnyMultiVariable: { count: 0, total: 0 },
  };

  const bySilhouette: Record<string, { count: number; total: number }> = {};

  for (const item of allProfiles) {
    const { profile, owned } = item;
    // Element
    byElement[profile.element].total++;
    if (owned) byElement[profile.element].count++;

    // Data Type
    byDataType[profile.dataType].total++;
    if (owned) byDataType[profile.dataType].count++;

    // Fighting Style
    byFightingStyle[profile.fightingStyle].total++;
    if (owned) byFightingStyle[profile.fightingStyle].count++;

    // Rarity
    const r = profile.rarity;
    if (byRarity[r]) {
      byRarity[r].total++;
      if (owned) byRarity[r].count++;
    }

    // Evolution Stage
    if (byEvolutionStage[profile.evolutionStage]) {
      byEvolutionStage[profile.evolutionStage].total++;
      if (owned) byEvolutionStage[profile.evolutionStage].count++;
    }

    // Body Silhouette
    if (!bySilhouette[profile.bodySilhouette]) {
      bySilhouette[profile.bodySilhouette] = { count: 0, total: 0 };
    }
    bySilhouette[profile.bodySilhouette].total++;
    if (owned) bySilhouette[profile.bodySilhouette].count++;

    // Multi-Variable Tracking
    const isMulti = profile.hasDualElement || profile.hasDualStyle || profile.hasDualData || profile.specialPowers.length > 1;
    if (isMulti) {
      multiVariableBreakdown.hasAnyMultiVariable.total++;
      if (owned) multiVariableBreakdown.hasAnyMultiVariable.count++;
    }
    if (profile.hasDualElement) {
      multiVariableBreakdown.dualElements.total++;
      if (owned) multiVariableBreakdown.dualElements.count++;
    }
    if (profile.hasDualStyle) {
      multiVariableBreakdown.dualStyles.total++;
      if (owned) multiVariableBreakdown.dualStyles.count++;
    }
    if (profile.hasDualData) {
      multiVariableBreakdown.dualData.total++;
      if (owned) multiVariableBreakdown.dualData.count++;
    }
    if (profile.specialPowers.length > 1) {
      multiVariableBreakdown.multiPowers.total++;
      if (owned) multiVariableBreakdown.multiPowers.count++;
    }
    if (profile.firstEdition) {
      multiVariableBreakdown.firstEdition.total++;
      if (owned) multiVariableBreakdown.firstEdition.count++;
    }

    // Cross-grid
    if (elementByStyleGrid[profile.element] && elementByStyleGrid[profile.element][profile.fightingStyle] !== undefined) {
      if (owned) {
        elementByStyleGrid[profile.element][profile.fightingStyle]++;
      }
    }
  }

  return {
    byElement,
    byDataType,
    byFightingStyle,
    byRarity,
    byEvolutionStage,
    bySilhouette,
    multiVariableBreakdown,
    elementByStyleGrid,
    totalCollected: ownedSet.size,
    totalCards: allCards.length,
    allProfiles,
  };
}
