/**
 * Persistent meta progression.
 *
 * Everything the player keeps between runs -- unlocked characters, cleared
 * areas, rescued allies, discoveries, bestiary counts -- lives here and is
 * mirrored into localStorage so a refresh does not wipe the hideout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';

import { AREAS, getArea } from '@/game/data/areas';
import { CHARACTERS, getCharacter } from '@/game/data/characters';
import { CHARACTER_EPISODES, CHARACTER_EPISODES_BY_ID } from '@/game/data/episodes';
import { getCharacterSkins, isCharacterSkinUnlocked } from '@/game/data/characterSkins';
import { EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import { CITY_RELICS, CITY_RELICS_BY_ID, RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { ENEMIES } from '@/game/data/enemies';
import { isStarterLokPetId, LOKPET_VARIANTS_BY_ID, rollLokPet, type StarterLokPetId } from '@/game/data/lokPets';
import { createRng } from '@/game/engine/math';
import { ALLIES, ALLIES_BY_ID, DISCOVERIES, HUB_ROOMS } from '@/game/data/progression';
import {
  crewActivityEffects,
  normalizeCrewActivities,
  rollCrewActivities,
} from '@/game/data/crewActivities';
import {
  normalizeActiveCrewRumor,
  rollCrewRumor,
} from '@/game/data/crewRumors';
import {
  RECOVERY_FACILITIES,
  RECOVERY_FACILITIES_BY_ID,
  RECOVERY_HUTS,
  SAUNA_HOLE_REWARDS,
} from '@/game/data/recovery';
import { VENDOR_CATALOG, VENDOR_CATALOG_BY_ID, vendorPurchaseCount } from '@/game/data/vendor';
import { CHARACTER_MASTERY_STAT_EFFECTS, characterRankTitle } from '@/game/data/characterMastery';
import { CURRENT_VERSION } from '@/game/data/changelog';
import { DEFAULT_UPDATE_POPUP_KINDS, normalizeUpdatePopupKinds, type ChangelogKind } from '@/game/data/changelogKinds';
import {
  advanceDailyContracts,
  contractDayKey,
  dailyContractDefs,
  dailyContractStatuses,
} from '@/game/data/contracts';
import { advanceLoginStreak } from '@/game/data/loginStreak';
import {
  DEFAULT_UI_THEME_ID,
  HIDDEN_UI_THEME_IDS,
  STARTER_UI_THEME_IDS,
  UI_THEMES_BY_ID,
  defaultSwatchId,
  uiLooksForOwnedThemeIds,
} from '@/game/data/uiThemes';
import { DEFAULT_PALETTE_ID, THEMED_PALETTES_BY_ID } from '@/game/data/themedPalettes';
import { DEFAULT_SOUND_PACK_ID, SOUND_PACKS_BY_ID } from '@/game/data/soundPacks';
import { DEFAULT_RUN_AURA_ID, RUN_AURAS, RUN_AURAS_BY_ID } from '@/game/data/runAuras';
import { DEFAULT_HAT_ID, HATS, HATS_BY_ID } from '@/game/data/hats';
import { CELEBRATIONS, CELEBRATIONS_BY_ID, DEFAULT_CELEBRATION_ID } from '@/game/data/celebrations';
import { effectiveCatalogIds, hasCatalogItem } from '@/game/data/devUnlockRegistry';
import { ENDLESS_BANDS } from '@/game/data/endlessBands';
import { MAX_CUSTOM_MAPS, normalizeCustomMap, normalizeCustomMaps } from '@/game/data/customMaps';
import { RENTABLE_GENERATORS, RENTABLE_GENERATORS_BY_ID } from '@/game/data/generators';
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from '@/game/data/achievements';
import type { BattleRewards } from '@/game/engine/lokPetBattleTypes';
import { getExpForLevel } from '@/game/engine/petExpCurve';
import { HIDEOUT_EVENTS_BY_ID } from '@/game/data/hideoutEvents';
import { applyPetCare } from '@/game/data/petCare';
import { applyChoice } from '@/game/engine/choiceEvents';
import { HIDEOUT_PROPS_BY_ID, propClaimKey, propReady, resolvePropReward } from '@/game/data/hideoutProps';
import {
  MAX_CLAIMS,
  REWARD_KEYS,
  bondLuck,
  emptyLedger,
  grantWithFallback,
  trimClaims,
} from '@/game/engine/hideoutRewards';
import { chooseBranch, normalizeEvolutionPath, undoBranch } from '@/game/engine/petEvolution';
import { BOND_RANK_BY_ID, TRAVEL_WIN_EXP_BASE, TREAT_EXP_BASE, applyBond, bondDayKey, growPartyPets, growPet, growthHeadlines, runPetExpBase, sanitizePetName, scalePetExp, setPetName, type PetNameSlot } from '@/game/engine/petGrowth';
import { DIRECTORS } from '@/game/data/directors';
import { CARD_MANIFESTS, LOKPET_CARDS } from '@/game/data/cards';
import { CARD_SHOP_PACKS_BY_ID, CARD_VARIANT_VALUE, PASSIVE_CARDS_BY_ID, activeCardEffects, mergeCardPulls, passiveDeckSlots, rollCardPack, type CardPull } from '@/game/data/passiveCards';
import { BATTLE_DECK_SLOTS, CARD_SALVAGE_COST, CARD_SALVAGE_EARN_RUNS } from '@/game/data/travelEncounters';
import type { TravelEncounterResult } from '@/game/travelEncounter';
import { SECTOR_MISSIONS, SECTOR_MISSIONS_BY_ID } from '@/game/data/sectorMissions';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { GRPD_MAX_SPAWN_MULTIPLIER, GRPD_PLAYABLE_WEAPON_IDS, GRPD_UNLOCK_SEAL_COST, grpdAvailableSeals, grpdEarnedSeals, grpdNextTierCost, grpdEndgameWeaponEarned, isGrpdEndgameWeapon, isGrpdPlayableWeapon } from '@/game/data/grpdArmory';
import { earnedEndgame, endgameReached, featureById, slotById } from '@/game/data/endgameUnlocks';
import { recordEarnedEndgame } from '@/game/state/operatorForgeStore';
import { PASSIVES } from '@/game/data/passives';
import type {
  AllyDef,
  AreaDef,
  BaseStats,
  CardPackId,
  CardVariant,
  CharacterEpisodeDef,
  CharacterDef,
  HubRoomDef,
  LokPetAttackKind,
  LokPetCatalogEntry,
  LokPetCatalogTrait,
  LokPetDiscoveryHistoryEntry,
  LokPetElement,
  LokPetRarity,
  OwnedCardRecord,
  LokPetRunDiscovery,
  LokPetRoll,
  SavedLokPet,
  VisitingLokCard,
  MetaState,
  RunResult,
  RunModifiers,
  FacilityTier,
  RecoverySession,
  StealthAbilityConfig,
  ThemedPaletteDef,
  UnlockRule,
  CustomMap,
  UIPanelLayout,
  ThreatCalibrations,
  ThreatEventId,
} from '@/game/types';

export const DEFAULT_THREAT_CALIBRATIONS: ThreatCalibrations = {
  hpMult: 1,
  massMult: 1,
  densityMult: 1,
  angleMode: 'standard',
  activeEvents: [],
};

export function normalizeThreatCalibrations(raw: unknown): ThreatCalibrations {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_THREAT_CALIBRATIONS };
  }
  const obj = raw as Partial<ThreatCalibrations>;
  const hpMult = typeof obj.hpMult === 'number' && Number.isFinite(obj.hpMult) ? Math.max(0.2, Math.min(5, obj.hpMult)) : 1;
  const massMult = typeof obj.massMult === 'number' && Number.isFinite(obj.massMult) ? Math.max(0.2, Math.min(5, obj.massMult)) : 1;
  const densityMult = typeof obj.densityMult === 'number' && Number.isFinite(obj.densityMult) ? Math.max(0.2, Math.min(5, obj.densityMult)) : 1;
  const validModes: ThreatCalibrations['angleMode'][] = ['standard', 'pincer', 'cardinal', 'spiral', 'corners'];
  const angleMode = validModes.includes(obj.angleMode as any) ? (obj.angleMode as ThreatCalibrations['angleMode']) : 'standard';
  const validEvents: ThreatEventId[] = ['emp-storm', 'gravity-anomaly', 'glitch-surge', 'solar-flare', 'blood-overclock', 'swarm-frenzy'];
  const activeEvents: ThreatEventId[] = Array.isArray(obj.activeEvents)
    ? (obj.activeEvents.filter((ev): ev is ThreatEventId => typeof ev === 'string' && (validEvents as string[]).includes(ev)))
    : [];

  return {
    hpMult,
    massMult,
    densityMult,
    angleMode,
    activeEvents,
  };
}

const STORAGE_KEY = 'survivor616.meta.v1';
const META_VERSION = 25;
export const MAX_FATIGUE_PCT = 5;
export const FATIGUE_PER_RUN_PCT = 0.5;
export const BASE_LOKPET_TEAM_SLOTS = 3;
export const BASE_CARD_CREDITS_PER_LOOT_BOX = 2;
export const LOKPET_CARD_PACK_COST = 14;

export function lokPetTeamCapacity(character: CharacterDef): number {
  return BASE_LOKPET_TEAM_SLOTS + (character.lokPetCollector?.extraTeamSlots ?? 0);
}

export function cardCreditsForRun(character: CharacterDef, lootBoxesOpened: number): number {
  const perBox = BASE_CARD_CREDITS_PER_LOOT_BOX + (character.lokPetCollector?.bonusCardCreditsPerLootBox ?? 0);
  return Math.max(0, Math.floor(lootBoxesOpened)) * perBox;
}

const FACILITY_ORDER: FacilityTier[] = RECOVERY_FACILITIES.map((facility) => facility.id);

function defaultRecovery(): RecoverySession {
  return { characterId: null, locationId: 'rooftop', startedAt: null, lastUpdatedAt: Date.now() };
}

function facilityIndex(id: string): number {
  const index = FACILITY_ORDER.indexOf(id as FacilityTier);
  return index >= 0 ? index : 0;
}

function facilityForLocation(locationId: string, rooftopTier: FacilityTier = 'tub') {
  const direct = RECOVERY_FACILITIES_BY_ID[locationId];
  if (direct) return direct;
  const hut = RECOVERY_HUTS.find((candidate) => candidate.id === locationId);
  return RECOVERY_FACILITIES_BY_ID[hut?.facility ?? rooftopTier] ?? RECOVERY_FACILITIES[0];
}

function settleRecovery(meta: MetaState, now = Date.now()): MetaState {
  const recovery = meta.recovery;
  if (!recovery.characterId || !recovery.startedAt) {
    return { ...meta, recovery: { ...recovery, lastUpdatedAt: now } };
  }
  const facility = facilityForLocation(recovery.locationId, meta.facilityTier);
  const elapsedMinutes = Math.max(0, now - recovery.lastUpdatedAt) / 60000;
  if (elapsedMinutes <= 0) return meta;
  const current = meta.fatigueByCharacter[recovery.characterId] ?? 0;
  const nextFatigue = Math.max(0, current - elapsedMinutes * facility.recoveryPctPerMinute);
  return {
    ...meta,
    fatigueByCharacter: { ...meta.fatigueByCharacter, [recovery.characterId]: nextFatigue },
    recovery: {
      ...recovery,
      lastUpdatedAt: now,
      ...(nextFatigue <= 0 ? { characterId: null, startedAt: null } : {}),
    },
  };
}

/**
 * Lazily settles cred earned by owned generators since the last settle,
 * same shape as `settleRecovery`/`replenishPetElixirs` above: a timestamp is
 * persisted and the delta is computed on read, so income keeps accruing
 * while the player is away instead of needing a running interval.
 */
function settleGeneratorIncome(meta: MetaState, now = Date.now()): Pick<MetaState, 'cred' | 'generatorAccrualAt'> {
  const elapsedMinutes = Math.max(0, now - meta.generatorAccrualAt) / 60000;
  if (elapsedMinutes <= 0 || meta.ownedGeneratorIds.length === 0) {
    return { cred: meta.cred, generatorAccrualAt: now };
  }
  const perMinute = meta.ownedGeneratorIds.reduce(
    (sum, id) => sum + (RENTABLE_GENERATORS_BY_ID[id]?.credPerMinute ?? 0),
    0,
  );
  return { cred: meta.cred + Math.floor(perMinute * elapsedMinutes), generatorAccrualAt: now };
}

function normalizeRunModifiers(value: unknown): RunModifiers {
  if (!isRecord(value)) return {};
  const modifiers: RunModifiers = {};
  if (value.doubleMode === true) modifiers.doubleMode = true;
  if (value.quadSpawnMode === true) modifiers.quadSpawnMode = true;
  if (value.unleashedMode === true) modifiers.unleashedMode = true;
  if (value.millionHordeMode === true) modifiers.millionHordeMode = true;
  if (value.invertedMap === true) modifiers.invertedMap = true;
  if (value.speedMode === true) modifiers.speedMode = true;
  if (value.scalerMode === true) modifiers.scalerMode = true;
  if (value.infiniteMode === true) modifiers.infiniteMode = true;
  if (value.hordeSpinEnabled === true) modifiers.hordeSpinEnabled = true;
  if (value.directorModeEnabled === true) modifiers.directorModeEnabled = true;
  if (value.bionicCluckProtocol === true) modifiers.bionicCluckProtocol = true;
  return modifiers;
}

/** Keeps a persisted or dispatched tilt sensitivity inside a usable range. */
function clampGyroSensitivity(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 1;
  return Math.max(0.5, Math.min(2, numeric));
}

function clampIntroReturnDelay(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 4;
  return Math.max(1, Math.min(12, Math.round(numeric)));
}

export function createInitialMeta(): MetaState {
  return {
    version: META_VERSION,
    devModeAccessUnlocked: false,
    devModeAllUnlocks: false,
    physicsObjectClicksEnabled: true,
    levelUpPausesEnabled: true,
    liveModeEnabled: false,
    lootPresentation: 'auto-pause',
    levelUpPresentation: 'pause-focus',
    pauseMapVisible: true,
    graphicsQuality: 'high',
    companionRevealStyle: 'ambush',
    frameRateMode: 60,
    soundtrackObjectiveCompletions: 0,
    fogAmbianceMode: 'auto',
    glowingEyesIntensity: 'mid',
    crowdAutoZoomEnabled: true,
    wildlifeSheltersInRain: true,
    minimapVisible: true,
    minimapExpanded: true,
    minimapPosition: { x: 0.82, y: 0.18 },
    worldInvertEnabled: false,
    paletteInvertEnabled: false,
    mirrorModeEnabled: false,
    uiDensity: 'grid',
    lokPetArtStyle: 'pixel-core',
    uiBorderStyle: 'square',
    lokPetBorderStyle: 'square',
    characterBorderStyle: 'square',
    musicReactiveEnabled: true,
    sfxEnabled: true,
    hideoutAmbienceEnabled: false,
    hideoutWeatherEnabled: true,
    attractModeEnabled: true,
    hideoutArrivalEnabled: true,
    hideoutSectionsCollapsedByDefault: false,
    hideoutPreviewEnabled: true,
    hideoutPets: 'all',
    hideoutEvents: 'on',
    hideoutInteractive: true,
    hideoutPetPlay: true,
    hideoutChoiceEvents: 'on',
    hideoutClaims: {},
    hideoutLedger: emptyLedger(),
    hideoutStickyHeadOutEnabled: true,
    splashTextEnabled: true,
    oneLineTitleEnabled: false,
    introTitlePhysicsEnabled: true,
    introTitleReturnDelaySec: 4,
    travelEncountersEnabled: true,
    paletteAnimationsEnabled: true,
    worldPaletteBlendEnabled: true,
    worldColorFullRecolorEnabled: false,
    gyroEnabled: false,
    studioPluginsEnabled: false,
    studioLayout: 'auto',
    gyroSensitivity: 1,
    gyroInvertY: false,
    selectedCharacterId: 'shade',
    characterSkinByCharacterId: {},
    unlockedCharacterIds: CHARACTERS.filter((c) => c.unlock.kind === 'default').map((c) => c.id),
    clearedAreaIds: [],
    rescuedAllyIds: [],
    discoveryIds: [],
    lokPetCatalog: [],
    lokPetHistory: [],
    savedLokPets: [],
    selectedLokPetIds: [],
    visitingLokCards: [],
    petElixirs: 3,
    petElixirUpdatedAt: Date.now(),
    bestiary: {},
    totalKills: 0,
    grpdSpentSeals: 0,
    grpdUnlockedWeaponIds: [],
    grpdActiveWeaponIds: [],
    grpdSpawnTierByWeaponId: {},
    grpdAutoIncreaseEnabled: true,
    grpdArmoryAnchor: 'station',
    totalRuns: 0,
    bestSurvivalSec: 0,
    totalLevelUps: 0,
    cred: 0,
    lootTokens: 0,
    cardCredits: 0,
    cardCollection: [],
    unopenedCardPacks: {},
    autoOpenPacksEnabled: true,
    activePassiveCardIds: [],
    battleDeckCardIds: [],
    cardSalvageUnlocked: false,
    handheldDigiScopeOwned: false,
    miningHelmetOwned: false,
    rancherWhistleOwned: false,
    eclipseMonocleOwned: false,
    cardFrameSleeves: ['frame-classic'],
    selectedCardFrame: 'frame-classic',
    lokCollectorRuns: 0,
    lokCollectorPetsFound: 0,
    lokPetLeagueTier: 0,
    lokPetBattleWins: 0,
    lokPetBattleBadges: [],
    lokPetTreats: 3,
    skeletonKeys: 0,
    ownedGeneratorIds: [],
    generatorAccrualAt: Date.now(),
    runModifiers: {},
    onboarded: false,
    starterLokPetOnboardingComplete: false,
    starterLokPetVariantId: null,
    endlessRecordDistancePx: 0,
    endlessRecordDepth: 0,
    endlessDiscoveryIds: [],
    fatigueByCharacter: {},
    characterLevelUps: {},
    recovery: defaultRecovery(),
    facilityTier: 'tub',
    discoveredHutIds: [],
    vendorPurchases: {},
    crewActivityByAlly: {},
    crewActivitySeed: 0,
    activeCrewRumor: null,
    hideoutVisitCount: 0,
    primeTakeoverVisitsRemaining: 0,
    primeTakeoverUntil: 0,
    completedEpisodeIds: [],
    unlockedEvolutionIds: [],
    episodeProgressById: {},
    completedSectorMissionIds: [],
    knownRelicIds: [],
    customMaps: [],
    uiPanelLayout: 'rail',
    ownedUiThemeIds: [DEFAULT_UI_THEME_ID, ...STARTER_UI_THEME_IDS],
    uiTheme: DEFAULT_UI_THEME_ID,
    uiThemeSwatchByTheme: {},
    themeCycleMastered: false,
    themeCycleCollection: 'starter',
    ownedPaletteIds: [DEFAULT_PALETTE_ID],
    activePaletteId: DEFAULT_PALETTE_ID,
    ownedSoundPackIds: [DEFAULT_SOUND_PACK_ID],
    activeSoundPackId: DEFAULT_SOUND_PACK_ID,
    ownedRunAuraIds: [DEFAULT_RUN_AURA_ID],
    activeRunAuraId: DEFAULT_RUN_AURA_ID,
    ownedHatIds: [DEFAULT_HAT_ID],
    activeHatId: DEFAULT_HAT_ID,
    ownedCelebrationIds: [DEFAULT_CELEBRATION_ID],
    activeCelebrationId: DEFAULT_CELEBRATION_ID,
    dailyContractDayKey: contractDayKey(),
    dailyContractProgressById: {},
    completedDailyContractIds: [],
    // Empty, not today's key, so a brand-new player's first hub visit still claims day 1.
    lastLoginStreakDayKey: '',
    loginStreakCount: 0,
    claimedAchievementIds: [],
    defeatedDirectorIds: [],
    directorModeUnlocked: false,
    activeDirectorPersonalityId: null,
    pendingSaunaReward: null,
    threatMatrixUnlocked: false,
    disabledEnemyIds: [],
    disabledWeaponIds: [],
    disabledPassiveIds: [],
    threatCalibrations: { ...DEFAULT_THREAT_CALIBRATIONS },
    threatUpgrades: {},
    dvdEasterEggUnlocked: false,
    pendingNotifications: [],
    lastSeenChangelogVersion: CURRENT_VERSION,
    updatePopupKinds: { ...DEFAULT_UPDATE_POPUP_KINDS },
    relicMaterials: { 'phosphor-ore': 6, 'silicon-alloy': 8, 'cyber-resin': 6, 'prism-quartz': 2 },
    craftedRelicIds: [],
    ownedKeyItemIds: ['digiscope'],
    unlockedCardCustomizations: ['frame-standard'],
    cardCustomizationsByCardId: {},
  };
}

function idList(value: unknown, allowed: Set<string>, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string' && allowed.has(entry)) seen.add(entry);
  }
  for (const entry of fallback) seen.add(entry);
  return [...seen];
}

function normalizeEndlessDiscoveries(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const validBands = new Set<string>(ENDLESS_BANDS.map((band) => band.id));
  const discoveries = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (validBands.has(entry) || (entry.startsWith('beacon:') && validBands.has(entry.slice('beacon:'.length)))) {
      discoveries.add(entry);
    }
  }
  return [...discoveries];
}

function counter(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function normalizeCardCollection(value: unknown): MetaState['cardCollection'] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set([...CARD_MANIFESTS.map((card) => card.id), ...Object.keys(PASSIVE_CARDS_BY_ID)]);
  const validVariants = new Set<CardVariant>(['standard', 'foil', 'neon', 'glitch', 'holo']);
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.cardId !== 'string' || !validIds.has(entry.cardId)) return [];
    const variants: Partial<Record<CardVariant, number>> = {};
    if (isRecord(entry.variants)) for (const variant of validVariants) { const count = counter(entry.variants[variant]); if (count > 0) variants[variant] = count; }
    const copies = Math.max(counter(entry.copies), Object.values(variants).reduce((sum, count) => sum + (count ?? 0), 0));
    if (!copies) return [];
    const bestVariant = typeof entry.bestVariant === 'string' && validVariants.has(entry.bestVariant as CardVariant) ? entry.bestVariant as CardVariant : 'standard';
    return [{ cardId: entry.cardId, copies, variants, bestVariant, totalValue: Math.max(copies, counter(entry.totalValue, copies)) }];
  }).slice(0, 500);
}

function rollPackForReveal(meta: MetaState, packId: CardPackId, seed: number): { pulls: CardPull[]; newFlags: boolean[] } {
  const pulls = rollCardPack(packId, createRng(seed), CARD_MANIFESTS.map((card) => card.id));
  const ownedBeforeIds = new Set(meta.cardCollection.filter((record) => record.copies > 0).map((record) => record.cardId));
  const seenThisPack = new Set<string>();
  const newFlags = pulls.map((pull) => {
    const isNew = !ownedBeforeIds.has(pull.cardId) && !seenThisPack.has(pull.cardId);
    seenThisPack.add(pull.cardId);
    return isNew;
  });
  return { pulls, newFlags };
}

function normalizeUnopenedCardPacks(value: unknown): MetaState['unopenedCardPacks'] {
  if (!isRecord(value)) return {};
  const result: Partial<Record<CardPackId, number>> = {};
  for (const packId of Object.keys(CARD_SHOP_PACKS_BY_ID) as CardPackId[]) {
    const count = counter(value[packId]);
    if (count > 0) result[packId] = count;
  }
  return result;
}


/** Removes one copy of a record's own `bestVariant` (the one a throw would have used) and recomputes `bestVariant`/`totalValue`. Returns null once copies reach 0, so the caller drops the record entirely -- mirrors normalizeCardCollection's own "a 0-copy record doesn't exist" rule. */
function removeThrownCardCopy(record: OwnedCardRecord): OwnedCardRecord | null {
  const copies = record.copies - 1;
  if (copies <= 0) return null;
  const spentVariant = record.bestVariant;
  const variants = { ...record.variants };
  const remainingOfSpent = Math.max(0, (variants[spentVariant] ?? 1) - 1);
  if (remainingOfSpent > 0) variants[spentVariant] = remainingOfSpent;
  else delete variants[spentVariant];
  const totalValue = Math.max(0, record.totalValue - CARD_VARIANT_VALUE[spentVariant]);
  let bestVariant: CardVariant = 'standard';
  let bestValue = -1;
  for (const [variant, count] of Object.entries(variants) as [CardVariant, number][]) {
    if (count > 0 && CARD_VARIANT_VALUE[variant] > bestValue) { bestValue = CARD_VARIANT_VALUE[variant]; bestVariant = variant; }
  }
  return { ...record, copies, variants, bestVariant, totalValue };
}

function normalizedPosition(value: unknown, fallback: { x: number; y: number }): { x: number; y: number } {
  if (!isRecord(value)) return { ...fallback };
  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : fallback.x;
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : fallback.y;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function normalizeVendorPurchases(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const purchases: Record<string, number> = {};
  for (const [id, rawCount] of Object.entries(value)) {
    const item = VENDOR_CATALOG_BY_ID[id];
    if (!item) continue;
    const count = counter(rawCount);
    if (count > 0) purchases[id] = Math.min(item.maxStacks, count);
  }
  return purchases;
}

function normalizeOwnedUiThemeIds(value: unknown): string[] {
  const owned = new Set<string>([DEFAULT_UI_THEME_ID, ...STARTER_UI_THEME_IDS]);
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && UI_THEMES_BY_ID[entry]) owned.add(entry);
    }
  }
  return [...owned];
}

function normalizeUiTheme(value: unknown, ownedUiThemeIds: string[]): string {
  return typeof value === 'string' && ownedUiThemeIds.includes(value) ? value : DEFAULT_UI_THEME_ID;
}

function normalizeUiThemeSwatchByTheme(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const swatches: Record<string, string> = {};
  for (const [themeId, rawSwatchId] of Object.entries(value)) {
    const theme = UI_THEMES_BY_ID[themeId];
    if (!theme?.swatches) continue;
    if (typeof rawSwatchId === 'string' && theme.swatches.some((swatch) => swatch.id === rawSwatchId)) {
      swatches[themeId] = rawSwatchId;
    }
  }
  return swatches;
}

function normalizeOwnedPaletteIds(value: unknown): string[] {
  const owned = new Set<string>([DEFAULT_PALETTE_ID]);
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && THEMED_PALETTES_BY_ID[entry]) owned.add(entry);
    }
  }
  return [...owned];
}

function normalizePaletteId(value: unknown, ownedPaletteIds: string[]): string {
  return typeof value === 'string' && ownedPaletteIds.includes(value) ? value : DEFAULT_PALETTE_ID;
}

function normalizeOwnedSoundPackIds(value: unknown): string[] {
  const owned = new Set<string>([DEFAULT_SOUND_PACK_ID]);
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string' && SOUND_PACKS_BY_ID[entry]) owned.add(entry);
    }
  }
  return [...owned];
}

function normalizeSoundPackId(value: unknown, ownedSoundPackIds: string[]): string {
  return typeof value === 'string' && ownedSoundPackIds.includes(value) ? value : DEFAULT_SOUND_PACK_ID;
}

function normalizeOwnedRunAuraIds(value: unknown): string[] {
  return idList(value, new Set(RUN_AURAS.map((aura) => aura.id)), [DEFAULT_RUN_AURA_ID]);
}

function normalizeRunAuraId(value: unknown, ownedRunAuraIds: string[]): string {
  return typeof value === 'string' && ownedRunAuraIds.includes(value) ? value : DEFAULT_RUN_AURA_ID;
}

function normalizeOwnedIds(value: unknown, ids: string[], defaultId: string): string[] {
  return idList(value, new Set(ids), [defaultId]);
}

