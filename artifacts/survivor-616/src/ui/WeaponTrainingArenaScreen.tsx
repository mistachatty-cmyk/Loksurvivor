import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Crosshair, RotateCcw, Search, Swords, Target, Zap } from 'lucide-react';

import { createWorld, stepWorld, type EnemyActor, type World } from '@/game/engine/world';
import { CHARACTERS } from '@/game/data/characters';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import { AREAS } from '@/game/data/areas';
import { ALL_WEAPON_DEFS } from '@/game/data/weaponPixelModels';
import { renderWorld, type Viewport } from '@/game/render/draw';
import { useMeta } from '@/game/state/metaStore';
import type { WeaponDef } from '@/game/types';
import type { CharacterDef } from '@/game/types';
import { WeaponIcon } from './WeaponIcon';

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

function buildTrainingLoadout(): WeaponDef[] {
  return [...ALL_WEAPON_DEFS].sort((a, b) => a.name.localeCompare(b.name));
}

const TRAINING_LOADOUT = buildTrainingLoadout();

function makeTrainingDummy(maxHp = DUMMY_START_HP): EnemyActor {
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
  world.camera.x = TRAINING_PLAYER_X;
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
  const testStartHpRef = useRef(DUMMY_START_HP);
  const testStartedAtRef = useRef(0);
  const { selectedCharacter } = useMeta();
  const [selectedWeaponId, setSelectedWeaponId] = useState(TRAINING_LOADOUT[0]!.id);
  const [expandedWeaponId, setExpandedWeaponId] = useState<string | null>(null);
  const [layout, setLayout] = useState<TrainingArenaLayout>(loadTrainingArenaLayout);
  const [search, setSearch] = useState('');
  const [dummyHp, setDummyHp] = useState(DUMMY_START_HP);
  const [dummyMaxHp, setDummyMaxHp] = useState<number>(DUMMY_START_HP);
  const [lastDamage, setLastDamage] = useState(0);
  const [lastDps, setLastDps] = useState(0);
  const [testRunning, setTestRunning] = useState(false);
  const [lastTest, setLastTest] = useState('Choose a weapon, then test it on the Dust Mite.');
  const selectedWeapon = TRAINING_LOADOUT.find((weapon) => weapon.id === selectedWeaponId) ?? TRAINING_LOADOUT[0]!;
  const mainLayout = layout === 'main';

  useEffect(() => {
    try {
      window.localStorage.setItem(TRAINING_ARENA_LAYOUT_KEY, layout);
    } catch {
      // The preferred layout still works for this visit when storage is unavailable.
    }
  }, [layout]);

  const filteredWeapons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return TRAINING_LOADOUT;
    return TRAINING_LOADOUT.filter((weapon) => `${weapon.name} ${weapon.kind} ${weapon.description}`.toLowerCase().includes(query));
  }, [search]);

  useEffect(() => {
    worldRef.current = createTrainingWorld(selectedCharacter, selectedWeapon, dummyMaxHp);
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
          world.camera.x = TRAINING_PLAYER_X;
          world.camera.y = 0;
          const dummy = world.enemies[0];
          if (dummy && !dummy.dying) {
            dummy.x = TRAINING_DUMMY_X;
            dummy.y = 0;
            dummy.vx = 0;
            dummy.vy = 0;
            dummy.kx = 0;
            dummy.ky = 0;
          }
          if (firingPendingRef.current) {
            firingPendingRef.current = false;
            const runWeapon = world.weapons[0];
            if (runWeapon && runWeapon.def.kind !== 'orbit') runWeapon.readyAt = Number.POSITIVE_INFINITY;
          }

          if (orbitStopAtRef.current && world.now >= orbitStopAtRef.current) {
            world.orbiters = [];
            orbitStopAtRef.current = 0;
          }

          const orbitFinished = orbitStopAtRef.current === 0;
          const safetyCapReached = world.now - testStartedAtRef.current >= TEST_SAFETY_CAP_MS;
          const attackResolved = !hasWeaponActivity(world);
          if (!firingPendingRef.current && orbitFinished && (attackResolved || safetyCapReached) && world.now >= testTailUntilRef.current) {
            if (safetyCapReached) {
              world.projectiles = [];
              world.pendingMeteors = [];
              world.effects = [];
              world.particles = [];
              world.popups = [];
              world.followers = [];
            }
            const durationSec = Math.max(0.1, (world.now - testStartedAtRef.current) / 1000);
            const damage = Math.max(0, testStartHpRef.current - (world.enemies[0]?.hp ?? testStartHpRef.current));
            testRunningRef.current = false;
            accumulator = 0;
            setTestRunning(false);
            setDummyHp(Math.max(0, world.enemies[0]?.hp ?? dummyMaxHp));
            setLastDamage(Math.round(damage));
            setLastDps(Math.round(damage / durationSec));
            break;
          }
        }
      } else {
        accumulator = 0;
      }

      resize();
      renderWorld(ctx, world, view);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [selectedCharacter, dummyMaxHp, layout]);

  const testWeapon = (weaponToTest = selectedWeapon): void => {
    const world = worldRef.current;
    if (!world) return;
    world.projectiles = [];
    world.effects = [];
    world.particles = [];
    world.popups = [];
    world.orbiters = [];
    world.pendingMeteors = [];
    world.followers = [];
    let target = world.enemies[0];
    if (!target || target.dying) {
      target = makeTrainingDummy(dummyMaxHp);
      world.enemies = [target];
    }
    target.hp = Math.max(target.hp, 1);
    target.maxHp = dummyMaxHp;
    world.player.anim = 'idle';
    world.weapons = [{ def: { ...weaponToTest, range: Math.max(weaponToTest.range, MIN_TEST_RANGE) }, level: 1, count: weaponToTest.count ?? 1, readyAt: world.now }];
    if (weaponToTest.kind === 'orbit') {
      world.orbiters = Array.from({ length: Math.max(1, weaponToTest.count ?? 1) }, (_, index) => ({
        weaponId: weaponToTest.id,
        angle: (Math.PI * 2 * index) / Math.max(1, weaponToTest.count ?? 1),
        radius: Math.max(weaponToTest.range, MIN_TEST_RANGE),
        damage: 0,
        cooldowns: new Map<number, number>(),
      }));
    } else {
      world.orbiters = [];
    }
    const startedAt = world.now;
    const orbitDurationMs = weaponToTest.kind === 'orbit'
      ? Math.max(1200, (Math.PI * 2 / (weaponToTest.speed ?? 2.5)) * 1000)
      : 0;
    testStartHpRef.current = target.hp;
    testStartedAtRef.current = startedAt;
    testTailUntilRef.current = startedAt + POST_ATTACK_TAIL_MS;
    orbitStopAtRef.current = orbitDurationMs ? startedAt + orbitDurationMs : 0;
    firingPendingRef.current = weaponToTest.kind !== 'orbit';
    testRunningRef.current = true;
    setTestRunning(true);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(`${weaponToTest.name} activated on the Dust Mite.`);
  };

  const resetDummy = (): void => {
    const world = worldRef.current;
    if (!world) return;
    world.enemies = [makeTrainingDummy(dummyMaxHp)];
    world.projectiles = [];
    world.effects = [];
    world.particles = [];
    world.popups = [];
    world.orbiters = [];
    world.pendingMeteors = [];
    world.followers = [];
    world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
    testRunningRef.current = false;
    testTailUntilRef.current = 0;
    orbitStopAtRef.current = 0;
    firingPendingRef.current = false;
    setTestRunning(false);
    setDummyHp(dummyMaxHp);
    setLastDamage(0);
    setLastDps(0);
    setLastTest('Dust Mite reset. Ready for another test.');
  };

  const setDummyDurability = (hp: number): void => {
    const world = worldRef.current;
    if (world) {
      world.enemies = [makeTrainingDummy(hp)];
      world.projectiles = [];
      world.effects = [];
      world.particles = [];
      world.popups = [];
      world.orbiters = [];
      world.pendingMeteors = [];
      world.followers = [];
    }
    if (world?.weapons[0]) world.weapons[0].readyAt = Number.POSITIVE_INFINITY;
    testRunningRef.current = false;
    testTailUntilRef.current = 0;
    orbitStopAtRef.current = 0;
    firingPendingRef.current = false;
    setTestRunning(false);
    setDummyMaxHp(hp);
    setDummyHp(hp);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(`Dust Mite durability set to ${hp.toLocaleString()} HP.`);
  };

  const chooseWeapon = (weapon: WeaponDef): void => {
    if (testRunningRef.current) return;
    setSelectedWeaponId(weapon.id);
    setExpandedWeaponId((expandedId) => expandedId === weapon.id ? null : weapon.id);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(`${weapon.name} selected. Ready to test.`);
  };

  return (
    <main className="flex h-[100dvh] flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-orange-300/70 bg-[#17110e] px-3 py-2.5 sm:gap-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-9 items-center gap-1.5 border border-white/20 px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/80 hover:bg-white/10 sm:min-h-10 sm:gap-2 sm:px-3 sm:text-xs">
            <ArrowLeft size={15} /> Hideout
          </button>
          <div>
            <p className="font-mono text-[9px] font-bold uppercase tracking-[.22em] text-orange-200">Sanctum test chamber</p>
            <h1 className="text-base font-black uppercase tracking-wide text-white sm:text-xl">Training Arena</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <div className="flex items-center border border-white/10 bg-black/25 p-0.5" aria-label="Training arena layout">
            <button type="button" onClick={() => setLayout('main')} aria-pressed={mainLayout} data-testid="training-arena-layout-main" className={`min-h-8 px-2 font-mono text-[8px] font-black uppercase tracking-wider transition sm:px-3 sm:text-[9px] ${mainLayout ? 'bg-orange-300 text-slate-950' : 'text-white/55 hover:text-white'}`}>Main</button>
            <button type="button" onClick={() => setLayout('classic')} aria-pressed={!mainLayout} data-testid="training-arena-layout-classic" className={`min-h-8 px-2 font-mono text-[8px] font-black uppercase tracking-wider transition sm:px-3 sm:text-[9px] ${!mainLayout ? 'bg-white/20 text-white' : 'text-white/55 hover:text-white'}`}>Classic</button>
          </div>
          <div className="hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-white/50 sm:flex">
            <Swords size={14} className="text-orange-200" /> Stationary combat test
          </div>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 overflow-hidden ${mainLayout ? 'grid-rows-[minmax(124px,24dvh)_minmax(0,1fr)] sm:grid-rows-1 sm:grid-cols-[196px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)]' : 'grid-rows-[minmax(176px,32dvh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[300px_minmax(0,1fr)]'}`}>
        <aside data-testid="training-weapon-dock" className={`flex min-h-0 flex-col overflow-hidden bg-slate-950/90 ${mainLayout ? 'border-b border-l-2 border-l-orange-300/50 border-white/10 sm:border-b-0 sm:border-r' : 'border-b border-white/10 lg:border-b-0 lg:border-r'}`}>
          <div className={`shrink-0 border-b border-white/10 ${mainLayout ? 'px-2 py-1.5 sm:p-3' : 'p-3 sm:p-4'}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider sm:text-xs"><Zap size={13} className="text-orange-200" /> Weapon rack</p>
              <span className="font-mono text-[8px] text-white/40">{TRAINING_LOADOUT.length}</span>
            </div>
            {!mainLayout && <p className="mt-1 text-xs text-white/45">Select an icon for details. Test when ready.</p>}
            <label className={`flex items-center gap-2 border border-white/15 bg-black/25 px-2 ${mainLayout ? 'mt-1 sm:mt-2' : 'mt-3'}`}>
              <Search size={13} className="shrink-0 text-white/40" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a weapon" className={`${mainLayout ? 'h-7 sm:h-8' : 'h-10'} min-w-0 flex-1 bg-transparent text-[10px] text-white outline-none placeholder:text-white/35`} />
            </label>
          </div>
          <div className={`training-arena-weapon-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain ${mainLayout ? 'grid grid-cols-2 content-start gap-1.5 p-1.5 sm:grid-cols-1 sm:gap-1.5 sm:p-2' : 'grid grid-cols-2 content-start gap-2 p-3 sm:grid-cols-3 lg:grid-cols-1'}`}>
            {filteredWeapons.map((weapon) => {
              const active = weapon.id === selectedWeapon.id;
              const expanded = expandedWeaponId === weapon.id;
              return mainLayout ? (
                <article key={weapon.id} className={`min-w-0 border transition ${active ? 'border-cyan-200/70 bg-cyan-300/[.08]' : 'border-white/10 bg-white/[.025] hover:border-white/25'}`}>
                  <button type="button" onClick={() => chooseWeapon(weapon)} disabled={testRunning} aria-expanded={expanded} aria-pressed={active} aria-controls={`weapon-details-${weapon.id}`} className="flex min-h-12 w-full items-center gap-1.5 px-1.5 py-1 text-left transition disabled:cursor-wait disabled:opacity-60 sm:min-h-14 sm:gap-2 sm:px-2">
                    <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] font-bold leading-tight sm:text-xs">{weapon.name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[8px] uppercase tracking-wider text-white/40">{weaponKindLabel(weapon)}</span>
                    </span>
                    {expanded ? <ChevronDown size={13} className="shrink-0 text-lime-300" /> : <ChevronRight size={13} className="shrink-0 text-white/35" />}
                  </button>
                  {expanded && (
                    <div id={`weapon-details-${weapon.id}`} className="border-t border-lime-300/25 bg-black/35 p-2" data-testid={`weapon-details-${weapon.id}`}>
                      <p className="text-[9px] leading-relaxed text-white/65">{weapon.description}</p>
                      <p className="mt-1.5 font-mono text-[8px] uppercase tracking-wider text-white/45">{weapon.damage} damage · {(weapon.cooldownMs / 1000).toFixed(2)}s cooldown</p>
                      <button type="button" onClick={() => { setSelectedWeaponId(weapon.id); testWeapon(weapon); }} className="mt-2 min-h-8 w-full border border-cyan-200/35 bg-cyan-200/[.08] px-2 font-mono text-[8px] font-black uppercase tracking-wider text-cyan-50 hover:bg-cyan-200/15">Test this weapon</button>
                    </div>
                  )}
                </article>
              ) : (
                <article key={weapon.id} className={`min-w-0 border ${active ? 'border-cyan-300/60 bg-cyan-300/[.06]' : 'border-white/10 bg-white/[.025]'}`}>
                  <button type="button" onClick={() => chooseWeapon(weapon)} disabled={testRunning} aria-expanded={expanded} aria-pressed={active} aria-controls={`classic-weapon-details-${weapon.id}`} className="flex min-h-12 w-full items-center gap-2 px-2.5 py-2 text-left transition disabled:cursor-wait disabled:opacity-60">
                    <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{weapon.name}</span>
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-white/40">{weaponKindLabel(weapon)}</span>
                    </span>
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                  {expanded && (
                    <div id={`classic-weapon-details-${weapon.id}`} className="border-t border-white/10 p-2">
                      <p className="text-[9px] leading-relaxed text-white/55">{weapon.description}</p>
                      <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-white/40">{weapon.damage} damage · {(weapon.cooldownMs / 1000).toFixed(2)}s cooldown</p>
                      <button type="button" onClick={() => { setSelectedWeaponId(weapon.id); testWeapon(weapon); }} disabled={testRunning} className="mt-2 min-h-8 w-full border border-cyan-200/25 px-2 font-mono text-[8px] font-black uppercase tracking-wider text-cyan-50 hover:bg-cyan-200/10 disabled:cursor-wait disabled:opacity-50">Test this weapon</button>
                    </div>
                  )}
                </article>
              );
            })}
            {filteredWeapons.length === 0 && <p className="col-span-full px-2 py-6 text-center text-xs text-white/45">No weapons match that search.</p>}
          </div>
        </aside>

        <section data-testid="training-arena-stage" className={`relative min-h-0 overflow-hidden ${mainLayout ? 'p-1.5 sm:p-3' : 'p-2 sm:p-4'}`}>
          <div className={`relative h-full min-h-0 overflow-hidden bg-[#111522] shadow-[inset_0_0_80px_rgba(9,20,42,.65)] ${mainLayout ? 'border-2 border-white/40' : 'border border-cyan-200/20'}`}>
            <canvas ref={canvasRef} aria-label="Training arena with your operator facing a Dust Mite target" className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-1.5 sm:inset-x-3 sm:top-3 sm:gap-3">
              <div className="max-w-[42%] border border-blue-200/50 bg-blue-950/85 px-2 py-1.5 shadow-lg sm:px-3 sm:py-2">
                <p className="font-mono text-[7px] uppercase tracking-[.16em] text-blue-200/75 sm:text-[9px]">Operator</p>
                <p className="truncate text-[10px] font-black text-white sm:text-xs">{selectedCharacter.name}</p>
              </div>
              <div className="max-w-[48%] border border-slate-300/50 bg-slate-800/90 px-2 py-1.5 text-right shadow-lg sm:px-3 sm:py-2">
                <p className="font-mono text-[7px] uppercase tracking-[.16em] text-slate-300/75 sm:text-[9px]">Training target</p>
                <p className="truncate text-[10px] font-black text-white sm:text-xs">Dust Mite</p>
                <p className="font-mono text-[8px] text-slate-300/70 sm:text-[9px]">{Math.ceil(dummyHp).toLocaleString()} / {dummyMaxHp.toLocaleString()} HP</p>
                <div className="mt-1 h-1 w-20 bg-white/10 sm:ml-auto sm:w-32"><div className="h-full bg-amber-300 transition-[width] duration-150" style={{ width: `${Math.max(0, (dummyHp / dummyMaxHp) * 100)}%` }} /></div>
              </div>
            </div>
            <div className="absolute inset-x-2 bottom-2 z-10 border border-white/15 bg-black/75 p-2 backdrop-blur-sm sm:inset-x-3 sm:bottom-3 sm:p-3">
              <div className="flex items-center gap-2 text-[10px] text-white/55 sm:text-xs"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${testRunning ? 'animate-pulse bg-amber-300' : 'bg-cyan-300'}`} />{lastTest}</div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/10 pt-1.5 sm:mt-2 sm:pt-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-white/55 sm:gap-x-4 sm:text-[10px]">
                  <span>Last test: <b className="text-white">{lastDamage}</b> damage</span>
                  <span>Avg: <b className="text-white">{lastDps}</b> damage/sec</span>
                  <span>Base: <b className="text-white">{selectedWeapon.damage}</b> · <b className="text-white">{(selectedWeapon.cooldownMs / 1000).toFixed(2)}s</b></span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1" aria-label="Dummy durability">
                    <span className="mr-0.5 font-mono text-[8px] uppercase tracking-wider text-white/40 sm:mr-1 sm:text-[9px]">Target HP</span>
                    {DUMMY_HP_PRESETS.map((hp) => (
                      <button key={hp} type="button" onClick={() => setDummyDurability(hp)} aria-pressed={dummyMaxHp === hp} className={`min-h-7 border px-1.5 font-mono text-[8px] sm:min-h-8 sm:px-2 sm:text-[9px] ${dummyMaxHp === hp ? 'border-slate-300/60 bg-slate-300/10 text-slate-100' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{hp.toLocaleString()}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={resetDummy} className="inline-flex min-h-8 items-center gap-1 border border-white/15 px-2 text-[8px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/10 sm:min-h-9 sm:px-3 sm:text-[9px]"><RotateCcw size={12} /> Reset</button>
                    <button type="button" onClick={() => testWeapon()} disabled={testRunning} className="inline-flex min-h-8 items-center gap-1 bg-cyan-200 px-2.5 text-[8px] font-black uppercase tracking-wider text-slate-950 hover:bg-white disabled:cursor-wait disabled:opacity-50 sm:min-h-9 sm:px-3 sm:text-[9px]"><Crosshair size={12} /> {testRunning ? 'Testing' : 'Test selected'}</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
