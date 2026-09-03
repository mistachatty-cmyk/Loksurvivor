/**
 * A single run: canvas simulation, HUD, touch controls, level-up draft,
 * pause, reel overlay, and the hand-off back to the meta layer when it ends.
 */

import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { beatBus, SILENT_FRAME } from '@/game/audio/beatBus';
import { getArea } from '@/game/data/areas';
import { getCharacter } from '@/game/data/characters';
import { DEFAULT_PALETTE_ID, getActivePalette, getThemePalette } from '@/game/data/themedPalettes';
import { getRunAuraStyle } from '@/game/data/runAuras';
import { getCelebrationStyle } from '@/game/data/celebrations';
import { getHatStyle } from '@/game/data/hats';
import { runHudIntelCount, selectPrimaryRunHudSignal } from '@/game/data/runHudLayout';
import { CHARACTER_EPISODES_BY_ID } from '@/game/data/episodes';
import { getFirstNightChapter } from '@/game/data/firstNight';
import { nextRescueAllyId } from '@/game/data/progression';
import { availableChallengeContracts } from '@/game/data/vendor';
import {
  applyUpgrade,
  buildResult,
  claimLootPrize,
  claimRumorEmergencyHeal,
  createWorld,
  dashPlayer,
  hudSnapshot,
  primePhysicsObject,
  rollUpgradeChoices,
  stepWorld,
  type World,
} from '@/game/engine/world';
import { useGyroInput } from '@/game/input/gyro';
import { REEL_FACES, prizeToFaceIndex } from '@/game/data/prizes';
import { WEAPONS_BY_ID } from '@/game/data/weapons';
import { renderWorld } from '@/game/render/draw';
import {
  effectiveStats,
  giantSizeMult,
  hazardImmunityUnlocked,
  minimapUnlockTiers,
  physicsObjectClickRadiusBonus,
  rewardCredMultiplier,
  startingWeaponLevel,
  stealthConfig,
  useMeta,
} from '@/game/state/metaStore';
import type { AreaDef, HudSnapshot, LootPrizeDef, RunPhase, RunResult, UpgradeDef } from '@/game/types';
import { ChestTally } from '@/ui/ChestTally';
import { Minimap } from '@/ui/Minimap';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { WeaponIcon } from '@/ui/WeaponIcon';

/** Resolve the weapon a level-up card represents, if any, for its icon. */
function resolveCardWeapon(upgrade: UpgradeDef) {
  if (upgrade.weaponId) return WEAPONS_BY_ID[upgrade.weaponId];
  return undefined;
}

export interface RunScreenProps {
  areaId: string;
  characterId: string;
  challengeIds?: string[];
  startingWeaponLevel?: number;
  utilityRewardMultiplier?: number;
  physicsObjectClicksEnabled?: boolean;
  episodeId?: string;
  areaOverride?: AreaDef;
  onAbort: () => void;
  onFinish: (result: RunResult) => void;
}

interface StickState {
  active: boolean;
  pointerId: number | null;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
}

type PointerMode = 'none' | 'stick' | 'object';

interface TapRecord {
  time: number;
  x: number;
  y: number;
}

type ReelPhase = 'spinning' | 'landed';

interface ReelState {
  prize: LootPrizeDef;
  phase: ReelPhase;
  faceIndex: number;
}

interface RandomUpgradeReveal {
  selected: UpgradeDef;
  candidates: UpgradeDef[];
  visibleName: string;
}

const STICK_RADIUS = 54;
/** Simulation timestep. */
const FIXED_STEP = 1 / 60;
/** Most catch-up steps allowed in one frame before time is dropped. */
const MAX_SUBSTEPS = 6;

