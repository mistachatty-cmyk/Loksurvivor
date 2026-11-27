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
import { FrameGovernor } from '@/lib/renderScale';
import { useT, type MessageKey } from '@/lib/i18n';
import { CapsulePullOverlay } from './CapsulePullOverlay';
import { BoardScreen } from './BoardScreen';
import { RingRunArena } from './RingRunScreen';
import { BOT_LEVELS, loadBotLevels, resolveBotSkills, saveBotLevels, type BotLevel, type BotLevels } from './botLevels';
import { rushPerformance, rushResults, type RushState } from './ringRun';
import { PartyLobby } from './PartyLobby';
import { GameModeButton } from '@/ui/GameModeButton';
import { LokInputDock } from '@/ui/LokInputDock';
import type { OnlineSession } from './partyNet';
import { boardStandings, type BoardState } from './lokBoard';
import { drawCrown, drawDiceBlock, drawOwl, drawCoin } from './boardArt';
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

export const ROSTER_IDS = ['zero-day', 'shade', 'quarry-kid', 'golden-hour'] as const;

/** The four seats for a match: the human first, then the rest of the launch roster. */
export function seatOrder(humanId: string): string[] {
  return [humanId, ...ROSTER_IDS.filter((id) => id !== humanId)];
}
const LANE_COLORS = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
const VIEW_W = 1000;
const VIEW_H = 700;
const FLOOR_TOP = 190;
const FLOOR_H = 470;
const STEP = 1000 / 60;
const RIG_SCALE = 1.9;
export { RigPreview };
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

type Phase = 'hub' | 'lobby' | 'online' | 'play' | 'board' | 'results';
type Mode = 'blitz' | 'drop' | 'friends' | 'rush';

function inviteCode(): string | null {
  try {
    const c = new URLSearchParams(window.location.search).get('party');
    return c && /^[A-Z0-9]{5}$/i.test(c) ? c.toUpperCase() : null;
  } catch {
    return null;
  }
}

interface Standing {
  characterId: string;
  place: number;
  crowns: number;
  coins: number;
  human: boolean;
}

