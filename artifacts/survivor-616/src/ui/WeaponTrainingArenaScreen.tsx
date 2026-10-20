import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Crosshair, Plus, RotateCcw, Search, Sparkles, Star, Swords, Target, Trash2, Zap, Move, LockKeyhole } from 'lucide-react';

import { createWorld, stepWorld, type EnemyActor, type World } from '@/game/engine/world';
import { CHARACTERS } from '@/game/data/characters';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { AREAS } from '@/game/data/areas';
import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { EVOLUTIONS_BY_ID } from '@/game/data/evolutions';
import { renderWorld, type Viewport } from '@/game/render/draw';
import { useMeta } from '@/game/state/metaStore';
import type { WeaponDef } from '@/game/types';
import type { CharacterDef } from '@/game/types';
import type { TrainingArenaLoadoutGroup } from '@/game/types';
import { WeaponIcon } from './WeaponIcon';
import { STATUS_EFFECTS_BY_ID } from '@/game/data/statusEffects';
import { useT } from '@/lib/i18n';

const FIXED_STEP = 1 / 60;
const TRAINING_ENEMY_ID = 'dust-mite';
const DUMMY_HP_PRESETS = [1000, 5000, 20_000] as const;
const DUMMY_START_HP = 5000;
const MIN_TEST_RANGE = 310;
const TRAINING_ARENA_LAYOUT_KEY = 'survivor616.training-arena-layout';

type TrainingArenaLayout = 'main' | 'classic';

function loadTrainingArenaLayout(): TrainingArenaLayout {
  if (typeof window === 'undefined') return 'main';
  try {
    return window.localStorage.getItem(TRAINING_ARENA_LAYOUT_KEY) === 'classic' ? 'classic' : 'main';
  } catch {
    return 'main';
  }
}
const POST_ATTACK_TAIL_MS = 420;
const TEST_SAFETY_CAP_MS = 10_000;
const TRAINING_PLAYER_X = -135;
const TRAINING_DUMMY_X = 175;
const TRAINING_CAMERA_CENTER_X = (TRAINING_PLAYER_X + TRAINING_DUMMY_X) / 2;
const TRAINING_DUMMY_RETURN_RATE = 1.8;

function buildTrainingLoadout(): WeaponDef[] {
  return [...ALL_WEAPON_DEFS].sort((a, b) => a.name.localeCompare(b.name));
}

const TRAINING_LOADOUT = buildTrainingLoadout();
const EVOLUTION_WEAPON_IDS = new Set(Object.keys(EVOLUTIONS_BY_ID));
const BASE_TRAINING_WEAPON_COUNT = TRAINING_LOADOUT.filter((weapon) => !EVOLUTION_WEAPON_IDS.has(weapon.id)).length;
const EVOLUTION_TRAINING_WEAPON_COUNT = TRAINING_LOADOUT.filter((weapon) => EVOLUTION_WEAPON_IDS.has(weapon.id)).length;
const EVOLUTION_KILL_REQUIREMENT = 6_166;

function makeTrainingDummy(maxHp = DUMMY_START_HP, mode: 'durability' | 'nonlethal' | 'infinite' = 'durability'): EnemyActor {
  const def = ENEMIES_BY_ID[TRAINING_ENEMY_ID]!;
  return {
    uid: 900_001,
    defId: def.id,
    def,
    x: 175,
    y: 0,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: def.radius,
    hp: maxHp,
    maxHp,
    facing: -1,
    anim: 'idle',
    animStartedAt: 0,
    hitFlashUntil: 0,
    falling: false,
    fallStartedAt: 0,
    speed: 0,
    damage: 0,
    xp: 0,
    mass: def.mass,
    contactReadyAt: Number.POSITIVE_INFINITY,
    chargeReadyAt: Number.POSITIVE_INFINITY,
    chargeUntil: 0,
    fireReadyAt: Number.POSITIVE_INFINITY,
    weave: 0,
    wobblePhase: 0,
    specialReadyAt: Number.POSITIVE_INFINITY,
    telegraphUntil: 0,
    specialUntil: 0,
    specialRadius: 0,
    specialKind: null,
    ghostUntil: 0,
    burstUntil: 0,
    baseRadius: def.radius,
    convertedUntil: 0,
    convertedAttackReadyAt: 0,
    dying: false,
    deathAt: 0,
    activeEffects: [],
    trainingDummyMode: mode,
    invisibleUntil: 0,
    phaseUntil: 0,
    shieldedUntil: 0,
    commanderLocked: false,
    frozenUntil: 0,
    selectedForThrow: false,
    commanded: false,
    orderKind: 'none',
    orderX: 0,
    orderY: 0,
    selectedForCommand: false,
    capturableUntil: 0,
  };
}

function trainingArea() {
  const base = AREAS[0]!;
  return {
    ...base,
    id: 'training-arena',
    name: 'Training Arena',
    district: 'Sanctum',
    description: 'A quiet room to try the full weapon rack.',
    bounds: { w: 520, h: 340 },
    obstacles: [],
    waves: [],
    musicEvents: undefined,
    mapPickups: [],
    mapInteractables: [],
    durationSec: 86_400,
    rescueAllyId: undefined,
    discoveryId: undefined,
  };
}

function createTrainingWorld(character: CharacterDef, weapon: WeaponDef, dummyMaxHp: number): World {
  const area = trainingArea();
  const actor = { ...character, weapon };
  const world = createWorld(area, actor, character.stats, 616, [], 1, false);
  world.player.x = TRAINING_PLAYER_X;
  world.player.y = 0;
  world.player.facing = 1;
  world.player.vx = 0;
  world.player.vy = 0;
  world.hazardImmune = true;
  world.camera.x = TRAINING_CAMERA_CENTER_X;
  world.camera.y = 0;
  world.enemies = [makeTrainingDummy(dummyMaxHp)];
  world.weapons = [{ def: { ...weapon, range: Math.max(weapon.range, MIN_TEST_RANGE) }, level: 1, count: weapon.count ?? 1, readyAt: Number.POSITIVE_INFINITY }];
  world.orbiters = weapon.kind === 'orbit'
    ? Array.from({ length: Math.max(1, weapon.count ?? 1) }, (_, index) => ({
      weaponId: weapon.id,
      angle: (Math.PI * 2 * index) / Math.max(1, weapon.count ?? 1),
      radius: Math.max(weapon.range, MIN_TEST_RANGE),
      damage: 0,
      cooldowns: new Map<number, number>(),
    }))
    : [];
  return world;
}

function weaponKindLabel(weapon: WeaponDef): string {
  return weapon.kind.toUpperCase().replace('-', ' ');
}

function hasWeaponActivity(world: World): boolean {
  return world.projectiles.length > 0
    || world.pendingMeteors.length > 0
    || world.effects.length > 0
    || world.particles.length > 0
    || world.popups.length > 0
    || world.followers.length > 0
    || world.enemies.some((enemy) => enemy.activeEffects.some((effect) => effect.expiresAt > world.now));
}

