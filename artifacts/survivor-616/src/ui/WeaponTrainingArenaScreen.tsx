import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crosshair, RotateCcw, Search, Swords, Target, Zap } from 'lucide-react';

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
  world.player.x = -135;
  world.player.y = 0;
  world.player.facing = 1;
  world.player.vx = 0;
  world.player.vy = 0;
  world.camera.x = -135;
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

export function WeaponTrainingArenaScreen({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const activeUntilRef = useRef(0);
  const firingPendingRef = useRef(false);
  const testStartHpRef = useRef(DUMMY_START_HP);
  const testStartedAtRef = useRef(0);
  const testCompletesAtRef = useRef(0);
  const { selectedCharacter } = useMeta();
  const [selectedWeaponId, setSelectedWeaponId] = useState(TRAINING_LOADOUT[0]!.id);
  const [search, setSearch] = useState('');
  const [dummyHp, setDummyHp] = useState(DUMMY_START_HP);
  const [dummyMaxHp, setDummyMaxHp] = useState<number>(DUMMY_START_HP);
  const [lastDamage, setLastDamage] = useState(0);
  const [lastDps, setLastDps] = useState(0);
  const [lastTest, setLastTest] = useState('Choose a weapon, then test it on the Dust Mite.');
  const selectedWeapon = TRAINING_LOADOUT.find((weapon) => weapon.id === selectedWeaponId) ?? TRAINING_LOADOUT[0]!;

  const filteredWeapons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return TRAINING_LOADOUT;
    return TRAINING_LOADOUT.filter((weapon) => `${weapon.name} ${weapon.kind} ${weapon.description}`.toLowerCase().includes(query));
  }, [search]);

  useEffect(() => {
    worldRef.current = createTrainingWorld(selectedCharacter, selectedWeapon, dummyMaxHp);
    setDummyHp(DUMMY_START_HP);
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
        if (testCompletesAtRef.current && time >= testCompletesAtRef.current) {
          const durationSec = Math.max(0.1, (testCompletesAtRef.current - testStartedAtRef.current) / 1000);
          const damage = Math.max(0, testStartHpRef.current - (target?.hp ?? testStartHpRef.current));
          setLastDamage(Math.round(damage));
          setLastDps(Math.round(damage / durationSec));
          testCompletesAtRef.current = 0;
        }
      }

      if (time < activeUntilRef.current || firingPendingRef.current) {
        accumulator = Math.min(accumulator + dt, FIXED_STEP * 6);
        while (accumulator >= FIXED_STEP) {
          accumulator -= FIXED_STEP;
          stepWorld(world, FIXED_STEP, { moveX: 0, moveY: 0, ultimate: false });
          const dummy = world.enemies[0];
          if (dummy && !dummy.dying) {
            dummy.x = 175;
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
        }
      } else {
        accumulator = 0;
      }

      resize();
      renderWorld(ctx, world, view);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [selectedCharacter]);

  const testWeapon = (weaponToTest = selectedWeapon): void => {
    const world = worldRef.current;
    if (!world) return;
    world.projectiles = [];
    world.effects = [];
    world.particles = [];
    world.popups = [];
    world.orbiters = [];
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
    firingPendingRef.current = weaponToTest.kind !== 'orbit';
    const startedAt = performance.now();
    const durationMs = weaponToTest.kind === 'orbit' ? 1800 : 1500;
    testStartHpRef.current = target.hp;
    testStartedAtRef.current = startedAt;
    testCompletesAtRef.current = startedAt + durationMs;
    activeUntilRef.current = startedAt + durationMs;
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
    world.weapons[0]!.readyAt = Number.POSITIVE_INFINITY;
    activeUntilRef.current = 0;
    firingPendingRef.current = false;
    testCompletesAtRef.current = 0;
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
    }
    if (world?.weapons[0]) world.weapons[0].readyAt = Number.POSITIVE_INFINITY;
    activeUntilRef.current = 0;
    firingPendingRef.current = false;
    testCompletesAtRef.current = 0;
    setDummyMaxHp(hp);
    setDummyHp(hp);
    setLastDamage(0);
    setLastDps(0);
    setLastTest(`Dust Mite durability set to ${hp.toLocaleString()} HP.`);
  };

  return (
    <main className="min-h-[100dvh] bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/35 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 border border-white/20 px-3 text-xs font-bold uppercase tracking-wider text-white/80 hover:bg-white/10">
            <ArrowLeft size={15} /> Hideout
          </button>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.22em] text-cyan-200">Sanctum test chamber</p>
            <h1 className="text-xl font-black uppercase tracking-wide text-white sm:text-2xl">Training Arena</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/55">
          <Swords size={15} className="text-cyan-300" /> Stationary combat test
        </div>
      </header>

      <div className="grid min-h-[calc(100dvh-65px)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/10 bg-slate-950/90 lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 p-4">
            <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Zap size={15} className="text-amber-300" /> Full weapon rack</p>
            <p className="mt-1 text-xs text-white/45">{TRAINING_LOADOUT.length} weapons · Select one to load it into the test.</p>
            <label className="mt-3 flex items-center gap-2 border border-white/15 bg-black/25 px-2.5">
              <Search size={14} className="text-white/40" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a weapon" className="h-10 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35" />
            </label>
          </div>
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 lg:max-h-none lg:flex-1 lg:grid-cols-1">
            {filteredWeapons.map((weapon) => {
              const active = weapon.id === selectedWeapon.id;
              return (
                <button key={weapon.id} type="button" onClick={() => { setSelectedWeaponId(weapon.id); testWeapon(weapon); }} aria-pressed={active} className={`flex min-h-12 items-center gap-2 border px-2.5 py-2 text-left transition ${active ? 'border-cyan-300/70 bg-cyan-300/10 text-white' : 'border-white/10 bg-white/[.025] text-white/70 hover:border-white/30 hover:bg-white/[.06]'}`}>
                  <WeaponIcon kind={weapon.kind} weaponId={weapon.id} color={weapon.color} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">{weapon.name}</span>
                    <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-white/40">{weaponKindLabel(weapon)}</span>
                  </span>
                </button>
              );
            })}
            {filteredWeapons.length === 0 && <p className="col-span-full px-2 py-6 text-center text-xs text-white/45">No weapons match that search.</p>}
          </div>
        </aside>

        <section className="flex min-h-[65vh] flex-col p-3 sm:p-5 lg:min-h-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-white/40">Selected weapon · {weaponKindLabel(selectedWeapon)}</p>
              <h2 className="text-lg font-black text-white">{selectedWeapon.name}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/55">{selectedWeapon.description}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetDummy} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-3 text-xs font-bold uppercase tracking-wider text-white/70 hover:bg-white/10"><RotateCcw size={14} /> Reset dummy</button>
              <button type="button" onClick={() => testWeapon()} className="inline-flex min-h-11 items-center gap-2 bg-cyan-200 px-4 text-xs font-black uppercase tracking-wider text-slate-950 hover:bg-white"><Crosshair size={15} /> Test weapon</button>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden border border-cyan-200/20 bg-[#111522] shadow-[inset_0_0_80px_rgba(9,20,42,.65)]">
            <canvas ref={canvasRef} aria-label="Training arena with your operator facing a Dust Mite target" className="absolute inset-0 h-full w-full" />
            <div className="pointer-events-none absolute left-3 top-3 border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-sm">
              <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[.18em] text-cyan-200"><Target size={12} /> Training target</p>
              <p className="mt-1 text-xs font-black text-white">Dust Mite</p>
              <div className="mt-2 h-1.5 w-36 bg-white/10"><div className="h-full bg-amber-300 transition-[width] duration-150" style={{ width: `${Math.max(0, (dummyHp / dummyMaxHp) * 100)}%` }} /></div>
              <p className="mt-1 font-mono text-[9px] text-white/50">{Math.ceil(dummyHp)} / {dummyMaxHp} HP</p>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 border border-white/10 bg-black/45 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/55">
              {selectedCharacter.name} <span className="mx-2 text-cyan-300">›</span> Stand still · Test one weapon at a time
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/50"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />{lastTest}</div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/20 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-wider text-white/55">
              <span>Last test: <b className="text-white">{lastDamage}</b> damage</span>
              <span>Average: <b className="text-white">{lastDps}</b> damage/sec</span>
              <span>Base: <b className="text-white">{selectedWeapon.damage}</b> damage · <b className="text-white">{(selectedWeapon.cooldownMs / 1000).toFixed(2)}s</b> cooldown</span>
            </div>
            <div className="flex items-center gap-1.5" aria-label="Dummy durability">
              <span className="mr-1 font-mono text-[9px] uppercase tracking-wider text-white/40">Dummy HP</span>
              {DUMMY_HP_PRESETS.map((hp) => (
              <button key={hp} type="button" onClick={() => setDummyDurability(hp)} aria-pressed={dummyMaxHp === hp} className={`min-h-8 border px-2 font-mono text-[9px] ${dummyMaxHp === hp ? 'border-cyan-300/60 bg-cyan-300/10 text-cyan-100' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{hp.toLocaleString()}</button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
