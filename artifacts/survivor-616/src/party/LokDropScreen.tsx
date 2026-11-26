/**
 * LokDropScreen -- the playable 60-second Lok Drop prototype (Lok Party Slice 1).
 *
 * 1 player + 3 bots, 2.5D front-facing vault floor (camera tilt, depth scale, z lift), the
 * juiceEngine on every hit, and the lokparty.meta.v1 report at the end.
 *
 * Art rule: every character is our own procedural rig (drawRig). The Drive reference images
 * only informed the camera tilt, wet-asphalt lighting, ring colors and the minimal top HUD.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { drawRig, drawShadow } from '@/game/render/sprite';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { CapsulePullOverlay } from './CapsulePullOverlay';
import { Squash, createJuice, drawRefractionRings, impact, type Juice } from './juiceEngine';
import {
  DROP,
  bankProgress,
  botSkillsForTier,
  createLokDrop,
  dropPerformance,
  dropResults,
  stepLokDrop,
  timeLeftMs,
  type DropEvent,
  type DropState,
  type PlayerInput,
} from './lokDrop';
import {
  COSMETICS_BY_ID,
  applyMatch,
  ladderLabel,
  loadLokPartyMeta,
  markGrantPaid,
  openCapsule,
  passTier,
  pendingGrants,
  saveLokPartyMeta,
  type LokPartyMeta,
  type MatchReport,
  type Shard,
} from './lokPartyMeta';

const ROSTER_IDS = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'] as const;
const LANE_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
const VIEW_W = 1000;
const VIEW_H = 700;
const FLOOR_TOP = 190;
const FLOOR_H = 470;
const STEP = 1000 / 60;
const RIG_SCALE = 1.9;
const CREAM = '#FAF6EE';
const ESPRESSO = '#3b2a20';

// ------------------------------------------------------------------ projection (2.5D)

function depth(y: number): number {
  return 0.76 + 0.24 * (y / DROP.height);
}
function project(x: number, y: number, z = 0): { sx: number; sy: number; k: number } {
  const k = depth(y);
  return { sx: VIEW_W / 2 + (x - DROP.width / 2) * k, sy: FLOOR_TOP + (y / DROP.height) * FLOOR_H - z * 0.72 * k, k };
}

// ------------------------------------------------------------------ fx particles

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Banner {
  text: string;
  until: number;
  color: string;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ rig preview (lobby)

function RigPreview({ id, size = 96 }: { id: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const def = CHARACTERS_BY_ID[id];
    if (!c || !def) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      drawShadow(ctx, c.width / 2, c.height - 10, 18);
      drawRig(ctx, def.rig, def.palette, 'idle', t - t0, c.width / 2, c.height - 10, 1, 2.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  return <canvas ref={ref} width={size} height={size} style={{ width: size, height: size, imageRendering: 'pixelated' }} />;
}

// ------------------------------------------------------------------ screen

type Phase = 'lobby' | 'play' | 'results';

export function LokDropScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { ensureAudioContext, getAudioContext } = useMusicPlayer();
  const { claimLokPartyGrant } = useMeta();
  const [phase, setPhase] = useState<Phase>('lobby');
  const [pick, setPick] = useState<string>(ROSTER_IDS[0]);
  const [meta, setMeta] = useState<LokPartyMeta>(() => loadLokPartyMeta(storage()));
  const [report, setReport] = useState<{ report: MatchReport; placement: number; players: number; banked: number } | null>(null);
  const [shards, setShards] = useState<Shard[] | null>(null);
  const [pulling, setPulling] = useState<Shard[] | null>(null);
  const [seed, setSeed] = useState(() => (Date.now() ^ 0x616) >>> 0);

  const startMatch = useCallback(() => {
    ensureAudioContext();
    void getAudioContext()?.resume?.();
    setSeed((s) => (s * 1664525 + 1013904223) >>> 0);
    setReport(null);
    setShards(null);
    setPhase('play');
  }, [ensureAudioContext, getAudioContext]);

  const finish = useCallback(
    (state: DropState) => {
      const results = dropResults(state);
      const mine = results.find((r) => !r.bot);
      if (!mine) return;
      const now = Date.now();
      let { meta: next, report: rep } = applyMatch(meta, dropPerformance(state, mine), { nowMs: now, seed: state.seed, ladder: 'solo' });
      // One-way bridge: 616 pays through its own capped path; Party just marks it delivered.
      for (const g of pendingGrants(next, 'survivor616')) {
        claimLokPartyGrant(g.id, g.amount);
        next = markGrantPaid(next, g.id);
      }
      saveLokPartyMeta(storage(), next);
      setMeta(next);
      setReport({ report: rep, placement: mine.placement, players: results.length, banked: mine.banked });
      setPhase('results');
    },
    [meta, claimLokPartyGrant],
  );

  const crack = useCallback(() => {
    const opened = openCapsule(meta, (Date.now() ^ meta.vault.nextUid) >>> 0);
    if (!opened) return;
    ensureAudioContext();
    saveLokPartyMeta(storage(), opened.meta);
    setMeta(opened.meta);
    // Saved before the show starts, so closing the tab mid-crack never loses the reward.
    setPulling(opened.shards);
  }, [meta, ensureAudioContext]);

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#07061a] text-white" style={{ touchAction: 'none' }}>
      {phase === 'play' ? (
        <DropArena key={seed} seed={seed} playerId={pick} onDone={finish} getAudioContext={getAudioContext} ladderTier={meta.ladders.solo.tier} />
      ) : null}
      {phase === 'lobby' ? (
        <Lobby pick={pick} setPick={setPick} meta={meta} onStart={startMatch} onBack={onBack} t={t} />
      ) : null}
      {phase === 'results' && report ? (
        <Results data={report} meta={meta} shards={shards} onCrack={crack} onAgain={startMatch} onBack={onBack} t={t} />
      ) : null}
      {pulling ? (
        <CapsulePullOverlay
          characterId={pick}
          shards={pulling}
          getAudioContext={getAudioContext}
          onDone={() => {
            setShards(pulling);
            setPulling(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ lobby

function CreamCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${className}`} style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 4px 0 ${ESPRESSO}` }}>
      {children}
    </div>
  );
}

function Lobby({ pick, setPick, meta, onStart, onBack, t }: { pick: string; setPick: (id: string) => void; meta: LokPartyMeta; onStart: () => void; onBack: () => void; t: ReturnType<typeof useT> }) {
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1d1450 0%, #07061a 70%)' }}>
     <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{t('lokParty.drop.title')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/75">{t('lokParty.drop.pitch')}</p>
      </div>
      <CreamCard className="w-full max-w-md">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest">{t('lokParty.drop.pick')}</div>
        <div className="grid grid-cols-4 gap-2">
          {ROSTER_IDS.map((id) => {
            const def = CHARACTERS_BY_ID[id];
            const m = meta.characters[id];
            const on = id === pick;
            return (
              <button
                key={id}
                type="button"
                onPointerDown={() => setPick(id)}
                className="flex flex-col items-center rounded-lg border-2 p-1 transition-transform active:scale-95"
                style={{ borderColor: on ? ESPRESSO : 'transparent', background: on ? '#efe5d0' : 'transparent' }}
              >
                <RigPreview id={id} size={72} />
                <span className="text-[11px] font-bold leading-tight">{def?.name ?? id}</span>
                <span className="text-[10px] opacity-70">{t('lokParty.drop.mastery', { level: m?.level ?? 1 })}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-xs opacity-80">{t('lokParty.results.ladder', { ladder: t('lokParty.ladder.solo'), rank: ladderLabel(meta.ladders.solo) })}</div>
        <div className="text-xs opacity-80">{t('lokParty.results.pass', { tier: passTier(meta.pass.xp) })}</div>
      </CreamCard>
      <p className="text-xs text-white/60">{touch ? t('lokParty.drop.controlsTouch') : t('lokParty.drop.controlsKeys')}</p>
      <div className="flex gap-3">
        <button type="button" onPointerDown={onBack} className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold">
          {t('lokParty.drop.back')}
        </button>
        <button type="button" onPointerDown={onStart} className="rounded-lg px-8 py-3 text-base font-black text-black" style={{ background: '#7cff6b', boxShadow: '0 0 24px #7cff6b88' }}>
          {t('lokParty.drop.start')}
        </button>
      </div>
     </div>
    </div>
  );
}

// ------------------------------------------------------------------ results

function Results({
  data,
  meta,
  shards,
  onCrack,
  onAgain,
  onBack,
  t,
}: {
  data: { report: MatchReport; placement: number; players: number; banked: number };
  meta: LokPartyMeta;
  shards: Shard[] | null;
  onCrack: () => void;
  onAgain: () => void;
  onBack: () => void;
  t: ReturnType<typeof useT>;
}) {
  const r = data.report;
  const canCrack = meta.vault.capsules > 0 && meta.vault.keys > 0;
  const gradeColor = r.grade.startsWith('S') ? '#ffd23f' : r.grade.startsWith('A') ? '#7cff6b' : r.grade.startsWith('B') ? '#38f2ff' : '#c9c2b8';
  const lines: string[] = [
    t('lokParty.results.mastery', { level: r.masteryLevel }),
    ...r.masteryLevelUps.map((level) => t('lokParty.results.masteryUp', { level })),
    `${t('lokParty.results.ladder', { ladder: t('lokParty.ladder.solo'), rank: ladderLabel(r.lpAfter) })} (${r.lpChange >= 0 ? '+' : ''}${t('lokParty.results.lp', { lp: r.lpChange })})`,
    `${t('lokParty.results.pass', { tier: r.passTierAfter })}  ${t('lokParty.results.xp', { xp: r.passXpGained })}`,
    ...(r.firstWinOfDay ? [t('lokParty.results.firstWin')] : []),
    ...r.bridgeGrants.filter((g) => g.game === 'survivor616').map((g) => t('lokParty.results.bridge', { cred: g.amount })),
    ...(r.capsuleEarned ? [t('lokParty.results.capsule')] : []),
    t('lokParty.results.fragments', { count: r.keyFragmentsEarned }),
    ...(r.keysCompleted ? [t('lokParty.results.keyReady')] : []),
    ...r.missionsCompleted.map(() => t('lokParty.results.mission')),
    ...r.milestones.map((m) => t('lokParty.results.milestone', { value: m.value, stat: m.stat.replace(/-/g, ' ') })),
    ...(r.victoriousUnlocked ? [t('lokParty.results.victorious')] : []),
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <CreamCard className="w-full max-w-md">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border-2 text-4xl font-black" style={{ borderColor: ESPRESSO, background: '#1a1238', color: gradeColor }}>
            {r.grade}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest">{t('lokParty.results.title')}</div>
            <div className="text-xl font-black">{t('lokParty.results.place', { place: data.placement, players: data.players })}</div>
            <div className="text-sm">
              {t('lokParty.drop.banked')}: {data.banked}
            </div>
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {lines.map((l, i) => (
            <li key={i} className="border-b border-dashed pb-1" style={{ borderColor: '#3b2a2033' }}>
              {l}
            </li>
          ))}
        </ul>
        <div className="mt-2 text-xs opacity-70">{t('lokParty.results.vault', { capsules: meta.vault.capsules, keys: meta.vault.keys, shards: meta.vault.shards.length })}</div>
        {canCrack && !shards ? (
          <button type="button" onPointerDown={onCrack} className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border-2 p-3 active:scale-95" style={{ borderColor: ESPRESSO, background: '#1a1238' }}>
            <CapsuleGlyph />
            <span className="text-xs font-bold text-amber-200">{t('lokParty.results.crack')}</span>
          </button>
        ) : null}
        {shards ? (
          <div className="mt-3">
            <div className="text-xs font-bold uppercase tracking-widest">{t('lokParty.results.shards')}</div>
            <div className="mt-1 flex gap-2">
              {shards.map((s) => (
                <span key={s.uid} className="rounded border px-2 py-1 text-xs" style={{ borderColor: ESPRESSO }}>
                  {s.cosmeticId.replace(/-/g, ' ')} ({COSMETICS_BY_ID[s.cosmeticId]?.rarity})
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex gap-3">
          <button type="button" onPointerDown={onBack} className="flex-1 rounded-lg border-2 py-3 text-sm font-bold" style={{ borderColor: ESPRESSO }}>
            {t('lokParty.drop.back')}
          </button>
          <button type="button" onPointerDown={onAgain} className="flex-1 rounded-lg py-3 text-sm font-black text-black" style={{ background: '#7cff6b' }}>
            {t('lokParty.results.again')}
          </button>
        </div>
      </CreamCard>
    </div>
  );
}

/** Original Gold L capsule glyph (SVG, no emoji, no stock icon). */
function CapsuleGlyph() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="animate-pulse">
      <defs>
        <linearGradient id="lokcap" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.5" stopColor="#ffc531" />
          <stop offset="1" stopColor="#a8650b" />
        </linearGradient>
      </defs>
      <rect x="14" y="6" width="36" height="52" rx="18" fill="url(#lokcap)" stroke="#3b2a20" strokeWidth="3" />
      <line x1="14" y1="32" x2="50" y2="32" stroke="#3b2a20" strokeWidth="2" />
      <path d="M27 18 V40 H39" fill="none" stroke="#3b2a20" strokeWidth="5" strokeLinecap="square" />
    </svg>
  );
}