export function WeaponTrainingArenaScreen({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const testRunningRef = useRef(false);
  const testTailUntilRef = useRef(0);
  const orbitStopAtRef = useRef(0);
  const firingPendingRef = useRef(false);
  const testStartedAtRef = useRef(0);
  const testResolutionStartedAtRef = useRef(0);
  const testStartDamageRef = useRef(0);
  const testStartHitsRef = useRef(0);
  const testStartCritsRef = useRef(0);
  const challengeModeRef = useRef(false);
  const challengeStopRef = useRef(false);
  const challengeTriggerRef = useRef<HTMLButtonElement>(null);
  const challengeDialogRef = useRef<HTMLDivElement>(null);
  const continuousModeRef = useRef(false);
  const continuousStopRef = useRef(false);
  const challengeKeyRef = useRef('');
  const observedEffectsRef = useRef<string[]>([]);
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const cameraDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const lastChallengeWeaponsRef = useRef<WeaponDef[]>([]);
  const { selectedCharacter, meta, recordTrainingSession, setTrainingArenaLoadoutGroups, toggleFavoriteTrainingWeapon } = useMeta();
  const t = useT();
  const [selectedWeaponId, setSelectedWeaponId] = useState(TRAINING_LOADOUT.find((weapon) => !EVOLUTION_WEAPON_IDS.has(weapon.id))?.id ?? TRAINING_LOADOUT[0]!.id);
  const [expandedWeaponId, setExpandedWeaponId] = useState<string | null>(null);
  const [layout, setLayout] = useState<TrainingArenaLayout>(loadTrainingArenaLayout);
  const [rackColumns, setRackColumns] = useState(2);
  const [cameraCenterLock, setCameraCenterLock] = useState(true);
  const [search, setSearch] = useState('');
  const [detailLock, setDetailLock] = useState(false);
  const [dummyHp, setDummyHp] = useState(DUMMY_START_HP);
  const [dummyMaxHp, setDummyMaxHp] = useState<number>(DUMMY_START_HP);
  const [lastDamage, setLastDamage] = useState(0);
  const [lastDps, setLastDps] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [lastTest, setLastTest] = useState('training.status.ready');
  const [targetMode, setTargetMode] = useState<'durability' | 'nonlethal' | 'infinite'>('durability');
  const [allWeaponLevel, setAllWeaponLevel] = useState(1);
  const [weaponLevelOverrides, setWeaponLevelOverrides] = useState<Record<string, number>>({});
  const [multiWeaponIds, setMultiWeaponIds] = useState<string[]>([]);
  const [loadoutName, setLoadoutName] = useState('');
  const [rackPage, setRackPage] = useState<'weapons' | 'evolutions'>('weapons');
  const [rackPageDirection, setRackPageDirection] = useState<'right' | 'left'>('right');
  const [spam, setSpam] = useState(false);
  const [challengeRunning, setChallengeRunning] = useState(false);
  const [challengeSeconds, setChallengeSeconds] = useState(0);
  const [challengeResult, setChallengeResult] = useState<{ damage: number; tier: string } | null>(null);
  const [liveHits, setLiveHits] = useState(0);
  const [liveCrits, setLiveCrits] = useState(0);
  const [liveLargestHit, setLiveLargestHit] = useState(0);
  const [liveDamage, setLiveDamage] = useState(0);
  const [liveEffects, setLiveEffects] = useState<string[]>([]);
  const weaponLevelFor = (weaponId: string): number => weaponLevelOverrides[weaponId] ?? allWeaponLevel;
  const adjustWeaponLevel = (weaponId: string, amount: number): void => {
    setWeaponLevelOverrides((levels) => ({
      ...levels,
      [weaponId]: Math.max(1, Math.min(8, (levels[weaponId] ?? allWeaponLevel) + amount)),
    }));
  };
  const adjustAllWeaponLevels = (amount: number): void => {
    setAllWeaponLevel((level) => Math.max(1, Math.min(8, level + amount)));
    setWeaponLevelOverrides({});
  };
  const selectedWeapon = TRAINING_LOADOUT.find((weapon) => weapon.id === selectedWeaponId) ?? TRAINING_LOADOUT[0]!;
  const selectedWeaponLevel = weaponLevelFor(selectedWeapon.id);
  const allWeaponsMixed = TRAINING_LOADOUT.some((weapon) => weaponLevelFor(weapon.id) !== allWeaponLevel);
  const multiUnlocked = meta.trainingDummyDamage >= 1_000_000 || meta.devModeAllUnlocks;
  const weaponKillsFor = (weapon: WeaponDef): number => {
    const evolution = EVOLUTIONS_BY_ID[weapon.id];
    const sourceWeaponId = evolution?.baseWeaponId ?? weapon.id;
    return meta.devModeAllUnlocks ? (evolution ? EVOLUTION_KILL_REQUIREMENT : 616) : (meta.trainingWeaponKills[sourceWeaponId] ?? 0);
  };
  const weaponIsUnlocked = (weapon: WeaponDef): boolean => meta.devModeAllUnlocks || weaponKillsFor(weapon) >= (EVOLUTIONS_BY_ID[weapon.id] ? EVOLUTION_KILL_REQUIREMENT : 616);
  const selectedEvolution = EVOLUTIONS_BY_ID[selectedWeapon.id];
  const selectedKillRequirement = selectedEvolution ? EVOLUTION_KILL_REQUIREMENT : 616;
  const weaponKills = Math.min(selectedKillRequirement, weaponKillsFor(selectedWeapon));
  const selectedWeapons = (multiUnlocked && multiWeaponIds.length > 0
    ? multiWeaponIds.map((id) => TRAINING_LOADOUT.find((weapon) => weapon.id === id)).filter((weapon): weapon is WeaponDef => Boolean(weapon))
    : [selectedWeapon]);
  const makeWeaponLevelKey = (weapons: WeaponDef[]): string => weapons
    .map((weapon) => `${weapon.id}@L${weaponLevelFor(weapon.id)}`)
    .sort()
    .join('+');
  const challengeKey = makeWeaponLevelKey(selectedWeapons);
  const mainLayout = layout === 'main';

  const toggleSpam = (): void => {
    const nextSpam = !spam;
    setSpam(nextSpam);
    if (!testRunningRef.current || challengeModeRef.current) return;
    if (nextSpam) {
      continuousModeRef.current = true;
      continuousStopRef.current = false;
      const world = worldRef.current;
      if (world) {
        for (const weapon of world.weapons) weapon.readyAt = Math.min(weapon.readyAt, world.now);
        firingPendingRef.current = true;
      }
    } else if (continuousModeRef.current) {
      continuousStopRef.current = true;
    }
  };

  useEffect(() => {
    if (!challengeResult) return;
    const dialog = challengeDialogRef.current;
    const retryButton = dialog?.querySelector<HTMLButtonElement>('[data-challenge-retry]');
    retryButton?.focus();

    const handleDialogKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setChallengeResult(null);
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      challengeTriggerRef.current?.focus();
    };
  }, [Boolean(challengeResult)]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TRAINING_ARENA_LAYOUT_KEY, layout);
    } catch {
      // The preferred layout still works for this visit when storage is unavailable.
    }
  }, [layout]);

  const activeLoadoutGroup = meta.trainingArenaLoadoutGroups.find((group) => group.id === meta.trainingArenaActiveGroupId)
    ?? meta.trainingArenaLoadoutGroups[0]!;
  const activeLoadout = activeLoadoutGroup.loadouts.find((loadout) => loadout.id === activeLoadoutGroup.activeLoadoutId) ?? null;
  const favoriteWeaponIds = new Set(meta.trainingFavoriteWeaponIds);
  const filteredWeapons = useMemo(() => {
    const query = search.trim().toLowerCase();
    const catalog = TRAINING_LOADOUT.filter((weapon) => EVOLUTION_WEAPON_IDS.has(weapon.id) === (rackPage === 'evolutions'));
    const filtered = query
      ? catalog.filter((weapon) => {
        const evolutionSource = EVOLUTIONS_BY_ID[weapon.id]?.baseWeaponId;
        const sourceName = evolutionSource ? TRAINING_LOADOUT.find((candidate) => candidate.id === evolutionSource)?.name ?? '' : '';
        return `${weapon.name} ${weapon.kind} ${weapon.description} ${evolutionSource ?? ''} ${sourceName}`.toLowerCase().includes(query);
      })
      : catalog;
    return filtered.sort((a, b) => Number(favoriteWeaponIds.has(b.id)) - Number(favoriteWeaponIds.has(a.id)) || a.name.localeCompare(b.name));
  }, [search, rackPage, meta.trainingFavoriteWeaponIds]);

  useEffect(() => {
    if (!challengeRunning) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setChallengeSeconds((seconds) => {
        if (seconds <= 1) {
          challengeStopRef.current = true;
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challengeRunning]);

  useEffect(() => {
    worldRef.current = createTrainingWorld(selectedCharacter, selectedWeapon, dummyMaxHp);
    if (worldRef.current?.enemies[0]) worldRef.current.enemies[0].trainingDummyMode = targetMode;
    setDummyHp(dummyMaxHp);
  }, [selectedCharacter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    let hpAt = 0;
    let view: Viewport = { width: 1, height: 1, dpr: 1 };

    const resize = (): void => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const backingW = Math.max(1, Math.round(width * ratio));
      const backingH = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      view = { width, height, dpr: backingW / width, targetViewOverride: 720 };
    };

    const frame = (time: number): void => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;
      if (time - hpAt > 120) {
        hpAt = time;
        const target = world.enemies[0];
        setDummyHp(Math.max(0, target?.hp ?? dummyMaxHp));
        const damage = Math.max(0, world.trainingDamage - testStartDamageRef.current);
        setLiveDamage(damage);
        setLiveHits(Math.max(0, world.trainingHits - testStartHitsRef.current));
        setLiveCrits(Math.max(0, world.trainingCriticalHits - testStartCritsRef.current));
        setLiveLargestHit(world.trainingLargestHit);
        const activeEffectNames = (target?.activeEffects ?? [])
          .filter((effect) => effect.expiresAt > world.now)
          .map((effect) => STATUS_EFFECTS_BY_ID[effect.id]?.name ?? effect.id);
        for (const name of activeEffectNames) {
          if (!observedEffectsRef.current.includes(name)) observedEffectsRef.current.push(name);
        }
        setLiveEffects((effects) => effects.length === observedEffectsRef.current.length ? effects : [...observedEffectsRef.current]);
      }

      if (testRunningRef.current) {
        accumulator = Math.min(accumulator + dt, FIXED_STEP * 6);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX: 0, moveY: 0, ultimate: false });
          world.player.x = TRAINING_PLAYER_X;
          world.player.y = 0;
          world.player.vx = 0;
          world.player.vy = 0;
          world.player.kx = 0;
          world.player.ky = 0;
          world.player.facing = 1;
          const dummy = world.enemies[0];
          if (dummy && !dummy.dying) {
            const returnFactor = 1 - Math.exp(-FIXED_STEP * TRAINING_DUMMY_RETURN_RATE);
            const returnX = TRAINING_DUMMY_X - dummy.x;
            const returnY = -dummy.y;
            dummy.x += returnX * returnFactor;
            dummy.y += returnY * returnFactor;
            if (Math.hypot(returnX, returnY) > 4) {
              dummy.facing = returnX < -1 ? -1 : returnX > 1 ? 1 : dummy.facing;
              if (dummy.anim !== 'hurt' || world.now - dummy.animStartedAt >= 160) {
                if (dummy.anim !== 'walk') {
                  dummy.anim = 'walk';
                  dummy.animStartedAt = world.now;
                }
              }
            }
          }
          if (firingPendingRef.current) {
            firingPendingRef.current = false;
            if (!challengeModeRef.current && !continuousModeRef.current) {
              for (const runWeapon of world.weapons) if (runWeapon.def.kind !== 'orbit') runWeapon.readyAt = Number.POSITIVE_INFINITY;
            }
          }

          if (challengeStopRef.current || continuousStopRef.current) {
            challengeStopRef.current = false;
            continuousStopRef.current = false;
            challengeModeRef.current = false;
            continuousModeRef.current = false;
            world.orbiters = [];
            orbitStopAtRef.current = 0;
            for (const runWeapon of world.weapons) runWeapon.readyAt = Number.POSITIVE_INFINITY;
            testTailUntilRef.current = world.now + POST_ATTACK_TAIL_MS;
            testResolutionStartedAtRef.current = world.now;
            if (world.enemies[0]) world.enemies[0].trainingDummyMode = targetMode;
          }

          // Keep the challenge target alive so all 24 seconds measure damage output,
          // even when the player's selected target preset has ordinary durability.
          if (world.enemies[0]) world.enemies[0].trainingDummyMode = challengeModeRef.current ? 'infinite' : targetMode;

          if (orbitStopAtRef.current && world.now >= orbitStopAtRef.current) {
            world.orbiters = [];
            orbitStopAtRef.current = 0;
          }

          const orbitFinished = orbitStopAtRef.current === 0;
          const safetyCapReached = world.now - testResolutionStartedAtRef.current >= TEST_SAFETY_CAP_MS;
          const target = world.enemies[0];
          const targetReturned = !target || (Math.hypot(target.x - TRAINING_DUMMY_X, target.y) < 3 && Math.hypot(target.kx, target.ky) < 8);
          const attackResolved = !hasWeaponActivity(world) && targetReturned;
          const continuous = challengeModeRef.current || continuousModeRef.current;
          if (!continuous && !firingPendingRef.current && orbitFinished && (attackResolved || safetyCapReached) && world.now >= testTailUntilRef.current) {
            if (safetyCapReached) {
              world.projectiles = [];
              world.pendingMeteors = [];
              world.effects = [];
              world.particles = [];
              world.popups = [];
              world.followers = [];
            }
            const durationSec = Math.max(0.1, (world.now - testStartedAtRef.current) / 1000);
            const damage = Math.max(0, world.trainingDamage - testStartDamageRef.current);
            const hits = Math.max(0, world.trainingHits - testStartHitsRef.current);
            const crits = Math.max(0, world.trainingCriticalHits - testStartCritsRef.current);
            const xp = Math.max(0, (hits - crits) * 0.1 + crits * 0.3);
            const challengeKeyAtStart = challengeKeyRef.current;
            recordTrainingSession(selectedCharacter.id, damage, xp, challengeKeyAtStart ? { key: challengeKeyAtStart, damage } : undefined);
            testRunningRef.current = false;
            accumulator = 0;
            setTestRunning(false);
            setChallengeRunning(false);
            setChallengeSeconds(0);
            setDummyHp(Math.max(0, world.enemies[0]?.hp ?? dummyMaxHp));
            setLastDamage(Math.round(damage));
            setLastDps(Math.round(damage / durationSec));
            setLiveDamage(damage);
            setLiveHits(hits);
            setLiveCrits(crits);
            setLiveLargestHit(world.trainingLargestHit);
            if (challengeKeyAtStart) {
              const tiers = [
                { min: 100_000_000, key: 'training.challenge.tier100000000' },
                { min: 5_000_000, key: 'training.challenge.tier5000000' },
                { min: 1_000_000, key: 'training.challenge.tier1000000' },
                { min: 5_000, key: 'training.challenge.tier5000' },
                { min: 1_000, key: 'training.challenge.tier1000' },
                { min: 0, key: 'training.challenge.tier0' },
              ];
              const tier = tiers.find((entry) => damage >= entry.min)!.key;
              setChallengeResult({ damage: Math.round(damage), tier });
            }
            challengeKeyRef.current = '';
            break;
          }
        }
      } else {
        accumulator = 0;
      }

      if (cameraCenterLock) {
        const returnFactor = 1 - Math.exp(-dt * 5);
        cameraOffsetRef.current.x += (0 - cameraOffsetRef.current.x) * returnFactor;
        cameraOffsetRef.current.y += (0 - cameraOffsetRef.current.y) * returnFactor;
      }
      world.camera.x = TRAINING_CAMERA_CENTER_X + cameraOffsetRef.current.x;
      world.camera.y = cameraOffsetRef.current.y;
      resize();
      renderWorld(ctx, world, view);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [selectedCharacter, dummyMaxHp, layout, recordTrainingSession, cameraCenterLock]);

  const testWeapon = (weaponToTest: WeaponDef | WeaponDef[] = selectedWeapon, challenge = false, continuous = false): void => {
    const world = worldRef.current;
    if (!world) return;
    const weaponsToTest = Array.isArray(weaponToTest) ? weaponToTest : [weaponToTest];
    if (weaponsToTest.length === 0) return;
    if (testRunningRef.current) {
      let target = world.enemies[0];
      if (!target || target.dying) {
        target = makeTrainingDummy(dummyMaxHp, targetMode);
        world.enemies = [target];
      }
      target.hp = Math.max(target.hp, 1);
      target.dying = false;
      target.trainingDummyMode = challengeModeRef.current ? 'infinite' : targetMode;
      const additions = weaponsToTest.map((weapon) => ({
        def: { ...weapon, range: Math.max(weapon.range, MIN_TEST_RANGE) },
        level: weaponLevelFor(weapon.id),
        count: weapon.count ?? 1,
        readyAt: world.now,
      }));
      world.weapons.push(...additions);
      const orbitWeapons = weaponsToTest.filter((weapon) => weapon.kind === 'orbit');
      world.orbiters.push(...orbitWeapons.flatMap((weapon) => Array.from({ length: Math.max(1, weapon.count ?? 1) }, (_, index) => ({
        weaponId: weapon.id,
        angle: (Math.PI * 2 * index) / Math.max(1, weapon.count ?? 1),
        radius: Math.max(weapon.range, MIN_TEST_RANGE),
        damage: 0,
        cooldowns: new Map<number, number>(),
      }))));
      firingPendingRef.current = firingPendingRef.current || weaponsToTest.some((weapon) => weapon.kind !== 'orbit');
      if (challengeModeRef.current) {
        const allWeapons = [...lastChallengeWeaponsRef.current, ...weaponsToTest];
        lastChallengeWeaponsRef.current = [...new Map(allWeapons.map((weapon) => [weapon.id, weapon])).values()];
        challengeKeyRef.current = makeWeaponLevelKey(lastChallengeWeaponsRef.current);
      }
      setLastTest(t('training.status.activated', { weapon: weaponsToTest.map((weapon) => weapon.name).join(' + ') }));
      return;
    }
    if (testRunningRef.current) return;
    world.projectiles = [];
    world.effects = [];
    world.particles = [];
    world.popups = [];
    world.orbiters = [];
    world.pendingMeteors = [];
    world.followers = [];
    let target = world.enemies[0];
    if (!target || target.dying) {
      target = makeTrainingDummy(dummyMaxHp, targetMode);
      world.enemies = [target];
    }
    target.hp = Math.max(target.hp, 1);
    target.maxHp = dummyMaxHp;
    target.trainingDummyMode = targetMode;
    target.dying = false;
    target.activeEffects = [];
    world.player.anim = 'idle';
    world.trainingDamage = 0;
    world.trainingHits = 0;
    world.trainingCriticalHits = 0;
    world.trainingLargestHit = 0;
    world.weapons = weaponsToTest.map((weapon) => ({ def: { ...weapon, range: Math.max(weapon.range, MIN_TEST_RANGE) }, level: weaponLevelFor(weapon.id), count: weapon.count ?? 1, readyAt: world.now }));
    const orbitWeapons = weaponsToTest.filter((weapon) => weapon.kind === 'orbit');
    world.orbiters = orbitWeapons.flatMap((weapon) => Array.from({ length: Math.max(1, weapon.count ?? 1) }, (_, index) => ({
      weaponId: weapon.id,
      angle: (Math.PI * 2 * index) / Math.max(1, weapon.count ?? 1),
      radius: Math.max(weapon.range, MIN_TEST_RANGE),
      damage: 0,
      cooldowns: new Map<number, number>(),
    })));
    const startedAt = world.now;
    const orbitDurationMs = orbitWeapons.length > 0
      ? Math.max(...orbitWeapons.map((weapon) => Math.max(1200, (Math.PI * 2 / (weapon.speed ?? 2.5)) * 1000)))
      : 0;
    testStartedAtRef.current = startedAt;
    testResolutionStartedAtRef.current = startedAt;
    testStartDamageRef.current = world.trainingDamage;
    testStartHitsRef.current = world.trainingHits;
    testStartCritsRef.current = world.trainingCriticalHits;
    testTailUntilRef.current = startedAt + POST_ATTACK_TAIL_MS;
    orbitStopAtRef.current = !challenge && !continuous && orbitDurationMs ? startedAt + orbitDurationMs : 0;
    firingPendingRef.current = weaponsToTest.some((weapon) => weapon.kind !== 'orbit');
    challengeModeRef.current = challenge;
    challengeStopRef.current = false;
    continuousModeRef.current = continuous && !challenge;
    continuousStopRef.current = false;
    challengeKeyRef.current = challenge ? makeWeaponLevelKey(weaponsToTest) : '';
    if (challenge) lastChallengeWeaponsRef.current = [...weaponsToTest];
    setChallengeResult(null);
    setChallengeRunning(challenge);
    setChallengeSeconds(challenge ? 24 : 0);
    if (challenge) setSpam(false);
    testRunningRef.current = true;
    setTestRunning(true);
    setLastDamage(0);
    setLastDps(0);
    setLiveDamage(0);
    setLiveHits(0);
    setLiveCrits(0);
    setLiveLargestHit(0);
    setLiveEffects([]);
    observedEffectsRef.current = [];
    setLastTest(t('training.status.activated', { weapon: weaponsToTest.map((weapon) => weapon.name).join(' + ') }));
  };

  const stopTest = (): void => {
    if (challengeModeRef.current) {
      challengeStopRef.current = true;
      setChallengeRunning(false);
      setChallengeSeconds(0);
    } else if (continuousModeRef.current) {
      continuousStopRef.current = true;
    }
  };

  const startChallenge = (): void => {
    if (testRunningRef.current || (!multiUnlocked && multiWeaponIds.length > 1) || selectedWeapons.some((weapon) => !weaponIsUnlocked(weapon))) return;
    testWeapon(selectedWeapons, true, false);
  };

  const retryChallenge = (): void => {
    const retryWeapons = lastChallengeWeaponsRef.current.length > 0 ? lastChallengeWeaponsRef.current : selectedWeapons;
    setChallengeResult(null);
    testWeapon(retryWeapons, true, false);
  };

  const activateWeapon = (weapon: WeaponDef): void => {
    if (!weaponIsUnlocked(weapon)) return;
    setSelectedWeaponId(weapon.id);
    testWeapon(weapon, false, spam);
  };

  const toggleWeaponDetails = (weapon: WeaponDef): void => {
    if (detailLock) {
      activateWeapon(weapon);
      return;
    }
    chooseWeapon(weapon);
  };

  const toggleDetailLock = (): void => {
    setDetailLock((locked) => !locked);
    setExpandedWeaponId(null);
  };

  const toggleMultiWeapon = (weapon: WeaponDef): void => {
    if (!multiUnlocked || !weaponIsUnlocked(weapon)) return;
    setMultiWeaponIds((ids) => ids.includes(weapon.id) ? ids.filter((id) => id !== weapon.id) : [...ids, weapon.id]);
  };

  const selectRackPage = (nextPage: 'weapons' | 'evolutions'): void => {
    if (nextPage === rackPage) return;
    setRackPageDirection(nextPage === 'evolutions' ? 'right' : 'left');
    setRackPage(nextPage);
    setExpandedWeaponId(null);
  };

  const selectLoadoutGroup = (groupId: string): void => {
    setTrainingArenaLoadoutGroups(meta.trainingArenaLoadoutGroups, groupId);
  };

  const createLoadoutGroup = (): void => {
    if (meta.trainingArenaLoadoutGroups.length >= 4) return;
    const group: TrainingArenaLoadoutGroup = {
      id: `training-group-${Date.now()}`,
      activeLoadoutId: null,
      loadouts: [],
    };
    setTrainingArenaLoadoutGroups([...meta.trainingArenaLoadoutGroups, group], group.id);
  };

  const removeLoadoutGroup = (groupId: string): void => {
    if (meta.trainingArenaLoadoutGroups.length <= 1) return;
    const groups = meta.trainingArenaLoadoutGroups.filter((group) => group.id !== groupId);
    const activeGroupId = groupId === meta.trainingArenaActiveGroupId ? groups[0]!.id : meta.trainingArenaActiveGroupId;
    setTrainingArenaLoadoutGroups(groups, activeGroupId);
    if (groupId === meta.trainingArenaActiveGroupId) {
      setMultiWeaponIds([]);
      setSelectedWeaponId(TRAINING_LOADOUT[0]!.id);
    }
  };

  const saveCurrentLoadout = (): void => {
    const weaponIds = [...new Set(multiUnlocked && multiWeaponIds.length > 0 ? multiWeaponIds : [selectedWeapon.id])];
    if (weaponIds.length === 0) return;
    const name = loadoutName.trim() || t('training.loadouts.defaultName', { number: activeLoadoutGroup.loadouts.length + 1 });
    const newLoadout = { id: `training-loadout-${Date.now()}`, name: name.slice(0, 32), weaponIds };
    const groups = meta.trainingArenaLoadoutGroups.map((group) => group.id === activeLoadoutGroup.id
      ? { ...group, activeLoadoutId: newLoadout.id, loadouts: [...group.loadouts, newLoadout] }
      : group);
    setTrainingArenaLoadoutGroups(groups, activeLoadoutGroup.id);
    setLoadoutName('');
  };

  const loadSavedLoadout = (loadoutId: string): void => {
    const loadout = activeLoadoutGroup.loadouts.find((candidate) => candidate.id === loadoutId);
    if (!loadout || (loadout.weaponIds.length > 1 && !multiUnlocked)) return;
    const weaponIds = loadout.weaponIds.filter((id) => TRAINING_LOADOUT.some((weapon) => weapon.id === id));
    if (weaponIds.length === 0 || weaponIds.some((id) => {
      const weapon = TRAINING_LOADOUT.find((candidate) => candidate.id === id);
      return !weapon || !weaponIsUnlocked(weapon);
    })) return;
    const selected = TRAINING_LOADOUT.find((weapon) => weapon.id === weaponIds[0])!;
    if (EVOLUTION_WEAPON_IDS.has(selected.id)) selectRackPage('evolutions');
    setSelectedWeaponId(selected.id);
    setMultiWeaponIds(multiUnlocked ? weaponIds : []);
    const groups = meta.trainingArenaLoadoutGroups.map((group) => group.id === activeLoadoutGroup.id ? { ...group, activeLoadoutId: loadoutId } : group);
    setTrainingArenaLoadoutGroups(groups, activeLoadoutGroup.id);
  };

  const deleteSavedLoadout = (loadoutId: string): void => {
    const groups = meta.trainingArenaLoadoutGroups.map((group) => group.id === activeLoadoutGroup.id
      ? { ...group, activeLoadoutId: group.activeLoadoutId === loadoutId ? null : group.activeLoadoutId, loadouts: group.loadouts.filter((loadout) => loadout.id !== loadoutId) }
      : group);
    setTrainingArenaLoadoutGroups(groups, activeLoadoutGroup.id);
  };

  const resetDummy = (): void => {
    const world = worldRef.current;
    if (!world) return;
    world.enemies = [makeTrainingDummy(dummyMaxHp, targetMode)];
    world.projectiles = [];
    world.effects = [];
    world.particles = [];
    world.popups = [];
    world.orbiters = [];
    world.pendingMeteors = [];
    world.followers = [];
    for (const weapon of world.weapons) weapon.readyAt = Number.POSITIVE_INFINITY;
    testRunningRef.current = false;
    challengeModeRef.current = false;
    continuousModeRef.current = false;
    setChallengeRunning(false);
    setChallengeSeconds(0);
    testTailUntilRef.current = 0;
    orbitStopAtRef.current = 0;
    firingPendingRef.current = false;
    setTestRunning(false);
    setDummyHp(dummyMaxHp);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(t('training.status.reset'));
  };

  const setDummyDurability = (hp: number): void => {
    const world = worldRef.current;
    if (world) {
      world.enemies = [makeTrainingDummy(hp, targetMode)];
      world.projectiles = [];
      world.effects = [];
      world.particles = [];
      world.popups = [];
      world.orbiters = [];
      world.pendingMeteors = [];
      world.followers = [];
    }
    if (world) for (const weapon of world.weapons) weapon.readyAt = Number.POSITIVE_INFINITY;
    testRunningRef.current = false;
    challengeModeRef.current = false;
    continuousModeRef.current = false;
    setChallengeRunning(false);
    setChallengeSeconds(0);
    testTailUntilRef.current = 0;
    orbitStopAtRef.current = 0;
    firingPendingRef.current = false;
    setTestRunning(false);
    setDummyMaxHp(hp);
    setDummyHp(hp);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(t('training.status.durability', { hp: hp.toLocaleString() }));
  };

  const setTrainingTargetMode = (mode: 'durability' | 'nonlethal' | 'infinite'): void => {
    setTargetMode(mode);
    const target = worldRef.current?.enemies[0];
    if (target) target.trainingDummyMode = mode;
    if (mode === 'infinite' && target) target.hp = target.maxHp;
  };

  const chooseWeapon = (weapon: WeaponDef): void => {
    setSelectedWeaponId(weapon.id);
    setExpandedWeaponId((expandedId) => expandedId === weapon.id ? null : weapon.id);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(t('training.status.selected', { weapon: weapon.name }));
  };

  const rackLocked = !meta.trainingWeaponRackOwned && !meta.devModeAllUnlocks;
  const trainingXp = meta.trainingOperatorXp[selectedCharacter.id] ?? 0;
  const operatorTrainingLevel = Math.floor(trainingXp / 100) + 1;
  const operatorTrainingProgress = trainingXp % 100;
  const shownDamage = testRunning ? Math.round(liveDamage) : lastDamage;
  const shownHits = testRunning ? liveHits : liveHits;
  const shownCrits = testRunning ? liveCrits : liveCrits;
  const statusText = lastTest.startsWith('training.status.') ? t(lastTest as never) : lastTest;
  const renderWeaponIconButton = (weapon: WeaponDef, unlocked: boolean) => {
    const favorite = favoriteWeaponIds.has(weapon.id);
    return (
      <div className="relative h-9 w-9 shrink-0">
        <button type="button" onClick={() => activateWeapon(weapon)} disabled={!unlocked} aria-label={`${t('training.rack.activate')} ${weapon.name} ${t('training.rack.level', { level: weaponLevelFor(weapon.id) })}`} title={`${t('training.rack.activate')} · ${t('training.rack.level', { level: weaponLevelFor(weapon.id) })}`} className="absolute inset-1 grid place-items-center rounded-sm outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
          <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={30} />
          <span key={`badge-${weaponLevelFor(weapon.id)}`} aria-hidden="true" className="training-tier-pop absolute -bottom-1 -right-1 z-10 min-w-4 border border-slate-950 bg-lime-300 px-0.5 font-mono text-[7px] font-black leading-[12px] text-slate-950">L{weaponLevelFor(weapon.id)}</span>
        </button>
        <button type="button" onClick={() => toggleFavoriteTrainingWeapon(weapon.id)} aria-pressed={favorite} aria-label={t(favorite ? 'training.rack.unfavorite' : 'training.rack.favorite', { weapon: weapon.name })} title={t(favorite ? 'training.rack.unfavorite' : 'training.rack.favorite', { weapon: weapon.name })} className="absolute -right-0.5 -top-0.5 z-20 grid h-4 w-4 place-items-center rounded-full border border-slate-950 bg-slate-950/95 text-primary outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary">
          <span key={`favorite-${favorite ? 'on' : 'off'}`} className={favorite ? 'training-favorite-pop' : ''}><Star size={10} className={favorite ? 'fill-primary/35 text-primary' : 'text-white/45'} /></span>
        </button>
      </div>
    );
  };

  if (rackLocked) return (
    <main className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-slate-950 px-5 text-center text-slate-100">
      <Target className="h-10 w-10 text-cyan-200" />
      <h1 className="font-mono text-xl font-black uppercase tracking-widest">{t('training.header.title')}</h1>
      <p className="max-w-md text-sm text-white/65">{t('training.status.locked')}</p>
      <button type="button" onClick={onBack} className="border border-white/20 px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-white/10">{t('training.header.back')}</button>
    </main>
  );

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-orange-300/70 bg-[#17110e] px-3 py-2.5 sm:gap-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 border border-white/20 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/10 sm:min-h-10 sm:gap-2 sm:px-3 sm:text-xs">
            <ArrowLeft size={15} /> {t('training.header.back')}
          </button>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[.22em] text-orange-200">{t('training.header.kicker')}</p>
            <h1 className="text-base font-black uppercase tracking-wide text-white sm:text-xl">{t('training.header.title')}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="flex items-center border border-white/10 bg-black/25 p-0.5" aria-label={t('training.layout.label')}>
            <button type="button" onClick={() => setLayout('main')} aria-pressed={mainLayout} data-testid="training-arena-layout-main" className={`min-h-8 px-2 font-mono text-[8px] font-black uppercase tracking-wider transition sm:px-3 sm:text-[9px] ${mainLayout ? 'bg-orange-300 text-slate-950' : 'text-white/55 hover:text-white'}`}>{t('training.layout.main')}</button>
            <button type="button" onClick={() => setLayout('classic')} aria-pressed={!mainLayout} data-testid="training-arena-layout-classic" className={`min-h-8 px-2 font-mono text-[8px] font-black uppercase tracking-wider transition sm:px-3 sm:text-[9px] ${!mainLayout ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white'}`}>{t('training.layout.classic')}</button>
          </div>
          <div className="flex min-h-8 items-center gap-1 border border-lime-300/25 bg-black/25 px-1" aria-label={t('training.rack.allLevels')} title={t('training.rack.allLevelsHelp')}>
            <span className="px-1 font-mono text-[7px] font-black uppercase tracking-wider text-lime-200">{t('training.rack.all')}</span>
            <button type="button" onClick={() => adjustAllWeaponLevels(-1)} disabled={testRunning || allWeaponLevel <= 1} aria-label={t('training.rack.lowerAll')} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">−</button>
            <button key={`all-control-${allWeaponsMixed ? 'mixed' : allWeaponLevel}`} type="button" onClick={() => setWeaponLevelOverrides({})} disabled={testRunning || !allWeaponsMixed} aria-label={t('training.rack.applyAll', { level: allWeaponLevel })} title={t('training.rack.applyAll', { level: allWeaponLevel })} className="training-tier-pop min-w-9 text-center font-mono text-[8px] font-black text-lime-100 disabled:cursor-default">
              {allWeaponsMixed ? t('training.rack.mixed') : t('training.rack.level', { level: allWeaponLevel })}
            </button>
            <button type="button" onClick={() => adjustAllWeaponLevels(1)} disabled={testRunning || allWeaponLevel >= 8} aria-label={t('training.rack.raiseAll')} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">+</button>
          </div>
          <button type="button" onClick={() => setCameraCenterLock((locked) => !locked)} aria-pressed={cameraCenterLock} title={t('training.camera.centerLock')} className={`inline-flex min-h-8 items-center gap-1 border px-2 font-mono text-[8px] font-bold uppercase tracking-wider ${cameraCenterLock ? 'border-cyan-200/50 bg-cyan-200/10 text-cyan-100' : 'border-white/15 text-white/55'}`}>{cameraCenterLock ? <LockKeyhole size={11} /> : <Move size={11} />}{t('training.camera.center')}</button>
          <button type="button" onClick={() => { cameraOffsetRef.current = { x: 0, y: 0 }; }} title={t('training.camera.reset')} className="min-h-8 border border-white/15 px-2 font-mono text-[8px] font-bold uppercase tracking-wider text-white/55 hover:text-white">{t('training.camera.reset')}</button>
          <div className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-white/50 sm:flex">
            <Swords size={14} className="text-orange-200" /> {t('training.header.stationary')}
          </div>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 overflow-hidden ${mainLayout ? 'grid-rows-[minmax(124px,24dvh)_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[196px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)]' : 'grid-rows-[minmax(176px,32dvh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[300px_minmax(0,1fr)]'}`}>
        <aside data-testid="training-weapon-dock" className={`flex min-h-0 flex-col overflow-hidden bg-slate-950/90 ${mainLayout ? 'border-b border-l-2 border-l-orange-300/50 border-white/10 sm:border-b-0 sm:border-r' : 'border-b border-white/10 lg:border-b-0 lg:border-r'}`}>
          <div className={`shrink-0 border-b border-white/10 ${mainLayout ? 'px-2 py-1.5 sm:p-3' : 'p-3 sm:p-4'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider sm:text-xs"><Zap size={13} className="text-orange-200" /> {t('training.rack.title')}</p>
              <div className="flex items-center gap-1" aria-label={t('training.rack.columns')}>
                {[2, 3, 4].map((columns) => <button key={columns} type="button" onClick={() => { setRackColumns(columns); if (columns > 2) setExpandedWeaponId(null); }} aria-pressed={rackColumns === columns} title={t('training.rack.columns')} className={`min-h-6 min-w-6 border font-mono text-[8px] font-bold ${rackColumns === columns ? 'border-cyan-200/60 bg-cyan-200/15 text-cyan-100' : 'border-white/10 text-white/45 hover:text-white'}`}>{columns}</button>)}
                <span className="ml-1 font-mono text-[8px] text-white/40">{rackPage === 'evolutions' ? EVOLUTION_TRAINING_WEAPON_COUNT : BASE_TRAINING_WEAPON_COUNT}</span>
              </div>
            </div>
            {!mainLayout && <p className="mt-1 text-xs text-white/45">{t('training.rack.help')}</p>}
            <div className={`training-rack-nav mt-1 flex border border-white/10 bg-black/25 p-0.5 sm:mt-2 ${mainLayout ? 'gap-0.5' : 'gap-1'}`} role="tablist" aria-label={t('training.rack.pages')}>
              <button type="button" role="tab" aria-selected={rackPage === 'weapons'} onClick={() => selectRackPage('weapons')} className={`relative min-h-7 flex-1 overflow-hidden px-1.5 font-mono text-[7px] font-black uppercase tracking-wider transition-colors sm:text-[8px] ${rackPage === 'weapons' ? 'bg-orange-200/15 text-orange-100' : 'text-white/45 hover:text-white'}`}>
                {rackPage === 'weapons' && <span aria-hidden="true" className="training-rack-nav-indicator" />}
                <span className="relative inline-flex items-center gap-1"><Swords size={10} />{t('training.rack.basePage')}</span>
              </button>
              <button type="button" role="tab" aria-selected={rackPage === 'evolutions'} onClick={() => selectRackPage('evolutions')} className={`relative min-h-7 flex-1 overflow-hidden px-1.5 font-mono text-[7px] font-black uppercase tracking-wider transition-colors sm:text-[8px] ${rackPage === 'evolutions' ? 'bg-fuchsia-200/15 text-fuchsia-100' : 'text-white/45 hover:text-white'}`}>
                {rackPage === 'evolutions' && <span aria-hidden="true" className="training-rack-nav-indicator training-rack-nav-indicator--evolution" />}
                <span className="relative inline-flex items-center gap-1"><Sparkles size={10} />{t('training.rack.evolutionPage')}</span>
              </button>
            </div>
            <div className={`flex items-center gap-1 ${mainLayout ? 'mt-1 sm:mt-2' : 'mt-3'}`}>
              <label className="flex min-w-0 flex-1 items-center gap-2 border border-white/15 bg-black/25 px-2">
                <Search size={13} className="shrink-0 text-white/40" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('training.rack.search')} className={`${mainLayout ? 'h-7 sm:h-8' : 'h-10'} min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/35`} />
              </label>
              <button type="button" onClick={toggleDetailLock} aria-pressed={detailLock} aria-label={detailLock ? t('training.rack.unlockDetails') : t('training.rack.lockDetails')} title={detailLock ? t('training.rack.unlockDetails') : t('training.rack.lockDetails')} className={`inline-flex min-h-8 shrink-0 items-center gap-1 border px-1.5 font-mono text-[8px] font-bold uppercase tracking-wider ${detailLock ? 'border-lime-300/50 bg-lime-300/10 text-lime-100' : 'border-white/15 text-white/55 hover:text-white'}`}>
                <LockKeyhole size={11} />{detailLock ? t('training.rack.lockedShort') : t('training.rack.lockShort')}
              </button>
              <button type="button" onClick={toggleSpam} aria-pressed={spam} aria-label={t('training.controls.spam')} title={t('training.controls.spam')} className={`inline-flex min-h-8 shrink-0 items-center gap-1 border px-1.5 font-mono text-[8px] font-bold uppercase tracking-wider ${spam ? 'border-amber-200/50 bg-amber-200/10 text-amber-100' : 'border-white/15 text-white/55 hover:text-white'}`}>
                {t('training.controls.spam')}{spam && <Check size={11} />}
              </button>
            </div>
          </div>
          <div key={`rack-page-${rackPage}`} role="tabpanel" aria-label={t(rackPage === 'evolutions' ? 'training.rack.evolutionPage' : 'training.rack.basePage')} className={`${rackPageDirection === 'right' ? 'settings-slide-from-right' : 'settings-slide-from-left'} training-arena-weapon-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${mainLayout ? 'grid content-start gap-1 p-1.5 sm:gap-1.5 sm:p-2' : 'grid content-start gap-2 p-3'}`} style={{ gridTemplateColumns: `repeat(${rackColumns}, minmax(0, 1fr))` }}>
            {filteredWeapons.map((weapon) => {
              const active = weapon.id === selectedWeapon.id;
              const expanded = expandedWeaponId === weapon.id;
              const evolution = EVOLUTIONS_BY_ID[weapon.id];
              const killTarget = evolution ? EVOLUTION_KILL_REQUIREMENT : 616;
              const kills = Math.min(killTarget, weaponKillsFor(weapon));
              const unlocked = weaponIsUnlocked(weapon);
              const evolutionSource = evolution ? TRAINING_LOADOUT.find((candidate) => candidate.id === evolution.baseWeaponId) : undefined;
              const inMultiLoadout = multiWeaponIds.includes(weapon.id);
              return mainLayout ? (
                <article key={weapon.id} style={{ gridColumn: expanded ? '1 / -1' : undefined }} className={`min-w-0 border transition ${active ? 'border-cyan-200/70 bg-cyan-300/[.08]' : 'border-white/10 bg-white/[.025] hover:border-white/25'}`}>
                  <div className="flex min-h-12 w-full items-center gap-1 px-1 py-1 sm:min-h-14 sm:gap-1.5 sm:px-1.5">
                    {renderWeaponIconButton(weapon, unlocked)}
                    <button type="button" onClick={() => activateWeapon(weapon)} disabled={!unlocked} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-0.5 text-left disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[9px] font-bold leading-tight sm:text-[10px]">{weapon.name}</span>
                        <span className="mt-0.5 block truncate font-mono text-[7px] uppercase tracking-wider text-white/40">{weaponKindLabel(weapon)}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => toggleWeaponDetails(weapon)} aria-expanded={expanded && !detailLock} aria-label={`${detailLock ? t('training.rack.activate') : t('training.rack.details')} ${weapon.name}`} aria-controls={`weapon-details-${weapon.id}`} title={detailLock ? t('training.rack.detailsLocked') : t('training.rack.details')} className="min-h-8 min-w-7 shrink-0 border-l border-white/10 pl-1 text-white/45 hover:text-lime-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200">
                      {expanded && !detailLock ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  </div>
                  {expanded && (
                    <div id={`weapon-details-${weapon.id}`} className="border-t border-lime-300/25 bg-black/35 p-2" data-testid={`weapon-details-${weapon.id}`}>
                      <p className="text-[9px] leading-relaxed text-white/65">{weapon.description}</p>
                      {evolution && <p className="mt-1 font-mono text-[8px] leading-relaxed text-fuchsia-100/75">{t('training.evolution.source', { weapon: evolutionSource?.name ?? evolution.baseWeaponId, kills: kills.toLocaleString(), target: killTarget.toLocaleString() })}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-[8px] font-black uppercase tracking-wider text-lime-200">{t('training.rack.stats')}</p>
                        <div className="flex items-center gap-1 border border-white/10 bg-black/35 p-0.5" aria-label={t('training.rack.levelControl', { weapon: weapon.name })}>
                          <button type="button" onClick={() => adjustWeaponLevel(weapon.id, -1)} disabled={testRunning || weaponLevelFor(weapon.id) <= 1} aria-label={t('training.rack.lowerLevel', { weapon: weapon.name })} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">−</button>
                          <span key={`detail-${weaponLevelFor(weapon.id)}`} className="training-tier-pop min-w-10 text-center font-mono text-[8px] font-black text-lime-100">{t('training.rack.level', { level: weaponLevelFor(weapon.id) })}</span>
                          <button type="button" onClick={() => adjustWeaponLevel(weapon.id, 1)} disabled={testRunning || weaponLevelFor(weapon.id) >= 8} aria-label={t('training.rack.raiseLevel', { weapon: weapon.name })} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">+</button>
                        </div>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-wider text-white/50">
                        <span>{t('training.rack.statDamage')} <b className="text-white">{Math.round(weapon.damage * (1 + (weaponLevelFor(weapon.id) - 1) * weapon.levelDamageScale))}</b></span>
                        <span>{t('training.rack.statCooldown')} <b className="text-white">{(weapon.cooldownMs / 1000).toFixed(2)}s</b></span>
                        <span>{t('training.rack.statRange')} <b className="text-white">{weapon.range}</b></span>
                        {weapon.count !== undefined && <span>{t('training.rack.statCount')} <b className="text-white">{weapon.count}</b></span>}
                        {weapon.speed !== undefined && <span>{t('training.rack.statSpeed')} <b className="text-white">{weapon.speed}</b></span>}
                        {weapon.pierce !== undefined && <span>{t('training.rack.statPierce')} <b className="text-white">{weapon.pierce}</b></span>}
                        {weapon.durationMs !== undefined && <span>{t('training.rack.statDuration')} <b className="text-white">{(weapon.durationMs / 1000).toFixed(1)}s</b></span>}
                        {weapon.impactIntensity > 0 && <span>{t('training.rack.statImpact')} <b className="text-white">{weapon.impactIntensity}/5</b></span>}
                      </div>
                      {(weapon.statusEffectId || weapon.bonusVsStatusId || weapon.nativeCharacterId) && <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5 text-[8px] leading-relaxed text-white/55">
                        {weapon.statusEffectId && <p><b className="text-rose-200">{t('training.rack.debuff')}:</b> {STATUS_EFFECTS_BY_ID[weapon.statusEffectId]?.name ?? weapon.statusEffectId}{STATUS_EFFECTS_BY_ID[weapon.statusEffectId]?.description ? ` · ${STATUS_EFFECTS_BY_ID[weapon.statusEffectId]!.description}` : ''}</p>}
                        {weapon.bonusVsStatusId && <p><b className="text-emerald-200">{t('training.rack.synergy')}:</b> {t('training.rack.bonusVs', { status: STATUS_EFFECTS_BY_ID[weapon.bonusVsStatusId]?.name ?? weapon.bonusVsStatusId, multiplier: weapon.bonusVsStatusMult ?? 1 })}</p>}
                        {weapon.nativeCharacterId && <p><b className="text-cyan-200">{t('training.rack.affinity')}:</b> {weapon.nativeCharacterId}</p>}
                      </div>}
                      {!weapon.statusEffectId && !weapon.bonusVsStatusId && !weapon.nativeCharacterId && <p className="mt-2 border-t border-white/10 pt-1.5 text-[8px] text-white/35">{t('training.rack.noModifiers')}</p>}
                      {!unlocked && !evolution && <p className="mt-2 font-mono text-[8px] font-bold uppercase tracking-wider text-amber-200">{t('training.rack.locked', { kills: kills.toLocaleString(), target: killTarget.toLocaleString() })}</p>}
                      <button type="button" onClick={() => activateWeapon(weapon)} disabled={!unlocked} className="mt-2 min-h-8 w-full border border-cyan-200/35 bg-cyan-200/[.08] px-2 font-mono text-[8px] font-black uppercase tracking-wider text-cyan-50 hover:bg-cyan-200/15 disabled:opacity-45">{t('training.rack.test')}</button>
                      {multiUnlocked && unlocked ? <button type="button" onClick={() => toggleMultiWeapon(weapon)} aria-pressed={inMultiLoadout} className="mt-1 min-h-8 w-full border border-violet-200/30 px-2 font-mono text-[8px] font-black uppercase tracking-wider text-violet-100 hover:bg-violet-200/10">{inMultiLoadout ? t('training.rack.remove') : t('training.rack.add')}</button> : !multiUnlocked ? <p className="mt-1 text-[8px] leading-relaxed text-white/40">{t('training.rack.multiLocked')}</p> : null}
                    </div>
                  )}
                </article>
              ) : (
                <article key={weapon.id} style={{ gridColumn: expanded ? '1 / -1' : undefined }} className={`min-w-0 border ${active ? 'border-cyan-300/60 bg-cyan-300/[.06]' : 'border-white/10 bg-white/[.025]'}`}>
                  <div className="flex min-h-12 w-full items-center gap-1.5 px-1.5 py-1.5">
                    {renderWeaponIconButton(weapon, unlocked)}
                    <button type="button" onClick={() => activateWeapon(weapon)} disabled={!unlocked} aria-pressed={active} className="flex min-w-0 flex-1 items-center gap-1 text-left disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-bold">{weapon.name}</span><span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-wider text-white/40">{weaponKindLabel(weapon)}</span></span>
                    </button>
              <button type="button" onClick={() => toggleWeaponDetails(weapon)} aria-expanded={expanded && !detailLock} aria-label={`${detailLock ? t('training.rack.activate') : t('training.rack.details')} ${weapon.name}`} aria-controls={`classic-weapon-details-${weapon.id}`} title={detailLock ? t('training.rack.detailsLocked') : t('training.rack.details')} className="min-h-8 min-w-7 border-l border-white/10 pl-1 text-white/45 hover:text-cyan-100">{expanded && !detailLock ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
                  </div>
                  {expanded && (
                    <div id={`classic-weapon-details-${weapon.id}`} className="border-t border-white/10 p-2">
                      <p className="text-[9px] leading-relaxed text-white/55">{weapon.description}</p>
                      {evolution && <p className="mt-1 font-mono text-[8px] leading-relaxed text-fuchsia-100/75">{t('training.evolution.source', { weapon: evolutionSource?.name ?? evolution.baseWeaponId, kills: kills.toLocaleString(), target: killTarget.toLocaleString() })}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="font-mono text-[8px] font-black uppercase tracking-wider text-cyan-100">{t('training.rack.stats')}</p>
                        <div className="flex items-center gap-1 border border-white/10 bg-black/35 p-0.5" aria-label={t('training.rack.levelControl', { weapon: weapon.name })}>
                          <button type="button" onClick={() => adjustWeaponLevel(weapon.id, -1)} disabled={testRunning || weaponLevelFor(weapon.id) <= 1} aria-label={t('training.rack.lowerLevel', { weapon: weapon.name })} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">−</button>
                          <span key={`detail-${weaponLevelFor(weapon.id)}`} className="training-tier-pop min-w-10 text-center font-mono text-[8px] font-black text-lime-100">{t('training.rack.level', { level: weaponLevelFor(weapon.id) })}</span>
                          <button type="button" onClick={() => adjustWeaponLevel(weapon.id, 1)} disabled={testRunning || weaponLevelFor(weapon.id) >= 8} aria-label={t('training.rack.raiseLevel', { weapon: weapon.name })} className="grid h-6 w-6 place-items-center border border-white/10 text-xs text-white/70 hover:bg-white/10 disabled:opacity-30">+</button>
                        </div>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-wider text-white/45">
                        <span>{t('training.rack.statDamage')} <b className="text-white">{Math.round(weapon.damage * (1 + (weaponLevelFor(weapon.id) - 1) * weapon.levelDamageScale))}</b></span>
                        <span>{t('training.rack.statCooldown')} <b className="text-white">{(weapon.cooldownMs / 1000).toFixed(2)}s</b></span>
                        <span>{t('training.rack.statRange')} <b className="text-white">{weapon.range}</b></span>
                        {weapon.count !== undefined && <span>{t('training.rack.statCount')} <b className="text-white">{weapon.count}</b></span>}
                        {weapon.speed !== undefined && <span>{t('training.rack.statSpeed')} <b className="text-white">{weapon.speed}</b></span>}
                        {weapon.pierce !== undefined && <span>{t('training.rack.statPierce')} <b className="text-white">{weapon.pierce}</b></span>}
                        {weapon.durationMs !== undefined && <span>{t('training.rack.statDuration')} <b className="text-white">{(weapon.durationMs / 1000).toFixed(1)}s</b></span>}
                        {weapon.impactIntensity > 0 && <span>{t('training.rack.statImpact')} <b className="text-white">{weapon.impactIntensity}/5</b></span>}
                      </div>
                      {(weapon.statusEffectId || weapon.bonusVsStatusId || weapon.nativeCharacterId) && <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5 text-[8px] leading-relaxed text-white/55">
                        {weapon.statusEffectId && <p><b className="text-rose-200">{t('training.rack.debuff')}:</b> {STATUS_EFFECTS_BY_ID[weapon.statusEffectId]?.name ?? weapon.statusEffectId}{STATUS_EFFECTS_BY_ID[weapon.statusEffectId]?.description ? ` · ${STATUS_EFFECTS_BY_ID[weapon.statusEffectId]!.description}` : ''}</p>}
                        {weapon.bonusVsStatusId && <p><b className="text-emerald-200">{t('training.rack.synergy')}:</b> {t('training.rack.bonusVs', { status: STATUS_EFFECTS_BY_ID[weapon.bonusVsStatusId]?.name ?? weapon.bonusVsStatusId, multiplier: weapon.bonusVsStatusMult ?? 1 })}</p>}
                        {weapon.nativeCharacterId && <p><b className="text-cyan-200">{t('training.rack.affinity')}:</b> {weapon.nativeCharacterId}</p>}
                      </div>}
                      {!weapon.statusEffectId && !weapon.bonusVsStatusId && !weapon.nativeCharacterId && <p className="mt-2 border-t border-white/10 pt-1.5 text-[8px] text-white/35">{t('training.rack.noModifiers')}</p>}
                      {!unlocked && !evolution && <p className="mt-2 font-mono text-[8px] font-bold uppercase tracking-wider text-amber-200">{t('training.rack.locked', { kills: kills.toLocaleString(), target: killTarget.toLocaleString() })}</p>}
                      <button type="button" onClick={() => activateWeapon(weapon)} disabled={!unlocked} className="mt-2 min-h-8 w-full border border-cyan-200/25 px-2 font-mono text-[8px] font-black uppercase tracking-wider text-cyan-50 hover:bg-cyan-200/10 disabled:cursor-wait disabled:opacity-50">{t('training.rack.test')}</button>
                      {multiUnlocked && unlocked ? <button type="button" onClick={() => toggleMultiWeapon(weapon)} aria-pressed={inMultiLoadout} className="mt-1 min-h-8 w-full border border-violet-200/30 px-2 font-mono text-[8px] font-black uppercase tracking-wider text-violet-100 hover:bg-violet-200/10">{inMultiLoadout ? t('training.rack.remove') : t('training.rack.add')}</button> : !multiUnlocked ? <p className="mt-1 text-[8px] leading-relaxed text-white/40">{t('training.rack.multiLocked')}</p> : null}
                    </div>
                  )}
                </article>
              );
            })}
            {filteredWeapons.length === 0 && <p className="col-span-full px-2 py-6 text-center text-xs text-white/45">{t('training.rack.none')}</p>}
          </div>
        </aside>

        <section data-testid="training-arena-stage" className={`relative min-h-0 overflow-hidden ${mainLayout ? 'p-1.5 sm:p-3' : 'p-2 sm:p-4'}`}>
          <div className={`relative h-full min-h-0 overflow-hidden bg-[#111522] shadow-[inset_0_0_80px_rgba(9,20,42,.65)] ${mainLayout ? 'border-2 border-white/40' : 'border border-cyan-200/20'}`}>
            <canvas
              ref={canvasRef}
              aria-label={`${t('training.header.title')} — ${selectedCharacter.name} facing ${t('training.stage.dustMite')}`}
              className="absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => {
                cameraDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const drag = cameraDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                cameraOffsetRef.current.x -= (event.clientX - drag.x) * (720 / Math.max(1, bounds.width));
                cameraOffsetRef.current.y -= (event.clientY - drag.y) * (720 / Math.max(1, bounds.height));
                cameraDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
              }}
              onPointerUp={(event) => { if (cameraDragRef.current?.pointerId === event.pointerId) cameraDragRef.current = null; }}
              onPointerCancel={() => { cameraDragRef.current = null; }}
            />
            <div className="pointer-events-none absolute bottom-2 left-2 z-10 border border-white/10 bg-black/55 px-1.5 py-1 font-mono text-[7px] uppercase tracking-wider text-white/40 sm:bottom-auto sm:left-3 sm:top-20">{t('training.camera.dragHint')}</div>
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-3">
              <div className="max-w-[42%] border border-blue-200/50 bg-blue-950/85 px-2 py-1.5 shadow-lg sm:px-3 sm:py-2">
                <p className="font-mono text-[7px] uppercase tracking-[.16em] text-blue-200/75 sm:text-[9px]">{t('training.stage.operator')}</p>
                <p className="truncate text-[10px] font-black text-white sm:text-xs">{selectedCharacter.name}</p>
              </div>
              <div className="max-w-[48%] border border-slate-300/50 bg-slate-800/90 px-2 py-1.5 text-right shadow-lg sm:px-3 sm:py-2">
                <p className="font-mono text-[7px] uppercase tracking-[.16em] text-slate-300/75 sm:text-[9px]">{t('training.stage.target')}</p>
                <p className="truncate text-[10px] font-black text-white sm:text-xs">{t('training.stage.dustMite')}</p>
                <p className="font-mono text-[8px] text-slate-300/70 sm:text-[9px]">{targetMode === 'infinite' ? t('training.stage.infinite') : t('training.stage.hp', { current: Math.ceil(dummyHp).toLocaleString(), max: dummyMaxHp.toLocaleString() })}</p>
                {targetMode !== 'infinite' && <div className="mt-1 h-1 w-20 bg-white/10 sm:ml-auto sm:w-32"><div className="h-full bg-amber-300 transition-[width] duration-150" style={{ width: `${Math.max(0, (dummyHp / dummyMaxHp) * 100)}%` }} /></div>}
              </div>
            </div>
            <div className="pointer-events-none absolute left-1/2 top-14 z-10 w-44 -translate-x-1/2 border border-blue-200/30 bg-blue-950/75 px-2 py-1.5 text-center shadow-lg sm:top-16 sm:w-56">
              <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-blue-100">{t('training.stage.operatorXp', { level: operatorTrainingLevel })}</p>
              <div className="mt-1 h-1.5 bg-white/10"><div className="h-full bg-cyan-200" style={{ width: `${operatorTrainingProgress}%` }} /></div>
              <p className="mt-0.5 font-mono text-[7px] text-white/55">{t('training.stage.xp', { current: operatorTrainingProgress.toFixed(1), next: 100 })}</p>
            </div>
            <div className="absolute inset-x-2 bottom-2 z-10 max-h-[62%] overflow-y-auto border border-white/15 bg-black/80 p-2 backdrop-blur-sm sm:inset-x-3 sm:bottom-3 sm:max-h-[50%] sm:p-3">
              <div className="flex items-center justify-between gap-2 text-[10px] text-white/65 sm:text-xs"><span className="flex min-w-0 items-center gap-2"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${testRunning ? 'animate-pulse bg-amber-300' : 'bg-cyan-300'}`} /><span className="truncate">{statusText}</span></span><span className="shrink-0 font-mono text-[8px] text-white/40">{t('training.rack.level', { level: selectedWeaponLevel })}</span></div>
              <div className="mt-1.5 grid grid-cols-3 gap-1 border-t border-white/10 pt-1.5 sm:grid-cols-6 sm:gap-2 sm:pt-2">
                {[
                  [t('training.stats.damage'), shownDamage.toLocaleString()],
                  [t('training.stats.dps'), (testRunning ? Math.round(liveDamage / Math.max(0.1, (worldRef.current?.now ?? 0) - testStartedAtRef.current) * 1000) : lastDps).toLocaleString()],
                  [t('training.stats.hits'), shownHits.toLocaleString()],
                  [t('training.stats.crits'), shownCrits.toLocaleString()],
                  [t('training.stats.largest'), liveLargestHit.toLocaleString()],
                  [t('training.stats.average'), (shownHits > 0 ? Math.round(shownDamage / shownHits) : 0).toLocaleString()],
                ].map(([label, value]) => <div key={label} className="border border-white/10 bg-white/[.035] px-1.5 py-1"><p className="font-mono text-[7px] uppercase tracking-wider text-white/40">{label}</p><p className="font-mono text-[10px] font-bold text-white sm:text-xs">{value}</p></div>)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[8px] uppercase tracking-wider text-white/50">
                <span>{t('training.stats.baseDamage')}: <b className="text-white">{Math.round(selectedWeapon.damage * (1 + (selectedWeaponLevel - 1) * selectedWeapon.levelDamageScale))}</b></span>
                <span>{t('training.stats.cooldown')}: <b className="text-white">{(selectedWeapon.cooldownMs / 1000).toFixed(2)}s</b></span>
                <span>{t('training.stats.title')}: <b className="text-white">{selectedWeapons.map((weapon) => weapon.name).join(' + ')}</b></span>
                <span>{t('training.rack.progress', { kills: weaponKills.toLocaleString(), target: selectedKillRequirement.toLocaleString() })}</span>
                <span>{t('training.rack.multiCount', { count: multiWeaponIds.length })}</span>
                <span>{meta.trainingDummyDamage.toLocaleString()} / 1,000,000 dummy damage</span>
              </div>
              <div className="mt-1 border-t border-white/10 pt-1">
                <p className="font-mono text-[7px] font-bold uppercase tracking-wider text-cyan-100/70">{t('training.effects.title')}</p>
                {shownHits === 0 && liveEffects.length === 0 ? <p className="mt-0.5 text-[8px] text-white/35">{t('training.effects.none')}</p> : <p className="mt-0.5 text-[8px] text-white/60">{t('training.effects.hit', { count: shownHits })} · {t('training.effects.critical', { count: shownCrits })}{liveEffects.length > 0 ? ` · ${t('training.effects.status', { effects: liveEffects.join(', ') })}` : ''}</p>}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
                <div className="flex flex-wrap items-center gap-1" aria-label={t('training.stage.targetMode')}>
                  {(['durability', 'nonlethal', 'infinite'] as const).map((mode) => <button key={mode} type="button" onClick={() => setTrainingTargetMode(mode)} aria-pressed={targetMode === mode} className={`min-h-7 border px-1.5 font-mono text-[7px] font-bold uppercase tracking-wider sm:px-2 sm:text-[8px] ${targetMode === mode ? 'border-slate-200/60 bg-slate-200/10 text-white' : 'border-white/10 text-white/45 hover:border-white/30'}`}>{t(`training.stage.${mode === 'nonlethal' ? 'nonlethal' : mode}` as never)}</button>)}
                  {targetMode === 'durability' && DUMMY_HP_PRESETS.map((hp) => <button key={hp} type="button" onClick={() => setDummyDurability(hp)} aria-pressed={dummyMaxHp === hp} className={`min-h-7 border px-1.5 font-mono text-[7px] sm:px-2 sm:text-[8px] ${dummyMaxHp === hp ? 'border-slate-300/60 bg-slate-300/10 text-slate-100' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{hp.toLocaleString()}</button>)}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={resetDummy} className="inline-flex min-h-8 items-center gap-1 border border-white/15 px-2 text-[8px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"><RotateCcw size={12} /> {t('training.controls.reset')}</button>
                  <button ref={challengeTriggerRef} type="button" onClick={startChallenge} disabled={testRunning || (!multiUnlocked && multiWeaponIds.length > 1) || selectedWeapons.some((weapon) => !weaponIsUnlocked(weapon))} className="inline-flex min-h-8 items-center gap-1 border border-violet-200/40 px-2 font-mono text-[8px] font-black uppercase tracking-wider text-violet-100 hover:bg-violet-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200 disabled:opacity-45">{challengeRunning ? t('training.controls.challengeRunning') : `${t('training.controls.challenge')} · ${challengeSeconds || 24}s`}</button>
                  {challengeRunning && <span className="font-mono text-[9px] font-black text-amber-200">{t('training.controls.remaining', { seconds: challengeSeconds })}</span>}
                  <button type="button" onClick={() => testRunning ? stopTest() : testWeapon(selectedWeapons, false, spam)} disabled={!testRunning && selectedWeapons.some((weapon) => !weaponIsUnlocked(weapon))} className="inline-flex min-h-8 items-center gap-1 bg-cyan-200 px-2.5 text-[8px] font-black uppercase tracking-wider text-slate-950 hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"><Crosshair size={12} /> {testRunning ? t(challengeRunning ? 'training.controls.challengeRunning' : 'training.controls.testing') : t('training.controls.test')}</button>
                </div>
              </div>
              <p className="mt-1 text-right font-mono text-[7px] text-white/35">{t('training.controls.best', { damage: (meta.trainingChallengeBests[challengeKey] ?? 0).toLocaleString() })}</p>
            </div>
            {challengeResult && <div ref={challengeDialogRef} className="absolute inset-0 z-20 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={t('training.challenge.celebration', { tier: t(challengeResult.tier as never), damage: challengeResult.damage.toLocaleString() })}>
              <div className="relative w-full max-w-sm overflow-hidden border border-amber-200/60 bg-gradient-to-b from-[#302517] via-slate-950 to-slate-950 p-5 text-center shadow-[0_24px_80px_rgba(0,0,0,.7)] sm:p-7">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-200 to-transparent" />
                <p className="text-4xl text-amber-200 drop-shadow-[0_0_18px_rgba(253,230,138,.6)]">✦</p>
                <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[.3em] text-amber-100/55">{t('training.challenge.result')}</p>
                <p className="mt-1 font-mono text-xl font-black uppercase tracking-widest text-amber-100">{t(challengeResult.tier as never)}</p>
                <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/75">{t('training.challenge.celebration', { tier: t(challengeResult.tier as never), damage: challengeResult.damage.toLocaleString() })}</p>
                <div className="mx-auto mt-4 max-w-[220px] border-y border-amber-100/15 py-2"><p className="font-mono text-[8px] uppercase tracking-[.2em] text-white/45">{t('training.stats.damage')}</p><p className="font-mono text-2xl font-black tabular-nums text-white">{challengeResult.damage.toLocaleString()}</p></div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setChallengeResult(null)} className="min-h-10 border border-white/20 bg-white/[.04] px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-white/75 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{t('training.challenge.close')}</button>
                  <button type="button" data-challenge-retry onClick={retryChallenge} className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-cyan-200/60 bg-cyan-200 px-3 font-mono text-[10px] font-black uppercase tracking-wider text-slate-950 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"><RotateCcw size={12} />{t('training.challenge.retry')}</button>
                </div>
              </div>
            </div>}
          </div>
        </section>
      </div>
      <footer data-testid="training-loadout-bar" className="shrink-0 border-t-2 border-lime-300/45 bg-[#0b100c] px-2 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-1">
          <span className="mr-1 shrink-0 font-mono text-[8px] font-black uppercase tracking-widest text-lime-100/80">{t('training.loadouts.groups')}</span>
          {meta.trainingArenaLoadoutGroups.map((group, index) => (
            <div key={group.id} className={`flex shrink-0 items-center border ${group.id === activeLoadoutGroup.id ? 'border-lime-200/60 bg-lime-200/10' : 'border-white/10 bg-white/[.025]'}`}>
              <button type="button" onClick={() => selectLoadoutGroup(group.id)} aria-pressed={group.id === activeLoadoutGroup.id} className="min-h-7 px-2 font-mono text-[8px] font-bold uppercase tracking-wider text-white/75 hover:text-white">{t('training.loadouts.group', { number: index + 1 })}<span className="ml-1 text-white/35">{group.loadouts.length}</span></button>
              {meta.trainingArenaLoadoutGroups.length > 1 && <button type="button" onClick={() => removeLoadoutGroup(group.id)} aria-label={t('training.loadouts.removeGroup', { number: index + 1 })} title={t('training.loadouts.removeGroup', { number: index + 1 })} className="grid h-7 w-6 place-items-center border-l border-white/10 text-white/35 hover:text-rose-200"><Trash2 size={10} /></button>}
            </div>
          ))}
          <span className="shrink-0 font-mono text-[7px] text-white/35">{t('training.loadouts.groupCount', { count: meta.trainingArenaLoadoutGroups.length })}</span>
          <button type="button" onClick={createLoadoutGroup} disabled={meta.trainingArenaLoadoutGroups.length >= 4} className="inline-flex min-h-7 shrink-0 items-center gap-1 border border-lime-200/25 px-2 font-mono text-[8px] font-bold uppercase tracking-wider text-lime-100/75 hover:bg-lime-100/10 disabled:opacity-35"><Plus size={11} />{t('training.loadouts.newGroup')}</button>
          {meta.trainingArenaLoadoutGroups.length >= 4 && <span className="shrink-0 text-[7px] text-white/35">{t('training.loadouts.expansion')}</span>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 border-t border-white/10 pt-1.5 sm:flex-nowrap">
          <div className="flex max-w-[28%] shrink-0 items-center gap-1 overflow-x-auto" aria-label={t('training.loadouts.current')}>
            {selectedWeapons.map((weapon) => <span key={weapon.id} className="relative grid h-7 w-7 shrink-0 place-items-center border border-cyan-100/25 bg-black/40" title={`${weapon.name} · ${t('training.rack.level', { level: weaponLevelFor(weapon.id) })}`}><WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={22} /><span key={`loadout-tier-${weapon.id}-${weaponLevelFor(weapon.id)}`} className="training-tier-pop absolute -bottom-1 -right-1 border border-slate-950 bg-lime-300 px-0.5 font-mono text-[6px] font-black leading-[10px] text-slate-950">L{weaponLevelFor(weapon.id)}</span></span>)}
          </div>
          <label className="flex min-w-24 flex-1 items-center border border-white/15 bg-black/30 px-2">
            <input value={loadoutName} onChange={(event) => setLoadoutName(event.target.value)} maxLength={32} aria-label={t('training.loadouts.name')} placeholder={t('training.loadouts.namePlaceholder')} className="h-7 min-w-0 w-full bg-transparent text-[9px] text-white outline-none placeholder:text-white/35" />
          </label>
          <button type="button" onClick={saveCurrentLoadout} className="inline-flex min-h-7 shrink-0 items-center gap-1 border border-cyan-100/35 bg-cyan-100/[.06] px-2 font-mono text-[8px] font-black uppercase tracking-wider text-cyan-50 hover:bg-cyan-100/15"><Check size={10} />{t('training.loadouts.save')}</button>
          <div className="training-arena-weapon-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {activeLoadoutGroup.loadouts.length === 0 && <span className="px-1 text-[8px] text-white/35">{t('training.loadouts.empty')}</span>}
            {activeLoadoutGroup.loadouts.map((loadout) => {
              const active = activeLoadout?.id === loadout.id;
              const locked = loadout.weaponIds.length > 1 && !multiUnlocked;
              return <div key={loadout.id} className={`flex shrink-0 items-center border ${active ? 'border-cyan-100/45 bg-cyan-100/10' : 'border-white/10 bg-white/[.025]'}`}>
                <button type="button" onClick={() => loadSavedLoadout(loadout.id)} disabled={locked} aria-pressed={active} title={locked ? t('training.rack.multiLocked') : t('training.loadouts.load', { name: loadout.name })} className="flex min-h-7 max-w-40 items-center gap-1.5 px-2 text-left disabled:cursor-not-allowed disabled:opacity-40">
                  <span className="flex shrink-0 items-center">{loadout.weaponIds.slice(0, 3).map((id) => { const weapon = TRAINING_LOADOUT.find((candidate) => candidate.id === id); return weapon ? <WeaponIcon key={id} kind={weapon.kind} weaponId={id} color={weapon.color} size={16} /> : null; })}</span>
                  <span className="max-w-24 truncate text-[8px] font-bold text-white/80">{loadout.name}</span>
                  {loadout.weaponIds.length > 3 && <span className="font-mono text-[7px] text-white/45">+{loadout.weaponIds.length - 3}</span>}
                </button>
                <button type="button" onClick={() => deleteSavedLoadout(loadout.id)} aria-label={t('training.loadouts.delete', { name: loadout.name })} title={t('training.loadouts.delete', { name: loadout.name })} className="grid h-7 w-6 place-items-center border-l border-white/10 text-white/35 hover:text-rose-200"><Trash2 size={10} /></button>
              </div>;
            })}
          </div>
        </div>
      </footer>
    </main>
  );
}