function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RunScreen({
  areaId,
  characterId,
  challengeIds = [],
  startingWeaponLevel: startingWeaponLevelProp,
  utilityRewardMultiplier: utilityRewardMultiplierProp,
  physicsObjectClicksEnabled = true,
  episodeId,
  areaOverride,
  onAbort,
  onFinish,
}: RunScreenProps) {
  const {
    meta,
    setMinimapExpanded,
    setMinimapPosition,
  } = useMeta();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const phaseRef = useRef<RunPhase>('countdown');
  const finishedRef = useRef(false);
  const keysRef = useRef(new Set<string>());
  const ultRequestRef = useRef(false);
  const stickRef = useRef<StickState>({
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    dx: 0,
    dy: 0,
  });
  const pointerModeRef = useRef<PointerMode>('none');
  const lastTapRef = useRef<TapRecord | null>(null);

  const [phase, setPhase] = useState<RunPhase>('countdown');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [choices, setChoices] = useState<UpgradeDef[]>([]);
  const [stickVisual, setStickVisual] = useState<StickState>(stickRef.current);
  const [dungeonTransition, setDungeonTransition] = useState<'enter' | 'exit' | null>(null);
  const [reel, setReel] = useState<ReelState | null>(null);
  const [reelTick, setReelTick] = useState(0);
  const [chestFlight, setChestFlight] = useState(0);
  const [celebration, setCelebration] = useState(false);
  const [runSettingsOpen, setRunSettingsOpen] = useState(false);
  const [hudMinimized, setHudMinimized] = useState(false);
  const [levelUpMinimized, setLevelUpMinimized] = useState(true);
  const [queuedPrizes, setQueuedPrizes] = useState<LootPrizeDef[]>([]);
  const claimedLootRef = useRef(new Set<LootPrizeDef>());
  const claimReelPrize = useCallback((prize: LootPrizeDef) => {
    const world = worldRef.current;
    if (!world || claimedLootRef.current.has(prize)) return;
    claimedLootRef.current.add(prize);
    claimLootPrize(world, prize);
    setHud(hudSnapshot(world));
  }, []);
  const [revealedPrizes, setRevealedPrizes] = useState<string[]>([]);
  const [lootTrayOpen, setLootTrayOpen] = useState(false);
  const [openingAllLoot, setOpeningAllLoot] = useState(false);
  const [randomUpgradeReveal, setRandomUpgradeReveal] = useState<RandomUpgradeReveal | null>(null);
  const [liveDashboardOpen, setLiveDashboardOpen] = useState(false);
  const [hudIntelOpen, setHudIntelOpen] = useState(false);
  const reelTimerRef = useRef<number | null>(null);
  const upgradeChoicesRef = useRef<UpgradeDef[]>([]);
  const levelUpPausesRef = useRef(meta.levelUpPresentation === 'pause-focus' && !meta.liveModeEnabled);
  levelUpPausesRef.current = meta.levelUpPresentation === 'pause-focus' && !meta.liveModeEnabled;
  const presentationRef = useRef(meta);
  presentationRef.current = meta;
  const musicReactiveRef = useRef(meta.musicReactiveEnabled);
  musicReactiveRef.current = meta.musicReactiveEnabled;

  // Tilt steering. The hook is inert unless the setting is on, and the ref is
  // read straight from the loop so orientation events never re-render.
  const { readingRef: gyroRef } = useGyroInput({
    enabled: meta.gyroEnabled,
    sensitivity: meta.gyroSensitivity,
    invertY: meta.gyroInvertY,
  });

  const area = areaOverride ?? getArea(areaId);
  const baseCharacter = getCharacter(characterId);
  // A purchased palette recolors the character (and, via its glow/accent, the
  // weapons/effects that key off it) without touching the shared data record
  // -- everyone else selecting this character still gets the authored look.
  const character =
    meta.activePaletteId === DEFAULT_PALETTE_ID
      ? baseCharacter
      : { ...baseCharacter, palette: getActivePalette(meta.activePaletteId) ?? baseCharacter.palette };
  const firstNightChapter = getFirstNightChapter(areaId);
  const episode = episodeId ? CHARACTER_EPISODES_BY_ID[episodeId] : undefined;
  // Episodes have authored rescue objectives; their target takes priority
  // over the normal rotating recruitment route.
  const rescueAllyId = episode?.crewAllyId
    ?? nextRescueAllyId(area.id, meta.rescuedAllyIds, area.rescueAllyId);
  const challenges = availableChallengeContracts(meta).filter((challenge) => challengeIds.includes(challenge.id));
  const initialWeaponLevel = startingWeaponLevelProp ?? startingWeaponLevel(meta);
  const finalRewardMultiplier = utilityRewardMultiplierProp ?? rewardCredMultiplier(meta);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setPhaseBoth = useCallback((next: RunPhase) => {
    // Once a run is over it stays over -- nothing may steal the hand-off.
    if (phaseRef.current === 'over') return;
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // Build the world once per mount.
  if (worldRef.current === null) {
    worldRef.current = createWorld(
      area,
      character,
      effectiveStats(character, meta),
      undefined,
      challenges,
      initialWeaponLevel,
      physicsObjectClicksEnabled,
      meta.activeCrewRumor,
      {
        unlockedEvolutionIds: meta.unlockedEvolutionIds,
        knownRelicIds: meta.knownRelicIds,
        episode,
        episodeProgress: episode ? meta.episodeProgressById[episode.id] : undefined,
        wildlifeSheltersInRain: meta.wildlifeSheltersInRain,
        physicsObjectClickRadiusBonus: physicsObjectClickRadiusBonus(meta),
        sizeMult: giantSizeMult(meta),
        stealth: stealthConfig(meta),
        hazardImmune: hazardImmunityUnlocked(meta),
        minimapEnemyRadar: minimapUnlockTiers(meta).enemyRadar,
        minimapLootSense: minimapUnlockTiers(meta).lootSense,
        minimapHazardSense: minimapUnlockTiers(meta).hazardSense,
        runAuraStyle: getRunAuraStyle(meta.activeRunAuraId),
        hatStyle: getHatStyle(meta.activeHatId),
        paletteEffect: prefersReducedMotion ? undefined : getThemePalette(meta.activePaletteId)?.effect,
        rescueAllyId,
        startingLokPets: meta.savedLokPets.filter((pet) => meta.selectedLokPetIds.includes(pet.id) && pet.stamina > 0).map((pet) => pet.roll),
      },
    );
  }

  /* -------------------------------------------------------------- */
  /* Input                                                           */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
        event.preventDefault();
      }
      keysRef.current.add(key);
      if (key === ' ') ultRequestRef.current = true;
      if (key === 'escape' || key === 'p') {
        if (phaseRef.current === 'playing' && meta.liveModeEnabled) setLiveDashboardOpen((open) => !open);
        else if (phaseRef.current === 'playing' && !worldRef.current?.player.falling) setPhaseBoth('paused');
        else if (phaseRef.current === 'paused') setPhaseBoth('playing');
      }
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.key.toLowerCase());
    const pauseWhenHidden = () => {
      keysRef.current.clear();
      if (phaseRef.current === 'playing') setPhaseBoth('paused');
    };
    const isTouchDevice =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    const blur = () => {
      // Mobile browsers can emit window.blur while handling a touch gesture
      // (for example when the browser chrome or an assistive overlay moves).
      // Treating that as an app switch makes the game pause during normal
      // joystick input. Visibility changes still pause when the player truly
      // leaves the game.
      if (!isTouchDevice) pauseWhenHidden();
    };
    const visibilityChange = () => {
      if (document.visibilityState === 'hidden') pauseWhenHidden();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibilityChange);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibilityChange);
    };
  }, [meta.liveModeEnabled, setPhaseBoth]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'playing') return;
    if (dungeonTransition) return;
    if (stickRef.current.active || pointerModeRef.current !== 'none') return;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);

    const canvas = canvasRef.current;
    const world = worldRef.current;
    const now = performance.now();
    const previousTap = lastTapRef.current;
    if (canvas && world && previousTap &&
      now - previousTap.time <= 300 &&
      Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) <= 48) {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const targetView = width < 620 ? 470 : Math.min(980, width * 0.78);
      const zoom = width / targetView;
      const targetX = (event.clientX - rect.left - width / 2) / zoom + world.camera.x;
      const targetY = (event.clientY - rect.top - rect.height / 2) / zoom + world.camera.y;
      dashPlayer(world, targetX - world.player.x, targetY - world.player.y);
      lastTapRef.current = null;
      pointerModeRef.current = 'none';
      return;
    }
    lastTapRef.current = null;
    if (physicsObjectClicksEnabled && canvas && world) {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const targetView = width < 620 ? 470 : Math.min(980, width * 0.78);
      const zoom = width / targetView;
      const target = primePhysicsObject(
        world,
        (event.clientX - rect.left - width / 2) / zoom + world.camera.x,
        (event.clientY - rect.top - rect.height / 2) / zoom + world.camera.y,
      );
      if (target) {
        pointerModeRef.current = 'object';
        return;
      }
    }

    pointerModeRef.current = 'stick';
    const next: StickState = {
      active: true,
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      dx: 0,
      dy: 0,
    };
    stickRef.current = next;
    setStickVisual(next);
  }, [dungeonTransition, physicsObjectClicksEnabled]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (pointerModeRef.current !== 'stick' || !stick.active || stick.pointerId !== event.pointerId) return;
    let dx = event.clientX - stick.originX;
    let dy = event.clientY - stick.originY;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    const next = { ...stick, dx, dy };
    stickRef.current = next;
    setStickVisual(next);
  }, []);

  const endPointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const stick = stickRef.current;
    if (pointerModeRef.current === 'object') {
      pointerModeRef.current = 'none';
      if (event.type !== 'pointercancel') {
        lastTapRef.current = { time: performance.now(), x: event.clientX, y: event.clientY };
      }
      return;
    }
    if (stick.pointerId !== event.pointerId) return;
    const wasTap = Math.hypot(stick.dx, stick.dy) <= 12;
    pointerModeRef.current = 'none';
    const next: StickState = { active: false, pointerId: null, originX: 0, originY: 0, dx: 0, dy: 0 };
    stickRef.current = next;
    setStickVisual(next);
    if (event.type === 'pointercancel' || !wasTap) {
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: performance.now(), x: event.clientX, y: event.clientY };
    }
  }, []);

  /* -------------------------------------------------------------- */
  /* Loop                                                            */
  /* -------------------------------------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    let countdownLeft = 1500;
    let sizeCheckedAt = 0;
    let accumulator = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      // Backing store must be whole pixels, so derive the scale from it --
      // comparing against a fractional product never matches.
      const backingW = Math.max(1, Math.round(width * ratio));
      const backingH = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== backingW || canvas.height !== backingH) {
        canvas.width = backingW;
        canvas.height = backingH;
      }
      return { width, height, dpr: backingW / width };
    };

    let view = resize();

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((time - last) / 1000, 0.1);
      last = time;

      if (time - sizeCheckedAt > 250) {
        sizeCheckedAt = time;
        view = resize();
      }

      if (phaseRef.current === 'countdown') {
        countdownLeft -= dt * 1000;
        if (countdownLeft <= 0) setPhaseBoth('playing');
      } else if (phaseRef.current === 'playing') {
        const keys = keysRef.current;
        let moveX = 0;
        let moveY = 0;
        if (keys.has('a') || keys.has('arrowleft')) moveX -= 1;
        if (keys.has('d') || keys.has('arrowright')) moveX += 1;
        if (keys.has('w') || keys.has('arrowup')) moveY -= 1;
        if (keys.has('s') || keys.has('arrowdown')) moveY += 1;

        // Tilt fills in when the player is not touching the stick, so picking
        // up the joystick always wins without having to disable the setting.
        const gyro = gyroRef.current;
        if (gyro.active && (gyro.x !== 0 || gyro.y !== 0)) {
          moveX = gyro.x;
          moveY = gyro.y;
        }

        const stick = stickRef.current;
        if (stick.active && (stick.dx !== 0 || stick.dy !== 0)) {
          moveX = stick.dx / STICK_RADIUS;
          moveY = stick.dy / STICK_RADIUS;
        }

        let ultimate = ultRequestRef.current;
        ultRequestRef.current = false;

        // Read the beat once per rendered frame and hold it across every
        // catch-up substep -- re-reading inside the loop would let one beat
        // retrigger several times on a slow frame.
        const audio = musicReactiveRef.current ? beatBus.read() : SILENT_FRAME;

        // Fixed-step catch-up: a dropped frame must not slow the run down,
        // but a long stall must not stampede the simulation either.
        accumulator = Math.min(accumulator + dt, FIXED_STEP * MAX_SUBSTEPS);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX, moveY, ultimate, audio });
          ultimate = false;
          if ((world.pendingLevelUps > 0 && levelUpPausesRef.current) || world.outcome !== 'running') break;
        }

        // Detect dungeon room transitions and briefly flash the screen.
        if (world.endless?.pendingTransition) {
          setDungeonTransition(world.endless.pendingTransition);
          world.endless.pendingTransition = null;
        }

        // Pop a queued loot-box prize and open the reel overlay.
        // Use the dedicated 'reel' phase so Escape/P cannot toggle back to 'playing'.
        if (world.pendingReel.length > 0) {
          if (presentationRef.current.liveModeEnabled || presentationRef.current.lootPresentation === 'queue') {
            const prizes = world.pendingReel.splice(0);
            setQueuedPrizes((current) => [...current, ...prizes]);
            setChestFlight((flight) => flight + prizes.length);
          } else {
            const prize = world.pendingReel.shift()!;
            setReel({ prize, phase: 'spinning', faceIndex: prizeToFaceIndex(prize) });
            setPhaseBoth('reel');
          }
        }

        if (world.outcome !== 'running') {
          // The run ended (block cleared or death) -- don't force the
          // player to click through any still-queued level-ups first.
          upgradeChoicesRef.current = [];
          setChoices([]);
          setPhaseBoth('over');
        } else if (world.pendingLevelUps > 0) {
          if (upgradeChoicesRef.current.length === 0) {
            const nextChoices = rollUpgradeChoices(world);
            upgradeChoicesRef.current = nextChoices;
            setChoices(nextChoices);
          }
          if (presentationRef.current.levelUpPresentation === 'random-live' && upgradeChoicesRef.current.length > 0) {
            const candidates = upgradeChoicesRef.current;
            const selected = candidates[Math.floor(world.rng() * candidates.length)] ?? candidates[0];
            applyUpgrade(world, selected);
            upgradeChoicesRef.current = [];
            setChoices([]);
            setRandomUpgradeReveal({ selected, candidates, visibleName: candidates[0]?.name ?? selected.name });
          } else if (levelUpPausesRef.current) {
            setPhaseBoth('levelup');
          }
        }
      } else if (phaseRef.current === 'over' && !finishedRef.current) {
        // Let the death or clear beat land before leaving.
        world.now += dt * 1000;
        if (world.outcome === 'dead') {
          world.player.animStartedAt = Math.min(world.player.animStartedAt, world.now);
        }
      }

      renderWorld(ctx, world, view);

      if (time - hudAt > 60) {
        hudAt = time;
        setHud(hudSnapshot(world));
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [setPhaseBoth]);

  // Hand the result back once the closing beat has played.
  useEffect(() => {
    if (phase !== 'over' || finishedRef.current) return;
    const world = worldRef.current;
    if (!world) return;
    const timer = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      for (const prize of [...world.pendingReel, ...queuedPrizes, ...(reel ? [reel.prize] : [])]) claimReelPrize(prize);
      onFinish(buildResult(world, finalRewardMultiplier));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [claimReelPrize, finalRewardMultiplier, onFinish, phase, queuedPrizes, reel]);

  const pickUpgrade = useCallback(
    (upgrade: UpgradeDef) => {
      const world = worldRef.current;
      if (!world) return;
      applyUpgrade(world, upgrade);
      if (world.pendingLevelUps > 0) {
        const nextChoices = rollUpgradeChoices(world);
        upgradeChoicesRef.current = nextChoices;
        setChoices(nextChoices);
      } else {
        upgradeChoicesRef.current = [];
        setChoices([]);
        setPhaseBoth(world.outcome === 'running' ? 'playing' : 'over');
      }
    },
    [setPhaseBoth],
  );

  const claimRumorHeal = useCallback(() => {
    const world = worldRef.current;
    if (!world || !claimRumorEmergencyHeal(world)) return;
    setHud(hudSnapshot(world));
  }, []);

  const triggerUltimate = useCallback(() => {
    ultRequestRef.current = true;
  }, []);

  const openQueuedPrize = useCallback(() => {
    setQueuedPrizes((current) => {
      const [prize, ...rest] = current;
      if (prize) {
        setReel({ prize, phase: 'spinning', faceIndex: prizeToFaceIndex(prize) });
        setRevealedPrizes((history) => [prize.label, ...history].slice(0, 8));
        if (!meta.liveModeEnabled) setPhaseBoth('reel');
      }
      return rest;
    });
  }, [meta.liveModeEnabled, setPhaseBoth]);

  const openAllQueuedPrizes = useCallback(() => {
    if (reel || queuedPrizes.length === 0) return;
    setLootTrayOpen(false);
    setOpeningAllLoot(true);
    openQueuedPrize();
  }, [openQueuedPrize, queuedPrizes.length, reel]);

  /** A real ticking reel, rather than a timestamp sampled only during unrelated renders. */
  useEffect(() => {
    if (reel?.phase !== 'spinning') return;
    const interval = window.setInterval(() => setReelTick((tick) => tick + 1), prefersReducedMotion ? 260 : 85);
    return () => window.clearInterval(interval);
  }, [reel?.phase, prefersReducedMotion]);

  /** Chain short reveals for the player's explicit Open all action. */
  useEffect(() => {
    if (!openingAllLoot || reel) return;
    if (queuedPrizes.length === 0) {
      setOpeningAllLoot(false);
      return;
    }
    const timer = window.setTimeout(openQueuedPrize, prefersReducedMotion ? 0 : 180);
    return () => window.clearTimeout(timer);
  }, [openingAllLoot, openQueuedPrize, prefersReducedMotion, queuedPrizes.length, reel]);

  useEffect(() => {
    if (!randomUpgradeReveal) return;
    let frame = 0;
    const interval = window.setInterval(() => {
      frame += 1;
      setRandomUpgradeReveal((current) => current ? { ...current, visibleName: current.candidates[frame % current.candidates.length]?.name ?? current.selected.name } : null);
    }, prefersReducedMotion ? 300 : 90);
    const finish = window.setTimeout(() => {
      window.clearInterval(interval);
      setRandomUpgradeReveal((current) => current ? { ...current, visibleName: current.selected.name } : null);
    }, prefersReducedMotion ? 300 : 720);
    const dismiss = window.setTimeout(() => setRandomUpgradeReveal(null), prefersReducedMotion ? 1100 : 1900);
    return () => { window.clearInterval(interval); window.clearTimeout(finish); window.clearTimeout(dismiss); };
  }, [randomUpgradeReveal?.selected.id, prefersReducedMotion]);

  /** Dismiss the reel overlay and resume the run. */
  const dismissReel = useCallback(() => {
    if (reelTimerRef.current !== null) {
      window.clearTimeout(reelTimerRef.current);
      reelTimerRef.current = null;
    }
    if (reel) claimReelPrize(reel.prize);
    setReel(null);
    setCelebration(false);
    if (phaseRef.current === 'reel') setPhaseBoth('playing');
  }, [claimReelPrize, reel, setPhaseBoth]);

  // Auto-land the reel after a short spin, then auto-dismiss.
  useEffect(() => {
    if (!reel) return;
    if (reel.phase === 'spinning') {
      const t = window.setTimeout(() => {
        setReel((prev) => {
          if (!prev) return null;
          claimReelPrize(prev.prize);
          return { ...prev, phase: 'landed' };
        });
        setCelebration(true);
        // Open-all stays brisk; a manually opened reward gets room to read.
        reelTimerRef.current = window.setTimeout(() => {
          setReel(null);
          if (phaseRef.current === 'reel') setPhaseBoth('playing');
        }, openingAllLoot ? 650 : 2200);
      }, openingAllLoot ? 450 : 1400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [claimReelPrize, openingAllLoot, reel?.phase, setPhaseBoth]);

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(false), prefersReducedMotion ? 500 : 1250);
    return () => window.clearTimeout(timer);
  }, [celebration, prefersReducedMotion]);

  /** End the run successfully ("head home"). Only available in endless mode. */
  const headHome = useCallback(() => {
    const world = worldRef.current;
    if (!world || world.outcome !== 'running' || world.player.falling) return;
    world.outcome = 'cleared';
    setPhaseBoth('over');
  }, [setPhaseBoth]);

  // Auto-clear the dungeon transition flash after a short beat.
  useEffect(() => {
    if (!dungeonTransition) return;
    const t = window.setTimeout(() => setDungeonTransition(null), 700);
    return () => window.clearTimeout(t);
  }, [dungeonTransition]);

  const hpPct = hud ? (hud.hp / Math.max(1, hud.maxHp)) * 100 : 100;
  const xpPct = hud ? (hud.xp / Math.max(1, hud.xpToNext)) * 100 : 0;
  const timeLeft = hud && !area.endless ? Math.max(0, hud.durationSec - hud.elapsedSec) : 0;
  const blocksWalked = hud?.endless?.blocksWalked ?? 0;
  const primaryHudSignal = selectPrimaryRunHudSignal(hud, challenges.map((challenge) => challenge.name));
  const hudIntelItems = runHudIntelCount(hud, challenges.length);
  const celebrationMarks = (() => {
    switch (getCelebrationStyle(meta.activeCelebrationId)) {
      case 'coin-burst': return ['●', '◉', '●', '✦', '◉', '●', '✦'];
      case 'signal-hearts': return ['♥', '♡', '♥', '✧', '♡', '♥', '✧'];
      case 'confetti-rain': return ['▰', '◆', '▴', '●', '✦', '◆', '▰'];
      case 'moth-swarm': return ['◇', '◈', '✧', '◇', '◈', '✧', '◇'];
      default: return ['✦', '✧', '★', '✦', '✧', '★', '✦'];
    }
  })();

  return (
    <div
      className="relative h-dvh w-full overflow-hidden bg-black select-none"
      style={{
        transform: meta.worldInvertEnabled ? 'rotate(180deg)' : undefined,
        filter: meta.paletteInvertEnabled ? 'invert(1)' : undefined,
      }}
      data-testid="screen-run"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* Touch surface: dragging anywhere steers. */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        data-testid="surface-controls"
      />

      {/* Top HUD */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 p-1"
        style={{ paddingTop: 'max(0.25rem, env(safe-area-inset-top))', paddingLeft: 'max(0.25rem, env(safe-area-inset-left))', paddingRight: 'max(0.25rem, env(safe-area-inset-right))' }}
        data-testid="run-hud-safe-zone"
      >
        <div className="flex h-8 items-start gap-1.5">
          <button
            type="button"
            onClick={() => setHudMinimized((v) => !v)}
            className="pointer-events-auto flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-black/75 text-white/70"
            data-testid="button-hud-minimize"
            aria-label={hudMinimized ? 'Expand HUD' : 'Minimize HUD'}
          >
            {hudMinimized ? <Maximize2 size={11} /> : <Minimize2 size={11} />}
          </button>

          {hudMinimized ? (
            <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-white/80" data-testid="hud-minimized">
              <span className="rounded-sm border border-white/20 bg-black/75 px-1 py-px" data-testid="text-level">L{hud?.level ?? 1}</span>
              <span className="h-1 w-12 overflow-hidden bg-black/70">
                <span className="block h-full bg-[#ff4d5e]" style={{ width: `${hpPct}%` }} />
              </span>
            </div>
          ) : (
            <div className="min-w-0 flex-1 max-w-[min(42vw,170px)] space-y-0.5">
              <div className="h-1 w-full overflow-hidden bg-black/70">
                <div
                  className="h-full bg-[#ff4d5e] transition-[width] duration-150"
                  style={{ width: `${hpPct}%` }}
                  data-testid="bar-health"
                />
              </div>
              <div className="h-0.5 w-full overflow-hidden bg-black/70">
                <div
                  className="h-full bg-[#6ee7ff] transition-[width] duration-150"
                  style={{ width: `${xpPct}%` }}
                  data-testid="bar-xp"
                />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-white/80">
                <span data-testid="text-level">Lv {hud?.level ?? 1}</span>
                <span data-testid="text-kills">{hud?.kills ?? 0} K</span>
                <span className="truncate">
                  {area.endless && hud?.endless
                    ? hud.endless.inBuilding
                      ? `Inside · ${hud.endless.buildingLabel}`
                      : `${hud.endless.currentBandLabel} · ${hud.endless.currentDistrict}`
                    : area.name}
                </span>
              </div>
            </div>
          )}

          <div className="ml-auto flex h-7 items-start gap-1">
            <div className="rounded-sm border border-white/20 bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white tabular-nums" data-testid="text-timer">
              {area.endless ? `${blocksWalked} blk` : formatClock(timeLeft)}
            </div>
            <button type="button" onClick={() => setHudIntelOpen((open) => !open)} className="pointer-events-auto flex h-6 items-center gap-1 border border-cyan-200/25 bg-black/75 px-1.5 font-mono text-[8px] uppercase tracking-wider text-cyan-100" aria-expanded={hudIntelOpen} data-testid="button-run-intel">
              Intel {hudIntelItems}{hudIntelOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {phase === 'playing' || phase === 'paused' ? (
              <button
                type="button"
                onClick={() => meta.liveModeEnabled && phase === 'playing' ? setLiveDashboardOpen((open) => !open) : setPhaseBoth(phase === 'playing' ? 'paused' : 'playing')}
                className="pointer-events-auto h-6 rounded-sm border border-white/20 bg-black/75 px-1.5 font-mono text-[8px] uppercase tracking-wider text-white/80"
                data-testid="button-pause"
              >
                {meta.liveModeEnabled && phase === 'playing' ? (liveDashboardOpen ? 'Close' : 'Tactics') : phase === 'paused' ? 'Resume' : 'Pause'}
              </button>
            ) : null}
          </div>
        </div>

        {primaryHudSignal ? (
          <div
            className="absolute left-1/2 top-[max(2.15rem,calc(env(safe-area-inset-top)+2rem))] flex h-6 w-[min(62vw,310px)] -translate-x-1/2 items-center justify-center gap-1.5 overflow-hidden border bg-black/78 px-2 font-mono text-[8px] font-bold uppercase tracking-wider shadow-sm"
            style={{ borderColor: `${primaryHudSignal.accent}66`, color: primaryHudSignal.accent }}
            data-testid="run-hud-primary-signal"
            aria-live={primaryHudSignal.urgent ? 'assertive' : 'polite'}
          >
            <span className="truncate">{primaryHudSignal.label}</span>
            {primaryHudSignal.detail ? <span className="max-w-[42%] shrink-0 truncate text-white/55">{primaryHudSignal.detail}</span> : null}
          </div>
        ) : null}

        {hudIntelOpen ? (
          <aside
            className="pointer-events-auto absolute right-1 top-[max(2.15rem,calc(env(safe-area-inset-top)+2rem))] max-h-[min(56dvh,430px)] w-[min(78vw,300px)] space-y-1 overflow-y-auto overscroll-contain border border-cyan-200/25 bg-[#050911]/94 p-1.5 shadow-[0_0_24px_rgba(0,0,0,.45)]"
            data-testid="run-intel-drawer"
            aria-label="Run details"
          >

        {hud?.rescueAvailable ? (
          <div className="mx-auto w-fit rounded-sm border border-[#ffe08a]/40 bg-black/70 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[#ffe08a]" data-testid="text-rescue">
            {hud.rescueAllyName ? `${hud.rescueAllyName} is caged` : 'Someone is caged'} — stand with them {hud.rescueProgressPct > 0 ? `(${hud.rescueProgressPct}%)` : ''}
          </div>
        ) : null}

        {challenges.length > 0 ? (
          <div className="mx-auto flex w-fit flex-wrap justify-center gap-1.5" data-testid="row-active-contracts">
            {challenges.map((challenge) => (
              <span key={challenge.id} className="border border-red-400/45 bg-black/75 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-red-200">
                Contract: {challenge.name}
              </span>
            ))}
          </div>
        ) : null}

        {hud?.crewRumor ? (
          <div className="mx-auto flex w-fit max-w-full items-center gap-2 border border-[#fbbf24]/45 bg-black/75 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[#fbbf24]" data-testid="indicator-crew-rumor">
            <span className="text-sm" aria-hidden="true">◆</span>
            <span className="truncate">
              Rumor · {hud.crewRumor.name} · {hud.crewRumor.triggered ? 'fired' : hud.crewRumor.effectLabel}
            </span>
          </div>
        ) : null}

        {hud?.loadout ? (
          <div className="flex gap-1.5 overflow-x-auto" data-testid="row-loadout">
            {hud.loadout.weapons.map((weapon) => {
              const kind = weapon.kind;
              return (
                <div key={weapon.id} title={weapon.name} className="flex h-8 min-w-8 items-center gap-1 justify-center border border-white/25 bg-black/75 px-1.5 font-mono text-[10px] font-bold text-white" style={{ borderColor: weapon.color ?? 'rgba(255,255,255,.25)' }}>
                  <WeaponIcon weaponId={weapon.id} kind={kind} color={weapon.color} size={20} className="shrink-0" />
                  {weapon.name.split(' ').map((part) => part[0]).join('').slice(0, 3)}<sup className="ml-0.5 text-primary">{weapon.level}</sup>
                </div>
              );
            })}
            {hud.loadout.passives.map((passive) => (
              <div key={passive.id} title={passive.name} className="flex h-8 min-w-8 items-center justify-center border border-primary/35 bg-primary/10 px-1.5 font-mono text-[10px] font-bold text-primary">
                {passive.name.split(' ').map((part) => part[0]).join('').slice(0, 3)}<sup className="ml-0.5">{passive.stacks}</sup>
              </div>
            ))}
          </div>
        ) : null}

        {hud?.lokPets && hud.lokPets.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="row-lokpets">
            {hud.lokPets.map((pet) => (
              <div
                key={pet.uid}
                title={`${pet.name} · ${pet.traitLabel} · ${pet.expiresInSec}s remaining`}
                className={`flex min-h-9 min-w-[148px] items-center gap-2 border bg-black/80 px-2 py-1 font-mono text-[9px] uppercase tracking-wide ${pet.ghost ? 'border-white/25' : 'border-pink-400/50'}`}
                style={{ color: pet.color, opacity: pet.ghost ? 0.68 : 1 }}
              >
                <span className="h-3 w-3 shrink-0 rotate-45 border" style={{ borderColor: pet.color, backgroundColor: `${pet.color}55`, boxShadow: `0 0 8px ${pet.color}` }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-white">{pet.name}</span>
                  <span className="block truncate opacity-80">{pet.traitLabel} · {pet.damage} dmg / {pet.cooldownMs}ms</span>
                </span>
                <span className="shrink-0 text-right opacity-80">
                  <span className="block">{pet.ghost ? 'ghost' : `${pet.expiresInSec}s`}</span>
                  <span className="block text-[8px]">{pet.silhouette}</span>
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {hud?.activeEffects && hud.activeEffects.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="row-status-effects">
            {hud.activeEffects.map((effect) => (
              <div
                key={effect.id}
                title={`${effect.name}: affecting ${effect.count} enemies`}
                className="flex items-center gap-1 border bg-black/75 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide"
                style={{ borderColor: `${effect.color}99`, color: effect.color }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: effect.color, boxShadow: `0 0 7px ${effect.color}` }} />
                {effect.name} <span className="opacity-70">×{effect.count}</span>
              </div>
            ))}
          </div>
        ) : null}

        {hud?.alerts.slice(-1).map((alert) => (
          <div key={alert} className="mx-auto w-fit font-mono text-sm uppercase tracking-[0.25em] text-white/90 drop-shadow">
            {alert}
          </div>
        ))}

        {hud?.firstNightBeat ? (
          <div className="mx-auto max-w-xl border border-cyan-200/40 bg-black/80 px-3 py-2 text-center" data-testid="story-beat">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-200">
              First Night · {hud.firstNightBeat.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/80">{hud.firstNightBeat.text}</p>
          </div>
        ) : null}

        {hud?.districtIncursion && hud.districtIncursion.phase !== 'pending' ? (
          <div
            className="mx-auto w-full max-w-xl border bg-black/80 px-3 py-2"
            style={{ borderColor: `${hud.districtIncursion.accent}88` }}
            data-testid="row-district-incursion"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: hud.districtIncursion.accent }}>
                {hud.districtIncursion.title} · {hud.districtIncursion.landmark}
              </span>
              <span className="font-mono text-[10px] uppercase text-white/70">
                {hud.districtIncursion.phase === 'active'
                  ? `${hud.districtIncursion.progress}/${hud.districtIncursion.target} · ${hud.districtIncursion.remainingSec}s`
                  : hud.districtIncursion.phase}
              </span>
            </div>
            <p className="mt-1 text-xs text-white/80">{hud.districtIncursion.objectiveLabel}</p>
            {hud.districtIncursion.phase === 'active' ? (
              <div className="mt-2 h-1 overflow-hidden bg-white/10">
                <div
                  className="h-full transition-[width]"
                  style={{
                    width: `${Math.min(100, (hud.districtIncursion.progress / Math.max(1, hud.districtIncursion.target)) * 100)}%`,
                    backgroundColor: hud.districtIncursion.accent,
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {hud?.evolution ? (
          <div
            className="mx-auto flex w-fit max-w-full items-center gap-2 border px-3 py-1.5 text-center"
            style={{ borderColor: `${hud.evolution.color}88`, backgroundColor: `${hud.evolution.color}18`, color: hud.evolution.color }}
            data-testid="text-signature-evolution"
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Signature · {hud.evolution.name}</span>
            <span className="hidden text-[10px] uppercase tracking-wider text-white/70 sm:inline">{hud.evolution.identity}</span>
          </div>
        ) : null}

        {hud?.relicWorkshop.activeRecipe ? (
          <div
            className="mx-auto flex w-fit max-w-full items-center gap-2 border px-3 py-1.5 text-center"
            style={{ borderColor: `${hud.relicWorkshop.activeRecipe.color}88`, backgroundColor: `${hud.relicWorkshop.activeRecipe.color}18`, color: hud.relicWorkshop.activeRecipe.color }}
            data-testid="text-relic-recipe"
          >
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Relic · {hud.relicWorkshop.activeRecipe.name}</span>
            <span className="hidden text-[10px] uppercase tracking-wider text-white/70 sm:inline">{hud.relicWorkshop.activeRecipe.identity}</span>
          </div>
        ) : hud?.relicWorkshop.readyRecipeIds.length ? (
          <div className="mx-auto w-fit max-w-full border border-orange-300/35 bg-orange-300/10 px-3 py-1.5 text-center text-orange-100" data-testid="text-relic-ready">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]">Relic recipe ready · level the base weapon</span>
          </div>
        ) : null}

        {hud?.episode ? (
          <div className="mx-auto w-full max-w-xl border border-primary/35 bg-black/75 px-3 py-2" data-testid="row-character-episode">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Episode · {hud.episode.title}</span>
              <span className="font-mono text-[10px] uppercase text-white/70">{hud.episode.progress}/{hud.episode.target}</span>
            </div>
            <p className="mt-1 text-xs text-white/80">{hud.episode.label}</p>
            <div className="mt-2 h-1 overflow-hidden bg-white/10">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${(hud.episode.progress / Math.max(1, hud.episode.target)) * 100}%` }} />
            </div>
          </div>
        ) : null}

        {/* Objective strip */}
        {hud && hud.objectives.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" data-testid="row-objectives">
            {hud.objectives.filter((o) => !o.completed).map((obj) => {
              const pct = Math.min(100, Math.round((obj.progress / Math.max(1, obj.target)) * 100));
              return (
                <div key={obj.label} className="flex items-center gap-1.5 rounded-sm border border-amber-800/40 bg-black/70 px-2 py-0.5">
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 transition-[width]" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-wide text-amber-300/80 truncate max-w-[110px]">{obj.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
          </aside>
        ) : null}
      </div>

      {area.endless && hud?.endless && meta.minimapVisible ? (
        <Minimap
          map={hud.endless}
          expanded={meta.minimapExpanded}
          position={meta.minimapPosition}
          onPositionChange={setMinimapPosition}
          onToggleExpanded={() => setMinimapExpanded(!meta.minimapExpanded)}
        />
      ) : null}

      {/* Ultimate */}
      <button
        type="button"
        onClick={triggerUltimate}
        disabled={(hud?.ultimateReadyPct ?? 0) < 100}
        className="absolute bottom-5 right-3 h-16 w-16 rounded-full border-2 border-white/25 bg-black/75 font-mono text-[8px] uppercase leading-tight tracking-wider text-white disabled:opacity-45 sm:bottom-8 sm:right-6 sm:h-20 sm:w-20 sm:text-[10px]"
        style={{
          background:
            hud && hud.ultimateReadyPct >= 100
              ? `radial-gradient(circle, ${character.palette.accent}55, rgba(0,0,0,0.75))`
              : `conic-gradient(${character.palette.accent}88 ${(hud?.ultimateReadyPct ?? 0) * 3.6}deg, rgba(0,0,0,0.75) 0deg)`,
        }}
        data-testid="button-ultimate"
      >
        {hud?.ultimateActive ? 'Active' : hud && hud.ultimateReadyPct >= 100 ? character.ultimate.name : `${Math.floor(hud?.ultimateReadyPct ?? 0)}%`}
      </button>

      <ChestTally count={hud?.lootBoxesOpened ?? 0} />
      {chestFlight > 0 ? (
        <span key={chestFlight} className="pointer-events-none absolute left-1/2 top-1/2 z-50 text-2xl" style={{ animation: 'chest-pocket-fly 700ms cubic-bezier(.2,.85,.25,1) forwards' }} aria-hidden="true">▣</span>
      ) : null}
      <div className="absolute bottom-[5.25rem] right-2 z-40 flex items-stretch sm:bottom-[6.5rem] sm:right-5">
        <button
          type="button"
          onClick={openQueuedPrize}
          disabled={queuedPrizes.length === 0 || Boolean(reel)}
          className="flex h-8 w-16 items-center justify-center border border-blue-300/50 bg-[#071225]/92 px-1 font-mono text-[8px] font-bold uppercase tracking-wider text-blue-100 shadow-[0_0_18px_rgba(96,165,250,.22)] disabled:opacity-40"
          data-testid="button-loot-tray"
          aria-label={`Open queued loot boxes, ${queuedPrizes.length} waiting`}
        >
          ▣ {queuedPrizes.length} · Open
        </button>
        <button
          type="button"
          onClick={() => setLootTrayOpen((open) => !open)}
          className="h-8 border border-l-0 border-blue-300/50 bg-[#071225]/92 px-1.5 font-mono text-[10px] text-blue-100 shadow-[0_0_18px_rgba(96,165,250,.22)]"
          aria-expanded={lootTrayOpen}
          aria-label="Loot pocket options"
          data-testid="button-loot-tray-options"
        >
          {lootTrayOpen ? '⌃' : '⌄'}
        </button>
        {lootTrayOpen ? (
          <aside className="absolute bottom-9 right-0 w-48 border border-blue-300/45 bg-[#050b16]/95 p-2 shadow-[0_0_24px_rgba(96,165,250,.2)]" aria-label="Loot pocket">
            <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-blue-100"><span>Loot pocket</span><span>{queuedPrizes.length} waiting</span></div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              <button type="button" onClick={() => { setLootTrayOpen(false); openQueuedPrize(); }} disabled={queuedPrizes.length === 0 || Boolean(reel)} className="border border-blue-200/30 px-2 py-1.5 font-mono text-[8px] uppercase text-blue-100 disabled:opacity-40">Open one</button>
              <button type="button" onClick={openAllQueuedPrizes} disabled={queuedPrizes.length < 2 || Boolean(reel)} className="border border-amber-200/35 px-2 py-1.5 font-mono text-[8px] uppercase text-amber-100 disabled:opacity-40">Open all</button>
            </div>
            {revealedPrizes.length > 0 ? <div className="mt-2 border-t border-white/10 pt-1.5"><p className="font-mono text-[8px] uppercase tracking-wider text-white/45">This run</p><ul className="mt-1 space-y-0.5 font-mono text-[8px] text-white/75">{revealedPrizes.slice(0, 4).map((label, index) => <li key={`${label}-${index}`} className="truncate">{label}</li>)}</ul></div> : null}
          </aside>
        ) : null}
      </div>

      {/* Virtual stick */}
      {stickVisual.active ? (
        <div
          className="pointer-events-none absolute rounded-full border border-white/25"
          style={{
            width: STICK_RADIUS * 2,
            height: STICK_RADIUS * 2,
            left: stickVisual.originX - STICK_RADIUS,
            top: stickVisual.originY - STICK_RADIUS,
          }}
        >
          <div
            className="absolute rounded-full bg-white/30"
            style={{
              width: 44,
              height: 44,
              left: STICK_RADIUS - 22 + stickVisual.dx,
              top: STICK_RADIUS - 22 + stickVisual.dy,
            }}
          />
        </div>
      ) : null}

      {/* Countdown */}
      {phase === 'countdown' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/60">{area.district}</p>
          <h2 className="mt-2 text-4xl font-black uppercase text-white">{area.name}</h2>
          <p className="mt-3 max-w-xs px-6 font-mono text-xs text-white/60">
            {area.endless
              ? 'Follow the street grid. Enter marked buildings, find the way back out, and head home when you\'re done.'
              : `Survive ${Math.round(area.durationSec)} seconds. Drag anywhere to move.`}
          </p>
          {firstNightChapter ? (
            <div className="mt-5 max-w-sm border border-cyan-200/30 bg-cyan-950/20 px-4 py-3 text-left" data-testid="run-briefing">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                Chapter {firstNightChapter.chapter} · {firstNightChapter.worldVerb}
              </p>
              <p className="mt-1 text-sm font-bold text-white">{firstNightChapter.goal}</p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-white/50">The lead: {firstNightChapter.thread}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Level up */}
      {phase === 'levelup' && meta.levelUpPausesEnabled ? (
        <div
          className="absolute inset-0 flex items-end justify-start bg-black/55 p-3"
          style={{
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
          }}
          data-testid="overlay-levelup"
        >
          <div className="max-h-[60vh] w-[min(75vw,260px)] space-y-2 overflow-y-auto border border-primary/40 bg-black/90 p-2 shadow-[0_0_24px_rgba(251,191,36,.16)]">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/60">Level {hud?.level}</p>
            <h2 className="text-xs font-black uppercase text-white">Pick your edge</h2>
            {hud?.crewRumor?.rumorId === 'pantry-surge' && hud.crewRumor.ready ? (
              <button
                type="button"
                onClick={claimRumorHeal}
                className="w-full border border-[#86efac]/60 bg-[#86efac]/10 p-2 text-left transition hover:bg-[#86efac]/20 active:scale-[0.99]"
                data-testid="button-rumor-heal"
              >
                <p className="font-bold uppercase tracking-wide text-[#86efac]">Emergency pantry heal</p>
                <p className="mt-1 font-mono text-[10px] text-white/70">Use Pantry Surge once alongside your normal upgrade.</p>
              </button>
            ) : null}
            <div className="space-y-2">
              {choices.map((upgrade) => {
                const cardWeapon = resolveCardWeapon(upgrade);
                return (
                  <button
                    key={upgrade.id}
                    type="button"
                    onClick={() => pickUpgrade(upgrade)}
                    className="flex w-full items-center gap-2 rounded-sm border border-white/20 bg-white/5 p-2 text-left transition hover:border-white/60 hover:bg-white/10 active:scale-[0.99]"
                    data-testid={`button-upgrade-${upgrade.id}`}
                  >
                    {cardWeapon ? (
                      <WeaponIcon weaponId={cardWeapon.id} kind={cardWeapon.kind} color={cardWeapon.color} size={28} className="shrink-0" />
                    ) : null}
                    <span>
                      <p className="text-xs font-bold uppercase tracking-wide text-white">{upgrade.name}</p>
                      <p className="mt-1 font-mono text-[10px] text-white/70">{upgrade.description}</p>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'playing' && !meta.levelUpPausesEnabled && choices.length > 0 ? (
        <div
          className={`pointer-events-none absolute bottom-3 left-3 z-40 ${levelUpMinimized ? 'w-fit' : 'w-[min(56vw,190px)]'}`}
          data-testid="panel-continuous-levelup"
        >
          <div className="pointer-events-auto space-y-1.5 border border-primary/40 bg-black/85 p-1.5 shadow-[0_0_18px_rgba(251,191,36,.16)]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-primary">Level {hud?.level}</p>
                {!levelUpMinimized ? <h2 className="text-xs font-black uppercase text-white">Pick your edge</h2> : null}
              </div>
              <button
                type="button"
                onClick={() => setLevelUpMinimized((v) => !v)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-black/60 text-white/70"
                data-testid="button-levelup-minimize"
                aria-label={levelUpMinimized ? 'Expand level-up choices' : 'Minimize level-up choices'}
              >
                {levelUpMinimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
              </button>
            </div>
            {levelUpMinimized ? null : (
              <>
                {hud?.crewRumor?.rumorId === 'pantry-surge' && hud.crewRumor.ready ? (
                  <button
                    type="button"
                    onClick={claimRumorHeal}
                    className="w-full border border-[#86efac]/60 bg-[#86efac]/10 p-2 text-left transition hover:bg-[#86efac]/20"
                    data-testid="button-rumor-heal-continuous"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#86efac]">Emergency pantry heal</p>
                    <p className="mt-0.5 font-mono text-[9px] text-white/70">Use once alongside your upgrade.</p>
                  </button>
                ) : null}
                <div className="max-h-[32vh] space-y-1.5 overflow-y-auto">
                  {choices.map((upgrade) => {
                    const cardWeapon = resolveCardWeapon(upgrade);
                    return (
                      <button
                        key={upgrade.id}
                        type="button"
                        onClick={() => pickUpgrade(upgrade)}
                        className="flex w-full items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 p-1.5 text-left transition hover:border-white/60 hover:bg-white/10 active:scale-[0.99]"
                        data-testid={`button-continuous-upgrade-${upgrade.id}`}
                      >
                        {cardWeapon ? (
                          <WeaponIcon weaponId={cardWeapon.id} kind={cardWeapon.kind} color={cardWeapon.color} size={22} className="shrink-0" />
                        ) : null}
                        <span className="min-w-0">
                          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-white">{upgrade.name}</p>
                          <p className="mt-0.5 line-clamp-2 font-mono text-[9px] text-white/70">{upgrade.description}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {randomUpgradeReveal ? (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-40 w-[min(72vw,300px)] -translate-x-1/2 border border-fuchsia-300/60 bg-black/88 px-4 py-3 text-center shadow-[0_0_28px_rgba(232,121,249,.3)]" data-testid="random-upgrade-reel" aria-live="polite">
          <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-fuchsia-200/70">Live level-up</p>
          <p className="mt-1 truncate text-lg font-black uppercase text-white">{randomUpgradeReveal.visibleName}</p>
          {randomUpgradeReveal.visibleName === randomUpgradeReveal.selected.name ? <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">Locked in · keep moving</p> : null}
        </div>
      ) : null}

      {/* Pause */}
      {(phase === 'paused' || liveDashboardOpen) && !runSettingsOpen ? (
        <div className={`${liveDashboardOpen ? 'pointer-events-none absolute inset-y-12 right-2 z-50 flex w-[min(78vw,420px)] items-start justify-end' : 'absolute inset-0 z-50 flex items-center justify-center bg-black/72 p-3'}`} data-testid="overlay-paused">
          <div className="pointer-events-auto max-h-full w-full max-w-4xl overflow-y-auto border border-cyan-200/30 bg-[#050911]/95 p-3 shadow-[0_0_36px_rgba(34,211,238,.16)]">
            <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.25em] text-cyan-200">Tactical dashboard</p><h2 className="text-xl font-black uppercase text-white">{liveDashboardOpen ? 'Live view' : 'Paused'}</h2></div><button type="button" onClick={() => liveDashboardOpen ? setLiveDashboardOpen(false) : setPhaseBoth('playing')} className="border border-white/25 px-3 py-2 font-mono text-[10px] uppercase text-white">{liveDashboardOpen ? 'Close' : 'Resume'}</button></div>
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              {meta.pauseMapVisible ? <div className="min-h-44 border border-cyan-200/20 bg-[#08111a] p-3">{hud?.endless ? <div className="relative h-52 overflow-hidden"><Minimap map={hud.endless} expanded position={{x:0,y:0}} onPositionChange={() => undefined} onToggleExpanded={() => undefined} /></div> : <div className="grid h-44 place-items-center"><div className="relative h-32 w-52 border border-white/15 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.16),transparent_55%)]"><span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-cyan-300 shadow-[0_0_14px_#67e8f9]"/><span className="absolute left-2 top-2 font-mono text-[9px] uppercase text-white/45">{area.district}</span><span className="absolute bottom-2 right-2 font-mono text-[9px] uppercase text-white/45">{area.name}</span></div></div>}</div> : null}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase"><span className="border border-emerald-400/30 bg-emerald-400/5 p-2 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,.08)]">HP {Math.ceil(hud?.hp ?? 0)}/{Math.ceil(hud?.maxHp ?? 0)}</span><span className="border border-emerald-400/30 bg-emerald-400/5 p-2 text-emerald-300">Level {hud?.level ?? 1}</span><span className="border border-emerald-400/30 bg-emerald-400/5 p-2 text-emerald-300">Kills {hud?.kills ?? 0}</span><span className="border border-red-400/30 bg-red-400/5 p-2 text-red-300 shadow-[0_0_10px_rgba(248,113,113,.08)]">Threats {challenges.length}</span></div>
                <div><p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/50">Weapons</p>{hud?.loadout.weapons.map((weapon) => <div key={weapon.id} className="flex justify-between border-b border-white/10 py-1 text-xs text-white"><span>{weapon.name}</span><span className="text-emerald-300">Lv {weapon.level}</span></div>)}</div>
                <div><p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-white/50">Passives / buffs</p>{hud?.loadout.passives.length ? hud.loadout.passives.map((passive) => <div key={passive.id} className="flex justify-between border-b border-white/10 py-1 text-xs text-emerald-200"><span>{passive.name}</span><span>+{passive.stacks}</span></div>) : <p className="text-xs text-white/35">No passives yet</p>}</div>
                {challenges.map((challenge) => <p key={challenge.id} className="font-mono text-[10px] uppercase text-red-300 [text-shadow:0_0_8px_rgba(248,113,113,.6)]">Debuff · {challenge.name}</p>)}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => liveDashboardOpen ? setLiveDashboardOpen(false) : setPhaseBoth('playing')}
              className="w-full rounded-sm border border-white/25 bg-white/10 px-4 py-3 font-bold uppercase tracking-widest text-white"
              data-testid="button-resume"
            >
              {liveDashboardOpen ? 'Close dashboard' : 'Resume'}
            </button>
            <button
              type="button"
              onClick={() => { if (liveDashboardOpen) setPhaseBoth('paused'); setLiveDashboardOpen(false); setRunSettingsOpen(true); }}
              className="w-full rounded-sm border border-cyan-200/40 bg-cyan-300/10 px-4 py-3 font-bold uppercase tracking-widest text-cyan-100"
              data-testid="button-pause-settings"
            >
              Settings
            </button>
            {area.endless && !liveDashboardOpen && (
              <button
                type="button"
                onClick={headHome}
                className="w-full rounded-sm border border-primary/50 bg-primary/10 px-4 py-3 font-bold uppercase tracking-widest text-primary"
                data-testid="button-head-home"
              >
                Head home
              </button>
            )}
            {!liveDashboardOpen ? <button
              type="button"
              onClick={onAbort}
              className="w-full rounded-sm border border-white/15 px-4 py-3 font-mono text-xs uppercase tracking-widest text-white/70"
              data-testid="button-abandon"
            >
              Abandon run
            </button> : null}
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'paused' && runSettingsOpen ? (
        <div className="absolute inset-0 z-[70] overflow-y-auto bg-background" data-testid="overlay-run-settings">
          <SettingsPanel onBack={() => setRunSettingsOpen(false)} />
        </div>
      ) : null}

      {/* Loot box reel overlay */}
      {reel ? (
        <div
          className={meta.liveModeEnabled ? 'absolute bottom-20 right-2 z-50 flex max-h-[42dvh] w-[min(58vw,220px)] flex-col items-center justify-center overflow-y-auto border border-blue-300/45 bg-black/90 p-2 shadow-[0_0_28px_rgba(96,165,250,.25)]' : 'absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/92'}
          data-testid="overlay-reel"
        >
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">Blue Box</p>
          <h2 className={`${meta.liveModeEnabled ? 'mb-2 text-lg' : 'mb-6 text-2xl'} font-black uppercase tracking-widest text-blue-300`}>
            {reel.phase === 'spinning' ? 'Spinning...' : 'You got'}
          </h2>

          {/* Reel strip — 3 faces scroll, then land */}
          <div className={`${meta.liveModeEnabled ? 'mb-2 gap-1.5' : 'mb-6 gap-3'} flex`}>
            {[0, 1, 2].map((col) => {
              const landed = reel.phase === 'landed';
              const face = landed ? REEL_FACES[reel.faceIndex] : REEL_FACES[(reel.faceIndex + col + 1) % REEL_FACES.length];
              return (
                <div
                  key={col}
                  className={`${meta.liveModeEnabled ? 'h-14 w-12 text-xl' : 'h-24 w-20 text-4xl'} flex flex-col items-center justify-center border-2 bg-black/80 font-black transition-all duration-500`}
                  style={{
                    borderColor: landed ? (face?.color ?? '#3b82f6') : '#334155',
                    color: landed ? (face?.color ?? '#3b82f6') : '#94a3b8',
                    boxShadow: landed ? `0 0 24px ${face?.color ?? '#3b82f6'}66` : 'none',
                  }}
                >
                  {landed ? face?.symbol : REEL_FACES[(reelTick + col) % REEL_FACES.length]?.symbol ?? '?'}
                  {landed && (
                    <span className="mt-1 font-mono text-[9px] uppercase tracking-widest opacity-70">
                      {face?.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {reel.phase === 'landed' ? (
            <div className="mb-6 text-center">
              <p
                className={`${meta.liveModeEnabled ? 'text-lg' : 'text-3xl'} font-black uppercase tracking-wide`}
                style={{ color: REEL_FACES[reel.faceIndex]?.color ?? '#3b82f6' }}
              >
                {reel.prize.label}
              </p>
              {reel.prize.lokPet ? (
                <div className={`${meta.liveModeEnabled ? 'mt-1 px-2 py-1 text-[8px]' : 'mt-3 px-4 py-3 text-[11px]'} border border-pink-400/30 bg-pink-400/5 text-left font-mono uppercase tracking-widest text-white/80`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-black text-pink-200">{reel.prize.lokPet.rarityLabel} {reel.prize.lokPet.family} signal</span>
                    <span className="text-pink-300">{reel.prize.lokPet.elementLabel}</span>
                  </div>
                  <p className="mt-1 text-white">{reel.prize.lokPet.traitLabel}</p>
                  <p className="mt-1 text-[9px] text-pink-100/70">
                    {reel.prize.lokPet.stats.damage} dmg · {reel.prize.lokPet.stats.cooldownMs}ms cadence · {reel.prize.lokPet.stats.range} range · {Math.round(reel.prize.lokPet.stats.lifetimeMs / 1000)}s lifespan
                  </p>
                  {!meta.liveModeEnabled ? <p className="mt-1 text-[9px] text-white/50">{reel.prize.lokPet.description}</p> : null}
                </div>
              ) : null}
              <p className="mt-1 font-mono text-xs text-white/40">reel landed — added to this run</p>
            </div>
          ) : (
            <div className="mb-6 h-12" />
          )}

          <button
            type="button"
            onClick={dismissReel}
            className="border border-white/20 bg-white/5 px-8 py-3 font-mono text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
            data-testid="button-reel-skip"
          >
            {reel.phase === 'landed' ? 'Continue' : 'Skip'}
          </button>
        </div>
      ) : null}

      {celebration ? (
        <div className="pointer-events-none absolute inset-0 z-[55] overflow-hidden" aria-hidden="true">
          {celebrationMarks.map((mark, index) => (
            <span key={`${chestFlight}-${index}`} className="absolute font-black" style={{
              left: `${12 + index * 13}%`, top: `${32 + (index % 3) * 16}%`, color: [character.palette.accentBright, '#fde68a', '#67e8f9'][index % 3],
              animation: `celebration-pop ${prefersReducedMotion ? 500 : 1050}ms ease-out ${index * 45}ms both`,
            }}>{mark}</span>
          ))}
        </div>
      ) : null}

      {/* Dungeon transition flash */}
      {dungeonTransition ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center">
          <p className="border border-white/20 bg-black/82 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.28em] text-white/75 shadow-lg">
            {dungeonTransition === 'enter' ? 'Going down...' : 'Back on the block'}
          </p>
        </div>
      ) : null}

      {/* Outcome */}
      {phase === 'over' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50">
          <h2 className="text-4xl font-black uppercase tracking-widest text-white drop-shadow" data-testid="text-outcome">
            {worldRef.current?.outcome === 'cleared'
              ? 'Block cleared'
              : worldRef.current?.deathCause === 'lethal-pothole'
                ? 'FELL THROUGH'
                : 'Down'}
          </h2>
        </div>
      ) : null}
    </div>
  );
}

export default RunScreen;