// ------------------------------------------------------------------ arena

interface ArenaProps {
  seed: number;
  playerId: string;
  onDone: (s: DropState) => void;
  getAudioContext: () => AudioContext | null;
  /** Solo Blitz tier, so bots scale with the player's rank. */
  ladderTier: number;
}

function DropArena({ seed, playerId, onDone, getAudioContext, ladderTier }: ArenaProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<PlayerInput>({ mx: 0, my: 0, dashPressed: false });
  const keys = useRef(new Set<string>());
  const stick = useRef<{ id: number; ox: number; oy: number; x: number; y: number } | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const labels = useMemo(
    () => ({
      you: t('lokParty.drop.you'),
      bot: t('lokParty.drop.bot'),
      banked: t('lokParty.drop.banked'),
      ringOpens: t('lokParty.drop.ringOpens'),
      ringMoved: t('lokParty.drop.ringMoved'),
      slamWarn: t('lokParty.drop.slamWarn'),
      slam: t('lokParty.drop.slam'),
      frenzy: t('lokParty.drop.frenzy'),
      bankedToast: (v: number) => t('lokParty.drop.bankedToast', { value: v }),
      dash: t('lokParty.drop.dash'),
    }),
    [t],
  );
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  // Keyboard (keydown fires the action; never keyup).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'shift') {
        inputRef.current.dashPressed = true;
        e.preventDefault();
      }
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const motion = prefersReducedMotion() ? 0 : 1;
    const juice: Juice = createJuice(getAudioContext, { motion, bpm: 118 });
    const labels = labelsRef.current;
    const skills = [0, ...botSkillsForTier(ladderTier)];
    const roster = [playerId, ...ROSTER_IDS.filter((id) => id !== playerId)].map((id, i) => ({ characterId: id, bot: i !== 0, botSkill: skills[i] }));
    const state = createLokDrop(seed, roster);
    const squash = state.players.map(() => new Squash());
    const sparks: Spark[] = [];
    const toasts: { x: number; y: number; text: string; born: number; color: string }[] = [];
    let banner: Banner | null = null;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let realNow = 0;
    let ended = false;
    let endAt = 0;
    let frenzyShown = false;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let fit = 1;
    let portrait = false;
    let offX = 0;
    let offY = 0;
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Landscape: fit the whole vault. Portrait: crop the sides and let the camera follow.
      portrait = h > w;
      fit = portrait ? Math.min(h / VIEW_H, w / (VIEW_W * 0.46)) : Math.min(w / VIEW_W, h / VIEW_H);
      offX = (w - VIEW_W * fit) / 2;
      offY = (h - VIEW_H * fit) / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    const cam = juice.camera;
    cam.x = VIEW_W / 2;
    cam.y = VIEW_H / 2;

    const toCanvas = (vx: number, vy: number) => {
      // view coords -> canvas device pixels, through the camera (shake ignored for ring placement)
      const z = cam.zoomValue;
      const px = (vx - cam.x) * z + VIEW_W / 2;
      const py = (vy - cam.y) * z + VIEW_H / 2;
      return { x: (offX + px * fit) * dpr, y: (offY + py * fit) * dpr };
    };

    const burst = (x: number, y: number, n: number, colors: string[], speed = 260) => {
      const count = Math.round(n * (motion ? 1 : 0.35));
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * (0.4 + Math.random() * 0.8);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: 0, max: 380 + Math.random() * 420, color: colors[i % colors.length], size: 2 + Math.random() * 3 });
      }
      if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
    };

    const handleEvent = (e: DropEvent) => {
      const mine = e.who === 0;
      const p = project(e.x, e.y, 0);
      const c = toCanvas(p.sx, p.sy);
      const pan = (e.x / DROP.width) * 2 - 1;
      switch (e.kind) {
        case 'capsule-crack':
        case 'gold-crack': {
          const gold = e.kind === 'gold-crack';
          burst(p.sx, p.sy - 20, gold ? 34 : 16, gold ? ['#ffd23f', '#fff3b0', '#ff9f1c'] : ['#38f2ff', '#ff3fd2', '#ffffff']);
          if (mine || gold) impact(juice, realNow, c.x / dpr, c.y / dpr, e.weight);
          juice.chimes.accent('crack', pan);
          break;
        }
        case 'pickup':
          if (mine) juice.chimes.pickup(realNow, { pan, bright: e.weight > 0.1 });
          break;
        case 'dash':
          if (e.who !== undefined) squash[e.who].launch(0.8);
          break;
        case 'hit':
        case 'boulder-hit': {
          burst(p.sx, p.sy - 24, 14, ['#ffffff', '#ff3fd2', '#38f2ff'], 320);
          const me = state.players[0];
          const involved = mine || Math.hypot(me.x - e.x, me.y - e.y) < 40;
          if (involved) impact(juice, realNow, c.x / dpr, c.y / dpr, e.weight);
          else juice.camera.addTrauma(0.12 * motion);
          for (const q of state.players) if (Math.hypot(q.x - e.x, q.y - e.y) < 30) squash[q.index].land(1.1);
          juice.chimes.accent('hit', pan);
          break;
        }
        case 'boulder-crack':
          burst(p.sx, p.sy - 20, 30, ['#c7b8a3', '#8f7a63', '#7cff6b'], 340);
          impact(juice, realNow, c.x / dpr, c.y / dpr, 0.9);
          juice.chimes.accent('crack', pan);
          break;
        case 'capsule-land':
          if (e.weight > 0.1) juice.camera.addTrauma(0.05 * motion);
          break;
        case 'bank': {
          burst(p.sx, p.sy - 30, mine ? 40 : 14, ['#7cff6b', '#ffd23f', '#38f2ff', '#ffffff'], 300);
          toasts.push({ x: p.sx, y: p.sy - 60, text: labels.bankedToast(e.value ?? 0), born: realNow, color: LANE_COLORS[e.who ?? 0] });
          if (mine) {
            impact(juice, realNow, c.x / dpr, c.y / dpr, e.weight);
            juice.chimes.accent('bank', pan);
          }
          break;
        }
        case 'ring-move':
          banner = { text: state.now < DROP.ringOpenMs + 100 ? labels.ringOpens : labels.ringMoved, until: realNow + 1400, color: '#7cff6b' };
          break;
        case 'slam-warn':
          banner = { text: labels.slamWarn, until: realNow + 1800, color: '#ff3f5a' };
          break;
        case 'slam':
          banner = { text: labels.slam, until: realNow + 2400, color: '#ff3f5a' };
          impact(juice, realNow, (offX + (VIEW_W / 2) * fit), (offY + 120 * fit), 1);
          juice.camera.addTrauma(0.8 * motion);
          juice.chimes.accent('slam');
          break;
      }
    };

    const readInput = (): PlayerInput => {
      const k = keys.current;
      let mx = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      let my = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
      const st = stick.current;
      if (st) {
        const dx = st.x - st.ox;
        const dy = st.y - st.oy;
        const len = Math.hypot(dx, dy);
        if (len > 6) {
          const m = Math.min(1, len / 56);
          mx = (dx / len) * m;
          my = (dy / len) * m;
        }
      }
      const dash = inputRef.current.dashPressed;
      inputRef.current.dashPressed = false;
      return { mx, my, dashPressed: dash };
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07061a';
      ctx.fillRect(0, 0, W, H);
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * offX, dpr * offY);
      cam.apply(ctx, VIEW_W, VIEW_H);
      const pulse = juice.bus.pulse((getAudioContext()?.currentTime ?? realNow / 1000));
      drawVault(ctx, state, realNow, pulse);
      drawRing(ctx, state, realNow, pulse);
      // Painter's order by depth.
      type Item = { y: number; draw: () => void };
      const items: Item[] = [];
      for (const tk of state.tokens) items.push({ y: tk.y, draw: () => drawToken(ctx, tk.x, tk.y, tk.gold, realNow + tk.id * 97) });
      for (const b of state.boulders) items.push({ y: b.y, draw: () => drawBoulder(ctx, b.x, b.y, b.spin, b.hp) });
      for (const c of state.capsules) items.push({ y: c.y, draw: () => drawCapsule(ctx, c.x, c.y, c.z, c.gold, realNow + c.id * 53) });
      state.players.forEach((p, i) =>
        items.push({
          y: p.y,
          draw: () => {
            const def = CHARACTERS_BY_ID[p.characterId];
            const pr = project(p.x, p.y, 0);
            const stunned = state.now < p.stunUntil;
            const dashing = state.now < p.dashUntil;
            squash[i].velocityStretch(Math.hypot(p.vx, p.vy) / DROP.dashSpeed);
            drawShadow(ctx, pr.sx, pr.sy + 2, 16 * pr.k);
            const prog = bankProgress(state, p);
            if (prog > 0) {
              ctx.save();
              ctx.strokeStyle = '#7cff6b';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(pr.sx, pr.sy - 70 * pr.k, 14, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
            if (dashing && motion) {
              ctx.save();
              ctx.globalAlpha = 0.35;
              ctx.strokeStyle = LANE_COLORS[i];
              ctx.lineWidth = 6;
              ctx.beginPath();
              ctx.moveTo(pr.sx, pr.sy - 20);
              ctx.lineTo(pr.sx - p.vx * 0.06 * pr.k, pr.sy - 20 - p.vy * 0.04 * pr.k);
              ctx.stroke();
              ctx.restore();
            }
            if (def) {
              ctx.save();
              ctx.translate(pr.sx, pr.sy);
              ctx.scale(squash[i].scaleX, squash[i].scaleY);
              const anim = stunned ? 'hurt' : dashing ? 'attack' : Math.hypot(p.vx, p.vy) > 30 ? 'walk' : 'idle';
              drawRig(ctx, def.rig, def.palette, anim, realNow, 0, 0, p.facing, RIG_SCALE * pr.k, { flash: stunned && Math.floor(realNow / 60) % 2 === 0 });
              ctx.restore();
            }
            // Lane marker + carried count above head.
            ctx.save();
            ctx.fillStyle = LANE_COLORS[i];
            ctx.beginPath();
            const hy = pr.sy - 92 * pr.k;
            ctx.moveTo(pr.sx - 7, hy - 8);
            ctx.lineTo(pr.sx + 7, hy - 8);
            ctx.lineTo(pr.sx, hy);
            ctx.closePath();
            ctx.fill();
            if (p.carried > 0) {
              ctx.font = 'bold 15px ui-monospace, monospace';
              ctx.textAlign = 'center';
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#07061a';
              ctx.strokeText(String(p.carried), pr.sx, hy - 14);
              ctx.fillStyle = '#ffd23f';
              ctx.fillText(String(p.carried), pr.sx, hy - 14);
            }
            ctx.restore();
          },
        }),
      );
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();
      // Sparks in view space.
      for (const s of sparks) {
        const a = 1 - s.life / s.max;
        ctx.globalAlpha = Math.max(0, a);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
      ctx.globalAlpha = 1;
      for (const tt of toasts) {
        const age = realNow - tt.born;
        ctx.globalAlpha = Math.max(0, 1 - age / 1100);
        ctx.font = 'bold 22px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#07061a';
        ctx.strokeText(tt.text, tt.x, tt.y - age * 0.05);
        ctx.fillStyle = tt.color;
        ctx.fillText(tt.text, tt.x, tt.y - age * 0.05);
      }
      ctx.globalAlpha = 1;
      ctx.restore(); // camera
      // Refraction rings re-sample the finished frame.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawRefractionRings(ctx, canvas, juice.waves, realNow, dpr);
      // Screen-space HUD (no camera, no shake).
      ctx.setTransform(dpr * fit, 0, 0, dpr * fit, dpr * offX, dpr * offY);
      // Visible slice of the view, in view units (portrait crops the sides).
      const visL = Math.max(0, -offX / fit);
      const visR = Math.min(VIEW_W, (canvas.clientWidth - offX) / fit);
      const visT = Math.max(0, -offY / fit);
      drawHud(ctx, state, labels, realNow, banner, pulse, { left: visL, right: visR, top: visT, stacked: portrait });
    };

    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      realNow += dt;
      const simDt = juice.hitStop.simDt(realNow, dt);
      acc += simDt;
      let steps = 0;
      while (acc >= STEP && steps < 5 && !state.over) {
        const inp = readInput();
        stepLokDrop(state, [inp, null, null, null], STEP);
        for (const e of state.events) handleEvent(e);
        acc -= STEP;
        steps += 1;
      }
      if (!frenzyShown && state.now >= 40_000) {
        frenzyShown = true;
        banner = { text: labels.frenzy, until: realNow + 1400, color: '#ffd23f' };
        juice.bus.bpm = 140;
      }
      cam.step(dt);
      juice.waves.prune(realNow);
      squash.forEach((s) => s.step(dt));
      for (const s of sparks) {
        s.life += dt;
        s.x += (s.vx * dt) / 1000;
        s.y += (s.vy * dt) / 1000;
        s.vy += (600 * dt) / 1000;
      }
      for (let i = sparks.length - 1; i >= 0; i -= 1) if (sparks[i].life >= sparks[i].max) sparks.splice(i, 1);
      for (let i = toasts.length - 1; i >= 0; i -= 1) if (realNow - toasts[i].born > 1100) toasts.splice(i, 1);
      // Gentle follow on the human player.
      const me = state.players[0];
      const target = project(me.x, me.y);
      const follow = portrait ? 0.85 : 0.12;
      cam.x += (VIEW_W / 2 + (target.sx - VIEW_W / 2) * follow - cam.x) * 0.08;
      cam.y += (VIEW_H / 2 + (target.sy - VIEW_H / 2) * 0.1 - cam.y) * 0.08;
      draw();
      if (state.over && !ended) {
        ended = true;
        endAt = realNow;
      }
      if (ended && realNow - endAt > 1600) {
        doneRef.current(state);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // Pointer: drag anywhere to move. React on pointerdown.
    const onDown = (e: PointerEvent) => {
      if (stick.current) return;
      stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      const st = stick.current;
      if (st && st.id === e.pointerId) {
        st.x = e.clientX;
        st.y = e.clientY;
        // Floating stick: drag origin follows so a long drag never stalls at max.
        const dx = st.x - st.ox;
        const dy = st.y - st.oy;
        const len = Math.hypot(dx, dy);
        if (len > 70) {
          st.ox = st.x - (dx / len) * 70;
          st.oy = st.y - (dy / len) * 70;
        }
      }
    };
    const onUp = (e: PointerEvent) => {
      if (stick.current?.id === e.pointerId) stick.current = null;
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tier is read once per match
  }, [seed, playerId, getAudioContext]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <button
        type="button"
        aria-label={labels.dash}
        onPointerDown={(e) => {
          e.stopPropagation();
          inputRef.current.dashPressed = true;
        }}
        className="absolute bottom-6 right-6 grid h-24 w-24 place-items-center rounded-full border-4 text-sm font-black active:scale-90"
        style={{ borderColor: '#ff3fd2', background: '#ff3fd233', color: '#fff', boxShadow: '0 0 24px #ff3fd266', touchAction: 'none' }}
      >
        {labels.dash}
      </button>
    </>
  );
}

// ------------------------------------------------------------------ drawing helpers

function drawVault(ctx: CanvasRenderingContext2D, s: DropState, now: number, pulse: number) {
  // Back wall.
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
  wall.addColorStop(0, '#0b0820');
  wall.addColorStop(1, '#1a1240');
  ctx.fillStyle = wall;
  ctx.fillRect(-200, -200, VIEW_W + 400, FLOOR_TOP + 200);
  // Vault doors slide shut over the last five seconds.
  const left = timeLeftMs(s);
  const close = left < DROP.slamWarnMs ? 1 - left / DROP.slamWarnMs : 0;
  const doorW = 220;
  const gap = 140 * (1 - close);
  ctx.fillStyle = '#2a2350';
  ctx.fillRect(VIEW_W / 2 - gap / 2 - doorW, 40, doorW, FLOOR_TOP - 40);
  ctx.fillRect(VIEW_W / 2 + gap / 2, 40, doorW, FLOOR_TOP - 40);
  ctx.strokeStyle = `rgba(56,242,255,${0.35 + 0.4 * pulse})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(VIEW_W / 2 - gap / 2 - doorW, 40, doorW, FLOOR_TOP - 40);
  ctx.strokeStyle = `rgba(255,63,210,${0.35 + 0.4 * pulse})`;
  ctx.strokeRect(VIEW_W / 2 + gap / 2, 40, doorW, FLOOR_TOP - 40);
  if (gap > 4) {
    const glow = ctx.createLinearGradient(VIEW_W / 2 - gap / 2, 0, VIEW_W / 2 + gap / 2, 0);
    glow.addColorStop(0, 'rgba(255,210,63,0)');
    glow.addColorStop(0.5, 'rgba(255,210,63,0.45)');
    glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(VIEW_W / 2 - gap / 2, 40, gap, FLOOR_TOP - 40);
  }
  // Floor: wet indigo asphalt as a tilted trapezoid.
  const tl = project(0, 0);
  const tr = project(DROP.width, 0);
  const br = project(DROP.width, DROP.height);
  const bl = project(0, DROP.height);
  const floor = ctx.createLinearGradient(0, tl.sy, 0, bl.sy);
  floor.addColorStop(0, '#141038');
  floor.addColorStop(1, '#221a52');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(tl.sx, tl.sy);
  ctx.lineTo(tr.sx, tr.sy);
  ctx.lineTo(br.sx, br.sy);
  ctx.lineTo(bl.sx, bl.sy);
  ctx.closePath();
  ctx.fill();
  // Reflections of the door neon on the wet floor.
  for (const [x, col] of [
    [VIEW_W / 2 - 160, 'rgba(56,242,255,0.10)'],
    [VIEW_W / 2 + 160, 'rgba(255,63,210,0.10)'],
  ] as const) {
    const g = ctx.createRadialGradient(x, FLOOR_TOP + 60, 4, x, FLOOR_TOP + 60, 220);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 240, FLOOR_TOP, 480, 360);
  }
  // Grid.
  ctx.strokeStyle = `rgba(120,110,255,${0.12 + 0.08 * pulse})`;
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= DROP.width; gx += 100) {
    const a = project(gx, 0);
    const b = project(gx, DROP.height);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
  for (let gy = 0; gy <= DROP.height; gy += 62) {
    const a = project(0, gy);
    const b = project(DROP.width, gy);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
  // Front lip.
  ctx.fillStyle = '#0b0820';
  ctx.fillRect(bl.sx - 40, bl.sy, br.sx - bl.sx + 80, 60);
  ctx.fillStyle = `rgba(56,242,255,${0.5 + 0.4 * pulse})`;
  ctx.fillRect(bl.sx, bl.sy, br.sx - bl.sx, 3);
  void now;
}

function drawRing(ctx: CanvasRenderingContext2D, s: DropState, now: number, pulse: number) {
  if (!s.ring.open) return;
  const c = project(s.ring.x, s.ring.y);
  const rx = DROP.ringRadius * c.k;
  const ry = rx * 0.48;
  ctx.save();
  const g = ctx.createRadialGradient(c.sx, c.sy, 4, c.sx, c.sy, rx);
  g.addColorStop(0, 'rgba(124,255,107,0.35)');
  g.addColorStop(1, 'rgba(124,255,107,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7cff6b';
  ctx.lineWidth = 3 + 2 * pulse;
  ctx.shadowColor = '#7cff6b';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Rotating dashes: shape cue so the ring reads without relying on color.
  ctx.setLineDash([10, 12]);
  ctx.lineDashOffset = -now / 30;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(c.sx, c.sy, rx * 0.78, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Light pillar.
  const pillar = ctx.createLinearGradient(0, c.sy - 160, 0, c.sy);
  pillar.addColorStop(0, 'rgba(124,255,107,0)');
  pillar.addColorStop(1, `rgba(124,255,107,${0.18 + 0.12 * pulse})`);
  ctx.fillStyle = pillar;
  ctx.fillRect(c.sx - rx * 0.6, c.sy - 160, rx * 1.2, 160);
  ctx.restore();
}

function drawCapsule(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, gold: boolean, t: number) {
  const ground = project(x, y, 0);
  const air = project(x, y, z);
  // Landing marker grows as it falls.
  const near = Math.max(0, 1 - z / 300);
  ctx.save();
  ctx.globalAlpha = 0.25 + 0.5 * near;
  ctx.strokeStyle = gold ? '#ffd23f' : '#38f2ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(ground.sx, ground.sy, 18 * ground.k, 8 * ground.k, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawShadow(ctx, ground.sx, ground.sy, 12 * ground.k * (0.5 + 0.5 * near));
  const w = 22 * air.k;
  const h = 32 * air.k;
  const wob = Math.sin(t / 120) * 0.15;
  ctx.save();
  ctx.translate(air.sx, air.sy - h / 2);
  ctx.rotate(wob);
  const grad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  if (gold) {
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.5, '#ffc531');
    grad.addColorStop(1, '#a8650b');
  } else {
    grad.addColorStop(0, '#c9fbff');
    grad.addColorStop(0.5, '#38c8ff');
    grad.addColorStop(1, '#5a1f9c');
  }
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, w / 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  if (gold) {
    // The L glyph: a shape, so gold reads without color.
    ctx.strokeStyle = '#3b2a20';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-3, -h * 0.3);
    ctx.lineTo(-3, h * 0.25);
    ctx.lineTo(w * 0.28, h * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function drawToken(ctx: CanvasRenderingContext2D, x: number, y: number, gold: boolean, t: number) {
  const p = project(x, y, 6 + Math.sin(t / 180) * 3);
  const flip = Math.abs(Math.cos(t / 160));
  const r = (gold ? 9 : 7) * p.k;
  ctx.save();
  ctx.fillStyle = gold ? '#ffd23f' : '#38f2ff';
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(p.sx, p.sy, Math.max(1.5, r * flip), r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number, hp: number) {
  const p = project(x, y, 0);
  const r = DROP.boulderRadius * p.k;
  drawShadow(ctx, p.sx, p.sy + 2, r * 1.1);
  ctx.save();
  ctx.translate(p.sx, p.sy - r);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, 2, 0, 0, r);
  g.addColorStop(0, '#b9a98f');
  g.addColorStop(1, '#4b3f33');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#07061a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.rotate(spin);
  ctx.strokeStyle = 'rgba(7,6,26,0.6)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(i * 2.1) * r * 0.2, Math.sin(i * 2.1) * r * 0.2);
    ctx.lineTo(Math.cos(i * 2.1) * r * 0.85, Math.sin(i * 2.1) * r * 0.85);
    ctx.stroke();
  }
  // Damage cracks glow green as it weakens.
  if (hp < DROP.boulderHp) {
    ctx.strokeStyle = '#7cff6b';
    ctx.lineWidth = 2;
    for (let i = 0; i < DROP.boulderHp - hp; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.2 + i * 8);
      ctx.lineTo(0, i * 6);
      ctx.lineTo(r * 0.5, -r * 0.3 + i * 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  s: DropState,
  labels: { you: string; bot: string; banked: string },
  now: number,
  banner: Banner | null,
  pulse: number,
  vis: { left: number; right: number; top: number; stacked: boolean },
) {
  // Timer pill: pixel-on-cream with espresso border.
  const left = Math.ceil(timeLeftMs(s) / 1000);
  const urgent = left <= 5;
  const midX = (vis.left + vis.right) / 2;
  const top = vis.top + 8;
  const timerY = vis.stacked ? top + 92 : top;
  ctx.save();
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = urgent ? '#ff3f5a' : ESPRESSO;
  ctx.lineWidth = urgent ? 3 + 2 * pulse : 3;
  ctx.beginPath();
  ctx.roundRect(midX - 56, timerY, 112, 40, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = urgent ? '#c8102e' : ESPRESSO;
  ctx.font = 'bold 26px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${left}`, midX, timerY + 21);
  // Four player chips: two per side in landscape, a 2 x 2 block above the timer in portrait.
  s.players.forEach((p, i) => {
    let x: number;
    let y = top;
    if (vis.stacked) {
      x = i % 2 === 0 ? vis.left + 8 : vis.right - 148;
      y = top + (i < 2 ? 0 : 44);
    } else x = i < 2 ? vis.left + 12 + i * 150 : vis.right - 162 - (3 - i) * 150;
    ctx.translate(0, y - 8);
    ctx.fillStyle = 'rgba(7,6,26,0.72)';
    ctx.strokeStyle = LANE_COLORS[i];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, 8, 140, 40, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillStyle = LANE_COLORS[i];
    const name = (CHARACTERS_BY_ID[p.characterId]?.name ?? p.characterId).slice(0, 12);
    ctx.fillText(`${name} ${p.bot ? '' : `(${labels.you})`}`, x + 8, 20);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText(`${labels.banked} ${p.banked}`, x + 8, 37);
    if (p.carried > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.textAlign = 'right';
      ctx.fillText(`+${p.carried}`, x + 132, 37);
    }
    ctx.translate(0, -(y - 8));
  });
  if (banner && now < banner.until) {
    const a = Math.min(1, (banner.until - now) / 300);
    ctx.globalAlpha = a;
    ctx.font = 'bold 34px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#07061a';
    const by = vis.stacked ? timerY + 80 : top + 102;
    ctx.strokeText(banner.text.toUpperCase(), midX, by);
    ctx.fillStyle = banner.color;
    ctx.fillText(banner.text.toUpperCase(), midX, by);
  }
  ctx.restore();
}