function normalizeOwnedCosmeticId(value: unknown, ownedIds: string[], defaultId: string): string {
  return typeof value === 'string' && ownedIds.includes(value) ? value : defaultId;
}

const LOKPET_RARITIES: LokPetRarity[] = ['common', 'charged', 'rare', 'mythic'];
const LOKPET_ATTACK_KINDS: LokPetAttackKind[] = ['shot', 'rapid-shot', 'heavy-shot', 'pulse', 'explosion'];
const LOKPET_ELEMENTS: LokPetElement[] = [
  'none',
  'fire',
  'freeze',
  'slow',
  'volt',
  'glitch',
  'terra',
  'aero',
  'light',
  'dark',
];
const LOKPET_ATTACK_LABELS: Record<LokPetAttackKind, string> = {
  shot: 'single shot',
  'rapid-shot': 'rapid fire',
  'heavy-shot': 'heavy shot',
  pulse: 'pulsating field',
  explosion: 'burst explosion',
};
const LOKPET_ELEMENT_LABELS: Record<LokPetElement, string> = {
  none: 'none',
  fire: 'fire',
  freeze: 'freeze',
  slow: 'slow',
  volt: 'volt',
  glitch: 'glitch',
  terra: 'terra',
  aero: 'aero',
  light: 'light',
  dark: 'dark',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isOneOf<T extends string>(value: unknown, values: T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

function catalogTraitKey(trait: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>): string {
  return `${trait.attackKind}:${trait.element}`;
}

function canonicalCatalogTrait(
  attackKind: LokPetAttackKind,
  element: LokPetElement,
): LokPetCatalogTrait {
  const elementLabel = LOKPET_ELEMENT_LABELS[element];
  const attackLabel = LOKPET_ATTACK_LABELS[attackKind];
  return {
    attackKind,
    element,
    elementLabel,
    label: element === 'none' ? attackLabel : `${attackLabel} · ${elementLabel}`,
  };
}

function sameCatalogTrait(
  left: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>,
  right: Pick<LokPetCatalogTrait, 'attackKind' | 'element'>,
): boolean {
  return catalogTraitKey(left) === catalogTraitKey(right);
}

/**
 * Compare this run's generated companions with the catalog before the run.
 * Keeping this calculation separate from the write means the summary can
 * celebrate only genuinely new information while the reducer remains the
 * source of truth for persistence.
 */
export function getLokPetDiscoveries(
  existing: LokPetCatalogEntry[],
  pets: RunResult['lokPets'],
): LokPetRunDiscovery[] {
  const previousByVariant = new Map(existing.map((entry) => [entry.variantId, entry]));
  const discoveries = new Map<string, LokPetRunDiscovery>();

  for (const pet of pets) {
    const previous = previousByVariant.get(pet.variantId);
    const discovery = discoveries.get(pet.variantId) ?? {
      variantId: pet.variantId,
      sightings: 0,
      totalSightings: (previous?.sightings ?? 0),
      newVariant: !previous,
      newRarities: [],
      newTraits: [],
    };
    discovery.sightings += 1;
    discovery.totalSightings += 1;

    // Include values learned earlier in this same run only once. This keeps
    // a chest that rolls the same combination twice from making fake deltas.
    const rarityAlreadyKnown =
      previous?.rarities.includes(pet.rarity) || discovery.newRarities.includes(pet.rarity);
    if (!rarityAlreadyKnown) discovery.newRarities.push(pet.rarity);

    const trait = canonicalCatalogTrait(pet.attackKind, pet.element);
    const traitAlreadyKnown =
      previous?.traits.some((candidate) => sameCatalogTrait(candidate, trait)) ||
      discovery.newTraits.some((candidate) => sameCatalogTrait(candidate, trait));
    if (!traitAlreadyKnown) discovery.newTraits.push(trait);

    discoveries.set(pet.variantId, discovery);
  }

  return [...discoveries.values()];
}

/**
 * Normalize catalog records independently from the rest of the save. The
 * variant sheet is the source of truth for presentation fields, so malformed
 * localStorage cannot inject a different palette or identity into the archive.
 */
export function normalizeLokPetCatalog(value: unknown): LokPetCatalogEntry[] {
  if (!Array.isArray(value)) return [];

  const entries = new Map<string, LokPetCatalogEntry>();
  for (const rawValue of value) {
    if (!isRecord(rawValue) || typeof rawValue.variantId !== 'string') continue;
    const variant = LOKPET_VARIANTS_BY_ID[rawValue.variantId];
    if (!variant) continue;

    const rarities = Array.isArray(rawValue.rarities)
      ? rawValue.rarities.filter((rarity): rarity is LokPetRarity => isOneOf(rarity, LOKPET_RARITIES))
      : [];
    const traits: LokPetCatalogTrait[] = [];
    if (Array.isArray(rawValue.traits)) {
      for (const traitValue of rawValue.traits) {
        if (!isRecord(traitValue)) continue;
        if (!isOneOf(traitValue.attackKind, LOKPET_ATTACK_KINDS)) continue;
        if (!isOneOf(traitValue.element, LOKPET_ELEMENTS)) continue;
        const trait = canonicalCatalogTrait(traitValue.attackKind, traitValue.element);
        if (!traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
          traits.push(trait);
        }
      }
    }

    const current = entries.get(variant.id);
    if (current) {
      current.rarities = [...new Set([...current.rarities, ...rarities])];
      for (const trait of traits) {
        if (!current.traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
          current.traits.push(trait);
        }
      }
      current.sightings += counter(rawValue.sightings);
      continue;
    }

    entries.set(variant.id, {
      variantId: variant.id,
      family: variant.family,
      silhouette: variant.silhouette,
      palette: variant.palette,
      rarities: [...new Set(rarities)],
      traits,
      sightings: counter(rawValue.sightings),
    });
  }

  return [...entries.values()];
}

type CatalogPetImprint = Pick<LokPetRoll, 'variantId' | 'rarity' | 'attackKind' | 'element'>;

function recordLokPetCatalog(existing: LokPetCatalogEntry[], pets: readonly CatalogPetImprint[]): LokPetCatalogEntry[] {
  const entries = new Map(
    existing.map((entry) => [
      entry.variantId,
      {
        ...entry,
        rarities: [...entry.rarities],
        traits: entry.traits.map((trait) => ({ ...trait })),
      },
    ]),
  );

  for (const pet of pets) {
    const variant = LOKPET_VARIANTS_BY_ID[pet.variantId];
    if (!variant) continue;
    const entry = entries.get(variant.id) ?? {
      variantId: variant.id,
      family: variant.family,
      silhouette: variant.silhouette,
      palette: variant.palette,
      rarities: [],
      traits: [],
      sightings: 0,
    };
    entry.sightings += 1;
    if (!entry.rarities.includes(pet.rarity)) entry.rarities.push(pet.rarity);
    const trait = canonicalCatalogTrait(pet.attackKind, pet.element);
    if (!entry.traits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
      entry.traits.push(trait);
    }
    entries.set(variant.id, entry);
  }

  return [...entries.values()];
}

function normalizeLokPetHistory(value: unknown): LokPetDiscoveryHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const history: LokPetDiscoveryHistoryEntry[] = [];
  for (const rawValue of value) {
    if (!isRecord(rawValue)) continue;
    const rawDiscoveries = rawValue.discoveries;
    if (!Array.isArray(rawDiscoveries)) continue;

    const discoveries: LokPetRunDiscovery[] = [];
    for (const rawDiscovery of rawDiscoveries) {
      if (!isRecord(rawDiscovery) || typeof rawDiscovery.variantId !== 'string') continue;
      if (!LOKPET_VARIANTS_BY_ID[rawDiscovery.variantId]) continue;

      const newRarities = Array.isArray(rawDiscovery.newRarities)
        ? [...new Set(rawDiscovery.newRarities.filter((rarity): rarity is LokPetRarity => isOneOf(rarity, LOKPET_RARITIES)))]
        : [];
      const newTraits: LokPetCatalogTrait[] = [];
      if (Array.isArray(rawDiscovery.newTraits)) {
        for (const rawTrait of rawDiscovery.newTraits) {
          if (!isRecord(rawTrait)) continue;
          if (!isOneOf(rawTrait.attackKind, LOKPET_ATTACK_KINDS)) continue;
          if (!isOneOf(rawTrait.element, LOKPET_ELEMENTS)) continue;
          const trait = canonicalCatalogTrait(rawTrait.attackKind, rawTrait.element);
          if (!newTraits.some((candidate) => catalogTraitKey(candidate) === catalogTraitKey(trait))) {
            newTraits.push(trait);
          }
        }
      }

      discoveries.push({
        variantId: rawDiscovery.variantId,
        sightings: counter(rawDiscovery.sightings),
        totalSightings: counter(rawDiscovery.totalSightings),
        newVariant: rawDiscovery.newVariant === true,
        newRarities,
        newTraits,
      });
    }

    if (discoveries.length === 0) continue;
    history.push({
      runNumber: counter(rawValue.runNumber),
      recordedAt:
        typeof rawValue.recordedAt === 'number' && Number.isFinite(rawValue.recordedAt)
          ? rawValue.recordedAt
          : 0,
      areaId: typeof rawValue.areaId === 'string' ? rawValue.areaId : 'unknown',
      characterId: typeof rawValue.characterId === 'string' ? rawValue.characterId : 'unknown',
      cleared: rawValue.cleared === true,
      discoveries,
    });
  }

  return history
    .sort((left, right) => right.recordedAt - left.recordedAt || right.runNumber - left.runNumber)
    .slice(0, 100);
}

const PET_STAMINA_MAX = 3;
export const STARTER_LOKPET_FREE_REFRESH_MS = 60 * 60 * 1000;
export const HANDHELD_DIGISCOPE_COST = 240;
const ELIXIR_GRANT_MS = 20 * 60 * 1000;
const ELIXIR_GRANT_AMOUNT = 3;
export const ELIXIR_CAP = 18;

function normalizeSavedLokPets(value: unknown): SavedLokPet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<SavedLokPet>;
    const roll = candidate.roll;
    if (!roll || typeof roll !== 'object' || typeof candidate.id !== 'string' || typeof roll.variantId !== 'string' || typeof roll.name !== 'string') return [];
    const pet: SavedLokPet = {
      id: candidate.id,
      roll: roll as SavedLokPet['roll'],
      stamina: Math.max(0, Math.min(PET_STAMINA_MAX, counter(candidate.stamina))),
      level: typeof candidate.level === 'number' && candidate.level >= 1 ? Math.min(candidate.starter === true ? 99 : 50, Math.floor(candidate.level)) : 1,
      exp: typeof candidate.exp === 'number' ? Math.max(0, Math.floor(candidate.exp)) : 0,
      battlesWon: counter(candidate.battlesWon),
      battlesFought: counter(candidate.battlesFought),
      favorite: candidate.favorite === true,
      equippedTrinket: typeof candidate.equippedTrinket === 'string' ? candidate.equippedTrinket : undefined,
      starter: candidate.starter === true,
      lastFreeRefreshAt: typeof candidate.lastFreeRefreshAt === 'number' && Number.isFinite(candidate.lastFreeRefreshAt)
        ? Math.max(0, candidate.lastFreeRefreshAt)
        : undefined,
      name: typeof candidate.name === 'string' && candidate.name.trim().length > 0
        ? sanitizePetName(candidate.name) || undefined
        : undefined,
      names: normalizePetNames(candidate.names),
      bond: typeof candidate.bond === 'number' && Number.isFinite(candidate.bond) && candidate.bond > 0 ? Math.min(100000, Math.floor(candidate.bond)) : undefined,
      careDay: typeof candidate.careDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.careDay) ? candidate.careDay : undefined,
      hideoutEvents: normalizeHideoutEventHistory(candidate.hideoutEvents),
      bondDay: typeof candidate.bondDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.bondDay) ? candidate.bondDay : undefined,
      bondToday: typeof candidate.bondToday === 'number' && Number.isFinite(candidate.bondToday) && candidate.bondToday > 0 ? Math.min(1000, Math.floor(candidate.bondToday)) : undefined,
      evolutionPath: isRecord(candidate.evolutionPath) && typeof candidate.evolutionPath.branchId === 'string' && typeof candidate.evolutionPath.chosenAt === 'number'
        ? { branchId: candidate.evolutionPath.branchId, chosenAt: candidate.evolutionPath.chosenAt }
        : undefined,
    };
    // Drops a path that is malformed or no longer applies to this pet.
    return [normalizeEvolutionPath(pet)];
  }).slice(0, 48);
}

function normalizeHideoutEventHistory(value: unknown): SavedLokPet['hideoutEvents'] {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value)
    .filter(([id, at]) => id.length > 0 && id.length <= 40 && typeof at === 'number' && Number.isFinite(at) && at > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 40);
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, number>) : undefined;
}

function normalizeHideoutClaims(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).filter(
    ([id, at]) => id.length > 0 && id.length <= 48 && typeof at === 'number' && Number.isFinite(at) && at > 0,
  ) as Array<[string, number]>;
  return trimClaims(Object.fromEntries(entries.slice(0, MAX_CLAIMS * 4)));
}