export function LokDropScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { ensureAudioContext, getAudioContext } = useMusicPlayer();
  const { claimLokPartyGrant } = useMeta();
  const [joinCode] = useState(inviteCode);
  const [phase, setPhase] = useState<Phase>(() => (inviteCode() ? 'online' : 'hub'));
  const [mode, setMode] = useState<Mode>(() => (inviteCode() ? 'friends' : 'blitz'));
  const [online, setOnline] = useState<OnlineSession | null>(null);
  const [rounds, setRounds] = useState(10);
  const [pick, setPick] = useState<string>(ROSTER_IDS[0]);
  const [meta, setMeta] = useState<LokPartyMeta>(() => loadLokPartyMeta(storage()));
  const [report, setReport] = useState<ReportData | null>(null);
  const [shards, setShards] = useState<Shard[] | null>(null);
  const [pulling, setPulling] = useState<Shard[] | null>(null);
  const [seed, setSeed] = useState(() => (Date.now() ^ 0x616) >>> 0);
  const [botLevels, setBotLevelsState] = useState<BotLevels>(() => loadBotLevels(storage()));
  const setBotLevel = useCallback((i: number, lv: BotLevel) => {
    setBotLevelsState((cur) => {
      const next = [...cur] as BotLevels;
      next[i] = lv;
      saveBotLevels(storage(), next);
      return next;
    });
  }, []);
  // Resolved once per match seed, so a Random bot keeps its level for the whole match.
  const botSkills = useMemo(() => resolveBotSkills(botLevels, meta.ladders.solo.tier, seed), [botLevels, meta.ladders.solo.tier, seed]);

  const startMatch = useCallback(() => {
    ensureAudioContext();
    void getAudioContext()?.resume?.();
    setSeed((s) => (s * 1664525 + 1013904223) >>> 0);
    setReport(null);
    setShards(null);
    setOnline(null);
    setPhase(mode === 'drop' || mode === 'rush' ? 'play' : 'board');
  }, [ensureAudioContext, getAudioContext, mode]);

  const settle = useCallback(
    (perf: Parameters<typeof applyMatch>[1], seedUsed: number, extra: Omit<ReportData, 'report'>) => {
      let { meta: next, report: rep } = applyMatch(meta, perf, { nowMs: Date.now(), seed: seedUsed, ladder: 'solo' });
      // One-way bridge: 616 pays through its own capped path; Party just marks it delivered.
      for (const g of pendingGrants(next, 'survivor616')) {
        claimLokPartyGrant(g.id, g.amount);
        next = markGrantPaid(next, g.id);
      }
      saveLokPartyMeta(storage(), next);
      setMeta(next);
      setReport({ report: rep, ...extra });
      setPhase('results');
    },
    [meta, claimLokPartyGrant],
  );

  const finish = useCallback(
    (state: DropState) => {
      const results = dropResults(state);
      const mine = results.find((r) => !r.bot);
      if (!mine) return;
      settle(dropPerformance(state, mine), state.seed, { placement: mine.placement, players: results.length, banked: mine.banked });
    },
    [settle],
  );

  const finishRush = useCallback(
    (state: RushState, newBest: boolean) => {
      const results = rushResults(state);
      const mine = results.find((r) => !r.bot);
      if (!mine) return;
      const best = (() => {
        try {
          return Number(window.localStorage.getItem('lokparty.rush.best.v1')) || mine.banked;
        } catch {
          return mine.banked;
        }
      })();
      settle(rushPerformance(state, mine), state.seed, {
        placement: mine.placement,
        players: results.length,
        banked: mine.banked,
        extra: [
          { key: 'lokParty.rush.statRings', params: { count: mine.rings } },
          { key: 'lokParty.rush.statPeak', params: { mult: mine.peakMult } },
          newBest ? { key: 'lokParty.rush.statNewBest', params: { score: best } } : { key: 'lokParty.rush.statBest', params: { score: best } },
        ],
      });
    },
    [settle],
  );

  const finishBoard = useCallback(
    (s: BoardState, localSeat: number) => {
      const standings = boardStandings(s);
      const me = s.players[localSeat];
      const place = standings.find((r) => r.index === localSeat)?.place ?? 4;
      const totalCrowns = s.players.reduce((n, p) => n + p.crowns, 0) || 1;
      const rounds = Math.max(1, s.maxRounds);
      settle(
        {
          characterId: me.characterId,
          placement: place,
          players: s.players.length,
          objective: (me.crowns / totalCrowns) * 2,
          skill: me.stats.minigameWins / rounds * 2.5,
          clutch: me.stats.steals,
          risk: Math.min(1, me.stats.coinsSpent / 80),
          stats: { crowns: me.crowns, 'minigame-wins': me.stats.minigameWins, 'spaces-moved': me.stats.spacesMoved },
        },
        s.seed,
        {
          placement: place,
          players: s.players.length,
          standings: standings.map((r) => ({ characterId: s.players[r.index].characterId, place: r.place, crowns: s.players[r.index].crowns, coins: s.players[r.index].coins, human: r.index === localSeat })),
        },
      );
    },
    [settle],
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
      {phase === 'play' && mode === 'drop' ? (
        <DropArena key={seed} seed={seed} playerId={pick} onDone={finish} getAudioContext={getAudioContext} botSkills={botSkills} />
      ) : null}
      {phase === 'play' && mode === 'rush' ? (
        <RingRunArena key={seed} seed={seed} playerId={pick} onDone={finishRush} getAudioContext={getAudioContext} botSkills={botSkills} />
      ) : null}
      {phase === 'hub' ? (
        <Hub
          onPick={(m) => {
            setMode(m);
            setPhase(m === 'friends' ? 'online' : 'lobby');
          }}
          onBack={onBack}
          t={t}
        />
      ) : null}
      {phase === 'online' ? (
        <PartyLobby
          characterId={pick}
          rounds={rounds}
          joinCode={joinCode}
          onStart={(session) => {
            ensureAudioContext();
            setOnline(session);
            setPhase('board');
          }}
          onBack={() => setPhase('hub')}
        />
      ) : null}
      {phase === 'board' ? (
        <BoardScreen
          key={online ? `${online.room.code}-${online.seed}` : seed}
          humanId={pick}
          rounds={rounds}
          seed={seed}
          online={online ?? undefined}
          botSkills={botSkills}
          getAudioContext={getAudioContext}
          onFinish={finishBoard}
          onQuit={() => {
            online?.room.send('leave', { seat: online.mySeat, host: online.host });
            online?.room.close();
            setOnline(null);
            setPhase('hub');
          }}
        />
      ) : null}
      {phase === 'lobby' ? (
        <Lobby mode={mode} botLevels={botLevels} setBotLevel={setBotLevel} rounds={rounds} setRounds={setRounds} pick={pick} setPick={setPick} meta={meta} onStart={startMatch} onBack={() => setPhase('hub')} t={t} />
      ) : null}
      {phase === 'results' && report ? (
        <Results
          data={report}
          meta={meta}
          shards={shards}
          onCrack={crack}
          onAgain={() => {
            if (online) {
              online.room.close();
              setOnline(null);
              setPhase('online');
            } else startMatch();
          }}
          onBack={() => {
            online?.room.close();
            setOnline(null);
            setPhase('hub');
          }}
          t={t}
        />
      ) : null}
      {phase === 'hub' || phase === 'lobby' || phase === 'results' || phase === 'online' ? <GameModeButton className="absolute right-3 top-3 z-30" /> : null}
      <LokInputDock getAudioContext={getAudioContext} />
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

function Lobby({ mode, botLevels, setBotLevel, rounds, setRounds, pick, setPick, meta, onStart, onBack, t }: { mode: Mode; botLevels: BotLevels; setBotLevel: (i: number, lv: BotLevel) => void; rounds: number; setRounds: (n: number) => void; pick: string; setPick: (id: string) => void; meta: LokPartyMeta; onStart: () => void; onBack: () => void; t: ReturnType<typeof useT> }) {
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1d1450 0%, #07061a 70%)' }}>
     <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{mode === 'blitz' ? t('lokParty.hub.blitzTitle') : mode === 'rush' ? t('lokParty.rush.title') : t('lokParty.drop.title')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/75">{mode === 'blitz' ? t('lokParty.hub.blitzPitch') : mode === 'rush' ? t('lokParty.rush.pitch') : t('lokParty.drop.pitch')}</p>
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
        {mode === 'blitz' ? (
          <div className="mt-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-widest">{t('lokParty.board.length')}</div>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((n) => (
                <button key={n} type="button" onPointerDown={() => setRounds(n)} className="rounded-lg border-2 py-2 text-sm font-black" style={{ borderColor: ESPRESSO, background: rounds === n ? '#ffcf3c' : 'transparent' }}>
                  {t('lokParty.board.rounds', { count: n })}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest">{t('lokParty.bots.title')}</div>
          <div className="space-y-1.5">
            {seatOrder(pick)
              .slice(1)
              .map((id, i) => (
                <div key={id} className="flex items-center gap-2 rounded-lg border-2 px-2 py-1" style={{ borderColor: '#3b2a2033' }}>
                  <RigPreview id={id} size={40} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{CHARACTERS_BY_ID[id]?.name ?? id}</span>
                  <select
                    value={botLevels[i]}
                    onChange={(e) => setBotLevel(i, e.target.value as BotLevel)}
                    aria-label={t('lokParty.bots.aria', { name: CHARACTERS_BY_ID[id]?.name ?? id })}
                    className="rounded-lg border-2 bg-transparent px-2 py-1.5 text-sm font-black"
                    style={{ borderColor: ESPRESSO, color: ESPRESSO }}
                    data-testid={`select-bot-level-${i}`}
                  >
                    {BOT_LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {t(`lokParty.bots.${lv}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
          </div>
        </div>
        <div className="mt-3 text-xs opacity-80">{t('lokParty.results.ladder', { ladder: t('lokParty.ladder.solo'), rank: ladderLabel(meta.ladders.solo) })}</div>
        <div className="text-xs opacity-80">{t('lokParty.results.pass', { tier: passTier(meta.pass.xp) })}</div>
      </CreamCard>
      <p className="text-xs text-white/60">{mode === 'rush' && !touch ? t('lokParty.rush.controlsKeys') : touch ? t('lokParty.drop.controlsTouch') : t('lokParty.drop.controlsKeys')}</p>
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

interface ReportData {
  report: MatchReport;
  placement: number;
  players: number;
  banked?: number;
  extra?: { key: string; params?: Record<string, string | number> }[];
  standings?: Standing[];
}

function Results({
  data,
  meta,
  shards,
  onCrack,
  onAgain,
  onBack,
  t,
}: {
  data: ReportData;
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
    ...(data.extra ?? []).map((x) => t(x.key as MessageKey, x.params)),
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
            {data.banked !== undefined ? (
              <div className="text-sm">
                {t('lokParty.drop.banked')}: {data.banked}
              </div>
            ) : null}
          </div>
        </div>
        {data.standings ? (
          <div className="mt-3">
            <div className="text-xs font-black uppercase tracking-widest">{t('lokParty.board.final')}</div>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {data.standings.map((st) => (
                <div key={st.characterId} className="flex flex-col items-center rounded-lg border-2 p-1" style={{ borderColor: st.human ? ESPRESSO : '#3b2a2033', background: st.place === 1 ? '#fff1c2' : 'transparent' }}>
                  <span className="text-xs font-black">{st.place}</span>
                  <RigPreview id={st.characterId} size={56} />
                  <span className="text-[10px] font-bold">{t('lokParty.board.crowns', { count: st.crowns })}</span>
                  <span className="text-[10px] opacity-70">{t('lokParty.board.coins', { count: st.coins })}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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

export interface ArenaProps {
  /** Match length; default 60 s. */
  durationMs?: number;
  seed: number;
  playerId: string;
  onDone: (s: DropState) => void;
  getAudioContext: () => AudioContext | null;
  /** Solo Blitz tier, so bots scale with the player's rank. */
  /** The three bot skills, resolved from the lobby's difficulty choices. */
  botSkills: [number, number, number];
}

export function DropArena({ seed, playerId, onDone, getAudioContext, botSkills, durationMs = DROP.durationMs }: ArenaProps) {
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
    const skills = [0, ...botSkills];
    const roster = seatOrder(playerId).map((id, i) => ({ characterId: id, bot: i !== 0, botSkill: skills[i] }));
    const state = createLokDrop(seed, roster, durationMs);
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

    const gov = new FrameGovernor();
    let dpr = gov.dpr;
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
          banner = { text: state.now < Math.min(DROP.ringOpenMs, state.durationMs * 0.1) + 100 ? labels.ringOpens : labels.ringMoved, until: realNow + 1400, color: '#7cff6b' };
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
      if (gov.tick(dt)) {
        dpr = gov.dpr;
        resize();
      }
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
      if (!frenzyShown && state.now >= state.durationMs - 20_000) {
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
  // Back wall: riveted steel panels, pipes, hazard trim.
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_TOP);
  wall.addColorStop(0, '#0b0820');
  wall.addColorStop(1, '#1d1548');
  ctx.fillStyle = wall;
  ctx.fillRect(-200, -200, VIEW_W + 400, FLOOR_TOP + 200);
  for (let x = -40; x < VIEW_W + 40; x += 120) {
    for (let y = 30; y < FLOOR_TOP - 20; y += 70) {
      const g = ctx.createLinearGradient(x, y, x + 110, y + 62);
      g.addColorStop(0, '#2a2160');
      g.addColorStop(1, '#171238');
      ctx.fillStyle = g;
      ctx.fillRect(x + 4, y, 112, 62);
      ctx.strokeStyle = 'rgba(140,130,255,0.22)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4.5, y + 0.5, 111, 61);
      ctx.fillStyle = 'rgba(200,190,255,0.35)';
      for (const [rx, ry] of [
        [8, 4],
        [110, 4],
        [8, 56],
        [110, 56],
      ])
        ctx.fillRect(x + rx, y + ry, 2.5, 2.5);
    }
  }
  // Pipes along the top with valve wheels.
  for (const [py, col] of [
    [18, '#3b3478'],
    [30, '#2f2a62'],
  ] as const) {
    const pg = ctx.createLinearGradient(0, py - 5, 0, py + 5);
    pg.addColorStop(0, '#6a62c8');
    pg.addColorStop(0.5, col);
    pg.addColorStop(1, '#120e2a');
    ctx.fillStyle = pg;
    ctx.fillRect(-200, py - 5, VIEW_W + 400, 10);
    for (let x = 60; x < VIEW_W; x += 220) {
      ctx.fillStyle = '#4b4396';
      ctx.fillRect(x, py - 7, 8, 14);
    }
  }
  // Warning beacons that spin faster as the vault closes.
  const left = timeLeftMs(s);
  const urgent = left < DROP.slamWarnMs;
  for (const bx of [140, VIEW_W - 140]) {
    const a = now / (urgent ? 90 : 400);
    ctx.fillStyle = '#2a1f2b';
    ctx.fillRect(bx - 10, 44, 20, 10);
    ctx.fillStyle = urgent ? '#ff3f5a' : '#ffb03c';
    ctx.beginPath();
    ctx.arc(bx, 42, 8, Math.PI, 0);
    ctx.fill();
    const beam = ctx.createRadialGradient(bx, 40, 2, bx, 40, 120);
    beam.addColorStop(0, urgent ? 'rgba(255,63,90,0.45)' : 'rgba(255,176,60,0.25)');
    beam.addColorStop(1, 'rgba(255,63,90,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(bx, 40);
    ctx.arc(bx, 40, 120, a, a + 0.5);
    ctx.closePath();
    ctx.fill();
  }
  // Vault doors slide shut over the last five seconds.
  const close = urgent ? 1 - left / DROP.slamWarnMs : 0;
  const doorW = 220;
  const gap = 140 * (1 - close);
  const doors: [number, string][] = [
    [VIEW_W / 2 - gap / 2 - doorW, '#38f2ff'],
    [VIEW_W / 2 + gap / 2, '#ff3fd2'],
  ];
  for (const [dx, neon] of doors) {
    const dg = ctx.createLinearGradient(dx, 0, dx + doorW, 0);
    dg.addColorStop(0, '#3a3270');
    dg.addColorStop(0.5, '#4a4290');
    dg.addColorStop(1, '#2a2356');
    ctx.fillStyle = dg;
    ctx.fillRect(dx, 40, doorW, FLOOR_TOP - 40);
    // Bars and bolts.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let k = 0; k < 4; k += 1) ctx.fillRect(dx + 10, 58 + k * 32, doorW - 20, 6);
    ctx.fillStyle = 'rgba(220,215,255,0.5)';
    for (let k = 0; k < 9; k += 1) {
      ctx.fillRect(dx + 8 + k * 25, 46, 3, 3);
      ctx.fillRect(dx + 8 + k * 25, FLOOR_TOP - 10, 3, 3);
    }
    // Lock wheel (spins while the doors move).
    const cx = dx + doorW / 2;
    const cy = 40 + (FLOOR_TOP - 40) / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(close * 6 + (dx < VIEW_W / 2 ? 0 : 0.4));
    ctx.strokeStyle = '#c9c4ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 6; k += 1) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 26);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(0, 30, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1238';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Neon edge trim that breathes on the beat.
    ctx.strokeStyle = neon;
    ctx.globalAlpha = 0.45 + 0.45 * pulse;
    ctx.lineWidth = 3;
    ctx.shadowColor = neon;
    ctx.shadowBlur = 12;
    ctx.strokeRect(dx, 40, doorW, FLOOR_TOP - 40);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
  if (gap > 4) {
    const glow = ctx.createLinearGradient(VIEW_W / 2 - gap / 2, 0, VIEW_W / 2 + gap / 2, 0);
    glow.addColorStop(0, 'rgba(255,210,63,0)');
    glow.addColorStop(0.5, 'rgba(255,210,63,0.55)');
    glow.addColorStop(1, 'rgba(255,210,63,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(VIEW_W / 2 - gap / 2, 40, gap, FLOOR_TOP - 40);
  }
  // Hazard stripe sill along the base of the wall.
  for (let x = -40, i = 0; x < VIEW_W + 40; x += 18, i += 1) {
    ctx.fillStyle = i % 2 ? '#1a1218' : '#ffcb3c';
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_TOP - 8);
    ctx.lineTo(x + 18, FLOOR_TOP - 8);
    ctx.lineTo(x + 10, FLOOR_TOP);
    ctx.lineTo(x - 8, FLOOR_TOP);
    ctx.closePath();
    ctx.fill();
  }
  // Floor: wet indigo plate steel as a tilted trapezoid.
  const tl = project(0, 0);
  const tr = project(DROP.width, 0);
  const br = project(DROP.width, DROP.height);
  const bl = project(0, DROP.height);
  const floor = ctx.createLinearGradient(0, tl.sy, 0, bl.sy);
  floor.addColorStop(0, '#141038');
  floor.addColorStop(1, '#251c58');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.moveTo(tl.sx, tl.sy);
  ctx.lineTo(tr.sx, tr.sy);
  ctx.lineTo(br.sx, br.sy);
  ctx.lineTo(bl.sx, bl.sy);
  ctx.closePath();
  ctx.fill();
  // Beveled plates with a tread pattern on alternating squares.
  for (let gy = 0; gy < DROP.height; gy += 62) {
    for (let gx = 0; gx < DROP.width; gx += 100) {
      const a = project(gx + 3, gy + 3);
      const b = project(gx + 97, gy + 3);
      const c = project(gx + 97, gy + 59);
      const d = project(gx + 3, gy + 59);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(d.sx, d.sy);
      ctx.lineTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(b.sx, b.sy);
      ctx.lineTo(c.sx, c.sy);
      ctx.lineTo(d.sx, d.sy);
      ctx.stroke();
      if (((gx / 100) + (gy / 62)) % 2 === 0) {
        ctx.strokeStyle = 'rgba(160,150,255,0.07)';
        for (let k = 1; k < 5; k += 1) {
          const p = project(gx + 15 + k * 14, gy + 15);
          const q = project(gx + 5 + k * 14, gy + 45);
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(q.sx, q.sy);
          ctx.stroke();
        }
      }
    }
  }
  // Puddles that mirror the door neon.
  for (const [px, py, r] of [
    [260, 180, 70],
    [720, 260, 90],
    [430, 470, 80],
    [860, 520, 60],
  ]) {
    const c = project(px, py);
    ctx.fillStyle = 'rgba(10,8,30,0.45)';
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy, r * c.k, r * 0.32 * c.k, 0, 0, Math.PI * 2);
    ctx.fill();
    const rg = ctx.createLinearGradient(c.sx - r, 0, c.sx + r, 0);
    rg.addColorStop(0, `rgba(56,242,255,${0.12 + 0.1 * pulse})`);
    rg.addColorStop(1, `rgba(255,63,210,${0.12 + 0.1 * pulse})`);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(c.sx, c.sy, r * c.k * 0.8, r * 0.22 * c.k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(c.sx - r * 0.2, c.sy - 2, r * c.k * 0.35, r * 0.06 * c.k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Grid glow on the beat.
  ctx.strokeStyle = `rgba(120,110,255,${0.08 + 0.08 * pulse})`;
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= DROP.width; gx += 100) {
    const a = project(gx, 0);
    const b = project(gx, DROP.height);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }
  // Side pillars with neon strips.
  for (const side of [-1, 1]) {
    const top = side < 0 ? tl : tr;
    const bot = side < 0 ? bl : br;
    const px = side < 0 ? top.sx - 30 : top.sx + 6;
    const pg = ctx.createLinearGradient(px, 0, px + 24, 0);
    pg.addColorStop(0, '#2a2356');
    pg.addColorStop(1, '#14102e');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(px, 40);
    ctx.lineTo(px + 24, 40);
    ctx.lineTo((side < 0 ? bot.sx - 50 : bot.sx + 26) + 24, bot.sy);
    ctx.lineTo(side < 0 ? bot.sx - 50 : bot.sx + 26, bot.sy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = side < 0 ? '#38f2ff' : '#ff3fd2';
    ctx.globalAlpha = 0.5 + 0.4 * pulse;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 12, 50);
    ctx.lineTo((side < 0 ? bot.sx - 50 : bot.sx + 26) + 12, bot.sy - 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Front lip.
  ctx.fillStyle = '#0b0820';
  ctx.fillRect(bl.sx - 60, bl.sy, br.sx - bl.sx + 120, 70);
  ctx.fillStyle = `rgba(56,242,255,${0.5 + 0.4 * pulse})`;
  ctx.fillRect(bl.sx, bl.sy, br.sx - bl.sx, 3);
  for (let x = bl.sx + 20; x < br.sx; x += 60) {
    ctx.fillStyle = 'rgba(200,190,255,0.3)';
    ctx.fillRect(x, bl.sy + 10, 3, 3);
  }
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

// ------------------------------------------------------------------ hub

function ModePreview({ mode }: { mode: Mode }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 300;
    const h = 150;
    c.width = w * dpr;
    c.height = h * dpr;
    let raf = 0;
    const t0 = performance.now();
    const loop = (ts: number) => {
      const t = ts - t0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      if (mode === 'blitz') {
        bg.addColorStop(0, '#f6b76b');
        bg.addColorStop(1, '#5b3a6e');
      } else if (mode === 'friends') {
        bg.addColorStop(0, '#2a7bb8');
        bg.addColorStop(1, '#1d1450');
      } else {
        bg.addColorStop(0, '#1d1450');
        bg.addColorStop(1, '#07061a');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      if (mode === 'blitz') {
        // Mini skyline.
        for (let i = 0; i < 9; i += 1) {
          const bh = 30 + ((i * 37) % 50);
          ctx.fillStyle = i % 2 ? '#6e3a4c' : '#4b3a6e';
          ctx.fillRect(i * 34, h - 40 - bh, 30, bh);
          ctx.fillStyle = 'rgba(255,220,150,0.6)';
          for (let y = h - 34 - bh; y < h - 46; y += 10) for (let x = i * 34 + 5; x < i * 34 + 26; x += 9) ctx.fillRect(x, y, 4, 5);
        }
        ctx.fillStyle = '#5b4a57';
        ctx.fillRect(0, h - 40, w, 40);
        // Path of spaces.
        const cols = ['#38d5ff', '#38d5ff', '#ff3fa4', '#ffcb3c', '#38d5ff', '#5fe36f'];
        cols.forEach((col, i) => {
          const x = 30 + i * 44;
          const y = h - 20;
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.beginPath();
          ctx.ellipse(x, y + 5, 16, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(x, y, 16, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        drawOwl(ctx, 235, h - 18, 0.5, t);
        drawDiceBlock(ctx, 90, 52 + Math.sin(t / 200) * 5, 40, String(1 + (Math.floor(t / 400) % 10)), '#ffcb3c', t);
        drawCoin(ctx, 150, 40, 10, t, true);
      } else if (mode === 'friends') {
        // Four seats linked by a pulsing relay line.
        const lanes = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];
        const pts = [
          [60, 95],
          [125, 60],
          [180, 100],
          [245, 65],
        ];
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 8]);
        ctx.lineDashOffset = -t / 30;
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.setLineDash([]);
        pts.forEach(([x, y], i) => {
          const bob = Math.sin(t / 300 + i) * 3;
          ctx.fillStyle = '#07061a';
          ctx.beginPath();
          ctx.arc(x, y + bob, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = lanes[i];
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.fillStyle = lanes[i];
          ctx.fillRect(x - 6, y + bob - 10, 12, 10);
          ctx.fillRect(x - 9, y + bob + 1, 18, 9);
        });
        drawCrown(ctx, 150, 28, 22, t);
      } else if (mode === 'rush') {
        // Neon street: three lanes, rings sliding past, a runner bobbing along.
        const sky = ctx.createLinearGradient(0, 0, 0, 70);
        sky.addColorStop(0, '#2a1458');
        sky.addColorStop(1, '#a8366e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, 70);
        for (let i = 0; i < 10; i += 1) {
          const bh = 20 + ((i * 29) % 36);
          ctx.fillStyle = i % 2 ? '#1e1548' : '#2d1f66';
          ctx.fillRect(i * 34 - ((t / 40) % 34), 70 - bh, 30, bh);
        }
        ctx.fillStyle = '#1b1440';
        ctx.fillRect(0, 70, w, h - 70);
        for (const y of [96, 122]) {
          ctx.strokeStyle = 'rgba(255,230,160,0.5)';
          ctx.setLineDash([16, 12]);
          ctx.lineDashOffset = t / 12;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        for (let i = 0; i < 6; i += 1) {
          const x = w - (((t / 5 + i * 60) % (w + 40)) - 20);
          const lane = i % 3;
          ctx.strokeStyle = ['#46e6ff', '#e86bff', '#ffc94d'][lane];
          ctx.lineWidth = 3;
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.ellipse(x, 84 + lane * 26, 5, 13, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        const bob = Math.abs(Math.sin(t / 150)) * 6;
        ctx.fillStyle = '#38f2ff';
        ctx.fillRect(66, 92 - bob, 12, 22);
        ctx.fillStyle = '#faf6ee';
        ctx.fillRect(68, 84 - bob, 8, 8);
        ctx.fillStyle = 'rgba(56,242,255,0.5)';
        ctx.fillRect(18, 100 - bob, 48, 4);
      } else {
        // Vault doors, ring and falling capsules.
        ctx.strokeStyle = '#38f2ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 14, 100, 60);
        ctx.strokeStyle = '#ff3fd2';
        ctx.strokeRect(160, 14, 100, 60);
        ctx.strokeStyle = '#7cff6b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(150, 118, 60, 16, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i += 1) {
          const x = 60 + i * 60;
          const y = ((t / 6 + i * 60) % 150) - 10;
          ctx.fillStyle = i === 2 ? '#ffc531' : '#38c8ff';
          ctx.beginPath();
          ctx.roundRect(x - 7, y - 10, 14, 20, 7);
          ctx.fill();
          ctx.strokeStyle = '#07061a';
          ctx.stroke();
        }
        drawCrown(ctx, 150, 60, 26, t);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);
  return <canvas ref={ref} className="w-full rounded-lg border-2" style={{ aspectRatio: '2 / 1', borderColor: ESPRESSO }} />;
}

function Hub({ onPick, onBack, t }: { onPick: (m: Mode) => void; onBack: () => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 20%, #2a1d5c 0%, #07061a 70%)' }}>
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{t('lokParty.hub.pick')}</h1>
        </div>
        <div className="grid w-full max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['blitz', 'friends', 'rush', 'drop'] as Mode[]).map((m) => (
            <CreamCard key={m}>
              <ModePreview mode={m} />
              <div className="mt-3 text-xl font-black">{m === 'blitz' ? t('lokParty.hub.blitzTitle') : m === 'friends' ? t('lokParty.hub.friendsTitle') : m === 'rush' ? t('lokParty.rush.title') : t('lokParty.drop.title')}</div>
              <p className="mt-1 text-sm opacity-80">{m === 'blitz' ? t('lokParty.hub.blitzPitch') : m === 'friends' ? t('lokParty.hub.friendsPitch') : m === 'rush' ? t('lokParty.rush.hubPitch') : t('lokParty.hub.dropPitch')}</p>
              <button type="button" onPointerDown={() => onPick(m)} className="mt-3 w-full rounded-xl border-[3px] py-3 text-base font-black active:translate-y-[3px]" style={{ background: m === 'blitz' ? '#ffcf3c' : m === 'friends' ? '#38f2ff' : m === 'rush' ? '#ff8fe6' : '#7cff6b', borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 3px 0 ${ESPRESSO}` }}>
                {t('lokParty.hub.play')}
              </button>
            </CreamCard>
          ))}
        </div>
        <button type="button" onPointerDown={onBack} className="rounded-lg border border-white/30 px-5 py-2 text-sm font-bold">
          {t('lokParty.drop.back')}
        </button>
      </div>
    </div>
  );
}
