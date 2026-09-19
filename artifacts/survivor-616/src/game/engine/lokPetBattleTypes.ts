import type {
  LokPetElement,
  LokPetFamily,
  LokPetPalette,
  LokPetRarity,
  LokPetSilhouette,
  SavedLokPet,
} from '@/game/types';

export type BattleStatusEffectType = 'burn' | 'freeze' | 'slow' | 'stun' | 'empower' | 'shield' | 'leech';

export interface BattleStatusEffect {
  type: BattleStatusEffectType;
  duration: number; // turns remaining
  value: number; // effect magnitude (e.g. burn damage per turn or % boost)
  sourcePetName: string;
}

export type MoveAnimationKind = 'strike' | 'claw' | 'blast' | 'beam' | 'burst' | 'pulse' | 'meteor' | 'heal' | 'lightning' | 'shadow';

export interface LokPetBattleMove {
  id: string;
  name: string;
  element: LokPetElement;
  energyCost: number; // 0 for basic strike, 30-40 for skill, 80-100 for ultimate
  power: number; // base attack multiplier (e.g. 1.0, 1.8, 3.2)
  kind: 'strike' | 'skill' | 'ultimate' | 'guard';
  description: string;
  accuracy: number; // 0.85 to 1.0
  statusEffect?: {
    type: BattleStatusEffectType;
    duration: number;
    value: number;
    chance: number; // 0 to 1
  };
  animation: MoveAnimationKind;
}

export interface BattlePet {
  id: string;
  originalSavedPetId?: string;
  name: string;
  variantId: string;
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  family: LokPetFamily;
  element: LokPetElement;
  elementLabel: string;
  rarity: LokPetRarity;
  level: number;
  exp: number;
  expToNext: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  attack: number;
  defense: number;
  speed: number;
  critRate: number; // e.g. 0.12 = 12%
  moves: LokPetBattleMove[];
  statusEffects: BattleStatusEffect[];
  isGuarding: boolean;
  fainted: boolean;
  battlesWon: number;
  equippedTrinket?: string;
}

export interface BattleLogEntry {
  id: string;
  text: string;
  type: 'action' | 'damage' | 'status' | 'crit' | 'switch' | 'system' | 'victory' | 'effective';
  timestamp: number;
}

export interface BattleFloatingText {
  id: string;
  text: string;
  color: string;
  target: 'player' | 'enemy';
  type: 'damage' | 'heal' | 'crit' | 'effective' | 'status';
  createdAt: number;
}

export interface BattleAnimationState {
  active: boolean;
  animKind: MoveAnimationKind;
  target: 'player' | 'enemy';
  attacker: 'player' | 'enemy';
  moveName: string;
  startedAt: number;
  durationMs: number;
}

export type BattleGameMode = 'test-sparring' | 'league' | 'endless-gauntlet';

export interface LeagueTierDef {
  id: string;
  tierNumber: number;
  title: string;
  trainerName: string;
  trainerTitle: string;
  flavorQuote: string;
  trainerPalette: { body: string; accent: string };
  team: Array<{
    variantId: string;
    name?: string;
    level: number;
  }>;
  rewards: {
    cred: number;
    cardCredits: number;
    treats: number;
    badgeId: string;
    badgeName: string;
  };
}

export interface BattleRewards {
  cred: number;
  cardCredits: number;
  treats: number;
  expEarned: number;
  badgeId?: string;
  badgeName?: string;
  levelUps: Array<{
    petId: string;
    petName: string;
    oldLevel: number;
    newLevel: number;
  }>;
}

export interface BattleState {
  gameMode: BattleGameMode;
  tierId?: string;
  floor?: number;
  playerTeam: BattlePet[];
  activePlayerIndex: number;
  enemyTeam: BattlePet[];
  activeEnemyIndex: number;
  turn: number;
  currentTurnActor: 'player' | 'enemy';
  phase: 'select-action' | 'animating' | 'round-end' | 'victory' | 'defeat';
  combatLog: BattleLogEntry[];
  floatingTexts: BattleFloatingText[];
  activeAnimation?: BattleAnimationState;
  cheerAvailable: boolean;
  autoBattle: boolean;
  battleSpeed: 1 | 2;
  rewards?: BattleRewards;
}

export interface LokPetTrinketDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  statBonus: {
    attack?: number;
    defense?: number;
    speed?: number;
    hp?: number;
    critRate?: number;
    initialEnergy?: number;
  };
}