function normalizeHideoutLedger(value: unknown): MetaState['hideoutLedger'] {
  if (!isRecord(value) || typeof value.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return emptyLedger();
  const granted: MetaState['hideoutLedger']['granted'] = {};
  if (isRecord(value.granted)) {
    for (const key of [...REWARD_KEYS, 'petExp'] as const) {
      const amount = value.granted[key];
      if (typeof amount === 'number' && Number.isFinite(amount) && amount > 0) granted[key] = Math.min(100_000, Math.floor(amount));
    }
  }
  const count = (raw: unknown) => (typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.min(1000, Math.floor(raw)) : 0);
  return { day: value.day, granted, events: count(value.events), rare: count(value.rare) };
}

function normalizePetNames(value: unknown): SavedLokPet['names'] {
  if (!isRecord(value)) return undefined;
  const out: NonNullable<SavedLokPet['names']> = {};
  for (const key of ['battle', 'callsYou', 'epithet', 'trueName'] as const) {
    const clean = typeof value[key] === 'string' ? sanitizePetName(value[key]) : '';
    if (clean) out[key] = clean;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function refreshStarterLokPets(pets: SavedLokPet[], now: number): SavedLokPet[] {
  let changed = false;
  const next = pets.map((pet) => {
    if (!pet.starter) return pet;
    const last = pet.lastFreeRefreshAt ?? now;
    const grants = Math.floor(Math.max(0, now - last) / STARTER_LOKPET_FREE_REFRESH_MS);
    if (grants < 1) return pet;
    changed = true;
    return {
      ...pet,
      stamina: PET_STAMINA_MAX,
      lastFreeRefreshAt: last + grants * STARTER_LOKPET_FREE_REFRESH_MS,
    };
  });
  return changed ? next : pets;
}

/**
 * Cards imported from another G-Six game. Kept strictly separate from
 * savedLokPets -- see VisitingLokCard's doc comment in types.ts -- so a
 * malformed or hostile save payload can never smuggle a combat-usable
 * kennel entry in through this field.
 */
function normalizeVisitingLokCards(value: unknown): VisitingLokCard[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((entry): VisitingLokCard[] => {
    if (!isRecord(entry)) return [];
    const { instanceId, assetId, name, sourceGame } = entry;
    if (typeof instanceId !== 'string' || !instanceId || seen.has(instanceId)) return [];
    if (typeof assetId !== 'string' || !assetId) return [];
    if (typeof name !== 'string' || !name) return [];
    if (typeof sourceGame !== 'string' || !sourceGame) return [];
    seen.add(instanceId);
    return [{
      instanceId,
      assetId,
      name,
      description: typeof entry.description === 'string' ? entry.description : undefined,
      rarity: typeof entry.rarity === 'string' && entry.rarity ? entry.rarity : 'common',
      sourceGame,
      tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      importedAt: Number.isFinite(entry.importedAt) ? Number(entry.importedAt) : Date.now(),
    }];
  }).slice(0, 120);
}

function replenishPetElixirs(meta: MetaState, now = Date.now()): Pick<MetaState, 'petElixirs' | 'petElixirUpdatedAt'> {
  const elapsed = Math.max(0, now - meta.petElixirUpdatedAt);
  const grants = Math.floor(elapsed / ELIXIR_GRANT_MS);
  return grants > 0
    ? { petElixirs: Math.min(ELIXIR_CAP, meta.petElixirs + grants * ELIXIR_GRANT_AMOUNT), petElixirUpdatedAt: meta.petElixirUpdatedAt + grants * ELIXIR_GRANT_MS }
    : { petElixirs: meta.petElixirs, petElixirUpdatedAt: meta.petElixirUpdatedAt };
}

/** Coerce an untrusted save payload into a usable MetaState. */
export function normalizeMeta(parsed: Partial<MetaState>): MetaState {
  const defaults = createInitialMeta();
  const liveModeEnabled = parsed.liveModeEnabled === true;
  const characterIds = new Set(CHARACTERS.map((c) => c.id));
  const areaIds = new Set(AREAS.map((a) => a.id));
  const allyIds = new Set(ALLIES.map((a) => a.id));
  const discoveryIds = new Set(DISCOVERIES.map((d) => d.id));
  const enemyIds = new Set(ENEMIES.map((e) => e.id));
  const episodeIds = new Set(CHARACTER_EPISODES.map((episode) => episode.id));
  const evolutionIds = new Set(Object.keys(EVOLUTIONS_BY_ID));
  const fatigueByCharacter: Record<string, number> = {};
  if (parsed.fatigueByCharacter && typeof parsed.fatigueByCharacter === 'object') {
    for (const [key, value] of Object.entries(parsed.fatigueByCharacter)) {
      if (characterIds.has(key) && typeof value === 'number' && Number.isFinite(value)) {
        fatigueByCharacter[key] = Math.min(MAX_FATIGUE_PCT, Math.max(0, value));
      }
    }
  }
  const characterLevelUps: Record<string, number> = {};
  if (parsed.characterLevelUps && typeof parsed.characterLevelUps === 'object') {
    for (const [key, value] of Object.entries(parsed.characterLevelUps)) {
      if (characterIds.has(key)) characterLevelUps[key] = counter(value);
    }
  }
  const parsedRecovery = parsed.recovery;
  const recovery: RecoverySession = {
    characterId:
      parsedRecovery && typeof parsedRecovery.characterId === 'string' && characterIds.has(parsedRecovery.characterId)
        ? parsedRecovery.characterId
        : null,
    locationId:
      parsedRecovery && typeof parsedRecovery.locationId === 'string' &&
      (RECOVERY_FACILITIES_BY_ID[parsedRecovery.locationId] || RECOVERY_HUTS.some((hut) => hut.id === parsedRecovery.locationId))
        ? parsedRecovery.locationId
        : 'rooftop',
    startedAt:
      parsedRecovery && typeof parsedRecovery.startedAt === 'number' && Number.isFinite(parsedRecovery.startedAt)
        ? parsedRecovery.startedAt
        : null,
    lastUpdatedAt:
      parsedRecovery && typeof parsedRecovery.lastUpdatedAt === 'number' && Number.isFinite(parsedRecovery.lastUpdatedAt)
        ? parsedRecovery.lastUpdatedAt
        : Date.now(),
  };
  const discoveredHutIds = idList(parsed.discoveredHutIds, new Set(RECOVERY_HUTS.map((hut) => hut.id)), []);
  const tier =
    typeof parsed.facilityTier === 'string' && RECOVERY_FACILITIES_BY_ID[parsed.facilityTier]
      ? parsed.facilityTier as FacilityTier
      : 'tub';
  const crewActivitySeed =
    typeof parsed.crewActivitySeed === 'number' && Number.isFinite(parsed.crewActivitySeed)
      ? Math.max(0, Math.floor(parsed.crewActivitySeed))
      : 0;

  const bestiary: Record<string, number> = {};
  if (parsed.bestiary && typeof parsed.bestiary === 'object') {
    for (const [key, value] of Object.entries(parsed.bestiary)) {
      if (enemyIds.has(key)) bestiary[key] = counter(value);
    }
  }

  const savedUnlockedCharacterIds = idList(
    parsed.unlockedCharacterIds,
    characterIds,
    defaults.unlockedCharacterIds,
  );
  // Starting characters are part of the game's arrival story, not a one-time
  // save creation detail. Add them during hydration so a returning player
  // receives any starter character introduced after their save was made.
  const unlockedCharacterIds = [...new Set([
    ...savedUnlockedCharacterIds,
    ...CHARACTERS.filter((character) => character.unlock.kind === 'default').map((character) => character.id),
  ])];
  const selectedCharacterId =
    typeof parsed.selectedCharacterId === 'string' &&
    unlockedCharacterIds.includes(parsed.selectedCharacterId)
      ? parsed.selectedCharacterId
      : (unlockedCharacterIds[0] ?? defaults.selectedCharacterId);
  const rescuedAllyIds = idList(parsed.rescuedAllyIds, allyIds, []);
  const crewActivityByAlly = normalizeCrewActivities(
    parsed.crewActivityByAlly,
    rescuedAllyIds,
    crewActivitySeed,
  );
  const completedEpisodeIds = idList(parsed.completedEpisodeIds, episodeIds, []);
  const characterSkinByCharacterId: Record<string, string> = {};
  if (parsed.characterSkinByCharacterId && typeof parsed.characterSkinByCharacterId === 'object') {
    for (const character of CHARACTERS) {
      const requested = parsed.characterSkinByCharacterId[character.id];
      const skin = getCharacterSkins(character).find((entry) => entry.id === requested);
      const characterEpisode = CHARACTER_EPISODES.find((entry) => entry.characterId === character.id);
      if (skin && isCharacterSkinUnlocked(skin, rescuedAllyIds.length, Boolean(characterEpisode && completedEpisodeIds.includes(characterEpisode.id)))) {
        characterSkinByCharacterId[character.id] = skin.id;
      }
    }
  }
  const episodeProgressById: Record<string, number> = {};
  if (parsed.episodeProgressById && typeof parsed.episodeProgressById === 'object') {
    for (const [episodeId, value] of Object.entries(parsed.episodeProgressById)) {
      const definition = CHARACTER_EPISODES_BY_ID[episodeId];
      if (!definition || typeof value !== 'number' || !Number.isFinite(value)) continue;
      episodeProgressById[episodeId] = Math.min(
        definition.objective.targetCount,
        Math.max(0, Math.floor(value)),
      );
    }
  }
  const completedSectorMissionIds = idList(
    parsed.completedSectorMissionIds,
    new Set(SECTOR_MISSIONS.map((mission) => mission.id)),
    [],
  );
  const knownRelicIds = idList(
    parsed.knownRelicIds,
    new Set(CITY_RELICS.map((relic) => relic.id)),
    [],
  );
  const endlessDiscoveryIds = normalizeEndlessDiscoveries(parsed.endlessDiscoveryIds);
  const customMaps = normalizeCustomMaps(parsed.customMaps);
  const ownedUiThemeIds = normalizeOwnedUiThemeIds(parsed.ownedUiThemeIds);
  const ownedRunAuraIds = normalizeOwnedRunAuraIds(parsed.ownedRunAuraIds);
  const ownedHatIds = normalizeOwnedIds(parsed.ownedHatIds, HATS.map((hat) => hat.id), DEFAULT_HAT_ID);
  const ownedCelebrationIds = normalizeOwnedIds(parsed.ownedCelebrationIds, CELEBRATIONS.map((entry) => entry.id), DEFAULT_CELEBRATION_ID);
  const today = contractDayKey();
  const savedContractDay = typeof parsed.dailyContractDayKey === 'string' ? parsed.dailyContractDayKey : today;
  const dailyContractDayKey = savedContractDay === today ? savedContractDay : today;
  const validContractIds = new Set(dailyContractDefs(dailyContractDayKey).map((contract) => contract.id));
  const dailyContractProgressById: Record<string, number> = {};
  if (dailyContractDayKey === savedContractDay && parsed.dailyContractProgressById && typeof parsed.dailyContractProgressById === 'object') {
    for (const [id, value] of Object.entries(parsed.dailyContractProgressById)) {
      if (validContractIds.has(id) && typeof value === 'number' && Number.isFinite(value)) {
        dailyContractProgressById[id] = Math.max(0, Math.floor(value));
      }
    }
  }
  const completedDailyContractIds = dailyContractDayKey === savedContractDay && Array.isArray(parsed.completedDailyContractIds)
    ? parsed.completedDailyContractIds.filter((id): id is string => typeof id === 'string' && validContractIds.has(id))
    : [];
  const lastLoginStreakDayKey = typeof parsed.lastLoginStreakDayKey === 'string' ? parsed.lastLoginStreakDayKey : '';
  const loginStreakCount = typeof parsed.loginStreakCount === 'number' && Number.isFinite(parsed.loginStreakCount)
    ? Math.max(0, Math.floor(parsed.loginStreakCount))
    : 0;
  const explicitEvolutionIds = idList(parsed.unlockedEvolutionIds, evolutionIds, []).filter((evolutionId) => {
    const evolution = EVOLUTIONS_BY_ID[evolutionId];
    return Boolean(evolution?.episodeId && completedEpisodeIds.includes(evolution.episodeId));
  });
  const completedEvolutionIds = completedEpisodeIds
    .map((episodeId) => CHARACTER_EPISODES_BY_ID[episodeId]?.evolutionId)
    .filter((evolutionId): evolutionId is string => Boolean(evolutionId));
  const unlockedEvolutionIds = [...new Set([...explicitEvolutionIds, ...completedEvolutionIds])];
  const savedLokPets = refreshStarterLokPets(normalizeSavedLokPets(parsed.savedLokPets), Date.now());
  const cardCollection = normalizeCardCollection(parsed.cardCollection);
  const ownedPassiveIds = new Set(cardCollection.filter((record) => PASSIVE_CARDS_BY_ID[record.cardId]).map((record) => record.cardId));
  const ownedCardIds = new Set(cardCollection.filter((record) => record.copies > 0).map((record) => record.cardId));
  const recoveredElixirs = replenishPetElixirs({
    ...defaults,
    petElixirs: Math.min(ELIXIR_CAP, counter(parsed.petElixirs ?? 3)),
    petElixirUpdatedAt: Math.max(0, typeof parsed.petElixirUpdatedAt === 'number' ? parsed.petElixirUpdatedAt : Date.now()),
  });
  const ownedGeneratorIds = idList(parsed.ownedGeneratorIds, new Set(RENTABLE_GENERATORS.map((g) => g.id)), []);
  const settledGeneratorIncome = settleGeneratorIncome({
    ...defaults,
    cred: counter(parsed.cred),
    ownedGeneratorIds,
    generatorAccrualAt: Math.max(0, typeof parsed.generatorAccrualAt === 'number' ? parsed.generatorAccrualAt : Date.now()),
  });
  const clearedAreaIds = idList(parsed.clearedAreaIds, areaIds, []);
  const savedTotalKills = counter(parsed.totalKills);
  const fabricatedGrpdIds = idList(parsed.grpdUnlockedWeaponIds, GRPD_PLAYABLE_WEAPON_IDS, []).filter((id) => !isGrpdEndgameWeapon(id));
  const earnedEndgameGrpdIds = [...GRPD_PLAYABLE_WEAPON_IDS].filter((id) => grpdEndgameWeaponEarned(id, savedTotalKills, endgameReached({ clearedAreaIds })));
  const activeGrpdIds = idList(parsed.grpdActiveWeaponIds, new Set([...fabricatedGrpdIds, ...earnedEndgameGrpdIds]), []);

  return {
    version: META_VERSION,
    devModeAccessUnlocked: parsed.devModeAccessUnlocked === true,
    devModeAllUnlocks: parsed.devModeAccessUnlocked === true && parsed.devModeAllUnlocks === true,
    physicsObjectClicksEnabled: parsed.physicsObjectClicksEnabled !== false,
    levelUpPausesEnabled: !liveModeEnabled && parsed.levelUpPausesEnabled !== false,
    liveModeEnabled,
    lootPresentation: liveModeEnabled || parsed.lootPresentation === 'queue' ? 'queue' : 'auto-pause',
    levelUpPresentation:
      parsed.levelUpPresentation === 'random-live' || parsed.levelUpPresentation === 'compact-live'
        ? parsed.levelUpPresentation
        : liveModeEnabled || parsed.levelUpPausesEnabled === false ? 'compact-live' : 'pause-focus',
    pauseMapVisible: parsed.pauseMapVisible !== false,
    graphicsQuality:
      parsed.graphicsQuality === 'balanced' || parsed.graphicsQuality === 'performance'
        ? parsed.graphicsQuality
        : 'high',
    companionRevealStyle: parsed.companionRevealStyle === 'classic' ? 'classic' : 'ambush',
    frameRateMode: parsed.frameRateMode === 120 ? 120 : 60,
    soundtrackObjectiveCompletions: counter(parsed.soundtrackObjectiveCompletions),
    fogAmbianceMode:
      parsed.fogAmbianceMode === 'dark-maps' ||
      parsed.fogAmbianceMode === 'always' ||
      parsed.fogAmbianceMode === 'off'
        ? parsed.fogAmbianceMode
        : 'auto',
    glowingEyesIntensity:
      parsed.glowingEyesIntensity === 'lil' ||
      parsed.glowingEyesIntensity === 'lot' ||
      parsed.glowingEyesIntensity === 'off'
        ? parsed.glowingEyesIntensity
        : 'mid',
    crowdAutoZoomEnabled: parsed.crowdAutoZoomEnabled !== false,
    wildlifeSheltersInRain: parsed.wildlifeSheltersInRain !== false,
    minimapVisible: parsed.minimapVisible !== false,
    minimapExpanded: parsed.minimapExpanded !== false,
    minimapPosition: normalizedPosition(parsed.minimapPosition, defaults.minimapPosition),
    worldInvertEnabled: parsed.worldInvertEnabled === true,
    paletteInvertEnabled: parsed.paletteInvertEnabled === true,
    mirrorModeEnabled: parsed.mirrorModeEnabled === true,
    uiDensity: parsed.uiDensity === 'list' ? 'list' : 'grid',
    lokPetArtStyle:
      parsed.lokPetArtStyle === 'neon-signal' || parsed.lokPetArtStyle === 'holo-card'
        ? parsed.lokPetArtStyle
        : 'pixel-core',
    uiBorderStyle:
      parsed.uiBorderStyle === 'soft' || parsed.uiBorderStyle === 'round'
        ? parsed.uiBorderStyle
        : 'square',
    lokPetBorderStyle:
      parsed.lokPetBorderStyle === 'soft' || parsed.lokPetBorderStyle === 'round'
        ? parsed.lokPetBorderStyle
        : 'square',
    characterBorderStyle:
      parsed.characterBorderStyle === 'soft' || parsed.characterBorderStyle === 'round'
        ? parsed.characterBorderStyle
        : 'square',
    musicReactiveEnabled: parsed.musicReactiveEnabled !== false,
    sfxEnabled: parsed.sfxEnabled !== false,
    // Opt-in, unlike the other audio toggles: ambience should never start
    // making noise on its own for a returning save that predates it.
    hideoutAmbienceEnabled: parsed.hideoutAmbienceEnabled === true,
    hideoutWeatherEnabled: parsed.hideoutWeatherEnabled !== false,
    hideoutArrivalEnabled: parsed.hideoutArrivalEnabled !== false,
    // Falls back to the pre-existing standalone localStorage toggle
    // (AttractMode.tsx's old component-local key) so a player who already
    // turned the background sim off doesn't see it silently re-enabled.
    attractModeEnabled: typeof parsed.attractModeEnabled === 'boolean'
      ? parsed.attractModeEnabled
      : !(typeof window !== 'undefined' && window.localStorage.getItem('survivor616.attractMode') === 'off'),
    hideoutSectionsCollapsedByDefault: parsed.hideoutSectionsCollapsedByDefault === true,
    hideoutPreviewEnabled: parsed.hideoutPreviewEnabled !== false,
    hideoutPets: parsed.hideoutPets === 'companion' || parsed.hideoutPets === 'off' ? parsed.hideoutPets : 'all',
    hideoutEvents: parsed.hideoutEvents === 'quiet' || parsed.hideoutEvents === 'off' ? parsed.hideoutEvents : 'on',
    hideoutInteractive: parsed.hideoutInteractive !== false,
    hideoutPetPlay: parsed.hideoutPetPlay !== false,
    hideoutChoiceEvents: parsed.hideoutChoiceEvents === 'quiet' || parsed.hideoutChoiceEvents === 'off' ? parsed.hideoutChoiceEvents : 'on',
    hideoutClaims: normalizeHideoutClaims(parsed.hideoutClaims),
    hideoutLedger: normalizeHideoutLedger(parsed.hideoutLedger),
    hideoutStickyHeadOutEnabled: parsed.hideoutStickyHeadOutEnabled !== false,
    splashTextEnabled: parsed.splashTextEnabled !== false,
    oneLineTitleEnabled: parsed.oneLineTitleEnabled === true,
    introTitlePhysicsEnabled: parsed.introTitlePhysicsEnabled !== false,
    introTitleReturnDelaySec: clampIntroReturnDelay(parsed.introTitleReturnDelaySec),
    travelEncountersEnabled: parsed.travelEncountersEnabled !== false,
    paletteAnimationsEnabled: parsed.paletteAnimationsEnabled !== false,
    worldPaletteBlendEnabled: parsed.worldPaletteBlendEnabled !== false,
    // Opt-in: recoloring enemies/environment is a bigger visual change than
    // the player-only blend, so a returning save keeps the original look
    // until the player turns this on deliberately.
    worldColorFullRecolorEnabled: parsed.worldColorFullRecolorEnabled === true,
    gyroEnabled: parsed.gyroEnabled === true,
    // Defaults to false on every load, including projects saved before this
    // existed -- remote code is never enabled by an upgrade.
    studioPluginsEnabled: parsed.studioPluginsEnabled === true,
    // 'auto' (the default for a save predating this) follows the device's
    // own viewport rather than forcing either layout on a returning player.
    studioLayout: parsed.studioLayout === 'mobile' || parsed.studioLayout === 'desktop' ? parsed.studioLayout : 'auto',
    gyroSensitivity: clampGyroSensitivity(parsed.gyroSensitivity),
    gyroInvertY: parsed.gyroInvertY === true,
    selectedCharacterId,
    characterSkinByCharacterId,
    unlockedCharacterIds,
    clearedAreaIds,
    rescuedAllyIds,
    discoveryIds: idList(parsed.discoveryIds, discoveryIds, []),
    lokPetCatalog: normalizeLokPetCatalog(parsed.lokPetCatalog),
    lokPetHistory: normalizeLokPetHistory(parsed.lokPetHistory),
    savedLokPets,
    selectedLokPetIds: savedLokPets
      .filter((pet) => (pet.starter || pet.stamina > 0) && Array.isArray(parsed.selectedLokPetIds) && parsed.selectedLokPetIds.includes(pet.id))
      .map((pet) => pet.id)
      .slice(0, lokPetTeamCapacity(getCharacter(selectedCharacterId))),
    visitingLokCards: normalizeVisitingLokCards(parsed.visitingLokCards),
    ...recoveredElixirs,
    bestiary,
    totalKills: savedTotalKills,
    grpdSpentSeals: counter(parsed.grpdSpentSeals),
    grpdUnlockedWeaponIds: fabricatedGrpdIds,
    grpdActiveWeaponIds: activeGrpdIds,
    grpdSpawnTierByWeaponId: Object.fromEntries(
      Object.entries(parsed.grpdSpawnTierByWeaponId ?? {})
        .filter(([id]) => GRPD_PLAYABLE_WEAPON_IDS.has(id))
        .map(([id, tier]) => [id, Math.max(1, Math.min(GRPD_MAX_SPAWN_MULTIPLIER, Math.floor(Number(tier) || 1)))]),
    ),
    grpdAutoIncreaseEnabled: parsed.grpdAutoIncreaseEnabled !== false,
    grpdArmoryAnchor: parsed.grpdArmoryAnchor === 'hideout' ? 'hideout' : 'station',
    totalRuns: counter(parsed.totalRuns),
    bestSurvivalSec: counter(parsed.bestSurvivalSec),
    totalLevelUps: counter(parsed.totalLevelUps),
    ...settledGeneratorIncome,
    lootTokens: counter(parsed.lootTokens),
    cardCredits: counter(parsed.cardCredits),
    cardCollection,
    unopenedCardPacks: normalizeUnopenedCardPacks(parsed.unopenedCardPacks),
    autoOpenPacksEnabled: parsed.autoOpenPacksEnabled !== false,
    activePassiveCardIds: Array.isArray(parsed.activePassiveCardIds) ? [...new Set(parsed.activePassiveCardIds.filter((id): id is string => typeof id === 'string' && ownedPassiveIds.has(id)))].slice(0, 5) : [],
    battleDeckCardIds: Array.isArray(parsed.battleDeckCardIds) ? [...new Set(parsed.battleDeckCardIds.filter((id): id is string => typeof id === 'string' && ownedCardIds.has(id)))].slice(0, BATTLE_DECK_SLOTS) : [],
    cardSalvageUnlocked: parsed.cardSalvageUnlocked === true,
    handheldDigiScopeOwned: parsed.handheldDigiScopeOwned === true || parsed.cardSalvageUnlocked === true,
    miningHelmetOwned: parsed.miningHelmetOwned === true,
    rancherWhistleOwned: parsed.rancherWhistleOwned === true,
    eclipseMonocleOwned: parsed.eclipseMonocleOwned === true,
    cardFrameSleeves: Array.isArray(parsed.cardFrameSleeves) && parsed.cardFrameSleeves.length > 0 ? (parsed.cardFrameSleeves as string[]) : ['frame-classic'],
    selectedCardFrame: typeof parsed.selectedCardFrame === 'string' ? parsed.selectedCardFrame : 'frame-classic',
    lokCollectorRuns: counter(parsed.lokCollectorRuns),
    lokCollectorPetsFound: counter(parsed.lokCollectorPetsFound),
    lokPetLeagueTier: counter(parsed.lokPetLeagueTier),
    lokPetBattleWins: counter(parsed.lokPetBattleWins),
    lokPetBattleBadges: Array.isArray(parsed.lokPetBattleBadges) ? parsed.lokPetBattleBadges.filter((b): b is string => typeof b === 'string') : [],
    lokPetTreats: typeof parsed.lokPetTreats === 'number' && parsed.lokPetTreats >= 0 ? Math.floor(parsed.lokPetTreats) : 3,
    skeletonKeys: counter(parsed.skeletonKeys),
    ownedGeneratorIds,
    runModifiers: normalizeRunModifiers(parsed.runModifiers),
    onboarded: parsed.onboarded === true,
    starterLokPetOnboardingComplete: parsed.starterLokPetOnboardingComplete === true,
    starterLokPetVariantId: typeof parsed.starterLokPetVariantId === 'string' && isStarterLokPetId(parsed.starterLokPetVariantId)
      ? parsed.starterLokPetVariantId
      : null,
    endlessRecordDistancePx: counter(parsed.endlessRecordDistancePx),
    endlessRecordDepth: counter(parsed.endlessRecordDepth),
    endlessDiscoveryIds,
    fatigueByCharacter,
    characterLevelUps,
    recovery,
    facilityTier: tier,
    discoveredHutIds,
    vendorPurchases: normalizeVendorPurchases(parsed.vendorPurchases),
    crewActivityByAlly,
    crewActivitySeed,
    activeCrewRumor: normalizeActiveCrewRumor(
      parsed.activeCrewRumor,
      rescuedAllyIds,
      crewActivityByAlly,
      crewActivitySeed,
    ),
    hideoutVisitCount: counter(parsed.hideoutVisitCount),
    primeTakeoverVisitsRemaining: counter(parsed.primeTakeoverVisitsRemaining),
    primeTakeoverUntil: counter(parsed.primeTakeoverUntil),
    completedEpisodeIds,
    unlockedEvolutionIds,
    episodeProgressById,
    completedSectorMissionIds,
    knownRelicIds,
    customMaps,
    uiPanelLayout: parsed.uiPanelLayout === 'slideout' ? 'slideout' : 'rail',
    ownedUiThemeIds,
    uiTheme: normalizeUiTheme(parsed.uiTheme, ownedUiThemeIds),
    uiThemeSwatchByTheme: normalizeUiThemeSwatchByTheme(parsed.uiThemeSwatchByTheme),
    themeCycleMastered: parsed.themeCycleMastered === true,
    themeCycleCollection: parsed.themeCycleMastered === true && parsed.themeCycleCollection === 'owned' ? 'owned' : 'starter',
    ownedPaletteIds: normalizeOwnedPaletteIds(parsed.ownedPaletteIds),
    activePaletteId: normalizePaletteId(parsed.activePaletteId, normalizeOwnedPaletteIds(parsed.ownedPaletteIds)),
    ownedSoundPackIds: normalizeOwnedSoundPackIds(parsed.ownedSoundPackIds),
    activeSoundPackId: normalizeSoundPackId(parsed.activeSoundPackId, normalizeOwnedSoundPackIds(parsed.ownedSoundPackIds)),
    ownedRunAuraIds,
    activeRunAuraId: normalizeRunAuraId(parsed.activeRunAuraId, ownedRunAuraIds),
    ownedHatIds,
    activeHatId: normalizeOwnedCosmeticId(parsed.activeHatId, ownedHatIds, DEFAULT_HAT_ID),
    ownedCelebrationIds,
    activeCelebrationId: normalizeOwnedCosmeticId(parsed.activeCelebrationId, ownedCelebrationIds, DEFAULT_CELEBRATION_ID),
    dailyContractDayKey,
    dailyContractProgressById,
    completedDailyContractIds: [...new Set(completedDailyContractIds)],
    lastLoginStreakDayKey,
    loginStreakCount,
    claimedAchievementIds: idList(
      parsed.claimedAchievementIds,
      new Set(ACHIEVEMENTS.map((achievement) => achievement.id)),
      [],
    ),
    defeatedDirectorIds: idList(
      parsed.defeatedDirectorIds,
      new Set(DIRECTORS.map((director) => director.id)),
      [],
    ),
    directorModeUnlocked: parsed.directorModeUnlocked === true,
    activeDirectorPersonalityId:
      typeof parsed.activeDirectorPersonalityId === 'string' &&
      DIRECTORS.some((director) => director.id === parsed.activeDirectorPersonalityId)
        ? parsed.activeDirectorPersonalityId
        : null,
    pendingSaunaReward:
      parsed.pendingSaunaReward &&
      typeof parsed.pendingSaunaReward === 'object' &&
      typeof (parsed.pendingSaunaReward as { weaponId?: unknown }).weaponId === 'string'
        ? { weaponId: (parsed.pendingSaunaReward as { weaponId: string }).weaponId }
        : null,
    threatMatrixUnlocked: parsed.threatMatrixUnlocked === true,
    disabledEnemyIds: Array.isArray(parsed.disabledEnemyIds)
      ? parsed.disabledEnemyIds.filter((id): id is string => typeof id === 'string')
      : [],
    disabledWeaponIds: Array.isArray(parsed.disabledWeaponIds)
      ? parsed.disabledWeaponIds.filter((id): id is string => typeof id === 'string')
      : [],
    disabledPassiveIds: Array.isArray(parsed.disabledPassiveIds)
      ? parsed.disabledPassiveIds.filter((id): id is string => typeof id === 'string')
      : [],
    threatCalibrations: normalizeThreatCalibrations(parsed.threatCalibrations),
    threatUpgrades: typeof parsed.threatUpgrades === 'object' && parsed.threatUpgrades !== null
      ? (parsed.threatUpgrades as Record<string, boolean>)
      : {},
    dvdEasterEggUnlocked: parsed.dvdEasterEggUnlocked === true,
    // Never carried across a reload -- a stale toast from a session that
    // never got to see it should not resurface out of context later.
    pendingNotifications: [],
    // Missing on any save from before this field existed -- '0.0.0' means
    // "older than every real version," so those players see the update
    // popup summarizing everything they missed, once.
    lastSeenChangelogVersion: typeof parsed.lastSeenChangelogVersion === 'string' ? parsed.lastSeenChangelogVersion : '0.0.0',
    updatePopupKinds: normalizeUpdatePopupKinds(parsed.updatePopupKinds),
    relicMaterials: typeof parsed.relicMaterials === 'object' && parsed.relicMaterials !== null
      ? (parsed.relicMaterials as Record<string, number>)
      : { 'phosphor-ore': 6, 'silicon-alloy': 8, 'cyber-resin': 6, 'prism-quartz': 2 },
    craftedRelicIds: Array.isArray(parsed.craftedRelicIds)
      ? parsed.craftedRelicIds.filter((id): id is string => typeof id === 'string')
      : [],
    ownedKeyItemIds: Array.isArray(parsed.ownedKeyItemIds)
      ? [...new Set([...parsed.ownedKeyItemIds.filter((id): id is string => typeof id === 'string'), 'digiscope'])]
      : ['digiscope'],
    unlockedCardCustomizations: Array.isArray(parsed.unlockedCardCustomizations)
      ? [...new Set([...parsed.unlockedCardCustomizations.filter((id): id is string => typeof id === 'string'), 'frame-standard'])]
      : ['frame-standard'],
    cardCustomizationsByCardId: typeof parsed.cardCustomizationsByCardId === 'object' && parsed.cardCustomizationsByCardId !== null
      ? (parsed.cardCustomizationsByCardId as Record<string, { frame?: string; overlay?: string; companionSeal?: string }>)
      : {},
  };
}

/**
 * Parses and validates a raw JSON save string, returning a fully normalised
 * MetaState or null if the JSON is malformed or missing a usable version.
 *
 * Only garbage (unparsable JSON, or a missing/non-numeric version) is
 * rejected -- an unrecognised version *value* is not, since normalizeMeta
 * already backfills every field against createInitialMeta() defaults. So a
 * save from an older or newer META_VERSION than this build still loads
 * safely, without a hardcoded list of known-good versions needing a manual
 * entry added on every content release (a save from version 16 read by a
 * client still on 15 should keep the player's progress, not nuke it).
 */
function parseAndNormalizeMeta(raw: string): MetaState | null {
  const parsed = JSON.parse(raw) as Partial<MetaState>;
  if (parsed === null || typeof parsed !== 'object') return null;
  if (typeof parsed.version !== 'number' || !Number.isFinite(parsed.version) || parsed.version < 1) return null;
  // Hand-edited or half-written saves must never brick the game, so every
  // field is normalised against the defaults rather than merged blindly.
  return normalizeMeta(parsed);
}

export function loadMeta(): MetaState {
  if (typeof window === 'undefined') return createInitialMeta();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialMeta();
    return parseAndNormalizeMeta(raw) ?? createInitialMeta();
  } catch (error) {
    console.warn('Could not read saved progress, starting fresh.', error);
    return createInitialMeta();
  }
}

/** Parses an arbitrary JSON string (e.g. an imported save file) into a safe MetaState, or null if it isn't one. */
export function parseMetaFile(raw: string): MetaState | null {
  try {
    return parseAndNormalizeMeta(raw);
  } catch {
    return null;
  }
}

export function serializeMeta(meta: MetaState): string {
  return JSON.stringify(meta, null, 2);
}

function saveMeta(meta: MetaState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
  } catch (error) {
    // A full or blocked storage quota must not break the game.
    console.warn('Could not save progress.', error);
  }
}

/* ------------------------------------------------------------------ */
/* Unlock evaluation                                                   */
/* ------------------------------------------------------------------ */

export function isUnlocked(rule: UnlockRule | undefined | null, meta: MetaState): boolean {
  if (meta.devModeAllUnlocks) return true;
  if (!rule || !rule.kind) return true;

  switch (rule.kind) {
    case 'default':
      return true;
    case 'rescue':
      return meta.rescuedAllyIds.includes(rule.allyId);
    case 'clearArea':
      return meta.clearedAreaIds.includes(rule.areaId);
    case 'discovery':
      return meta.discoveryIds.includes(rule.discoveryId);
    case 'kills':
      return meta.totalKills >= rule.count;
    case 'lokPetCards':
      return meta.lokPetCatalog.length >= rule.count;
    case 'lokCollector':
      return meta.lokCollectorRuns >= rule.runs && meta.lokCollectorPetsFound >= rule.lokPets;
    default:
      return false;
  }
}

export function describeUnlock(rule: UnlockRule): string {
  switch (rule.kind) {
    case 'default':
      return 'Available from the start';
    case 'rescue':
      return `Rescue ${ALLIES_BY_ID[rule.allyId]?.name ?? rule.allyId}`;
    case 'clearArea':
      return `Clear ${AREAS.find((a) => a.id === rule.areaId)?.name ?? rule.areaId}`;
    case 'discovery':
      return 'Find a hidden location';
    case 'kills':
      return `Defeat ${rule.count} enemies`;
    case 'lokPetCards':
      return `Catalogue ${rule.count} LokPet cards`;
    case 'lokCollector':
      return `Collector challenge: ${rule.runs} runs and ${rule.lokPets} LokPets caught`;
    default:
      return 'Locked';
  }
}

export type EpisodeStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export function episodeStatus(episodeId: string, meta: MetaState): EpisodeStatus {
  const episode = CHARACTER_EPISODES_BY_ID[episodeId];
  if (!episode) return 'locked';
  if (meta.completedEpisodeIds.includes(episode.id)) return 'completed';
  const characterUnlocked = meta.unlockedCharacterIds.includes(episode.characterId) || meta.devModeAllUnlocks;
  if (!characterUnlocked || !isUnlocked(episode.unlock, meta)) return 'locked';
  return (meta.episodeProgressById[episode.id] ?? 0) > 0 ? 'in-progress' : 'available';
}

export function episodeProgress(episodeId: string, meta: MetaState): number {
  const episode = CHARACTER_EPISODES_BY_ID[episodeId];
  if (!episode) return 0;
  return Math.min(episode.objective.targetCount, Math.max(0, Math.floor(meta.episodeProgressById[episode.id] ?? 0)));
}

function validEpisodeResult(result: RunResult): CharacterEpisodeDef | undefined {
  const record = result.episode;
  if (!record) return undefined;
  const definition = CHARACTER_EPISODES_BY_ID[record.id];
  if (!definition || definition.characterId !== result.characterId || definition.areaId !== result.areaId) return undefined;
  if (record.target !== definition.objective.targetCount || record.objectiveLabel !== definition.objective.label) return undefined;
  return definition;
}

/** Total permanent stat boost granted by every rescued ally. */
export function allyBoostTotals(meta: MetaState): Partial<BaseStats> {
  const totals: Partial<BaseStats> = {};
  for (const id of meta.rescuedAllyIds) {
    const ally = ALLIES_BY_ID[id];
    if (!ally) continue;
    for (const [key, value] of Object.entries(ally.boost) as Array<[keyof BaseStats, number]>) {
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

/** A character's stats after permanent ally boosts are applied. */
export function effectiveStats(character: CharacterDef, meta: MetaState, ignoreFatigue = false): BaseStats {
  const settled = settleRecovery(meta);
  const boosts = allyBoostTotals(meta);
  const stats: BaseStats = { ...character.stats };
  for (const [key, value] of Object.entries(boosts) as Array<[keyof BaseStats, number]>) {
    stats[key] = stats[key] + value;
  }
  for (const effect of crewActivityEffects(meta)) {
    if (effect.add) stats[effect.stat] += effect.add;
    if (effect.mult) stats[effect.stat] *= effect.mult;
  }
  for (const item of VENDOR_CATALOG) {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    if (!stacks) continue;
    for (const effect of item.effects ?? []) {
      if (effect.kind !== 'stat') continue;
      if (effect.add) stats[effect.stat] += effect.add * stacks;
      if (effect.mult) stats[effect.stat] *= Math.pow(effect.mult, stacks);
      if (effect.cap !== undefined) stats[effect.stat] = Math.min(stats[effect.stat], effect.cap);
    }
  }
  const masteryLevel = characterLevelProgress(meta, character.id).level;
  const masteryStacks = Math.max(0, masteryLevel - 1);
  if (masteryStacks > 0) {
    for (const effect of CHARACTER_MASTERY_STAT_EFFECTS) {
      if (effect.kind !== 'stat') continue;
      if (effect.add) stats[effect.stat] += effect.add * masteryStacks;
      if (effect.mult) stats[effect.stat] *= Math.pow(effect.mult, masteryStacks);
      if (effect.cap !== undefined) stats[effect.stat] = Math.min(stats[effect.stat], effect.cap);
    }
  }
  const cards = activeCardEffects(meta);
  for (const [stat, multiplier] of Object.entries(cards.statMults) as Array<[keyof BaseStats, number]>) stats[stat] *= multiplier;
  stats.magnet *= cards.magnetMult;
  stats.armor = Math.min(stats.armor, 0.6);
  if (!ignoreFatigue) {
    const fatigue = Math.min(MAX_FATIGUE_PCT, Math.max(0, settled.fatigueByCharacter[character.id] ?? 0)) / 100;
    stats.maxHp *= 1 - fatigue;
    stats.speed *= 1 - fatigue;
    stats.power *= 1 - fatigue;
    stats.area *= 1 - fatigue;
    stats.magnet *= 1 - fatigue;
    stats.armor = Math.max(0, stats.armor * (1 - fatigue));
    stats.haste *= 1 + fatigue;
  }
  return stats;
}

export interface CharacterFatigueSummary {
  fatiguePct: number;
  maxFatiguePct: number;
  isFatigued: boolean;
  effectiveStats: BaseStats;
  restedStats: BaseStats;
  diffs: {
    maxHp: number;
    speed: number;
    power: number;
    armor: number;
    haste: number;
    area: number;
    magnet: number;
  };
}

export function getCharacterFatigueSummary(character: CharacterDef, meta: MetaState): CharacterFatigueSummary {
  const fatiguePct = currentFatiguePct(meta, character.id);
  const effective = effectiveStats(character, meta, false);
  const rested = effectiveStats(character, meta, true);
  return {
    fatiguePct,
    maxFatiguePct: MAX_FATIGUE_PCT,
    isFatigued: fatiguePct > 0,
    effectiveStats: effective,
    restedStats: rested,
    diffs: {
      maxHp: effective.maxHp - rested.maxHp,
      speed: effective.speed - rested.speed,
      power: effective.power - rested.power,
      armor: effective.armor - rested.armor,
      haste: effective.haste - rested.haste,
      area: effective.area - rested.area,
      magnet: effective.magnet - rested.magnet,
    },
  };
}

/**
 * Level-ups needed to advance past `level`, for the lifetime player level.
 * Mirrors the shape of `xpForLevel()` in engine/world.ts (a linear plus
 * superlinear term, so it climbs quickly at first and increasingly slowly)
 * but rescaled for `totalLevelUps` -- a lifetime count of level-ups across
 * every run, not a single run's XP -- so there's no level cap, ever.
 */
function levelUpsForPlayerLevel(level: number): number {
  return Math.round(4 + level * 3 + Math.pow(level, 1.5) * 1.2);
}

/** Derives the persistent player level from `meta.totalLevelUps`. */
export function playerLevelProgress(totalLevelUps: number): {
  level: number;
  levelUpsIntoLevel: number;
  levelUpsToNext: number;
} {
  let level = 1;
  let remaining = Math.max(0, totalLevelUps);
  let needed = levelUpsForPlayerLevel(level);
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = levelUpsForPlayerLevel(level);
  }
  return { level, levelUpsIntoLevel: remaining, levelUpsToNext: needed };
}

/**
 * Level-ups needed to advance past `level`, for a single character's own
 * lifetime mastery level. Same growing-curve shape as `levelUpsForPlayerLevel`
 * but gentler -- a single character accumulates level-ups slower than the
 * account-wide total, so its own levels should still come at a reasonable pace.
 */
function levelUpsForCharacterLevel(level: number): number {
  return Math.round(3 + level * 2 + Math.pow(level, 1.4) * 0.9);
}

/** Derives a character's persistent mastery level from `meta.characterLevelUps[characterId]`. */
export function characterLevelProgress(meta: MetaState, characterId: string): {
  level: number;
  levelUpsIntoLevel: number;
  levelUpsToNext: number;
} {
  let level = 1;
  let remaining = Math.max(0, meta.characterLevelUps[characterId] ?? 0);
  let needed = levelUpsForCharacterLevel(level);
  while (remaining >= needed) {
    remaining -= needed;
    level += 1;
    needed = levelUpsForCharacterLevel(level);
  }
  return { level, levelUpsIntoLevel: remaining, levelUpsToNext: needed };
}

/** Permanent utility bonuses used when constructing a new run. */
export function startingWeaponLevel(meta: MetaState): number {
  const levelBoost = VENDOR_CATALOG.reduce((total, item) => {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    return total + (item.effects ?? []).reduce(
      (sum, effect) => sum + (effect.kind === 'utility' && effect.utility === 'starting-weapon-level' ? effect.amount * stacks : 0),
      0,
    );
  }, 0);
  return Math.min(8, 1 + levelBoost);
}

/** Whether the player owns the "extra life" vendor item for this run. */
export function hasExtraLife(meta: MetaState): boolean {
  return VENDOR_CATALOG.some((item) => {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    if (stacks <= 0) return false;
    return (item.effects ?? []).some((effect) => effect.kind === 'utility' && effect.utility === 'extra-life');
  });
}

/** Permanent utility bonuses applied to the final cred payout. */
export function rewardCredMultiplier(meta: MetaState): number {
  const bonus = VENDOR_CATALOG.reduce((total, item) => {
    const stacks = Math.min(item.maxStacks, Math.max(0, Math.floor(meta.vendorPurchases[item.id] ?? 0)));
    return total + (item.effects ?? []).reduce(
      (sum, effect) => sum + (effect.kind === 'utility' && effect.utility === 'reward-cred-mult' ? effect.amount * stacks : 0),
      0,
    );
  }, 0);
  return (1 + bonus) * activeCardEffects(meta).creditMult;
}

/** Extra world units the "prime a movable prop" tap/click radius reaches, from Grabby Hands stacks. */
export function physicsObjectClickRadiusBonus(meta: MetaState): number {
  return vendorPurchaseCount(meta, 'grabby-hands') * 18;
}

/** 2 once Colossus Frame is owned (player renders and collides twice as large), else 1. */
export function giantSizeMult(meta: MetaState): number {
  return vendorPurchaseCount(meta, 'colossus-frame') > 0 ? 2 : 1;
}

/** Ghost Cloak + its upgrade tree, resolved into the numbers stepWorld needs. Null when not owned. */
export function stealthConfig(meta: MetaState): StealthAbilityConfig | null {
  if (vendorPurchaseCount(meta, 'ghost-cloak') <= 0) return null;
  const durationStacks = vendorPurchaseCount(meta, 'ghost-cloak-duration');
  const rateStacks = vendorPurchaseCount(meta, 'ghost-cloak-rate');
  const fullInvisible = vendorPurchaseCount(meta, 'ghost-cloak-full') > 0;
  return {
    durationMs: 2500 + durationStacks * 1200 + (fullInvisible ? 1500 : 0),
    cooldownMs: Math.max(4000, 14000 - rateStacks * 3000 - (fullInvisible ? 2000 : 0)),
    fullInvisible,
    damageBonusPct: fullInvisible ? 0.05 : 0,
  };
}

/** Whether "Let Me Hold This" is owned: any hazard weapon stops hurting whoever's holding it, native character or not. */
export function hazardImmunityUnlocked(meta: MetaState): boolean {
  return vendorPurchaseCount(meta, 'hazard-handler') > 0;
}

/** Whether "Low-Light Optics" is owned: the night-time screen tint is cut down in draw.ts. */
export function nightVisionUnlocked(meta: MetaState): boolean {
  return vendorPurchaseCount(meta, 'night-vision') > 0;
}

/** True while Artisan Valor Prime is fronting the Paint Gallery and re-theming the hideout (every 14th hideout visit, for a few visits or occasionally a real 24h window). */
export function isPrimeTakeoverActive(meta: MetaState, now: number): boolean {
  return meta.primeTakeoverVisitsRemaining > 0 || now < meta.primeTakeoverUntil;
}

/** True on the single hideout visit where Prime briefly flickers into the Paint Gallery as a tease (every 4th visit that isn't also a full 14th-visit takeover). */
export function isPrimeFlickerVisit(meta: MetaState): boolean {
  return meta.hideoutVisitCount % 4 === 0 && meta.hideoutVisitCount % 14 !== 0;
}

/** Which minimap recon tiers are unlocked, in purchase order. */
export function minimapUnlockTiers(meta: MetaState): {
  enemyRadar: boolean;
  lootSense: boolean;
  hazardSense: boolean;
} {
  return {
    enemyRadar: vendorPurchaseCount(meta, 'minimap-street-ears') > 0,
    lootSense: vendorPurchaseCount(meta, 'minimap-loot-sense') > 0,
    hazardSense: vendorPurchaseCount(meta, 'minimap-hazard-sense') > 0,
  };
}

export function currentFatiguePct(meta: MetaState, characterId: string): number {
  return Math.min(MAX_FATIGUE_PCT, Math.max(0, settleRecovery(meta).fatigueByCharacter[characterId] ?? 0));
}

export function recoveryRemainingMs(meta: MetaState): number {
  const settled = settleRecovery(meta);
  if (!settled.recovery.characterId) return 0;
  const facility = facilityForLocation(settled.recovery.locationId, settled.facilityTier);
  const fatigue = currentFatiguePct(settled, settled.recovery.characterId);
  return (fatigue / facility.recoveryPctPerMinute) * 60000;
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export interface CardPackReveal {
  packId: CardPackId;
  pulls: CardPull[];
  /** Parallel to `pulls`: true where that pull is the player's first-ever copy of the card. */
  newFlags: boolean[];
}

interface StoreState {
  meta: MetaState;
  /** Result of the most recent run; not persisted. */
  lastRun: RunResult | null;
  /** Cards from the most recent pack purchase, for the pack-opening reveal UI; not persisted. */
  lastCardPackReveal: CardPackReveal | null;
}

type Action =
  | { type: 'selectCharacter'; id: string }
  | { type: 'selectCharacterSkin'; characterId: string; skinId: string }
  | { type: 'enterHideout'; now: number }
  | { type: 'completeRun'; result: RunResult }
  | { type: 'buyCardPack'; packId: CardPackId; now: number }
  | { type: 'buySingleCard'; cardId: string; cost: number; variant?: CardVariant }
  | { type: 'recycleCard'; cardId: string; rewardCC: number }
  | { type: 'recycleAllDuplicates' }
  | { type: 'openStoredCardPack'; packId: CardPackId; now: number }
  | { type: 'setAutoOpenPacksEnabled'; enabled: boolean }
  | { type: 'togglePassiveCard'; cardId: string }
  | { type: 'toggleBattleDeckCard'; cardId: string }
  | { type: 'consumeThrownCard'; cardId: string }
  | { type: 'buyCardSalvageProtocol' }
  | { type: 'buyHandheldDigiScope' }
  | { type: 'buyCardFrameSleeve'; frameId: string; cardCreditsCost: number }
  | { type: 'equipCardFrameSleeve'; frameId: string }
  | { type: 'buyKeyItem'; itemId: 'miningHelmet' | 'rancherWhistle' | 'eclipseMonocle'; credCost: number }
  | { type: 'craftRelic'; relicId: string }
  | { type: 'buyKeyItemAction'; keyItemId: string; credCost: number }
  | { type: 'unlockCardCustomization'; customizationId: string; costCC: number }
  | { type: 'setCardCustomization'; cardId: string; customization: { frame?: string; overlay?: string; companionSeal?: string } }
  | { type: 'openAllStoredCardPacks' }
  | { type: 'completeTravelEncounter'; result: TravelEncounterResult }
  | { type: 'toggleSavedLokPet'; id: string }
  | { type: 'setLokPetLoadout'; ids: string[] }
  | { type: 'restoreSavedLokPet'; id: string; now: number }
  | { type: 'refreshPetElixirs'; now: number }
  | { type: 'feedLokPetTreat'; id: string }
  | { type: 'adoptRancherPet'; variantId: string; credCost: number }
  | { type: 'feedRanchKibble'; petId: string; credCost: number }
  | { type: 'recordLokPetBattleResult'; rewards: BattleRewards; winningPetIds: string[] }
  | { type: 'toggleFavoriteLokPet'; id: string }
  | { type: 'renameLokPet'; id: string; name: string }
  | { type: 'setLokPetName'; id: string; slot: PetNameSlot; name: string }
  | { type: 'claimDailyLogin'; now: number }
  | { type: 'equipLokPetTrinket'; id: string; trinketId?: string }
  | { type: 'draftStarterLokPets' }
  | { type: 'completeStarterLokPetOnboarding'; variantId: StarterLokPetId; characterId: string; now: number; callName?: string }
  | { type: 'clearLastRun' }
  | { type: 'clearCardPackReveal' }
  | { type: 'markOnboarded' }
  | { type: 'spendTokens'; amount: number }
  | { type: 'buyVendorItem'; id: string }
  | { type: 'refundVendorItem'; id: string }
  | { type: 'refundAllVendorItems' }
  | { type: 'setUiPanelLayout'; layout: UIPanelLayout }
  | { type: 'buyUiTheme'; id: string }
  | { type: 'equipUiTheme'; id: string }
  | { type: 'selectUiThemeSwatch'; themeId: string; swatchId: string }
  | { type: 'buyPalette'; id: string }
  | { type: 'grantPalette'; id: string }
  | { type: 'equipPalette'; id: string }
  | { type: 'equipDirectorPersonality'; id: string | null }
  | { type: 'claimSaunaHoleReward' }
  | { type: 'claimLegendaryPoliceDog' }
  | { type: 'buySoundPack'; id: string }
  | { type: 'equipSoundPack'; id: string }
  | { type: 'setSfxEnabled'; enabled: boolean }
  | { type: 'buyRunAura'; id: string }
  | { type: 'equipRunAura'; id: string }
  | { type: 'buyHat'; id: string }
  | { type: 'equipHat'; id: string }
  | { type: 'buyCelebration'; id: string }
  | { type: 'equipCelebration'; id: string }
  | { type: 'cycleUiLook' }
  | { type: 'cycleStarterUiLook' }
  | { type: 'unlockThemeCycleMastery' }
  | { type: 'setThemeCycleCollection'; collection: 'starter' | 'owned' }
  | { type: 'checkHiddenThemeReload' }
  | { type: 'unlockDevModeAccess' }
  | { type: 'setDevModeAllUnlocks'; enabled: boolean }
  | { type: 'setPhysicsObjectClicks'; enabled: boolean }
  | { type: 'setLevelUpPauses'; enabled: boolean }
  | { type: 'setLiveMode'; enabled: boolean }
  | { type: 'setLootPresentation'; value: MetaState['lootPresentation'] }
  | { type: 'setLevelUpPresentation'; value: MetaState['levelUpPresentation'] }
  | { type: 'setPauseMapVisible'; enabled: boolean }
  | { type: 'setGraphicsQuality'; quality: MetaState['graphicsQuality'] }
  | { type: 'setCompanionRevealStyle'; style: MetaState['companionRevealStyle'] }
  | { type: 'setFrameRateMode'; mode: MetaState['frameRateMode'] }
  | { type: 'setFogAmbianceMode'; mode: MetaState['fogAmbianceMode'] }
  | { type: 'setGlowingEyesIntensity'; intensity: MetaState['glowingEyesIntensity'] }
  | { type: 'setCrowdAutoZoomEnabled'; enabled: boolean }
  | { type: 'setWildlifeSheltersInRain'; enabled: boolean }
  | { type: 'setMinimapVisible'; enabled: boolean }
  | { type: 'setMusicReactive'; enabled: boolean }
  | { type: 'setHideoutAmbience'; enabled: boolean }
  | { type: 'setHideoutArrival'; enabled: boolean }
  | { type: 'setAttractMode'; enabled: boolean }
  | { type: 'setHideoutWeather'; enabled: boolean }
  | { type: 'setHideoutSectionsCollapsedByDefault'; enabled: boolean }
  | { type: 'setHideoutPreview'; enabled: boolean }
  | { type: 'setHideoutPets'; mode: MetaState['hideoutPets'] }
  | { type: 'setHideoutEvents'; mode: MetaState['hideoutEvents'] }
  | { type: 'setHideoutInteractive'; enabled: boolean }
  | { type: 'setHideoutPetPlay'; enabled: boolean }
  | { type: 'setHideoutChoiceEvents'; mode: MetaState['hideoutChoiceEvents'] }
  | { type: 'activateHideoutProp'; propId: string; seed: number; now: number }
  | { type: 'resolveChoiceEvent'; eventId: string; choiceId: string; seed: number; now: number; petId?: string; propId?: string }
  | { type: 'playWithLokPet'; petId: string; verbId: string; seed: number; now: number; musicPlaying: boolean }
  | { type: 'careForLokPet'; id: string; now: number }
  | { type: 'chooseLokPetBranch'; id: string; branchId: string; now: number }
  | { type: 'undoLokPetBranch'; id: string; now: number }
  | { type: 'completeHideoutEvent'; petId: string; eventId: string; now: number }
  | { type: 'setHideoutStickyHeadOut'; enabled: boolean }
  | { type: 'setSplashTextEnabled'; enabled: boolean }
  | { type: 'setOneLineTitleEnabled'; enabled: boolean }
  | { type: 'setIntroTitlePhysicsEnabled'; enabled: boolean }
  | { type: 'setIntroTitleReturnDelay'; seconds: number }
  | { type: 'setTravelEncountersEnabled'; enabled: boolean }
  | { type: 'setPaletteAnimations'; enabled: boolean }
  | { type: 'setWorldPaletteBlend'; enabled: boolean }
  | { type: 'setWorldColorFullRecolor'; enabled: boolean }
  | { type: 'setGyroEnabled'; enabled: boolean }
  | { type: 'setStudioPlugins'; enabled: boolean }
  | { type: 'setStudioLayout'; value: MetaState['studioLayout'] }
  | { type: 'setGyroSensitivity'; value: number }
  | { type: 'setGyroInvertY'; enabled: boolean }
  | { type: 'setMinimapExpanded'; enabled: boolean }
  | { type: 'setMinimapPosition'; position: { x: number; y: number } }
  | { type: 'setWorldInvertEnabled'; enabled: boolean }
  | { type: 'setPaletteInvertEnabled'; enabled: boolean }
  | { type: 'setMirrorModeEnabled'; enabled: boolean }
  | { type: 'toggleRunModifier'; key: keyof RunModifiers }
  | { type: 'dismissNotifications'; ids: string[] }
  | { type: 'announceEndgame'; ids: string[]; now: number }
  | { type: 'acknowledgeChangelog' }
  | { type: 'setUpdatePopupKind'; kind: ChangelogKind; enabled: boolean }
  | { type: 'buyGenerator'; id: string; now: number }
  | { type: 'refreshGeneratorIncome'; now: number }
  | { type: 'setUiDensity'; density: 'grid' | 'list' }
  | { type: 'setLokPetArtStyle'; style: MetaState['lokPetArtStyle'] }
  | { type: 'setUiBorderStyle'; style: MetaState['uiBorderStyle'] }
  | { type: 'setLokPetBorderStyle'; style: MetaState['lokPetBorderStyle'] }
  | { type: 'setCharacterBorderStyle'; style: MetaState['characterBorderStyle'] }
  | { type: 'startRecovery'; characterId: string; locationId?: string }
  | { type: 'stopRecovery' }
  | { type: 'tickRecovery'; now: number }
  | { type: 'upgradeFacility' }
  | { type: 'createCustomMap' }
  | { type: 'completeSectorMission'; missionId: string }
  | { type: 'saveCustomMap'; map: CustomMap }
  | { type: 'duplicateCustomMap'; id: string }
  | { type: 'deleteCustomMap'; id: string }
  | { type: 'claimAchievement'; id: string }
  | { type: 'importVisitingLokCard'; card: VisitingLokCard }
  | { type: 'unlockThreatMatrixWithKeys' }
  | { type: 'toggleEnemyDisabled'; enemyId: string }
  | { type: 'setAllEnemiesDisabled'; disabled: boolean }
  | { type: 'toggleWeaponDisabled'; weaponId: string }
  | { type: 'unlockGrpdWeapon'; weaponId: string }
  | { type: 'toggleGrpdWeapon'; weaponId: string }
  | { type: 'buyGrpdSpawnTier'; weaponId: string }
  | { type: 'setGrpdAutoIncreaseEnabled'; enabled: boolean }
  | { type: 'setGrpdArmoryAnchor'; anchor: MetaState['grpdArmoryAnchor'] }
  | { type: 'setAllWeaponsDisabled'; disabled: boolean }
  | { type: 'togglePassiveDisabled'; passiveId: string }
  | { type: 'setAllPassivesDisabled'; disabled: boolean }
  | { type: 'setThreatCalibrations'; calibrations: Partial<ThreatCalibrations> }
  | { type: 'resetThreatCalibrations' }
  | { type: 'resetArsenalQuarantine' }
  | { type: 'toggleThreatUpgrade'; upgradeId: string }
  | { type: 'unlockDvdEasterEgg' }
  | { type: 'replaceMeta'; meta: Partial<MetaState> }
  | { type: 'reset' };

function addUnique(list: string[], value?: string): string[] {
  if (!value || list.includes(value)) return list;
  return [...list, value];
}

/**
 * Achievements are derived (never stored), so a completion toast is derived too: any
 * achievement that is complete after an action but was not before it. Only that
 * transition announces, so existing saves never get a flood of old completions.
 */
function withAchievementToasts(before: StoreState, after: StoreState): StoreState {
  if (after.meta === before.meta) return after;
  const fresh = ACHIEVEMENTS.filter((a) => a.isComplete(after.meta) && !a.isComplete(before.meta)
    && !after.meta.pendingNotifications.some((n) => n.id === `achievement-${a.id}`));
  if (fresh.length === 0) return after;
  const now = Date.now();
  return {
    ...after,
    meta: {
      ...after.meta,
      pendingNotifications: [
        ...after.meta.pendingNotifications,
        ...fresh.map((a) => ({
          id: `achievement-${a.id}`,
          title: `Achievement: ${a.name}`,
          body: a.reward ? `${a.description} Claim your reward in the Archive.` : a.description,
          createdAt: now,
        })),
      ],
    },
  };
}

export function reducer(state: StoreState, action: Action): StoreState {
  const next = coreReducer(state, action);
  // Swapping the whole save (reset, import) is not earning anything, so it never toasts.
  if (action.type === 'reset' || action.type === 'replaceMeta') return next;
  return withAchievementToasts(state, next);
}

function coreReducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'selectCharacter': {
      const character = CHARACTERS.find((candidate) => candidate.id === action.id);
      if (!character) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          selectedCharacterId: action.id,
          selectedLokPetIds: state.meta.selectedLokPetIds.slice(0, lokPetTeamCapacity(character)),
        },
      };
    }

    case 'selectCharacterSkin': {
      const character = CHARACTERS.find((entry) => entry.id === action.characterId);
      if (!character) return state;
      const skin = getCharacterSkins(character).find((entry) => entry.id === action.skinId);
      const characterEpisode = CHARACTER_EPISODES.find((entry) => entry.characterId === character.id);
      if (!skin || !isCharacterSkinUnlocked(skin, state.meta.rescuedAllyIds.length, Boolean(characterEpisode && state.meta.completedEpisodeIds.includes(characterEpisode.id)))) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          characterSkinByCharacterId: { ...state.meta.characterSkinByCharacterId, [character.id]: skin.id },
        },
      };
    }

    case 'toggleSavedLokPet': {
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet || pet.stamina <= 0) return state;
      const capacity = lokPetTeamCapacity(getCharacter(state.meta.selectedCharacterId));
      const selected = state.meta.selectedLokPetIds.includes(action.id)
        ? state.meta.selectedLokPetIds.filter((id) => id !== action.id)
        : state.meta.selectedLokPetIds.length < capacity ? [...state.meta.selectedLokPetIds, action.id] : state.meta.selectedLokPetIds;
      return { ...state, meta: { ...state.meta, selectedLokPetIds: selected } };
    }

    case 'setLokPetLoadout': {
      const capacity = lokPetTeamCapacity(getCharacter(state.meta.selectedCharacterId));
      const readyPetIds = new Set(state.meta.savedLokPets.filter((pet) => pet.stamina > 0).map((pet) => pet.id));
      const selectedLokPetIds = [...new Set(action.ids)].filter((id) => readyPetIds.has(id)).slice(0, capacity);
      return { ...state, meta: { ...state.meta, selectedLokPetIds } };
    }

    case 'buyCardPack': {
      const pack = CARD_SHOP_PACKS_BY_ID[action.packId];
      if (!pack || state.meta.cardCredits < pack.cost) return state;
      const meta = { ...state.meta, cardCredits: state.meta.cardCredits - pack.cost };
      if (!state.meta.autoOpenPacksEnabled) {
        return {
          ...state,
          meta: {
            ...meta,
            unopenedCardPacks: { ...meta.unopenedCardPacks, [pack.id]: (meta.unopenedCardPacks[pack.id] ?? 0) + 1 },
          },
        };
      }
      const seed = (action.now ^ state.meta.totalRuns ^ state.meta.cardCredits ^ state.meta.cardCollection.length) >>> 0;
      const { pulls, newFlags } = rollPackForReveal(meta, pack.id, seed);
      return {
        ...state,
        meta: { ...meta, cardCollection: mergeCardPulls(meta.cardCollection, pulls) },
        lastCardPackReveal: { packId: pack.id, pulls, newFlags },
      };
    }

    case 'buySingleCard': {
      if (state.meta.cardCredits < action.cost) return state;
      const variant = action.variant || 'foil';
      const pulls: CardPull[] = [{ cardId: action.cardId, variant, value: CARD_VARIANT_VALUE[variant] || 2 }];
      const meta = {
        ...state.meta,
        cardCredits: state.meta.cardCredits - action.cost,
        cardCollection: mergeCardPulls(state.meta.cardCollection, pulls),
      };
      return { ...state, meta };
    }

    case 'recycleCard': {
      const record = state.meta.cardCollection.find((r) => r.cardId === action.cardId);
      if (!record || record.copies <= 1) return state;
      const nextCollection = state.meta.cardCollection.map((r) => {
        if (r.cardId === action.cardId) {
          return { ...r, copies: r.copies - 1 };
        }
        return r;
      });
      return {
        ...state,
        meta: {
          ...state.meta,
          cardCredits: state.meta.cardCredits + action.rewardCC,
          cardCollection: nextCollection,
        },
      };
    }

    case 'recycleAllDuplicates': {
      let earnedCC = 0;
      const nextCollection = state.meta.cardCollection.map((r) => {
        if (r.copies > 1) {
          const excess = r.copies - 1;
          const card = CARD_MANIFESTS.find((c) => c.id === r.cardId);
          const rMult = card?.rarity === 'mythic' ? 32 : card?.rarity === 'legendary' ? 24 : card?.rarity === 'epic' ? 12 : card?.rarity === 'rare' ? 6 : card?.rarity === 'uncommon' ? 3 : 2;
          earnedCC += excess * rMult;
          return { ...r, copies: 1 };
        }
        return r;
      });
      if (earnedCC === 0) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cardCredits: state.meta.cardCredits + earnedCC,
          cardCollection: nextCollection,
        },
      };
    }

    case 'openStoredCardPack': {
      const pack = CARD_SHOP_PACKS_BY_ID[action.packId];
      const owned = state.meta.unopenedCardPacks[action.packId] ?? 0;
      if (!pack || owned <= 0) return state;
      const seed = (action.now ^ state.meta.totalRuns ^ owned ^ state.meta.cardCollection.length) >>> 0;
      const { pulls, newFlags } = rollPackForReveal(state.meta, pack.id, seed);
      const remaining = owned - 1;
      const unopenedCardPacks = { ...state.meta.unopenedCardPacks };
      if (remaining > 0) unopenedCardPacks[pack.id] = remaining;
      else delete unopenedCardPacks[pack.id];
      return {
        ...state,
        meta: {
          ...state.meta,
          cardCredits: state.meta.cardCredits - pack.cost,
          cardCollection: mergeCardPulls(state.meta.cardCollection, pulls),
        },
        lastCardPackReveal: { packId: pack.id, pulls, newFlags },
      };
    }

    case 'clearCardPackReveal':
      return { ...state, lastCardPackReveal: null };

    case 'togglePassiveCard': {
      if (!PASSIVE_CARDS_BY_ID[action.cardId] || !state.meta.cardCollection.some((record) => record.cardId === action.cardId && record.copies > 0)) return state;
      const active = state.meta.activePassiveCardIds;
      const next = active.includes(action.cardId) ? active.filter((id) => id !== action.cardId) : active.length < passiveDeckSlots(state.meta) ? [...active, action.cardId] : active;
      return { ...state, meta: { ...state.meta, activePassiveCardIds: next } };
    }

    case 'toggleBattleDeckCard': {
      if (!state.meta.cardCollection.some((record) => record.cardId === action.cardId && record.copies > 0)) return state;
      const active = state.meta.battleDeckCardIds;
      const next = active.includes(action.cardId) ? active.filter((id) => id !== action.cardId) : active.length < BATTLE_DECK_SLOTS ? [...active, action.cardId] : active;
      return { ...state, meta: { ...state.meta, battleDeckCardIds: next } };
    }

    // Thrown, not spent from a shop -- until a Handheld DigiScope is bought, a
    // Battle Deck card loses one copy the instant it's thrown, win or lose.
    // A no-op once the protocol is owned, so callers can dispatch this
    // unconditionally on every throw. See CARD_SALVAGE_* in travelEncounters.ts.
    case 'consumeThrownCard': {
      if (state.meta.handheldDigiScopeOwned || state.meta.cardSalvageUnlocked) return state;
      const record = state.meta.cardCollection.find((candidate) => candidate.cardId === action.cardId);
      if (!record) return state;
      const remaining = removeThrownCardCopy(record);
      const cardCollection = remaining
        ? state.meta.cardCollection.map((candidate) => (candidate.cardId === action.cardId ? remaining : candidate))
        : state.meta.cardCollection.filter((candidate) => candidate.cardId !== action.cardId);
      const battleDeckCardIds = remaining
        ? state.meta.battleDeckCardIds
        : state.meta.battleDeckCardIds.filter((id) => id !== action.cardId);
      return { ...state, meta: { ...state.meta, cardCollection, battleDeckCardIds } };
    }

    case 'buyCardSalvageProtocol': {
      if (state.meta.cardSalvageUnlocked) return state;
      if (state.meta.totalRuns < CARD_SALVAGE_EARN_RUNS || state.meta.cardCredits < CARD_SALVAGE_COST) return state;
      return {
        ...state,
        meta: { ...state.meta, cardSalvageUnlocked: true, cardCredits: state.meta.cardCredits - CARD_SALVAGE_COST },
      };
    }

    case 'buyHandheldDigiScope': {
      if (state.meta.handheldDigiScopeOwned || state.meta.cred < HANDHELD_DIGISCOPE_COST) return state;
      return {
        ...state,
        meta: { ...state.meta, handheldDigiScopeOwned: true, cred: state.meta.cred - HANDHELD_DIGISCOPE_COST },
      };
    }

    // No penalty on loss/flee beyond no reward -- enforced here at the state
    // layer, not just the UI, per the "classic version" scope. See
    // .agents/memory/travel-encounters.md.
    case 'completeTravelEncounter': {
      if (action.result.outcome !== 'won') return state;
      const caughtPet = action.result.caughtLokPet && action.result.lokPetRoll
        ? [{ id: `pet-${Date.now().toString(36)}-0-${action.result.lokPetRoll.variantId}`, roll: action.result.lokPetRoll, stamina: PET_STAMINA_MAX }]
        : [];
      // A travel-encounter win against an enemy counts toward the same
      // Bestiary defeat tally a real run would -- otherwise this feature is
      // invisible to existing progression UI.
      const bestiary = action.result.opponentKind === 'enemy' && action.result.enemyId
        ? { ...state.meta.bestiary, [action.result.enemyId]: (state.meta.bestiary[action.result.enemyId] ?? 0) + 1 }
        : state.meta.bestiary;
      const travelNow = Date.now();
      // Only wins pay (by design), and they train the pets that are out, starter first.
      const travelGrowth = growPartyPets(state.meta.savedLokPets, state.meta.selectedLokPetIds, TRAVEL_WIN_EXP_BASE, 'travel', travelNow);
      const travelHeadlines = growthHeadlines(travelGrowth.entries);
      return {
        ...state,
        meta: {
          ...state.meta,
          bestiary,
          cred: state.meta.cred + action.result.rewardCred,
          cardCredits: state.meta.cardCredits + action.result.rewardCardCredits,
          savedLokPets: [...caughtPet, ...travelGrowth.pets].slice(0, 48),
          pendingNotifications: travelHeadlines.length > 0
            ? [...state.meta.pendingNotifications, { id: `pet-travel-${travelNow}`, title: 'Your pets grew', body: travelHeadlines.join('. ') + '.', createdAt: travelNow }]
            : state.meta.pendingNotifications,
        },
      };
    }

    case 'restoreSavedLokPet': {
      const recovery = replenishPetElixirs(state.meta, action.now);
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet || pet.stamina >= PET_STAMINA_MAX || recovery.petElixirs < 1) return { ...state, meta: { ...state.meta, ...recovery } };
      return { ...state, meta: { ...state.meta, ...recovery, petElixirs: recovery.petElixirs - 1, savedLokPets: state.meta.savedLokPets.map((candidate) => candidate.id === action.id ? { ...candidate, stamina: candidate.stamina + 1 } : candidate) } };
    }

    case 'refreshPetElixirs': {
      const recovery = replenishPetElixirs(state.meta, action.now);
      const savedLokPets = refreshStarterLokPets(state.meta.savedLokPets, action.now);
      return recovery.petElixirs === state.meta.petElixirs && savedLokPets === state.meta.savedLokPets
        ? state
        : { ...state, meta: { ...state.meta, ...recovery, savedLokPets } };
    }

    case 'feedLokPetTreat': {
      if (state.meta.lokPetTreats < 1) return state;
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet) return state;
      const now = Date.now();
      const grown = growPet(pet, { exp: scalePetExp(TREAT_EXP_BASE), bondSource: 'treat', now });
      const headlines = growthHeadlines(grown.entry ? [grown.entry] : []);
      return {
        ...state,
        meta: {
          ...state.meta,
          lokPetTreats: state.meta.lokPetTreats - 1,
          savedLokPets: state.meta.savedLokPets.map((candidate) =>
            candidate.id === action.id
              ? { ...grown.pet, stamina: Math.min(PET_STAMINA_MAX, candidate.stamina + 1) }
              : candidate,
          ),
          pendingNotifications: headlines.length > 0
            ? [...state.meta.pendingNotifications, { id: `pet-treat-${action.id}-${now}`, title: 'Treat time', body: headlines.join('. ') + '.', createdAt: now }]
            : state.meta.pendingNotifications,
        },
      };
    }

    case 'adoptRancherPet': {
      if (state.meta.cred < action.credCost) return state;
      const roll = rollLokPet(() => Math.random(), { fixedVariantId: action.variantId });
      const newPet: SavedLokPet = {
        id: `ranch-${Date.now().toString(36)}-${action.variantId}`,
        roll,
        stamina: PET_STAMINA_MAX,
        level: 3,
        exp: 0,
        battlesWon: 0,
        battlesFought: 0,
      };
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - action.credCost,
          savedLokPets: [newPet, ...state.meta.savedLokPets].slice(0, 48),
          lokPetCatalog: recordLokPetCatalog(state.meta.lokPetCatalog, [roll]),
        },
      };
    }

    case 'feedRanchKibble': {
      if (state.meta.cred < action.credCost) return state;
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.petId);
      if (!pet) return state;
      const newLvl = (pet.level || 1) + 1;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - action.credCost,
          savedLokPets: state.meta.savedLokPets.map((candidate) =>
            candidate.id === action.petId
              ? {
                  ...candidate,
                  stamina: PET_STAMINA_MAX,
                  level: newLvl,
                  exp: 0,
                }
              : candidate,
          ),
        },
      };
    }

    case 'recordLokPetBattleResult': {
      const { rewards, winningPetIds } = action;
      const nextWins = state.meta.lokPetBattleWins + 1;
      const badges = [...state.meta.lokPetBattleBadges];
      let leagueTier = state.meta.lokPetLeagueTier;
      if (rewards.badgeId && !badges.includes(rewards.badgeId)) {
        badges.push(rewards.badgeId);
        leagueTier = Math.max(leagueTier, badges.length);
      }
      const now = Date.now();
      const updatedSaved = state.meta.savedLokPets.map((candidate) => {
        if (!winningPetIds.includes(candidate.id)) return candidate;
        const levelUp = rewards.levelUps.find((l) => l.petId.includes(candidate.id));
        // The engine reports the final level AND the XP remainder; saving both is what
        // stops XP from vanishing between battles.
        const result = rewards.petResults?.find((r) => r.petId.includes(candidate.id));
        const newLevel = result ? result.level : levelUp ? levelUp.newLevel : (candidate.level || 1);
        const bond = applyBond(candidate, 'battle', now);
        return {
          ...candidate,
          level: newLevel,
          ...(result ? { exp: result.exp } : {}),
          bond: bond.bond,
          bondDay: bond.bondDay,
          bondToday: bond.bondToday,
          battlesWon: (candidate.battlesWon || 0) + 1,
          battlesFought: (candidate.battlesFought || 0) + 1,
        };
      });
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred + rewards.cred,
          cardCredits: state.meta.cardCredits + rewards.cardCredits,
          lokPetTreats: state.meta.lokPetTreats + rewards.treats,
          lokPetBattleWins: nextWins,
          lokPetBattleBadges: badges,
          lokPetLeagueTier: leagueTier,
          savedLokPets: updatedSaved,
        },
      };
    }

    case 'toggleFavoriteLokPet': {
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: state.meta.savedLokPets.map((p) =>
            p.id === action.id ? { ...p, favorite: !p.favorite } : p,
          ),
        },
      };
    }

    case 'renameLokPet':
    case 'setLokPetName': {
      // Plain renames are the call name (slot 1). A locked slot leaves the pet unchanged.
      const slot: PetNameSlot = action.type === 'setLokPetName' ? action.slot : 'call';
      let changed = false;
      const savedLokPets = state.meta.savedLokPets.map((p) => {
        if (p.id !== action.id) return p;
        const next = setPetName(p, slot, action.name);
        if (next !== p) changed = true;
        return next;
      });
      return changed ? { ...state, meta: { ...state.meta, savedLokPets } } : state;
    }

    case 'claimDailyLogin': {
      const advance = advanceLoginStreak(state.meta.lastLoginStreakDayKey, state.meta.loginStreakCount, action.now);
      if (!advance.reward) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lastLoginStreakDayKey: advance.dayKey,
          loginStreakCount: advance.streakCount,
          cred: state.meta.cred + advance.reward.rewardCred,
          skeletonKeys: state.meta.skeletonKeys + advance.reward.rewardKeys,
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `login-streak-${action.now}`,
              title: `Day ${advance.streakCount} streak`,
              body: advance.reward.rewardKeys > 0
                ? `+${advance.reward.rewardCred} cred, +${advance.reward.rewardKeys} skeleton key. Come back tomorrow to keep it going.`
                : `+${advance.reward.rewardCred} cred. Come back tomorrow to keep it going.`,
              createdAt: action.now,
            },
          ],
        },
      };
    }

    case 'equipLokPetTrinket': {
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: state.meta.savedLokPets.map((p) =>
            p.id === action.id ? { ...p, equippedTrinket: action.trinketId } : p,
          ),
        },
      };
    }

    case 'draftStarterLokPets': {
      if (state.meta.savedLokPets.length > 0) return state;
      const p1 = rollLokPet(() => 0.25, { fixedVariantId: 'cinder-pouncer' });
      const p2 = rollLokPet(() => 0.55, { fixedVariantId: 'rain-jelly' });
      const p3 = rollLokPet(() => 0.85, { fixedVariantId: 'volt-wing' });
      const starters: SavedLokPet[] = [
        { id: `starter-pouncer-${Date.now()}`, roll: p1, stamina: 3, level: 3, exp: 0, battlesWon: 0, battlesFought: 0, favorite: true },
        { id: `starter-jelly-${Date.now() + 1}`, roll: p2, stamina: 3, level: 3, exp: 0, battlesWon: 0, battlesFought: 0 },
        { id: `starter-volt-${Date.now() + 2}`, roll: p3, stamina: 3, level: 3, exp: 0, battlesWon: 0, battlesFought: 0 },
      ];
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: starters,
          selectedLokPetIds: starters.map((s) => s.id),
        },
      };
    }

    case 'completeStarterLokPetOnboarding': {
      if (state.meta.starterLokPetOnboardingComplete || !isStarterLokPetId(action.variantId)) return state;
      const starterCharacter = CHARACTERS.find((character) => character.id === action.characterId);
      if (!starterCharacter || !state.meta.unlockedCharacterIds.includes(starterCharacter.id)) return state;
      const roll = rollLokPet(() => 0.616, { fixedVariantId: action.variantId });
      const starter: SavedLokPet = {
        id: `starter-${action.variantId}-${action.now}`,
        roll: { ...roll, level: 1 },
        stamina: PET_STAMINA_MAX,
        level: 1,
        exp: 0,
        battlesWon: 0,
        battlesFought: 0,
        favorite: true,
        starter: true,
        lastFreeRefreshAt: action.now,
        // The partner's call name is the one name that is free from day one (optional).
        name: sanitizePetName(action.callName) || undefined,
      };
      const pack = CARD_SHOP_PACKS_BY_ID.lokpet;
      const rng = createRng((action.now ^ 0x616) >>> 0);
      const firstPack = rollCardPack(pack.id, rng, CARD_MANIFESTS.map((card) => card.id));
      const secondPack = rollCardPack(pack.id, rng, CARD_MANIFESTS.map((card) => card.id));
      const pulls = [...firstPack, ...secondPack];
      const starterCard = LOKPET_CARDS.find((card) => card.metadata?.subjectId === action.variantId);
      const starterCardPulls: CardPull[] = starterCard
        ? [{ cardId: starterCard.id, variant: 'standard', value: 1 }]
        : [];
      const ownedBeforeIds = new Set(state.meta.cardCollection.filter((record) => record.copies > 0).map((record) => record.cardId));
      const seen = new Set<string>();
      const newFlags = pulls.map((pull) => {
        const isNew = !ownedBeforeIds.has(pull.cardId) && !seen.has(pull.cardId);
        seen.add(pull.cardId);
        return isNew;
      });
      return {
        ...state,
        meta: {
          ...state.meta,
          starterLokPetOnboardingComplete: true,
          starterLokPetVariantId: action.variantId,
          selectedCharacterId: starterCharacter.id,
          savedLokPets: [starter, ...state.meta.savedLokPets].slice(0, 48),
          selectedLokPetIds: [starter.id],
          lokPetCatalog: recordLokPetCatalog(state.meta.lokPetCatalog, [roll]),
          cardCredits: state.meta.cardCredits + 40,
          cardCollection: mergeCardPulls(state.meta.cardCollection, [...starterCardPulls, ...pulls]),
        },
        lastCardPackReveal: { packId: 'lokpet', pulls, newFlags },
      };
    }

    case 'enterHideout': {
      const refreshedPets = refreshStarterLokPets(state.meta.savedLokPets, action.now);
      const crewActivitySeed = state.meta.crewActivitySeed + 1;
      const crewActivityByAlly = rollCrewActivities(state.meta.rescuedAllyIds, crewActivitySeed);
      const hideoutVisitCount = state.meta.hideoutVisitCount + 1;
      let primeTakeoverVisitsRemaining = Math.max(0, state.meta.primeTakeoverVisitsRemaining - 1);
      let primeTakeoverUntil = state.meta.primeTakeoverUntil;
      if (hideoutVisitCount % 14 === 0) {
        if (Math.random() < 0.25) {
          primeTakeoverUntil = action.now + 24 * 60 * 60 * 1000;
          primeTakeoverVisitsRemaining = 0;
        } else {
          primeTakeoverVisitsRemaining = 3;
          primeTakeoverUntil = 0;
        }
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: refreshedPets,
          crewActivitySeed,
          crewActivityByAlly,
          activeCrewRumor: state.meta.activeCrewRumor ?? rollCrewRumor(
            state.meta.rescuedAllyIds,
            crewActivityByAlly,
            crewActivitySeed,
          ),
          hideoutVisitCount,
          primeTakeoverVisitsRemaining,
          primeTakeoverUntil,
        },
      };
    }

    case 'markOnboarded':
      return { ...state, meta: { ...state.meta, onboarded: true } };

    case 'reset':
      return { meta: createInitialMeta(), lastRun: null, lastCardPackReveal: null };

    // Wholesale replace, used by a cloud-save pull or a manual save import --
    // normalised the same way a freshly-loaded localStorage save would be,
    // so a save from another device/version can never carry a malformed field.
    case 'replaceMeta':
      return { ...state, meta: normalizeMeta(action.meta) };

    case 'clearLastRun':
      return { ...state, lastRun: null };

    case 'spendTokens': {
      const cost = action.amount;
      if (state.meta.lootTokens < cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - cost } };
    }

    case 'buyVendorItem': {
      const item = VENDOR_CATALOG_BY_ID[action.id];
      if (!item) return state;
      if (item.requires && vendorPurchaseCount(state.meta, item.requires) <= 0) return state;
      const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
      const currency = item.currency ?? 'cred';
      const balance = state.meta[currency];
      if (owned >= item.maxStacks || balance < item.cost) return state;
      const nextPurchases = { ...state.meta.vendorPurchases, [item.id]: owned + 1 };
      const nextMeta = {
        ...state.meta,
        [currency]: balance - item.cost,
        vendorPurchases: nextPurchases,
      };
      if (item.category === 'lokpet' && item.grantsLokPetVariantId) {
        const roll = rollLokPet(Math.random, { fixedVariantId: item.grantsLokPetVariantId });
        nextMeta.savedLokPets = [
          { id: `pet-${Date.now().toString(36)}-0-${roll.variantId}`, roll, stamina: PET_STAMINA_MAX },
          ...state.meta.savedLokPets,
        ].slice(0, 48);
      }
      if (item.id === 'threat-matrix-console') {
        nextMeta.threatMatrixUnlocked = true;
      }
      if (['universal-incursion', 'corner-magnet', 'tidal-anchor', 'static-inverter'].includes(item.id)) {
        nextMeta.threatUpgrades = { ...(nextMeta.threatUpgrades ?? {}), [item.id]: true };
      }
      if (['mining-helmet', 'bag-of-water', 'firefly-lantern'].includes(item.id)) {
        nextMeta.ownedKeyItemIds = addUnique(nextMeta.ownedKeyItemIds, item.id);
      }
      return {
        ...state,
        meta: nextMeta,
      };
    }

    case 'craftRelic': {
      const relic = CITY_RELICS_BY_ID[action.relicId];
      if (!relic || !relic.craftRecipe) return state;
      const currentCrafted = new Set(state.meta.craftedRelicIds ?? []);
      if (currentCrafted.has(relic.id)) return state;
      const materials = { ...(state.meta.relicMaterials ?? {}) };
      for (const [matId, req] of Object.entries(relic.craftRecipe.materials)) {
        if ((materials[matId] ?? 0) < req) return state;
      }
      for (const [matId, req] of Object.entries(relic.craftRecipe.materials)) {
        materials[matId] = (materials[matId] ?? 0) - req;
      }
      return {
        ...state,
        meta: {
          ...state.meta,
          relicMaterials: materials,
          craftedRelicIds: [...currentCrafted, relic.id],
          knownRelicIds: addUnique(state.meta.knownRelicIds, relic.id),
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `craft-${Date.now()}`,
              title: `Relic Forged: ${relic.name}`,
              body: relic.craftRecipe.perkLabel,
              createdAt: Date.now(),
            },
          ],
        },
      };
    }

    case 'buyKeyItemAction': {
      if (state.meta.cred < action.credCost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - action.credCost,
          ownedKeyItemIds: addUnique(state.meta.ownedKeyItemIds, action.keyItemId),
        },
      };
    }

    case 'unlockCardCustomization': {
      if (state.meta.cardCredits < action.costCC) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cardCredits: state.meta.cardCredits - action.costCC,
          unlockedCardCustomizations: addUnique(state.meta.unlockedCardCustomizations, action.customizationId),
        },
      };
    }

    case 'setCardCustomization': {
      return {
        ...state,
        meta: {
          ...state.meta,
          cardCustomizationsByCardId: {
            ...state.meta.cardCustomizationsByCardId,
            [action.cardId]: {
              ...(state.meta.cardCustomizationsByCardId[action.cardId] ?? {}),
              ...action.customization,
            },
          },
        },
      };
    }

    case 'unlockThreatMatrixWithKeys': {
      if (state.meta.threatMatrixUnlocked || state.meta.skeletonKeys < 4) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          skeletonKeys: state.meta.skeletonKeys - 4,
          threatMatrixUnlocked: true,
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `threat-matrix-${Date.now()}`,
              title: 'Threat Matrix Quarantine Terminal Online',
              body: 'Security override granted. You can now quarantine or unleash any enemy across all maps.',
              createdAt: Date.now(),
            },
          ],
        },
      };
    }

    case 'toggleEnemyDisabled': {
      const { enemyId } = action;
      const current = state.meta.disabledEnemyIds ?? [];
      const disabledEnemyIds = current.includes(enemyId)
        ? current.filter((id) => id !== enemyId)
        : [...current, enemyId];
      return { ...state, meta: { ...state.meta, disabledEnemyIds } };
    }

    case 'setAllEnemiesDisabled': {
      return {
        ...state,
        meta: {
          ...state.meta,
          disabledEnemyIds: action.disabled ? ENEMIES.map((e) => e.id) : [],
        },
      };
    }

    case 'toggleWeaponDisabled': {
      const { weaponId } = action;
      const current = state.meta.disabledWeaponIds ?? [];
      const disabledWeaponIds = current.includes(weaponId)
        ? current.filter((id) => id !== weaponId)
        : [...current, weaponId];
      return { ...state, meta: { ...state.meta, disabledWeaponIds } };
    }

    case 'unlockGrpdWeapon': {
      const weaponId = action.weaponId;
      if (!GRPD_PLAYABLE_WEAPON_IDS.has(weaponId) || state.meta.grpdUnlockedWeaponIds.includes(weaponId)) return state;
      if (isGrpdEndgameWeapon(weaponId)) return state;
      if (grpdAvailableSeals(state.meta.totalKills, state.meta.grpdSpentSeals) < GRPD_UNLOCK_SEAL_COST) return state;
      return { ...state, meta: {
        ...state.meta,
        grpdSpentSeals: state.meta.grpdSpentSeals + GRPD_UNLOCK_SEAL_COST,
        grpdUnlockedWeaponIds: [...state.meta.grpdUnlockedWeaponIds, weaponId],
        grpdSpawnTierByWeaponId: { ...state.meta.grpdSpawnTierByWeaponId, [weaponId]: 1 },
      } };
    }

    case 'toggleGrpdWeapon': {
      const weaponId = action.weaponId;
      if (!state.meta.grpdUnlockedWeaponIds.includes(weaponId) && !grpdEndgameWeaponEarned(weaponId, state.meta.totalKills, endgameReached(state.meta))) return state;
      const active = state.meta.grpdActiveWeaponIds;
      return { ...state, meta: {
        ...state.meta,
        grpdActiveWeaponIds: active.includes(weaponId) ? active.filter((id) => id !== weaponId) : [...active, weaponId],
      } };
    }

    case 'buyGrpdSpawnTier': {
      const weaponId = action.weaponId;
      if (!state.meta.grpdUnlockedWeaponIds.includes(weaponId) && !grpdEndgameWeaponEarned(weaponId, state.meta.totalKills, endgameReached(state.meta))) return state;
      const current = state.meta.grpdSpawnTierByWeaponId[weaponId] ?? 1;
      if (current >= GRPD_MAX_SPAWN_MULTIPLIER) return state;
      const cost = grpdNextTierCost(current);
      if (grpdAvailableSeals(state.meta.totalKills, state.meta.grpdSpentSeals) < cost) return state;
      return { ...state, meta: {
        ...state.meta,
        grpdSpentSeals: state.meta.grpdSpentSeals + cost,
        grpdSpawnTierByWeaponId: { ...state.meta.grpdSpawnTierByWeaponId, [weaponId]: current + 1 },
      } };
    }

    case 'setGrpdAutoIncreaseEnabled':
      return { ...state, meta: { ...state.meta, grpdAutoIncreaseEnabled: action.enabled } };

    case 'setGrpdArmoryAnchor':
      return { ...state, meta: { ...state.meta, grpdArmoryAnchor: action.anchor } };

    case 'setAllWeaponsDisabled': {
      return {
        ...state,
        meta: {
          ...state.meta,
          disabledWeaponIds: action.disabled ? Object.keys(WEAPONS_BY_ID).filter((id) => !isGrpdPlayableWeapon(id)) : [],
        },
      };
    }

    case 'togglePassiveDisabled': {
      const { passiveId } = action;
      const current = state.meta.disabledPassiveIds ?? [];
      const disabledPassiveIds = current.includes(passiveId)
        ? current.filter((id) => id !== passiveId)
        : [...current, passiveId];
      return { ...state, meta: { ...state.meta, disabledPassiveIds } };
    }

    case 'setAllPassivesDisabled': {
      return {
        ...state,
        meta: {
          ...state.meta,
          disabledPassiveIds: action.disabled ? PASSIVES.map((p) => p.id) : [],
        },
      };
    }

    case 'setThreatCalibrations': {
      const current = state.meta.threatCalibrations ?? DEFAULT_THREAT_CALIBRATIONS;
      return {
        ...state,
        meta: {
          ...state.meta,
          threatCalibrations: { ...current, ...action.calibrations },
        },
      };
    }

    case 'resetThreatCalibrations': {
      return {
        ...state,
        meta: {
          ...state.meta,
          threatCalibrations: { ...DEFAULT_THREAT_CALIBRATIONS },
        },
      };
    }

    case 'resetArsenalQuarantine': {
      return {
        ...state,
        meta: {
          ...state.meta,
          disabledWeaponIds: [],
          disabledPassiveIds: [],
        },
      };
    }

    case 'toggleThreatUpgrade': {
      const current = state.meta.threatUpgrades ?? {};
      return {
        ...state,
        meta: {
          ...state.meta,
          threatUpgrades: { ...current, [action.upgradeId]: !current[action.upgradeId] },
        },
      };
    }

    case 'unlockDvdEasterEgg': {
      if (state.meta.dvdEasterEggUnlocked) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          dvdEasterEggUnlocked: true,
          unlockedEvolutionIds: addUnique(state.meta.unlockedEvolutionIds, 'dvd-screensaver'),
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `dvd-easter-egg-${Date.now()}`,
              title: '★ SPECIAL EASTER EGG UNLOCKED! ★',
              body: 'DVD Bouncing Logo weapon & DVD Corner Strike evolution unlocked! The iconic screensaver is now armed and bouncing in your arsenal.',
              createdAt: Date.now(),
            },
          ],
        },
      };
    }

    case 'refundVendorItem': {
      const item = VENDOR_CATALOG_BY_ID[action.id];
      if (!item) return state;
      const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
      if (owned <= 0) return state;
      const nextOwned = owned - 1;
      const vendorPurchases = { ...state.meta.vendorPurchases };
      if (nextOwned > 0) vendorPurchases[item.id] = nextOwned;
      else delete vendorPurchases[item.id];
      const currency = item.currency ?? 'cred';
      return {
        ...state,
        meta: {
          ...state.meta,
          [currency]: state.meta[currency] + item.cost,
          vendorPurchases,
        },
      };
    }

    case 'refundAllVendorItems': {
      const refundByCurrency: Partial<Record<'cred' | 'skeletonKeys', number>> = {};
      for (const item of VENDOR_CATALOG) {
        const owned = Math.min(item.maxStacks, Math.max(0, Math.floor(state.meta.vendorPurchases[item.id] ?? 0)));
        if (owned <= 0) continue;
        const currency = item.currency ?? 'cred';
        refundByCurrency[currency] = (refundByCurrency[currency] ?? 0) + owned * item.cost;
      }
      if (Object.keys(refundByCurrency).length === 0) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred + (refundByCurrency.cred ?? 0),
          skeletonKeys: state.meta.skeletonKeys + (refundByCurrency.skeletonKeys ?? 0),
          vendorPurchases: {},
        },
      };
    }

    case 'setUiPanelLayout':
      return { ...state, meta: { ...state.meta, uiPanelLayout: action.layout } };

    case 'buyUiTheme': {
      const theme = UI_THEMES_BY_ID[action.id];
      if (!theme || state.meta.ownedUiThemeIds.includes(theme.id) || state.meta.cred < theme.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          cred: state.meta.cred - theme.cost,
          ownedUiThemeIds: [...state.meta.ownedUiThemeIds, theme.id],
        },
      };
    }

    case 'equipUiTheme':
      if (!hasCatalogItem(state.meta, 'uiThemes', action.id, state.meta.ownedUiThemeIds)) return state;
      return { ...state, meta: { ...state.meta, uiTheme: action.id } };

    case 'selectUiThemeSwatch': {
      const theme = UI_THEMES_BY_ID[action.themeId];
      if (!theme?.swatches?.some((swatch) => swatch.id === action.swatchId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          uiThemeSwatchByTheme: { ...state.meta.uiThemeSwatchByTheme, [action.themeId]: action.swatchId },
        },
      };
    }

    case 'buyPalette': {
      const palette = THEMED_PALETTES_BY_ID[action.id];
      if (!palette || state.meta.ownedPaletteIds.includes(palette.id) || state.meta.lootTokens < palette.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lootTokens: state.meta.lootTokens - palette.cost,
          ownedPaletteIds: [...state.meta.ownedPaletteIds, palette.id],
        },
      };
    }

    // Unlocks a palette that was paid for elsewhere (LokTokens, server-verified),
    // so no local currency moves. Idempotent.
    case 'grantPalette': {
      if (!THEMED_PALETTES_BY_ID[action.id] || state.meta.ownedPaletteIds.includes(action.id)) return state;
      return { ...state, meta: { ...state.meta, ownedPaletteIds: [...state.meta.ownedPaletteIds, action.id] } };
    }

    case 'equipPalette':
      if (!hasCatalogItem(state.meta, 'palettes', action.id, state.meta.ownedPaletteIds)) return state;
      return { ...state, meta: { ...state.meta, activePaletteId: action.id } };

    case 'equipDirectorPersonality': {
      if (action.id !== null && !state.meta.defeatedDirectorIds.includes(action.id)) return state;
      return { ...state, meta: { ...state.meta, activeDirectorPersonalityId: action.id } };
    }

    case 'claimSaunaHoleReward': {
      if (state.meta.pendingSaunaReward) return state;
      const reward = SAUNA_HOLE_REWARDS[0];
      if (!reward) return state;
      return { ...state, meta: { ...state.meta, pendingSaunaReward: { weaponId: reward.weaponId } } };
    }

    case 'claimLegendaryPoliceDog': {
      if (!state.meta.clearedAreaIds.includes('site-crew-active-zone')) return state;
      if (state.meta.savedLokPets.some((pet) => pet.roll.variantId === 'blue-616')) return state;
      const roll = rollLokPet(() => 0.616, { fixedVariantId: 'blue-616' });
      const now = Date.now();
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: [{
            id: 'pet-grpd-blue-616',
            roll,
            stamina: PET_STAMINA_MAX,
            level: 1,
            exp: 0,
            battlesWon: 0,
            battlesFought: 0,
            favorite: true,
          }, ...state.meta.savedLokPets].slice(0, 48),
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `grpd-vault-k9-${now}`,
              title: 'Blue 616 joined the kennel',
              body: 'The legendary GRPD vault guardian is ready for runs and LokPet battles.',
              createdAt: now,
            },
          ],
        },
      };
    }

    case 'buySoundPack': {
      const pack = SOUND_PACKS_BY_ID[action.id];
      if (!pack || state.meta.ownedSoundPackIds.includes(pack.id) || state.meta.lootTokens < pack.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lootTokens: state.meta.lootTokens - pack.cost,
          ownedSoundPackIds: [...state.meta.ownedSoundPackIds, pack.id],
        },
      };
    }

    case 'equipSoundPack':
      if (!hasCatalogItem(state.meta, 'soundPacks', action.id, state.meta.ownedSoundPackIds)) return state;
      return { ...state, meta: { ...state.meta, activeSoundPackId: action.id } };

    case 'setSfxEnabled':
      return { ...state, meta: { ...state.meta, sfxEnabled: action.enabled } };

    case 'buyRunAura': {
      const aura = RUN_AURAS_BY_ID[action.id];
      if (!aura || state.meta.ownedRunAuraIds.includes(aura.id) || state.meta.lootTokens < aura.cost) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          lootTokens: state.meta.lootTokens - aura.cost,
          ownedRunAuraIds: [...state.meta.ownedRunAuraIds, aura.id],
        },
      };
    }

    case 'equipRunAura':
      if (!hasCatalogItem(state.meta, 'runAuras', action.id, state.meta.ownedRunAuraIds)) return state;
      return { ...state, meta: { ...state.meta, activeRunAuraId: action.id } };

    case 'buyHat': {
      const hat = HATS_BY_ID[action.id];
      if (!hat || state.meta.ownedHatIds.includes(hat.id) || state.meta.lootTokens < hat.cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - hat.cost, ownedHatIds: [...state.meta.ownedHatIds, hat.id] } };
    }
    case 'equipHat':
      if (!hasCatalogItem(state.meta, 'hats', action.id, state.meta.ownedHatIds)) return state;
      return { ...state, meta: { ...state.meta, activeHatId: action.id } };
    case 'buyCelebration': {
      const celebration = CELEBRATIONS_BY_ID[action.id];
      if (!celebration || state.meta.ownedCelebrationIds.includes(celebration.id) || state.meta.lootTokens < celebration.cost) return state;
      return { ...state, meta: { ...state.meta, lootTokens: state.meta.lootTokens - celebration.cost, ownedCelebrationIds: [...state.meta.ownedCelebrationIds, celebration.id] } };
    }
    case 'equipCelebration':
      if (!hasCatalogItem(state.meta, 'celebrations', action.id, state.meta.ownedCelebrationIds)) return state;
      return { ...state, meta: { ...state.meta, activeCelebrationId: action.id } };

    case 'cycleUiLook': {
      const themeIds = state.meta.themeCycleMastered && state.meta.themeCycleCollection === 'owned'
        ? effectiveCatalogIds(state.meta, 'uiThemes', state.meta.ownedUiThemeIds)
        : STARTER_UI_THEME_IDS;
      const looks = uiLooksForOwnedThemeIds(themeIds);
      if (looks.length <= 1) return state;
      const currentSwatchId = activeUiThemeSwatchId(state.meta);
      const currentIndex = looks.findIndex(
        (look) => look.themeId === state.meta.uiTheme && look.swatchId === currentSwatchId,
      );
      const next = looks[(currentIndex + 1 + looks.length) % looks.length] ?? looks[0];
      return {
        ...state,
        meta: {
          ...state.meta,
          uiTheme: next.themeId,
          ...(next.swatchId
            ? {
                uiThemeSwatchByTheme: {
                  ...state.meta.uiThemeSwatchByTheme,
                  [next.themeId]: next.swatchId,
                },
              }
            : {}),
        },
      };
    }

    case 'cycleStarterUiLook': {
      const looks = uiLooksForOwnedThemeIds(STARTER_UI_THEME_IDS);
      const currentSwatchId = activeUiThemeSwatchId(state.meta);
      const currentIndex = looks.findIndex((look) => look.themeId === state.meta.uiTheme && look.swatchId === currentSwatchId);
      const next = looks[(currentIndex + 1 + looks.length) % looks.length] ?? looks[0];
      return {
        ...state,
        meta: {
          ...state.meta,
          uiTheme: next.themeId,
          ...(next.swatchId ? { uiThemeSwatchByTheme: { ...state.meta.uiThemeSwatchByTheme, [next.themeId]: next.swatchId } } : {}),
        },
      };
    }

    case 'unlockThemeCycleMastery':
      if (state.meta.themeCycleMastered || state.meta.cred < 2400) return state;
      return { ...state, meta: { ...state.meta, cred: state.meta.cred - 2400, themeCycleMastered: true } };

    case 'setThemeCycleCollection':
      if (!state.meta.themeCycleMastered) return state;
      return { ...state, meta: { ...state.meta, themeCycleCollection: action.collection } };

    case 'checkHiddenThemeReload': {
      // Rare cold-open takeovers are the discovery mechanic. This action only
      // runs when IntroScreen mounts, never during normal render work.
      const undiscovered = HIDDEN_UI_THEME_IDS.filter((id) => !state.meta.ownedUiThemeIds.includes(id));
      const available = state.meta.devModeAllUnlocks ? HIDDEN_UI_THEME_IDS : undiscovered.length > 0 ? undiscovered : HIDDEN_UI_THEME_IDS.filter((id) => state.meta.ownedUiThemeIds.includes(id));
      if (available.length === 0 || Math.random() >= 0.08) return state;
      const id = available[Math.floor(Math.random() * available.length)]!;
      return {
        ...state,
        meta: {
          ...state.meta,
          uiTheme: id,
          ownedUiThemeIds: state.meta.ownedUiThemeIds.includes(id) ? state.meta.ownedUiThemeIds : [...state.meta.ownedUiThemeIds, id],
        },
      };
    }

    case 'unlockDevModeAccess':
      return { ...state, meta: { ...state.meta, devModeAccessUnlocked: true } };

    case 'setDevModeAllUnlocks':
      if (!state.meta.devModeAccessUnlocked) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          devModeAllUnlocks: action.enabled,
          ...(action.enabled ? { ownedUiThemeIds: [...new Set([...state.meta.ownedUiThemeIds, ...HIDDEN_UI_THEME_IDS])] } : {}),
          ...(!action.enabled
            ? {
                uiTheme: state.meta.ownedUiThemeIds.includes(state.meta.uiTheme) ? state.meta.uiTheme : DEFAULT_UI_THEME_ID,
                activePaletteId: state.meta.ownedPaletteIds.includes(state.meta.activePaletteId) ? state.meta.activePaletteId : DEFAULT_PALETTE_ID,
                activeSoundPackId: state.meta.ownedSoundPackIds.includes(state.meta.activeSoundPackId) ? state.meta.activeSoundPackId : DEFAULT_SOUND_PACK_ID,
                activeRunAuraId: state.meta.ownedRunAuraIds.includes(state.meta.activeRunAuraId) ? state.meta.activeRunAuraId : DEFAULT_RUN_AURA_ID,
              }
            : {}),
        },
      };

    case 'setPhysicsObjectClicks':
      return {
        ...state,
        meta: { ...state.meta, physicsObjectClicksEnabled: action.enabled },
      };

    case 'setLevelUpPauses':
      return {
        ...state, meta: { ...state.meta, levelUpPausesEnabled: action.enabled, levelUpPresentation: action.enabled ? 'pause-focus' : 'compact-live' },
      };

    case 'setLiveMode':
      return { ...state, meta: { ...state.meta, liveModeEnabled: action.enabled, ...(action.enabled ? { lootPresentation: 'queue' as const, levelUpPausesEnabled: false, levelUpPresentation: state.meta.levelUpPresentation === 'random-live' ? 'random-live' as const : 'compact-live' as const } : {}) } };
    case 'setLootPresentation':
      return { ...state, meta: { ...state.meta, lootPresentation: action.value } };
    case 'setLevelUpPresentation':
      return {
        ...state,
        meta: {
          ...state.meta,
          levelUpPresentation: state.meta.liveModeEnabled && action.value === 'pause-focus' ? 'compact-live' : action.value,
          levelUpPausesEnabled: !state.meta.liveModeEnabled && action.value === 'pause-focus',
        },
      };
    case 'setPauseMapVisible':
      return { ...state, meta: { ...state.meta, pauseMapVisible: action.enabled } };

    case 'setGraphicsQuality':
      return { ...state, meta: { ...state.meta, graphicsQuality: action.quality } };
    case 'setCompanionRevealStyle':
      return { ...state, meta: { ...state.meta, companionRevealStyle: action.style } };

    case 'setFrameRateMode':
      return { ...state, meta: { ...state.meta, frameRateMode: action.mode } };

    case 'setFogAmbianceMode':
      return { ...state, meta: { ...state.meta, fogAmbianceMode: action.mode } };

    case 'setGlowingEyesIntensity':
      return { ...state, meta: { ...state.meta, glowingEyesIntensity: action.intensity } };

    case 'setCrowdAutoZoomEnabled':
      return { ...state, meta: { ...state.meta, crowdAutoZoomEnabled: action.enabled } };

    case 'setWildlifeSheltersInRain':
      return {
        ...state,
        meta: { ...state.meta, wildlifeSheltersInRain: action.enabled },
      };

    case 'setMusicReactive':
      return { ...state, meta: { ...state.meta, musicReactiveEnabled: action.enabled } };

    case 'setHideoutAmbience':
      return { ...state, meta: { ...state.meta, hideoutAmbienceEnabled: action.enabled } };

    case 'setHideoutArrival':
      return { ...state, meta: { ...state.meta, hideoutArrivalEnabled: action.enabled } };

    case 'setAttractMode':
      return { ...state, meta: { ...state.meta, attractModeEnabled: action.enabled } };

    case 'setHideoutWeather':
      return { ...state, meta: { ...state.meta, hideoutWeatherEnabled: action.enabled } };

    case 'setHideoutSectionsCollapsedByDefault':
      return { ...state, meta: { ...state.meta, hideoutSectionsCollapsedByDefault: action.enabled } };

    case 'setHideoutPreview':
      return { ...state, meta: { ...state.meta, hideoutPreviewEnabled: action.enabled } };

    case 'setHideoutPets':
      return { ...state, meta: { ...state.meta, hideoutPets: action.mode } };

    case 'setHideoutEvents':
      return { ...state, meta: { ...state.meta, hideoutEvents: action.mode } };

    case 'setHideoutInteractive':
      return { ...state, meta: { ...state.meta, hideoutInteractive: action.enabled } };

    case 'setHideoutPetPlay':
      return { ...state, meta: { ...state.meta, hideoutPetPlay: action.enabled } };

    case 'setHideoutChoiceEvents':
      return { ...state, meta: { ...state.meta, hideoutChoiceEvents: action.mode } };

    case 'resolveChoiceEvent': {
      // A choice event: validation, the rolled outcome and the payout all live in `applyChoice`
      // (and the shared reward policy). A repeat of the same event inside its cooldown is a no-op.
      const result = applyChoice(state.meta, action.eventId, action.choiceId, action.seed, {
        now: action.now,
        petId: action.petId,
        propId: action.propId,
        elixirCap: ELIXIR_CAP,
      });
      return result.ok ? { ...state, meta: result.meta } : state;
    }

    case 'playWithLokPet': {
      // A play verb: cooldown per pet, XP and bond scaled by mood, plus the verb's small find.
      // The rules (and every cap) live in `applyPetCare` and the shared reward policy.
      const outcome = applyPetCare(state.meta, action.petId, action.verbId, action.seed, {
        now: action.now,
        musicPlaying: action.musicPlaying,
        elixirCap: ELIXIR_CAP,
      });
      return outcome.ok ? { ...state, meta: outcome.meta } : state;
    }

    case 'activateHideoutProp': {
      // A reward prop pays out once per cooldown; everything else about a prop (lines,
      // opening a panel, starting an event) never touches the save.
      const def = HIDEOUT_PROPS_BY_ID[action.propId];
      if (!def || def.action.kind !== 'reward') return state;
      if (def.unlock && !isUnlocked(def.unlock, state.meta)) return state;
      if (!propReady(def, state.meta.hideoutClaims, action.now)) return state;
      const roll = resolvePropReward(def, createRng(action.seed), bondLuck(state.meta.savedLokPets));
      if (!roll) return state;
      const result = grantWithFallback(state.meta, roll.reward, roll.fallback, { now: action.now, rare: roll.rare, elixirCap: ELIXIR_CAP });
      const claimed = trimClaims({ ...result.meta.hideoutClaims, [propClaimKey(def.id)]: action.now });
      return { ...state, meta: { ...result.meta, hideoutClaims: claimed } };
    }

    case 'chooseLokPetBranch': {
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet) return state;
      const change = chooseBranch(pet, action.branchId, action.now);
      if (!change.ok) return state;
      return {
        ...state,
        meta: { ...state.meta, savedLokPets: state.meta.savedLokPets.map((candidate) => (candidate.id === action.id ? change.pet : candidate)) },
      };
    }

    case 'undoLokPetBranch': {
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet) return state;
      const change = undoBranch(pet, action.now);
      if (!change.ok) return state;
      return {
        ...state,
        meta: { ...state.meta, savedLokPets: state.meta.savedLokPets.map((candidate) => (candidate.id === action.id ? change.pet : candidate)) },
      };
    }

    case 'careForLokPet': {
      // Petting a companion in the hideout: it always plays, but only the first of the day counts for bond.
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.id);
      if (!pet) return state;
      const day = bondDayKey(action.now);
      if (pet.careDay === day) return state;
      const grown = growPet(pet, { exp: 0, bondSource: 'care', now: action.now });
      const headlines = growthHeadlines(grown.entry ? [grown.entry] : []);
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: state.meta.savedLokPets.map((candidate) => (candidate.id === action.id ? { ...grown.pet, careDay: day } : candidate)),
          pendingNotifications: headlines.length > 0
            ? [...state.meta.pendingNotifications, { id: `pet-care-${action.id}-${action.now}`, title: 'A good day together', body: headlines.join('. ') + '.', createdAt: action.now }]
            : state.meta.pendingNotifications,
        },
      };
    }

    case 'completeHideoutEvent': {
      const def = HIDEOUT_EVENTS_BY_ID[action.eventId];
      const pet = state.meta.savedLokPets.find((candidate) => candidate.id === action.petId);
      if (!def || !pet) return state;
      const last = pet.hideoutEvents?.[def.id];
      if (last !== undefined && (def.once || action.now - last < def.cooldownMs)) return state;
      const grown = growPet(pet, {
        exp: scalePetExp(def.reward?.exp ?? 0),
        bondSource: def.reward?.bond === false ? undefined : 'event',
        now: action.now,
      });
      const seen = { ...(pet.hideoutEvents ?? {}), [def.id]: action.now };
      const kept = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, 40);
      const headlines = growthHeadlines(grown.entry ? [grown.entry] : []);
      return {
        ...state,
        meta: {
          ...state.meta,
          savedLokPets: state.meta.savedLokPets.map((candidate) => (candidate.id === action.petId ? { ...grown.pet, hideoutEvents: Object.fromEntries(kept) } : candidate)),
          pendingNotifications: headlines.length > 0
            ? [...state.meta.pendingNotifications, { id: `pet-event-${action.petId}-${action.now}`, title: def.title, body: headlines.join('. ') + '.', createdAt: action.now }]
            : state.meta.pendingNotifications,
        },
      };
    }

    case 'setHideoutStickyHeadOut':
      return { ...state, meta: { ...state.meta, hideoutStickyHeadOutEnabled: action.enabled } };

    case 'setSplashTextEnabled':
      return { ...state, meta: { ...state.meta, splashTextEnabled: action.enabled } };

    case 'setOneLineTitleEnabled':
      return { ...state, meta: { ...state.meta, oneLineTitleEnabled: action.enabled } };

    case 'setIntroTitlePhysicsEnabled':
      return { ...state, meta: { ...state.meta, introTitlePhysicsEnabled: action.enabled } };

    case 'setIntroTitleReturnDelay':
      return { ...state, meta: { ...state.meta, introTitleReturnDelaySec: clampIntroReturnDelay(action.seconds) } };

    case 'setTravelEncountersEnabled':
      return { ...state, meta: { ...state.meta, travelEncountersEnabled: action.enabled } };

    case 'setPaletteAnimations':
      return { ...state, meta: { ...state.meta, paletteAnimationsEnabled: action.enabled } };

    case 'setWorldPaletteBlend':
      return { ...state, meta: { ...state.meta, worldPaletteBlendEnabled: action.enabled } };

    case 'setWorldColorFullRecolor':
      return { ...state, meta: { ...state.meta, worldColorFullRecolorEnabled: action.enabled } };

    case 'setGyroEnabled':
      return { ...state, meta: { ...state.meta, gyroEnabled: action.enabled } };

    case 'setStudioPlugins':
      return { ...state, meta: { ...state.meta, studioPluginsEnabled: action.enabled } };

    case 'setStudioLayout':
      return { ...state, meta: { ...state.meta, studioLayout: action.value } };

    case 'setGyroSensitivity':
      return {
        ...state,
        meta: { ...state.meta, gyroSensitivity: clampGyroSensitivity(action.value) },
      };

    case 'setGyroInvertY':
      return { ...state, meta: { ...state.meta, gyroInvertY: action.enabled } };

    case 'setMinimapVisible':
      return {
        ...state,
        meta: { ...state.meta, minimapVisible: action.enabled },
      };

    case 'setMinimapExpanded':
      return {
        ...state,
        meta: { ...state.meta, minimapExpanded: action.enabled },
      };

    case 'setMinimapPosition':
      return {
        ...state,
        meta: {
          ...state.meta,
          minimapPosition: normalizedPosition(action.position, state.meta.minimapPosition),
        },
      };

    case 'setUiDensity':
      return {
        ...state,
        meta: { ...state.meta, uiDensity: action.density },
      };

    case 'setLokPetArtStyle':
      return { ...state, meta: { ...state.meta, lokPetArtStyle: action.style } };

    case 'setUiBorderStyle':
      return { ...state, meta: { ...state.meta, uiBorderStyle: action.style } };
    case 'setLokPetBorderStyle':
      return { ...state, meta: { ...state.meta, lokPetBorderStyle: action.style } };
    case 'setCharacterBorderStyle':
      return { ...state, meta: { ...state.meta, characterBorderStyle: action.style } };

    case 'setWorldInvertEnabled':
      if (action.enabled && vendorPurchaseCount(state.meta, 'invert-world') <= 0) return state;
      return { ...state, meta: { ...state.meta, worldInvertEnabled: action.enabled } };

    case 'setPaletteInvertEnabled':
      if (action.enabled && vendorPurchaseCount(state.meta, 'invert-palette') <= 0) return state;
      return { ...state, meta: { ...state.meta, paletteInvertEnabled: action.enabled } };

    case 'setMirrorModeEnabled':
      if (action.enabled && vendorPurchaseCount(state.meta, 'mirror-mode') <= 0) return state;
      return { ...state, meta: { ...state.meta, mirrorModeEnabled: action.enabled } };

    case 'toggleRunModifier': {
      const current = state.meta.runModifiers[action.key] === true;
      return {
        ...state,
        meta: { ...state.meta, runModifiers: { ...state.meta.runModifiers, [action.key]: !current } },
      };
    }

    case 'announceEndgame': {
      const features = action.ids.map((id) => featureById(id)?.label).filter((l): l is string => Boolean(l));
      const slots = action.ids.map((id) => slotById(id)?.label).filter((l): l is string => Boolean(l));
      if (features.length === 0 && slots.length === 0) return state;
      const parts: string[] = [];
      if (features.length > 0) parts.push(`${features.join(', ')} can now be switched on in Settings, under End game. They are off until you turn them on.`);
      if (slots.length > 0) parts.push(`Custom operator slot${slots.length > 1 ? 's' : ''} earned: ${slots.join(', ')}.`);
      return {
        ...state,
        meta: {
          ...state.meta,
          pendingNotifications: [
            ...state.meta.pendingNotifications,
            {
              id: `endgame-${action.now}-${action.ids.join('-')}`,
              title: features.length > 0 ? 'END GAME UNLOCKED' : 'CUSTOM SLOT EARNED',
              body: parts.join(' '),
              createdAt: action.now,
            },
          ],
        },
      };
    }

    case 'dismissNotifications': {
      const ids = new Set(action.ids);
      return {
        ...state,
        meta: {
          ...state.meta,
          pendingNotifications: state.meta.pendingNotifications.filter((n) => !ids.has(n.id)),
        },
      };
    }

    case 'acknowledgeChangelog':
      return {
        ...state,
        meta: { ...state.meta, lastSeenChangelogVersion: CURRENT_VERSION },
      };

    case 'setUpdatePopupKind':
      return {
        ...state,
        meta: {
          ...state.meta,
          updatePopupKinds: { ...state.meta.updatePopupKinds, [action.kind]: action.enabled },
        },
      };

    case 'refreshGeneratorIncome':
      return { ...state, meta: { ...state.meta, ...settleGeneratorIncome(state.meta, action.now) } };

    case 'buyGenerator': {
      const def = RENTABLE_GENERATORS_BY_ID[action.id];
      if (!def || state.meta.ownedGeneratorIds.includes(action.id)) return state;
      const settled = settleGeneratorIncome(state.meta, action.now);
      if (settled.cred < def.cost) return { ...state, meta: { ...state.meta, ...settled } };
      return {
        ...state,
        meta: {
          ...state.meta,
          ...settled,
          cred: settled.cred - def.cost,
          ownedGeneratorIds: [...state.meta.ownedGeneratorIds, action.id],
        },
      };
    }

    case 'claimAchievement': {
      const def = ACHIEVEMENTS_BY_ID[action.id];
      if (!def || !def.reward) return state;
      if (state.meta.claimedAchievementIds.includes(action.id)) return state;
      if (!def.isComplete(state.meta)) return state;
      const currencyPatch = def.reward.kind === 'cred'
        ? { cred: state.meta.cred + def.reward.amount }
        : def.reward.kind === 'lootTokens'
          ? { lootTokens: state.meta.lootTokens + def.reward.amount }
          : { cardCredits: state.meta.cardCredits + def.reward.amount };
      return {
        ...state,
        meta: {
          ...state.meta,
          ...currencyPatch,
          claimedAchievementIds: [...state.meta.claimedAchievementIds, action.id],
        },
      };
    }

    case 'importVisitingLokCard': {
      if (state.meta.visitingLokCards.some((card) => card.instanceId === action.card.instanceId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          visitingLokCards: [...state.meta.visitingLokCards, action.card].slice(0, 120),
        },
      };
    }

    case 'tickRecovery':
      return { ...state, meta: settleRecovery(state.meta, action.now) };

    case 'startRecovery': {
      const settled = settleRecovery(state.meta);
      if (!settled.unlockedCharacterIds.includes(action.characterId)) return state;
      return {
        ...state,
        meta: {
          ...settled,
          recovery: {
            characterId: action.characterId,
            locationId: action.locationId ?? 'rooftop',
            startedAt: Date.now(),
            lastUpdatedAt: Date.now(),
          },
        },
      };
    }

    case 'stopRecovery':
      {
        const settled = settleRecovery(state.meta);
        return { ...state, meta: { ...settled, recovery: { ...settled.recovery, characterId: null, startedAt: null } } };
      }

    case 'upgradeFacility': {
      const currentIndex = facilityIndex(state.meta.facilityTier);
      const nextFacility = RECOVERY_FACILITIES[currentIndex + 1];
      // The SWAT Sauna (cost 0) is a hut-only reward reached by clearing GRPD
      // Station, never a purchasable rung on this ladder -- see its unlockText.
      if (!nextFacility || nextFacility.cost <= 0 || state.meta.cred < nextFacility.cost) return state;
      return {
        ...state,
        meta: { ...state.meta, cred: state.meta.cred - nextFacility.cost, facilityTier: nextFacility.id },
      };
    }

    case 'createCustomMap': {
      if (state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const map = normalizeCustomMap({ id, name: `Night route ${state.meta.customMaps.length + 1}` }, id);
      return map
        ? { ...state, meta: { ...state.meta, customMaps: [map, ...state.meta.customMaps] } }
        : state;
    }

    case 'completeSectorMission': {
      if (!SECTOR_MISSIONS_BY_ID[action.missionId]) return state;
      if (state.meta.completedSectorMissionIds.includes(action.missionId)) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          completedSectorMissionIds: [...state.meta.completedSectorMissionIds, action.missionId],
        },
      };
    }

    case 'saveCustomMap': {
      const map = normalizeCustomMap({ ...action.map, updatedAt: Date.now() }, action.map.id);
      if (!map) return state;
      const index = state.meta.customMaps.findIndex((candidate) => candidate.id === map.id);
      if (index < 0 && state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const customMaps = index < 0
        ? [map, ...state.meta.customMaps]
        : state.meta.customMaps.map((candidate, candidateIndex) => candidateIndex === index ? map : candidate);
      return { ...state, meta: { ...state.meta, customMaps } };
    }

    case 'duplicateCustomMap': {
      if (state.meta.customMaps.length >= MAX_CUSTOM_MAPS) return state;
      const source = state.meta.customMaps.find((map) => map.id === action.id);
      if (!source) return state;
      const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const copy = normalizeCustomMap({
        ...source,
        id,
        name: `${source.name} copy`,
        placements: source.placements.map((placement) => ({ ...placement, id: `${placement.id}-copy` })),
      }, id);
      return copy
        ? { ...state, meta: { ...state.meta, customMaps: [copy, ...state.meta.customMaps] } }
        : state;
    }

    case 'deleteCustomMap':
      return {
        ...state,
        meta: { ...state.meta, customMaps: state.meta.customMaps.filter((map) => map.id !== action.id) },
      };

    case 'completeRun': {
      const result = action.result;
      const prev = state.meta;
      const runCharacter = getCharacter(result.characterId);
      const collectorRun = Boolean(runCharacter.lokPetCollector);
      const collectorPetsFound = collectorRun
        ? result.lokPets.filter((pet) => pet.origin === 'chest').length
        : 0;

      const bestiary = { ...prev.bestiary };
      for (const [enemyId, count] of Object.entries(result.killsByEnemy)) {
        bestiary[enemyId] = (bestiary[enemyId] ?? 0) + count;
      }

      let rescuedAllyIds = prev.rescuedAllyIds;
      if (result.rescuedAllyId) {
        rescuedAllyIds = addUnique(rescuedAllyIds, result.rescuedAllyId);
      }

      let discoveryIds = prev.discoveryIds;
      if (result.cleared && result.discoveryId) {
        discoveryIds = addUnique(discoveryIds, result.discoveryId);
      }
      for (const findId of result.mapFindIds ?? []) {
        if (findId === 'breach-616-plate' || findId === 'transit-coil-found') discoveryIds = addUnique(discoveryIds, findId);
      }
      const discoveredRelic = result.cleared && result.discoveryId
        ? RELIC_BY_DISCOVERY_ID[result.discoveryId]
        : undefined;
      const knownRelicIds = discoveredRelic
        ? addUnique(prev.knownRelicIds, discoveredRelic.id)
        : prev.knownRelicIds;
      const endlessDiscoveryIds = result.endless
        ? [...new Set([
            ...prev.endlessDiscoveryIds,
            ...result.endless.discoveredBandIds,
            ...result.endless.discoveredRouteEventIds,
          ])]
        : prev.endlessDiscoveryIds;
      const dailyContracts = advanceDailyContracts(
        {
          dayKey: prev.dailyContractDayKey,
          progressById: prev.dailyContractProgressById,
          completedIds: prev.completedDailyContractIds,
        },
        result,
      );

      const clearedAreaIds = result.cleared
        ? addUnique(prev.clearedAreaIds, result.areaId)
        : prev.clearedAreaIds;
      const lokPetCatalog = recordLokPetCatalog(prev.lokPetCatalog, result.lokPets);
      const recoveredElixirs = replenishPetElixirs(prev);
      const spentPetIds = new Set(prev.selectedLokPetIds);
      const runNow = Date.now();
      // Pets that were out earn XP and bond for the run: the starter partner always,
      // plus the loadout. Growth is applied before the stamina cost below.
      const runGrowth = growPartyPets(prev.savedLokPets, spentPetIds, runPetExpBase(result), 'run', runNow);
      const savedLokPets = [
        ...result.lokPets
          .filter((pet) => pet.origin === 'chest')
          .map((pet, index) => ({ id: `pet-${Date.now().toString(36)}-${index}-${pet.variantId}`, roll: pet.roll, stamina: PET_STAMINA_MAX })),
        ...runGrowth.pets.map((pet) => spentPetIds.has(pet.id) && !pet.starter ? { ...pet, stamina: Math.max(0, pet.stamina - 1) } : pet),
      ].slice(0, 48);
      const selectedLokPetIds = prev.selectedLokPetIds.filter((id) => savedLokPets.some((pet) => pet.id === id && (('starter' in pet && pet.starter) || pet.stamina > 0)));
      const lokPetDiscoveries = getLokPetDiscoveries(prev.lokPetCatalog, result.lokPets);
      const lokPetHistory = lokPetDiscoveries.length > 0
        ? [
            {
              runNumber: prev.totalRuns + 1,
              recordedAt: Date.now(),
              areaId: result.areaId,
              characterId: result.characterId,
              cleared: result.cleared,
              discoveries: lokPetDiscoveries,
            },
            ...prev.lokPetHistory,
          ].slice(0, 100)
        : prev.lokPetHistory;

      const next: MetaState = {
        ...prev,
        ownedUiThemeIds: discoveryIds.includes('breach-616-plate') ? addUnique(prev.ownedUiThemeIds, 'breach-616') : prev.ownedUiThemeIds,
        bestiary,
        rescuedAllyIds,
        discoveryIds,
        lokPetCatalog,
        lokPetHistory,
        savedLokPets,
        selectedLokPetIds,
        ...recoveredElixirs,
        clearedAreaIds,
        totalKills: prev.totalKills + result.kills,
        totalRuns: prev.totalRuns + 1,
        bestSurvivalSec: Math.max(prev.bestSurvivalSec, Math.round(result.survivedSec)),
        totalLevelUps: prev.totalLevelUps + Math.max(0, result.level - 1),
        soundtrackObjectiveCompletions: prev.soundtrackObjectiveCompletions + result.completedObjectives.length,
        cred: prev.cred + result.cred + dailyContracts.rewardCred,
        lootTokens: prev.lootTokens + result.lootTokensGained + dailyContracts.rewardTokens,
        cardCredits: prev.cardCredits + cardCreditsForRun(runCharacter, result.lootBoxesOpened),
        cardCollection: prev.autoOpenPacksEnabled
          ? (result.cardPacksFound ?? []).reduce((collection, packId, index) => mergeCardPulls(collection, rollCardPack(packId, createRng(((prev.totalRuns + 1) * 616 + result.kills * 17 + index * 97) >>> 0), CARD_MANIFESTS.map((card) => card.id))), prev.cardCollection)
          : prev.cardCollection,
        unopenedCardPacks: prev.autoOpenPacksEnabled
          ? prev.unopenedCardPacks
          : (result.cardPacksFound ?? []).reduce((packs, packId) => ({ ...packs, [packId]: (packs[packId] ?? 0) + 1 }), prev.unopenedCardPacks),
        lokCollectorRuns: prev.lokCollectorRuns + (collectorRun ? 1 : 0),
        lokCollectorPetsFound: prev.lokCollectorPetsFound + collectorPetsFound,
        skeletonKeys: prev.skeletonKeys + result.skeletonKeysGained + dailyContracts.rewardKeys,
        // Endless records
        endlessRecordDistancePx: result.endless
          ? Math.max(prev.endlessRecordDistancePx, result.endless.maxDistancePx)
          : prev.endlessRecordDistancePx,
        endlessRecordDepth: result.endless
          ? Math.max(prev.endlessRecordDepth, result.endless.dungeonDepth)
          : prev.endlessRecordDepth,
        endlessDiscoveryIds,
        fatigueByCharacter: {
          ...prev.fatigueByCharacter,
          [result.characterId]: Math.min(
            MAX_FATIGUE_PCT,
            (prev.fatigueByCharacter[result.characterId] ?? 0) + FATIGUE_PER_RUN_PCT,
          ),
        },
        characterLevelUps: {
          ...prev.characterLevelUps,
          [result.characterId]: (prev.characterLevelUps[result.characterId] ?? 0) + Math.max(0, result.level - 1),
        },
        discoveredHutIds: RECOVERY_HUTS.filter(
          (hut) => clearedAreaIds.includes(hut.areaId),
        ).map((hut) => hut.id),
        // The SWAT Sauna's hole reward is scoped to exactly one run, win or lose.
        pendingSaunaReward: null,
        activeCrewRumor: result.crewRumor ? null : prev.activeCrewRumor,
        completedEpisodeIds: [...prev.completedEpisodeIds],
        unlockedEvolutionIds: [...prev.unlockedEvolutionIds],
        episodeProgressById: { ...prev.episodeProgressById },
        knownRelicIds,
        relicMaterials: result.craftingMaterialsCollected
          ? Object.entries(result.craftingMaterialsCollected).reduce(
              (acc, [matId, count]) => ({ ...acc, [matId]: (acc[matId] ?? 0) + count }),
              { ...(prev.relicMaterials ?? {}) },
            )
          : prev.relicMaterials,
        dailyContractDayKey: dailyContracts.dayKey,
        dailyContractProgressById: dailyContracts.progressById,
        completedDailyContractIds: dailyContracts.completedIds,
      };

      const episodeDefinition = validEpisodeResult(result);
      if (episodeDefinition && result.episode) {
        const nextProgress = Math.max(
          next.episodeProgressById[episodeDefinition.id] ?? 0,
          Math.min(episodeDefinition.objective.targetCount, Math.max(0, Math.floor(result.episode.progress))),
        );
        next.episodeProgressById[episodeDefinition.id] = nextProgress;
        if (result.episode.completed && result.episode.completedThisRun) {
          next.completedEpisodeIds = addUnique(next.completedEpisodeIds, episodeDefinition.id);
          next.unlockedEvolutionIds = addUnique(next.unlockedEvolutionIds, episodeDefinition.evolutionId);
        }
      }

      // Characters whose unlock rule just became true.
      const newlyUnlocked = CHARACTERS.filter(
        (c) => !next.unlockedCharacterIds.includes(c.id) && isUnlocked(c.unlock, next),
      ).map((c) => c.id);

      next.unlockedCharacterIds = [...next.unlockedCharacterIds, ...newlyUnlocked];

      // Director defeat -> a one-time permanent unlock plus a queued
      // announcement the hub screen drains on the player's next visit. See
      // "Add a notification system" -- this queue is generic on purpose, so
      // a future unlock trigger only needs to push another entry here.
      if (
        result.directorDefeated &&
        result.directorEncounterId &&
        !prev.defeatedDirectorIds.includes(result.directorEncounterId)
      ) {
        const director = DIRECTORS.find((d) => d.id === result.directorEncounterId);
        next.defeatedDirectorIds = addUnique(prev.defeatedDirectorIds, result.directorEncounterId);
        next.directorModeUnlocked = true;
        next.pendingNotifications = [
          ...prev.pendingNotifications,
          {
            id: `director-${result.directorEncounterId}-${Date.now()}`,
            title: director ? `${director.name} defeated` : 'Director defeated',
            body: director
              ? `${director.toggleLabel} is now available as a run toggle on the Roster screen.`
              : 'A new run toggle is now available on the Roster screen.',
            createdAt: Date.now(),
          },
        ];
      }

      const newEvidenceSeals = grpdEarnedSeals(next.totalKills) - grpdEarnedSeals(prev.totalKills);
      if (newEvidenceSeals > 0) {
        next.pendingNotifications = [
          ...next.pendingNotifications,
          {
            id: `grpd-evidence-${next.totalKills}`,
            title: `${newEvidenceSeals} GRPD evidence seal${newEvidenceSeals === 1 ? '' : 's'} earned`,
            body: 'Visit the GRPD Armory to fabricate an archived weapon or raise its spawn modifier.',
            createdAt: Date.now(),
          },
        ];
      }

      // Check DVD Bouncing Logo Easter Egg Unlock:
      // Condition 1: Finished every authored area
      // Condition 2: Cleared bubbleWash (especially with optional side quest objectives completed)
      const allAuthoredAreasCleared = AREAS.every((a) => clearedAreaIds.includes(a.id));
      const bubbleWashCleared = result.areaId === 'bubbleWash' && result.cleared;
      if (!next.dvdEasterEggUnlocked && (allAuthoredAreasCleared || bubbleWashCleared)) {
        next.dvdEasterEggUnlocked = true;
        next.unlockedEvolutionIds = addUnique(next.unlockedEvolutionIds, 'dvd-screensaver');
        next.pendingNotifications = [
          ...next.pendingNotifications,
          {
            id: `dvd-easter-egg-${Date.now()}`,
            title: '★ SPECIAL EASTER EGG UNLOCKED! ★',
            body: 'DVD Bouncing Logo & DVD Corner Strike unlocked! The legendary screensaver ricochets across the screen and detonates full-screen rainbow kinetic bursts on corner hits!',
            createdAt: Date.now(),
          },
        ];
      }

      // Character mastery rank-up: only announce when the rank *title*
      // actually changes (not every level), so the queue doesn't spam.
      const rankBefore = characterRankTitle(characterLevelProgress(prev, result.characterId).level);
      const rankAfter = characterRankTitle(characterLevelProgress(next, result.characterId).level);
      if (rankAfter !== rankBefore) {
        next.pendingNotifications = [
          ...next.pendingNotifications,
          {
            id: `character-rank-${result.characterId}-${Date.now()}`,
            title: `${runCharacter.name} reached ${rankAfter} rank`,
            body: `Level ${characterLevelProgress(next, result.characterId).level} mastery for ${runCharacter.name} -- permanent combat bonus increased.`,
            createdAt: Date.now(),
          },
        ];
      }

      return {
        meta: next,
        lastCardPackReveal: state.lastCardPackReveal,
        lastRun: {
          ...result,
          petGrowth: runGrowth.entries,
          lokPetDiscoveries,
          newlyUnlockedCharacterIds: newlyUnlocked,
          newlyDiscoveredRelicIds: discoveredRelic && !prev.knownRelicIds.includes(discoveredRelic.id)
            ? [discoveredRelic.id]
            : [],
        },
      };
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* Context                                                             */
/* ------------------------------------------------------------------ */

export interface MetaContextValue {
  meta: MetaState;
  lastRun: RunResult | null;
  lastCardPackReveal: CardPackReveal | null;
  selectedCharacter: CharacterDef;
  unlockedCharacters: CharacterDef[];
  lockedCharacters: CharacterDef[];
  unlockedAreas: AreaDef[];
  lockedAreas: AreaDef[];
  unlockedRooms: HubRoomDef[];
  lockedRooms: HubRoomDef[];
  rescuedAllies: AllyDef[];
  missingAllies: AllyDef[];
  dailyContracts: ReturnType<typeof dailyContractStatuses>;
  enterHideout: () => void;
  selectCharacter: (id: string) => void;
  selectCharacterSkin: (characterId: string, skinId: string) => void;
  completeRun: (result: RunResult) => void;
  resolveTravelEncounter: (result: TravelEncounterResult) => void;
  buyCardPack: (packId: CardPackId) => void;
  craftRelic: (relicId: string) => void;
  buyKeyItemAction: (keyItemId: string, credCost: number) => void;
  buySingleCard: (cardId: string, cost: number, variant?: CardVariant) => void;
  recycleCard: (cardId: string, rewardCC: number) => void;
  recycleAllDuplicates: () => void;
  openStoredCardPack: (packId: CardPackId) => void;
  setAutoOpenPacksEnabled: (enabled: boolean) => void;
  buyLokPetCardPack: () => void;
  togglePassiveCard: (cardId: string) => void;
  toggleBattleDeckCard: (cardId: string) => void;
  consumeThrownCard: (cardId: string) => void;
  buyCardSalvageProtocol: () => void;
  buyHandheldDigiScope: () => void;
  toggleSavedLokPet: (id: string) => void;
  setLokPetLoadout: (ids: string[]) => void;
  restoreSavedLokPet: (id: string) => void;
  refreshPetElixirs: () => void;
  feedLokPetTreat: (id: string) => void;
  adoptRancherPet: (variantId: string, credCost: number) => void;
  feedRanchKibble: (petId: string, credCost: number) => void;
  recordLokPetBattleResult: (rewards: BattleRewards, winningPetIds: string[]) => void;
  toggleFavoriteLokPet: (id: string) => void;
  renameLokPet: (id: string, name: string) => void;
  setLokPetName: (id: string, slot: PetNameSlot, name: string) => void;
  claimDailyLogin: () => void;
  equipLokPetTrinket: (id: string, trinketId?: string) => void;
  draftStarterLokPets: () => void;
  completeStarterLokPetOnboarding: (variantId: StarterLokPetId, characterId: string, callName?: string) => void;
  clearLastRun: () => void;
  clearCardPackReveal: () => void;
  markOnboarded: () => void;
  spendTokens: (amount: number) => void;
  buyVendorItem: (id: string) => void;
  refundVendorItem: (id: string) => void;
  refundAllVendorItems: () => void;
  setUiPanelLayout: (layout: UIPanelLayout) => void;
  buyUiTheme: (id: string) => void;
  equipUiTheme: (id: string) => void;
  selectUiThemeSwatch: (themeId: string, swatchId: string) => void;
  buyPalette: (id: string) => void;
  grantPalette: (id: string) => void;
  equipPalette: (id: string) => void;
  /** Digital Archive terminal: select which Director personality spawns for the encounter. Pass null to clear. */
  equipDirectorPersonality: (id: string | null) => void;
  /** SWAT Sauna's "reach through the hole" hub action -- queues a bonus weapon for the next run. */
  claimSaunaHoleReward: () => void;
  /** GRPD Vault action -- adds its named legendary police K9 to the kennel once. */
  claimLegendaryPoliceDog: () => void;
  buySoundPack: (id: string) => void;
  equipSoundPack: (id: string) => void;
  setSfxEnabled: (enabled: boolean) => void;
  buyRunAura: (id: string) => void;
  equipRunAura: (id: string) => void;
  buyHat: (id: string) => void;
  equipHat: (id: string) => void;
  buyCelebration: (id: string) => void;
  equipCelebration: (id: string) => void;
  cycleUiLook: () => void;
  cycleStarterUiLook: () => void;
  unlockThemeCycleMastery: () => void;
  setThemeCycleCollection: (collection: 'starter' | 'owned') => void;
  checkHiddenThemeReload: () => void;
  unlockDevModeAccess: () => void;
  setDevModeAllUnlocks: (enabled: boolean) => void;
  setPhysicsObjectClicks: (enabled: boolean) => void;
  setLevelUpPauses: (enabled: boolean) => void;
  setLiveMode: (enabled: boolean) => void;
  setLootPresentation: (value: MetaState['lootPresentation']) => void;
  setLevelUpPresentation: (value: MetaState['levelUpPresentation']) => void;
  setPauseMapVisible: (enabled: boolean) => void;
  setGraphicsQuality: (quality: MetaState['graphicsQuality']) => void;
  setCompanionRevealStyle: (style: MetaState['companionRevealStyle']) => void;
  setFrameRateMode: (mode: MetaState['frameRateMode']) => void;
  setFogAmbianceMode: (mode: MetaState['fogAmbianceMode']) => void;
  setGlowingEyesIntensity: (intensity: MetaState['glowingEyesIntensity']) => void;
  setCrowdAutoZoomEnabled: (enabled: boolean) => void;
  setWildlifeSheltersInRain: (enabled: boolean) => void;
  setMinimapVisible: (enabled: boolean) => void;
  setMusicReactive: (enabled: boolean) => void;
  setHideoutAmbience: (enabled: boolean) => void;
  setHideoutArrival: (enabled: boolean) => void;
  setAttractMode: (enabled: boolean) => void;
  setHideoutWeather: (enabled: boolean) => void;
  setHideoutSectionsCollapsedByDefault: (enabled: boolean) => void;
  setHideoutPreview: (enabled: boolean) => void;
  setHideoutPets: (mode: MetaState['hideoutPets']) => void;
  setHideoutEvents: (mode: MetaState['hideoutEvents']) => void;
  setHideoutInteractive: (enabled: boolean) => void;
  setHideoutPetPlay: (enabled: boolean) => void;
  setHideoutChoiceEvents: (mode: MetaState['hideoutChoiceEvents']) => void;
  activateHideoutProp: (propId: string, seed: number) => void;
  playWithLokPet: (petId: string, verbId: string, seed: number, musicPlaying: boolean) => void;
  resolveChoiceEvent: (eventId: string, choiceId: string, seed: number, petId?: string, propId?: string) => void;
  careForLokPet: (id: string) => void;
  chooseLokPetBranch: (id: string, branchId: string) => void;
  undoLokPetBranch: (id: string) => void;
  completeHideoutEvent: (petId: string, eventId: string) => void;
  setHideoutStickyHeadOut: (enabled: boolean) => void;
  setSplashTextEnabled: (enabled: boolean) => void;
  setOneLineTitleEnabled: (enabled: boolean) => void;
  setIntroTitlePhysicsEnabled: (enabled: boolean) => void;
  setIntroTitleReturnDelay: (seconds: number) => void;
  setTravelEncountersEnabled: (enabled: boolean) => void;
  setPaletteAnimations: (enabled: boolean) => void;
  setWorldPaletteBlend: (enabled: boolean) => void;
  setWorldColorFullRecolor: (enabled: boolean) => void;
  setGyroEnabled: (enabled: boolean) => void;
  setStudioPlugins: (enabled: boolean) => void;
  setStudioLayout: (value: MetaState['studioLayout']) => void;
  setGyroSensitivity: (value: number) => void;
  setGyroInvertY: (enabled: boolean) => void;
  setMinimapExpanded: (enabled: boolean) => void;
  setMinimapPosition: (position: { x: number; y: number }) => void;
  setWorldInvertEnabled: (enabled: boolean) => void;
  setPaletteInvertEnabled: (enabled: boolean) => void;
  setMirrorModeEnabled: (enabled: boolean) => void;
  toggleRunModifier: (key: keyof RunModifiers) => void;
  dismissNotifications: (ids: string[]) => void;
  acknowledgeChangelog: () => void;
  setUpdatePopupKind: (kind: ChangelogKind, enabled: boolean) => void;
  buyGenerator: (id: string) => void;
  refreshGeneratorIncome: () => void;
  setUiDensity: (density: 'grid' | 'list') => void;
  setLokPetArtStyle: (style: MetaState['lokPetArtStyle']) => void;
  setUiBorderStyle: (style: MetaState['uiBorderStyle']) => void;
  setLokPetBorderStyle: (style: MetaState['lokPetBorderStyle']) => void;
  setCharacterBorderStyle: (style: MetaState['characterBorderStyle']) => void;
  startRecovery: (characterId: string, locationId?: string) => void;
  stopRecovery: () => void;
  tickRecovery: () => void;
  upgradeFacility: () => void;
  createCustomMap: () => void;
  completeSectorMission: (missionId: string) => void;
  saveCustomMap: (map: CustomMap) => void;
  duplicateCustomMap: (id: string) => void;
  deleteCustomMap: (id: string) => void;
  claimAchievement: (id: string) => void;
  importVisitingLokCard: (card: VisitingLokCard) => void;
  unlockThreatMatrixWithKeys: () => void;
  toggleEnemyDisabled: (enemyId: string) => void;
  setAllEnemiesDisabled: (disabled: boolean) => void;
  toggleWeaponDisabled: (weaponId: string) => void;
  unlockGrpdWeapon: (weaponId: string) => void;
  toggleGrpdWeapon: (weaponId: string) => void;
  buyGrpdSpawnTier: (weaponId: string) => void;
  setGrpdAutoIncreaseEnabled: (enabled: boolean) => void;
  setGrpdArmoryAnchor: (anchor: MetaState['grpdArmoryAnchor']) => void;
  setAllWeaponsDisabled: (disabled: boolean) => void;
  togglePassiveDisabled: (passiveId: string) => void;
  setAllPassivesDisabled: (disabled: boolean) => void;
  setThreatCalibrations: (calibrations: Partial<ThreatCalibrations>) => void;
  resetThreatCalibrations: () => void;
  resetArsenalQuarantine: () => void;
  toggleThreatUpgrade: (upgradeId: string) => void;
  unlockDvdEasterEgg: () => void;
  resetProgress: () => void;
  /** Wholesale-replaces progress, e.g. from an imported save file or a cloud-save pull. Normalised the same way a loaded save is. */
  importMeta: (meta: Partial<MetaState>) => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, null, () => ({
    meta: loadMeta(),
    lastRun: null,
    lastCardPackReveal: null,
  }));

  useEffect(() => {
    saveMeta(state.meta);
  }, [state.meta]);

  // End-game unlocks are earned once and kept. Record anything newly qualified and announce it once.
  useEffect(() => {
    const fresh = recordEarnedEndgame(earnedEndgame(state.meta));
    if (fresh.length > 0) dispatch({ type: 'announceEndgame', ids: fresh, now: Date.now() });
  }, [state.meta]);

  // Wholesale-replace, used by a manual save import or (via CloudSyncProvider
  // in @/state/cloudSyncStore, kept out of this file so importing pure
  // metaStore helpers in tests never pulls in the Supabase-touching auth
  // module) a cloud-save pull.
  const importMeta = useCallback((meta: Partial<MetaState>) => dispatch({ type: 'replaceMeta', meta }), []);

  const selectCharacter = useCallback((id: string) => dispatch({ type: 'selectCharacter', id }), []);
  const selectCharacterSkin = useCallback((characterId: string, skinId: string) => dispatch({ type: 'selectCharacterSkin', characterId, skinId }), []);
  const enterHideout = useCallback(() => dispatch({ type: 'enterHideout', now: Date.now() }), []);
  const completeRun = useCallback((result: RunResult) => dispatch({ type: 'completeRun', result }), []);
  const buyCardPack = useCallback((packId: CardPackId) => dispatch({ type: 'buyCardPack', packId, now: Date.now() }), []);
  const buySingleCard = useCallback((cardId: string, cost: number, variant?: CardVariant) => dispatch({ type: 'buySingleCard', cardId, cost, variant }), []);
  const recycleCard = useCallback((cardId: string, rewardCC: number) => dispatch({ type: 'recycleCard', cardId, rewardCC }), []);
  const recycleAllDuplicates = useCallback(() => dispatch({ type: 'recycleAllDuplicates' }), []);
  const openStoredCardPack = useCallback((packId: CardPackId) => dispatch({ type: 'openStoredCardPack', packId, now: Date.now() }), []);
  const setAutoOpenPacksEnabled = useCallback((enabled: boolean) => dispatch({ type: 'setAutoOpenPacksEnabled', enabled }), []);
  const buyLokPetCardPack = useCallback(() => dispatch({ type: 'buyCardPack', packId: 'lokpet', now: Date.now() }), []);
  const togglePassiveCard = useCallback((cardId: string) => dispatch({ type: 'togglePassiveCard', cardId }), []);
  const toggleBattleDeckCard = useCallback((cardId: string) => dispatch({ type: 'toggleBattleDeckCard', cardId }), []);
  const consumeThrownCard = useCallback((cardId: string) => dispatch({ type: 'consumeThrownCard', cardId }), []);
  const buyCardSalvageProtocol = useCallback(() => dispatch({ type: 'buyCardSalvageProtocol' }), []);
  const buyHandheldDigiScope = useCallback(() => dispatch({ type: 'buyHandheldDigiScope' }), []);
  const resolveTravelEncounter = useCallback((result: TravelEncounterResult) => dispatch({ type: 'completeTravelEncounter', result }), []);
  const toggleSavedLokPet = useCallback((id: string) => dispatch({ type: 'toggleSavedLokPet', id }), []);
  const setLokPetLoadout = useCallback((ids: string[]) => dispatch({ type: 'setLokPetLoadout', ids }), []);
  const restoreSavedLokPet = useCallback((id: string) => dispatch({ type: 'restoreSavedLokPet', id, now: Date.now() }), []);
  const refreshPetElixirs = useCallback(() => dispatch({ type: 'refreshPetElixirs', now: Date.now() }), []);
  const feedLokPetTreat = useCallback((id: string) => dispatch({ type: 'feedLokPetTreat', id }), []);
  const adoptRancherPet = useCallback((variantId: string, credCost: number) => dispatch({ type: 'adoptRancherPet', variantId, credCost }), []);
  const feedRanchKibble = useCallback((petId: string, credCost: number) => dispatch({ type: 'feedRanchKibble', petId, credCost }), []);
  const recordLokPetBattleResult = useCallback(
    (rewards: BattleRewards, winningPetIds: string[]) =>
      dispatch({ type: 'recordLokPetBattleResult', rewards, winningPetIds }),
    [],
  );
  const toggleFavoriteLokPet = useCallback((id: string) => dispatch({ type: 'toggleFavoriteLokPet', id }), []);
  const renameLokPet = useCallback((id: string, name: string) => dispatch({ type: 'renameLokPet', id, name }), []);
  const setLokPetName = useCallback((id: string, slot: PetNameSlot, name: string) => dispatch({ type: 'setLokPetName', id, slot, name }), []);
  const claimDailyLogin = useCallback(() => dispatch({ type: 'claimDailyLogin', now: Date.now() }), []);
  const equipLokPetTrinket = useCallback(
    (id: string, trinketId?: string) => dispatch({ type: 'equipLokPetTrinket', id, trinketId }),
    [],
  );
  const draftStarterLokPets = useCallback(() => dispatch({ type: 'draftStarterLokPets' }), []);
  const completeStarterLokPetOnboarding = useCallback(
    (variantId: StarterLokPetId, characterId: string, callName?: string) => dispatch({ type: 'completeStarterLokPetOnboarding', variantId, characterId, now: Date.now(), callName }),
    [],
  );
  const clearLastRun = useCallback(() => dispatch({ type: 'clearLastRun' }), []);
  const clearCardPackReveal = useCallback(() => dispatch({ type: 'clearCardPackReveal' }), []);
  const markOnboarded = useCallback(() => dispatch({ type: 'markOnboarded' }), []);
  const spendTokens = useCallback((amount: number) => dispatch({ type: 'spendTokens', amount }), []);
  const craftRelic = useCallback((relicId: string) => dispatch({ type: 'craftRelic', relicId }), []);
  const buyKeyItemAction = useCallback((keyItemId: string, credCost: number) => dispatch({ type: 'buyKeyItemAction', keyItemId, credCost }), []);
  const unlockCardCustomization = useCallback((customizationId: string, costCC: number) => dispatch({ type: 'unlockCardCustomization', customizationId, costCC }), []);
  const setCardCustomization = useCallback((cardId: string, customization: { frame?: string; overlay?: string; companionSeal?: string }) => dispatch({ type: 'setCardCustomization', cardId, customization }), []);
  const buyVendorItem = useCallback((id: string) => dispatch({ type: 'buyVendorItem', id }), []);
  const refundVendorItem = useCallback((id: string) => dispatch({ type: 'refundVendorItem', id }), []);
  const refundAllVendorItems = useCallback(() => dispatch({ type: 'refundAllVendorItems' }), []);
  const setUiPanelLayout = useCallback((layout: UIPanelLayout) => dispatch({ type: 'setUiPanelLayout', layout }), []);
  const buyUiTheme = useCallback((id: string) => dispatch({ type: 'buyUiTheme', id }), []);
  const equipUiTheme = useCallback((id: string) => dispatch({ type: 'equipUiTheme', id }), []);
  const selectUiThemeSwatch = useCallback(
    (themeId: string, swatchId: string) => dispatch({ type: 'selectUiThemeSwatch', themeId, swatchId }),
    [],
  );
  const buyPalette = useCallback((id: string) => dispatch({ type: 'buyPalette', id }), []);
  const grantPalette = useCallback((id: string) => dispatch({ type: 'grantPalette', id }), []);
  const equipPalette = useCallback((id: string) => dispatch({ type: 'equipPalette', id }), []);
  const equipDirectorPersonality = useCallback((id: string | null) => dispatch({ type: 'equipDirectorPersonality', id }), []);
  const claimSaunaHoleReward = useCallback(() => dispatch({ type: 'claimSaunaHoleReward' }), []);
  const claimLegendaryPoliceDog = useCallback(() => dispatch({ type: 'claimLegendaryPoliceDog' }), []);
  const buySoundPack = useCallback((id: string) => dispatch({ type: 'buySoundPack', id }), []);
  const equipSoundPack = useCallback((id: string) => dispatch({ type: 'equipSoundPack', id }), []);
  const setSfxEnabled = useCallback((enabled: boolean) => dispatch({ type: 'setSfxEnabled', enabled }), []);
  const buyRunAura = useCallback((id: string) => dispatch({ type: 'buyRunAura', id }), []);
  const equipRunAura = useCallback((id: string) => dispatch({ type: 'equipRunAura', id }), []);
  const buyHat = useCallback((id: string) => dispatch({ type: 'buyHat', id }), []);
  const equipHat = useCallback((id: string) => dispatch({ type: 'equipHat', id }), []);
  const buyCelebration = useCallback((id: string) => dispatch({ type: 'buyCelebration', id }), []);
  const equipCelebration = useCallback((id: string) => dispatch({ type: 'equipCelebration', id }), []);
  const cycleUiLook = useCallback(() => dispatch({ type: 'cycleUiLook' }), []);
  const cycleStarterUiLook = useCallback(() => dispatch({ type: 'cycleStarterUiLook' }), []);
  const unlockThemeCycleMastery = useCallback(() => dispatch({ type: 'unlockThemeCycleMastery' }), []);
  const setThemeCycleCollection = useCallback((collection: 'starter' | 'owned') => dispatch({ type: 'setThemeCycleCollection', collection }), []);
  const checkHiddenThemeReload = useCallback(() => dispatch({ type: 'checkHiddenThemeReload' }), []);
  const unlockDevModeAccess = useCallback(() => dispatch({ type: 'unlockDevModeAccess' }), []);
  const setDevModeAllUnlocks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setDevModeAllUnlocks', enabled }),
    [],
  );
  const setPhysicsObjectClicks = useCallback(
    (enabled: boolean) => dispatch({ type: 'setPhysicsObjectClicks', enabled }),
    [],
  );
  const setLevelUpPauses = useCallback(
    (enabled: boolean) => dispatch({ type: 'setLevelUpPauses', enabled }),
    [],
  );
  const setLiveMode = useCallback((enabled: boolean) => dispatch({ type: 'setLiveMode', enabled }), []);
  const setLootPresentation = useCallback((value: MetaState['lootPresentation']) => dispatch({ type: 'setLootPresentation', value }), []);
  const setLevelUpPresentation = useCallback((value: MetaState['levelUpPresentation']) => dispatch({ type: 'setLevelUpPresentation', value }), []);
  const setPauseMapVisible = useCallback((enabled: boolean) => dispatch({ type: 'setPauseMapVisible', enabled }), []);
  const setGraphicsQuality = useCallback((quality: MetaState['graphicsQuality']) => dispatch({ type: 'setGraphicsQuality', quality }), []);
  const setCompanionRevealStyle = useCallback((style: MetaState['companionRevealStyle']) => dispatch({ type: 'setCompanionRevealStyle', style }), []);
  const setFrameRateMode = useCallback((mode: MetaState['frameRateMode']) => dispatch({ type: 'setFrameRateMode', mode }), []);
  const setFogAmbianceMode = useCallback((mode: MetaState['fogAmbianceMode']) => dispatch({ type: 'setFogAmbianceMode', mode }), []);
  const setGlowingEyesIntensity = useCallback((intensity: MetaState['glowingEyesIntensity']) => dispatch({ type: 'setGlowingEyesIntensity', intensity }), []);
  const setCrowdAutoZoomEnabled = useCallback((enabled: boolean) => dispatch({ type: 'setCrowdAutoZoomEnabled', enabled }), []);
  const setWildlifeSheltersInRain = useCallback(
    (enabled: boolean) => dispatch({ type: 'setWildlifeSheltersInRain', enabled }),
    [],
  );
  const setHideoutAmbience = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutAmbience', enabled }),
    [],
  );
  const setHideoutArrival = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutArrival', enabled }),
    [],
  );
  const setAttractMode = useCallback(
    (enabled: boolean) => dispatch({ type: 'setAttractMode', enabled }),
    [],
  );
  const setHideoutWeather = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutWeather', enabled }),
    [],
  );
  const setHideoutSectionsCollapsedByDefault = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutSectionsCollapsedByDefault', enabled }),
    [],
  );
  const setHideoutPreview = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutPreview', enabled }),
    [],
  );
  const setHideoutPets = useCallback((mode: MetaState['hideoutPets']) => dispatch({ type: 'setHideoutPets', mode }), []);
  const setHideoutEvents = useCallback((mode: MetaState['hideoutEvents']) => dispatch({ type: 'setHideoutEvents', mode }), []);
  const setHideoutInteractive = useCallback((enabled: boolean) => dispatch({ type: 'setHideoutInteractive', enabled }), []);
  const setHideoutPetPlay = useCallback((enabled: boolean) => dispatch({ type: 'setHideoutPetPlay', enabled }), []);
  const setHideoutChoiceEvents = useCallback((mode: MetaState['hideoutChoiceEvents']) => dispatch({ type: 'setHideoutChoiceEvents', mode }), []);
  const resolveChoiceEvent = useCallback((eventId: string, choiceId: string, seed: number, petId?: string, propId?: string) => dispatch({ type: 'resolveChoiceEvent', eventId, choiceId, seed, now: Date.now(), petId, propId }), []);
  const playWithLokPet = useCallback((petId: string, verbId: string, seed: number, musicPlaying: boolean) => dispatch({ type: 'playWithLokPet', petId, verbId, seed, now: Date.now(), musicPlaying }), []);
  const activateHideoutProp = useCallback((propId: string, seed: number) => dispatch({ type: 'activateHideoutProp', propId, seed, now: Date.now() }), []);
  const careForLokPet = useCallback((id: string) => dispatch({ type: 'careForLokPet', id, now: Date.now() }), []);
  const chooseLokPetBranch = useCallback((id: string, branchId: string) => dispatch({ type: 'chooseLokPetBranch', id, branchId, now: Date.now() }), []);
  const undoLokPetBranch = useCallback((id: string) => dispatch({ type: 'undoLokPetBranch', id, now: Date.now() }), []);
  const completeHideoutEvent = useCallback((petId: string, eventId: string) => dispatch({ type: 'completeHideoutEvent', petId, eventId, now: Date.now() }), []);
  const setHideoutStickyHeadOut = useCallback(
    (enabled: boolean) => dispatch({ type: 'setHideoutStickyHeadOut', enabled }),
    [],
  );
  const setSplashTextEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setSplashTextEnabled', enabled }),
    [],
  );
  const setOneLineTitleEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setOneLineTitleEnabled', enabled }),
    [],
  );
  const setIntroTitlePhysicsEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setIntroTitlePhysicsEnabled', enabled }),
    [],
  );
  const setIntroTitleReturnDelay = useCallback(
    (seconds: number) => dispatch({ type: 'setIntroTitleReturnDelay', seconds }),
    [],
  );
  const setTravelEncountersEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setTravelEncountersEnabled', enabled }),
    [],
  );

  const setMusicReactive = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMusicReactive', enabled }),
    [],
  );
  const setPaletteAnimations = useCallback((enabled: boolean) => dispatch({ type: 'setPaletteAnimations', enabled }), []);
  const setWorldPaletteBlend = useCallback((enabled: boolean) => dispatch({ type: 'setWorldPaletteBlend', enabled }), []);
  const setWorldColorFullRecolor = useCallback((enabled: boolean) => dispatch({ type: 'setWorldColorFullRecolor', enabled }), []);
  const setStudioPlugins = useCallback(
    (enabled: boolean) => dispatch({ type: 'setStudioPlugins', enabled }),
    [],
  );
  const setStudioLayout = useCallback(
    (value: MetaState['studioLayout']) => dispatch({ type: 'setStudioLayout', value }),
    [],
  );
  const setGyroEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setGyroEnabled', enabled }),
    [],
  );
  const setGyroSensitivity = useCallback(
    (value: number) => dispatch({ type: 'setGyroSensitivity', value }),
    [],
  );
  const setGyroInvertY = useCallback(
    (enabled: boolean) => dispatch({ type: 'setGyroInvertY', enabled }),
    [],
  );
  const setMinimapVisible = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMinimapVisible', enabled }),
    [],
  );
  const setMinimapExpanded = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMinimapExpanded', enabled }),
    [],
  );
  const setMinimapPosition = useCallback(
    (position: { x: number; y: number }) => dispatch({ type: 'setMinimapPosition', position }),
    [],
  );
  const setWorldInvertEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setWorldInvertEnabled', enabled }),
    [],
  );
  const setPaletteInvertEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setPaletteInvertEnabled', enabled }),
    [],
  );
  const setMirrorModeEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'setMirrorModeEnabled', enabled }),
    [],
  );
  const toggleRunModifier = useCallback((key: keyof RunModifiers) => dispatch({ type: 'toggleRunModifier', key }), []);
  const dismissNotifications = useCallback((ids: string[]) => dispatch({ type: 'dismissNotifications', ids }), []);
  const acknowledgeChangelog = useCallback(() => dispatch({ type: 'acknowledgeChangelog' }), []);
  const setUpdatePopupKind = useCallback((kind: ChangelogKind, enabled: boolean) => dispatch({ type: 'setUpdatePopupKind', kind, enabled }), []);
  const buyGenerator = useCallback((id: string) => dispatch({ type: 'buyGenerator', id, now: Date.now() }), []);
  const refreshGeneratorIncome = useCallback(() => dispatch({ type: 'refreshGeneratorIncome', now: Date.now() }), []);
  const setUiDensity = useCallback(
    (density: 'grid' | 'list') => dispatch({ type: 'setUiDensity', density }),
    [],
  );
  const setLokPetArtStyle = useCallback(
    (style: MetaState['lokPetArtStyle']) => dispatch({ type: 'setLokPetArtStyle', style }),
    [],
  );
  const setUiBorderStyle = useCallback(
    (style: MetaState['uiBorderStyle']) => dispatch({ type: 'setUiBorderStyle', style }),
    [],
  );
  const setLokPetBorderStyle = useCallback(
    (style: MetaState['lokPetBorderStyle']) => dispatch({ type: 'setLokPetBorderStyle', style }),
    [],
  );
  const setCharacterBorderStyle = useCallback(
    (style: MetaState['characterBorderStyle']) => dispatch({ type: 'setCharacterBorderStyle', style }),
    [],
  );
  const startRecovery = useCallback((characterId: string, locationId?: string) => dispatch({ type: 'startRecovery', characterId, locationId }), []);
  const stopRecovery = useCallback(() => dispatch({ type: 'stopRecovery' }), []);
  const tickRecovery = useCallback(() => dispatch({ type: 'tickRecovery', now: Date.now() }), []);
  const upgradeFacility = useCallback(() => dispatch({ type: 'upgradeFacility' }), []);
  const createCustomMap = useCallback(() => dispatch({ type: 'createCustomMap' }), []);
  const completeSectorMission = useCallback(
    (missionId: string) => dispatch({ type: 'completeSectorMission', missionId }),
    [],
  );
  const saveCustomMap = useCallback((map: CustomMap) => dispatch({ type: 'saveCustomMap', map }), []);
  const duplicateCustomMap = useCallback((id: string) => dispatch({ type: 'duplicateCustomMap', id }), []);
  const deleteCustomMap = useCallback((id: string) => dispatch({ type: 'deleteCustomMap', id }), []);
  const claimAchievement = useCallback((id: string) => dispatch({ type: 'claimAchievement', id }), []);
  const importVisitingLokCard = useCallback((card: VisitingLokCard) => dispatch({ type: 'importVisitingLokCard', card }), []);
  const unlockThreatMatrixWithKeys = useCallback(() => dispatch({ type: 'unlockThreatMatrixWithKeys' }), []);
  const toggleEnemyDisabled = useCallback((enemyId: string) => dispatch({ type: 'toggleEnemyDisabled', enemyId }), []);
  const setAllEnemiesDisabled = useCallback((disabled: boolean) => dispatch({ type: 'setAllEnemiesDisabled', disabled }), []);
  const toggleThreatUpgrade = useCallback((upgradeId: string) => dispatch({ type: 'toggleThreatUpgrade', upgradeId }), []);
  const toggleWeaponDisabled = useCallback((weaponId: string) => dispatch({ type: 'toggleWeaponDisabled', weaponId }), []);
  const unlockGrpdWeapon = useCallback((weaponId: string) => dispatch({ type: 'unlockGrpdWeapon', weaponId }), []);
  const toggleGrpdWeapon = useCallback((weaponId: string) => dispatch({ type: 'toggleGrpdWeapon', weaponId }), []);
  const buyGrpdSpawnTier = useCallback((weaponId: string) => dispatch({ type: 'buyGrpdSpawnTier', weaponId }), []);
  const setGrpdAutoIncreaseEnabled = useCallback((enabled: boolean) => dispatch({ type: 'setGrpdAutoIncreaseEnabled', enabled }), []);
  const setGrpdArmoryAnchor = useCallback((anchor: MetaState['grpdArmoryAnchor']) => dispatch({ type: 'setGrpdArmoryAnchor', anchor }), []);
  const setAllWeaponsDisabled = useCallback((disabled: boolean) => dispatch({ type: 'setAllWeaponsDisabled', disabled }), []);
  const togglePassiveDisabled = useCallback((passiveId: string) => dispatch({ type: 'togglePassiveDisabled', passiveId }), []);
  const setAllPassivesDisabled = useCallback((disabled: boolean) => dispatch({ type: 'setAllPassivesDisabled', disabled }), []);
  const setThreatCalibrations = useCallback((calibrations: Partial<ThreatCalibrations>) => dispatch({ type: 'setThreatCalibrations', calibrations }), []);
  const resetThreatCalibrations = useCallback(() => dispatch({ type: 'resetThreatCalibrations' }), []);
  const resetArsenalQuarantine = useCallback(() => dispatch({ type: 'resetArsenalQuarantine' }), []);
  const unlockDvdEasterEgg = useCallback(() => dispatch({ type: 'unlockDvdEasterEgg' }), []);
  const resetProgress = useCallback(() => dispatch({ type: 'reset' }), []);

  const value = useMemo<MetaContextValue>(() => {
    const { meta } = state;
    const unlockedCharacters = CHARACTERS.filter((c) => isUnlocked(c.unlock, meta));
    const lockedCharacters = CHARACTERS.filter((c) => !isUnlocked(c.unlock, meta));
    const unlockedAreas = AREAS.filter((a) => isUnlocked(a.unlock, meta));
    const lockedAreas = AREAS.filter((a) => !isUnlocked(a.unlock, meta));
    const unlockedRooms = HUB_ROOMS.filter((r) => isUnlocked(r.unlock, meta));
    const lockedRooms = HUB_ROOMS.filter((r) => !isUnlocked(r.unlock, meta));
    const rescuedAllies = ALLIES.filter((a) => meta.rescuedAllyIds.includes(a.id));
    const missingAllies = ALLIES.filter((a) => !meta.rescuedAllyIds.includes(a.id));
    const dailyContracts = dailyContractStatuses({
      dayKey: meta.dailyContractDayKey,
      progressById: meta.dailyContractProgressById,
      completedIds: meta.completedDailyContractIds,
    });

    const selectedCharacter = unlockedCharacters.some((c) => c.id === meta.selectedCharacterId)
      ? getCharacter(meta.selectedCharacterId)
      : (unlockedCharacters[0] ?? getCharacter('shade'));

    return {
      meta,
      lastRun: state.lastRun,
      lastCardPackReveal: state.lastCardPackReveal,
      selectedCharacter,
      unlockedCharacters,
      lockedCharacters,
      unlockedAreas,
      lockedAreas,
      unlockedRooms,
      lockedRooms,
      rescuedAllies,
      missingAllies,
      dailyContracts,
      enterHideout,
      selectCharacter,
      selectCharacterSkin,
      completeRun,
      resolveTravelEncounter,
      buyCardPack,
      buySingleCard,
      recycleCard,
      recycleAllDuplicates,
      openStoredCardPack,
      setAutoOpenPacksEnabled,
      buyLokPetCardPack,
      togglePassiveCard,
      toggleBattleDeckCard,
      consumeThrownCard,
      buyCardSalvageProtocol,
      buyHandheldDigiScope,
      craftRelic,
      buyKeyItemAction,
      unlockCardCustomization,
      setCardCustomization,
      toggleSavedLokPet,
      setLokPetLoadout,
      restoreSavedLokPet,
      refreshPetElixirs,
      feedLokPetTreat,
      adoptRancherPet,
      feedRanchKibble,
      recordLokPetBattleResult,
      toggleFavoriteLokPet,
      renameLokPet,
      setLokPetName,
      claimDailyLogin,
      equipLokPetTrinket,
      draftStarterLokPets,
      completeStarterLokPetOnboarding,
      clearLastRun,
      clearCardPackReveal,
      markOnboarded,
      spendTokens,
      buyVendorItem,
      refundVendorItem,
      refundAllVendorItems,
      setUiPanelLayout,
      buyUiTheme,
      equipUiTheme,
      selectUiThemeSwatch,
      buyPalette,
      grantPalette,
      equipPalette,
      equipDirectorPersonality,
      claimSaunaHoleReward,
      claimLegendaryPoliceDog,
      buySoundPack,
      equipSoundPack,
      setSfxEnabled,
      buyRunAura,
      equipRunAura,
      buyHat,
      equipHat,
      buyCelebration,
      equipCelebration,
      cycleUiLook,
      cycleStarterUiLook,
      unlockThemeCycleMastery,
      setThemeCycleCollection,
      checkHiddenThemeReload,
      unlockDevModeAccess,
      setDevModeAllUnlocks,
      setPhysicsObjectClicks,
      setLevelUpPauses,
      setLiveMode,
      setLootPresentation,
      setLevelUpPresentation,
      setPauseMapVisible,
      setGraphicsQuality,
      setCompanionRevealStyle,
      setFrameRateMode,
      setFogAmbianceMode,
      setGlowingEyesIntensity,
      setCrowdAutoZoomEnabled,
      setWildlifeSheltersInRain,
      setMinimapVisible,
      setMusicReactive,
      setHideoutAmbience,
      setHideoutArrival,
      setAttractMode,
      setHideoutWeather,
      setHideoutSectionsCollapsedByDefault,
      setHideoutPreview,
      setHideoutPets,
      setHideoutEvents,
      setHideoutInteractive,
      setHideoutPetPlay,
      setHideoutChoiceEvents,
      activateHideoutProp,
      playWithLokPet,
      resolveChoiceEvent,
      careForLokPet,
      chooseLokPetBranch,
      undoLokPetBranch,
      completeHideoutEvent,
      setHideoutStickyHeadOut,
      setSplashTextEnabled,
      setOneLineTitleEnabled,
      setIntroTitlePhysicsEnabled,
      setIntroTitleReturnDelay,
      setTravelEncountersEnabled,
      setPaletteAnimations,
      setWorldPaletteBlend,
      setWorldColorFullRecolor,
      setGyroEnabled,
      setStudioPlugins,
      setStudioLayout,
      setGyroSensitivity,
      setGyroInvertY,
      setMinimapExpanded,
      setMinimapPosition,
      setWorldInvertEnabled,
      setPaletteInvertEnabled,
      setMirrorModeEnabled,
      toggleRunModifier,
      dismissNotifications,
      acknowledgeChangelog,
      setUpdatePopupKind,
      buyGenerator,
      refreshGeneratorIncome,
      setUiDensity,
      setLokPetArtStyle,
      setUiBorderStyle,
      setLokPetBorderStyle,
      setCharacterBorderStyle,
      resetProgress,
      startRecovery,
      stopRecovery,
      tickRecovery,
      upgradeFacility,
      createCustomMap,
      completeSectorMission,
      saveCustomMap,
      duplicateCustomMap,
      deleteCustomMap,
      claimAchievement,
      importVisitingLokCard,
      unlockThreatMatrixWithKeys,
      toggleEnemyDisabled,
      setAllEnemiesDisabled,
      toggleWeaponDisabled,
      unlockGrpdWeapon,
      toggleGrpdWeapon,
      buyGrpdSpawnTier,
      setGrpdAutoIncreaseEnabled,
      setGrpdArmoryAnchor,
      setAllWeaponsDisabled,
      togglePassiveDisabled,
      setAllPassivesDisabled,
      setThreatCalibrations,
      resetThreatCalibrations,
      resetArsenalQuarantine,
      toggleThreatUpgrade,
      unlockDvdEasterEgg,
      importMeta,
    };
  }, [
    state,
    selectCharacter,
    enterHideout,
    selectCharacterSkin,
    completeRun,
    resolveTravelEncounter,
    buyCardPack,
    buySingleCard,
    recycleCard,
    recycleAllDuplicates,
    openStoredCardPack,
    setAutoOpenPacksEnabled,
    buyLokPetCardPack,
    togglePassiveCard,
    toggleBattleDeckCard,
    consumeThrownCard,
    buyCardSalvageProtocol,
    buyHandheldDigiScope,
    toggleSavedLokPet,
    setLokPetLoadout,
    restoreSavedLokPet,
    refreshPetElixirs,
    feedLokPetTreat,
    adoptRancherPet,
    feedRanchKibble,
    recordLokPetBattleResult,
    toggleFavoriteLokPet,
    renameLokPet,
    setLokPetName,
    claimDailyLogin,
    equipLokPetTrinket,
    draftStarterLokPets,
    completeStarterLokPetOnboarding,
    clearLastRun,
    clearCardPackReveal,
    markOnboarded,
    spendTokens,
    buyVendorItem,
    refundVendorItem,
    refundAllVendorItems,
    setUiPanelLayout,
    buyUiTheme,
    equipUiTheme,
    selectUiThemeSwatch,
    buyPalette,
    grantPalette,
    equipPalette,
    equipDirectorPersonality,
    claimSaunaHoleReward,
    claimLegendaryPoliceDog,
    buySoundPack,
    equipSoundPack,
    setSfxEnabled,
    buyRunAura,
    equipRunAura,
    buyHat,
    equipHat,
    buyCelebration,
    equipCelebration,
    cycleUiLook,
    cycleStarterUiLook,
    unlockThemeCycleMastery,
    setThemeCycleCollection,
    checkHiddenThemeReload,
    unlockDevModeAccess,
    setDevModeAllUnlocks,
    setPhysicsObjectClicks,
    setLevelUpPauses,
    setLiveMode,
    setLootPresentation,
    setLevelUpPresentation,
    setPauseMapVisible,
    setGraphicsQuality,
    setCompanionRevealStyle,
    setFrameRateMode,
    setFogAmbianceMode,
    setGlowingEyesIntensity,
    setCrowdAutoZoomEnabled,
    setWildlifeSheltersInRain,
    setMinimapVisible,
    setMusicReactive,
    setHideoutAmbience,
    setHideoutArrival,
    setAttractMode,
    setHideoutWeather,
    setHideoutSectionsCollapsedByDefault,
    setHideoutPreview,
    setHideoutPets,
    setHideoutEvents,
    setHideoutInteractive,
    setHideoutPetPlay,
    setHideoutChoiceEvents,
    activateHideoutProp,
    playWithLokPet,
    resolveChoiceEvent,
    careForLokPet,
    chooseLokPetBranch,
    undoLokPetBranch,
    completeHideoutEvent,
    setHideoutStickyHeadOut,
    setSplashTextEnabled,
    setOneLineTitleEnabled,
    setIntroTitlePhysicsEnabled,
    setIntroTitleReturnDelay,
    setTravelEncountersEnabled,
    setPaletteAnimations,
    setWorldPaletteBlend,
    setWorldColorFullRecolor,
    setGyroEnabled,
    setStudioLayout,
    setGyroSensitivity,
    setGyroInvertY,
    setMinimapExpanded,
    setMinimapPosition,
    setWorldInvertEnabled,
    setPaletteInvertEnabled,
    setMirrorModeEnabled,
    toggleRunModifier,
    dismissNotifications,
    acknowledgeChangelog,
    setUpdatePopupKind,
    buyGenerator,
    refreshGeneratorIncome,
    setUiDensity,
    setLokPetArtStyle,
    setUiBorderStyle,
    setLokPetBorderStyle,
    setCharacterBorderStyle,
    resetProgress,
    startRecovery,
    stopRecovery,
    tickRecovery,
    upgradeFacility,
    createCustomMap,
    completeSectorMission,
    saveCustomMap,
    duplicateCustomMap,
    deleteCustomMap,
    claimAchievement,
    importVisitingLokCard,
    unlockThreatMatrixWithKeys,
    toggleEnemyDisabled,
    setAllEnemiesDisabled,
    toggleWeaponDisabled,
    unlockGrpdWeapon,
    toggleGrpdWeapon,
    buyGrpdSpawnTier,
    setGrpdAutoIncreaseEnabled,
    setGrpdArmoryAnchor,
    setAllWeaponsDisabled,
    togglePassiveDisabled,
    setAllPassivesDisabled,
    setThreatCalibrations,
    resetThreatCalibrations,
    resetArsenalQuarantine,
    toggleThreatUpgrade,
    unlockDvdEasterEgg,
    importMeta,
  ]);

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMeta(): MetaContextValue {
  const ctx = useContext(MetaContext);
  if (!ctx) {
    throw new Error('useMeta must be used inside <MetaProvider>');
  }
  return ctx;
}

/** The accent swatch id currently in effect for the player's equipped UI theme, if it offers any. */
export function activeUiThemeSwatchId(meta: MetaState): string | undefined {
  return meta.uiThemeSwatchByTheme[meta.uiTheme] ?? defaultSwatchId(meta.uiTheme);
}

/** Convenience for menus that need the area record plus its lock state. */
export function areaStatus(areaId: string, meta: MetaState) {
  const area = getArea(areaId);
  return {
    area,
    unlocked: isUnlocked(area.unlock, meta),
    cleared: meta.clearedAreaIds.includes(areaId),
  };
}
