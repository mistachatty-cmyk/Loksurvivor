/**
 * LokDropScreen -- the playable 60-second Lok Drop prototype (Lok Party Slice 1).
 *
 * 1 player + 3 bots, 2.5D front-facing vault floor (camera tilt, depth scale, z lift), the
 * juiceEngine on every hit, and the lokparty.meta.v1 report at the end.
 *
 * Art rule: every character is our own procedural rig (drawRig). The Drive reference images
 * only informed the camera tilt, wet-asphalt lighting, ring colors and the minimal top HUD.
 */

import { press } from './press';
import { useEffect, useRef } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { useT } from '@/lib/i18n';
import { MinigameStage } from './MinigameStage';
import { RingRushArena } from './RingRushArena';
import { CARTRIDGES, PRACTICE_ORDER, isKitGame } from './cartridges';
import {
  drawCrown,
  drawDiceBlock,
  drawOwl,
  drawCoin,
} from './boardArt';
import { botSkillsForTier, type DropState } from './lokDrop';
import {
  COSMETICS_BY_ID,
  ladderLabel,
  passTier,
  type LokPartyMeta,
  type MatchReport,
  type Shard,
} from './lokPartyMeta';
import { CREAM, ESPRESSO, Mode, PracticeGame, ROSTER_IDS, RigPreview, Standing, seatOrder } from './dropShared';


export function CreamCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border-2 p-4 ${className}`} style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 4px 0 ${ESPRESSO}` }}>
      {children}
    </div>
  );
}

/** Race lengths in the lobby: short, standard, long (a long relic hunt is a long evening). */
export const RACE_TARGETS = { crowns: [2, 3, 5], relics: [3, 5, 8] } as const;

export function Lobby({ mode, rounds, setRounds, goalKind, setGoalKind, raceLen, setRaceLen, pick, setPick, meta, onStart, onBack, t }: { mode: Mode; rounds: number; setRounds: (n: number) => void; raceLen: number; setRaceLen: (n: number) => void; goalKind: 'rounds' | 'crowns' | 'relics'; setGoalKind: (k: 'rounds' | 'crowns' | 'relics') => void; pick: string; setPick: (id: string) => void; meta: LokPartyMeta; onStart: () => void; onBack: () => void; t: ReturnType<typeof useT> }) {
  const touch = typeof window !== 'undefined' && 'ontouchstart' in window;
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 30%, #1d1450 0%, #07061a 70%)' }}>
     <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{mode === 'blitz' ? t('lokParty.hub.blitzTitle') : t('lokParty.drop.title')}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/75">{mode === 'blitz' ? t('lokParty.hub.blitzPitch') : t('lokParty.drop.pitch')}</p>
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
                {...press(() => setPick(id))}
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
            <div className="mb-1 text-xs font-bold uppercase tracking-widest">{t('lokParty.board.goal')}</div>
            <div className="mb-3 grid grid-cols-3 gap-2">
              {(['rounds', 'crowns', 'relics'] as const).map((k) => (
                <button key={k} type="button" {...press(() => setGoalKind(k))} aria-pressed={goalKind === k} className="rounded-lg border-2 py-2 text-xs font-black" style={{ borderColor: ESPRESSO, background: goalKind === k ? '#ffcf3c' : 'transparent' }}>
                  {t(k === 'rounds' ? 'lokParty.board.goalRounds' : k === 'crowns' ? 'lokParty.board.goalRaceCrowns' : 'lokParty.board.goalRaceRelics')}
                </button>
              ))}
            </div>
            <div className="mb-2 text-[11px] opacity-70">{t('lokParty.board.goalHelp')}</div>
            {goalKind !== 'rounds' ? (
              <div className="mb-1 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <button key={i} type="button" {...press(() => setRaceLen(i))} aria-pressed={raceLen === i} className="rounded-lg border-2 py-2 text-xs font-black" style={{ borderColor: ESPRESSO, background: raceLen === i ? '#ffcf3c' : 'transparent' }}>
                    {t(goalKind === 'crowns' ? 'lokParty.board.goalCrowns' : 'lokParty.board.goalRelics', { count: RACE_TARGETS[goalKind][i] })}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-1 text-xs font-bold uppercase tracking-widest">{t('lokParty.board.length')}</div>
            )}
            <div className={goalKind === 'rounds' ? 'grid grid-cols-3 gap-2' : 'hidden'}>
              {[5, 10, 15].map((n) => (
                <button key={n} type="button" {...press(() => setRounds(n))} className="rounded-lg border-2 py-2 text-sm font-black" style={{ borderColor: ESPRESSO, background: rounds === n ? '#ffcf3c' : 'transparent' }}>
                  {t('lokParty.board.rounds', { count: n })}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="mt-3 text-xs opacity-80">{t('lokParty.results.ladder', { ladder: t('lokParty.ladder.solo'), rank: ladderLabel(meta.ladders.solo) })}</div>
        <div className="text-xs opacity-80">{t('lokParty.results.pass', { tier: passTier(meta.pass.xp) })}</div>
      </CreamCard>
      <p className="text-xs text-white/60">{touch ? t('lokParty.drop.controlsTouch') : t('lokParty.drop.controlsKeys')}</p>
      <div className="flex gap-3">
        <button type="button" {...press(onBack)} className="rounded-lg border border-white/30 px-5 py-3 text-sm font-bold">
          {t('lokParty.drop.back')}
        </button>
        <button type="button" {...press(onStart)} className="rounded-lg px-8 py-3 text-base font-black text-black" style={{ background: '#7cff6b', boxShadow: '0 0 24px #7cff6b88' }}>
          {t('lokParty.drop.start')}
        </button>
      </div>
     </div>
    </div>
  );
}

// ------------------------------------------------------------------ results

export interface ReportData {
  report: MatchReport;
  placement: number;
  players: number;
  banked?: number;
  standings?: Standing[];
  unranked?: boolean;
}

export function Results({
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
    data.unranked ? t('lokParty.results.unranked') : `${t('lokParty.results.ladder', { ladder: t('lokParty.ladder.solo'), rank: ladderLabel(r.lpAfter) })} (${r.lpChange >= 0 ? '+' : ''}${t('lokParty.results.lp', { lp: r.lpChange })})`,
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
          <button type="button" {...press(onCrack)} className="mt-3 flex w-full flex-col items-center gap-1 rounded-xl border-2 p-3 active:scale-95" style={{ borderColor: ESPRESSO, background: '#1a1238' }}>
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
          <button type="button" {...press(onBack)} className="flex-1 rounded-lg border-2 py-3 text-sm font-bold" style={{ borderColor: ESPRESSO }}>
            {t('lokParty.drop.back')}
          </button>
          <button type="button" {...press(onAgain)} className="flex-1 rounded-lg py-3 text-sm font-black text-black" style={{ background: '#7cff6b' }}>
            {t('lokParty.results.again')}
          </button>
        </div>
      </CreamCard>
    </div>
  );
}

/** Original Gold L capsule glyph (SVG, no emoji, no stock icon). */
export function CapsuleGlyph() {
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
  ladderTier: number;
}


export function ModePreview({ mode }: { mode: Mode }) {
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

/** A single minigame from the menu, against bots, with no rewards. */
export function PracticeRun({ game, seed, pick, tier, getAudioContext, onDone }: { game: PracticeGame; seed: number; pick: string; tier: number; getAudioContext: () => AudioContext | null; onDone: () => void }) {
  const seats = seatOrder(pick).map((id, i) => ({ characterId: id, bot: i !== 0, botSkill: [0, ...botSkillsForTier(tier)][i] }));
  return game !== 'rush' && isKitGame(game) ? (
    <MinigameStage cartridge={CARTRIDGES[game]} seed={seed} seats={seats} getAudioContext={getAudioContext} onDone={onDone} />
  ) : (
    <RingRushArena seed={seed} roster={seats} getAudioContext={getAudioContext} onDone={onDone} />
  );
}

export function Hub({ onPractice, missions, vault, onCrack, onVault, onPick, onBack, t }: { onVault: () => void; onPractice: (g: PracticeGame) => void; missions: LokPartyMeta['weekly']['missions']; vault: LokPartyMeta['vault']; onCrack: () => void; onPick: (m: Mode) => void; onBack: () => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 20%, #2a1d5c 0%, #07061a 70%)' }}>
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
        <div className="text-center">
          <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{t('lokParty.hub.pick')}</h1>
        </div>
        <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          {(['blitz', 'friends', 'drop'] as Mode[]).map((m) => (
            <CreamCard key={m}>
              <ModePreview mode={m} />
              <div className="mt-3 text-xl font-black">{m === 'blitz' ? t('lokParty.hub.blitzTitle') : m === 'friends' ? t('lokParty.hub.friendsTitle') : t('lokParty.drop.title')}</div>
              <p className="mt-1 text-sm opacity-80">{m === 'blitz' ? t('lokParty.hub.blitzPitch') : m === 'friends' ? t('lokParty.hub.friendsPitch') : t('lokParty.hub.dropPitch')}</p>
              <button type="button" {...press(() => onPick(m))} className="mt-3 w-full rounded-xl border-[3px] py-3 text-base font-black active:translate-y-[3px]" style={{ background: m === 'blitz' ? '#ffcf3c' : m === 'friends' ? '#38f2ff' : '#7cff6b', borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 3px 0 ${ESPRESSO}` }}>
                {t('lokParty.hub.play')}
              </button>
            </CreamCard>
          ))}
        </div>
        <div className="w-full max-w-xl">
          <CreamCard>
            <div className="text-xl font-black">{t('lokParty.games.title')}</div>
            <p className="mt-1 text-sm opacity-80">{t('lokParty.games.pitch')}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRACTICE_ORDER.map((g) => (
                <button key={g} type="button" {...press(() => onPractice(g))} className="rounded-xl border-[3px] px-1 py-3 text-sm font-black leading-tight active:translate-y-[3px]" style={{ background: g === 'rumble' ? '#ff3fd2' : g === 'collapse' ? '#ffd23f' : '#38f2ff', borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 3px 0 ${ESPRESSO}` }}>
                  {g === 'rush' ? t('lokParty.rush.title') : CARTRIDGES[g].labels(t).title}
                </button>
              ))}
            </div>
          </CreamCard>
        </div>
        {missions.length ? (
          <div className="w-full max-w-xs">
            <CreamCard>
              <div className="text-sm font-black">{t('lokParty.missions.title')}</div>
              {missions.map((m) => {
                const done = Math.min(m.progress, m.target);
                return (
                  <div key={m.id} className="mt-2">
                    <div className="flex justify-between gap-2 text-xs font-bold">
                      <span>{t(`lokParty.missions.${m.id}`, { target: m.target })}</span>
                      <span>{done >= m.target ? t('lokParty.missions.done') : `${done}/${m.target}`}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: '#e4d8c0' }}>
                      <div className="h-full" style={{ width: `${(100 * done) / m.target}%`, background: done >= m.target ? '#3fbf4a' : '#ff9f2e' }} />
                    </div>
                  </div>
                );
              })}
            </CreamCard>
          </div>
        ) : null}
        {/* A capsule saved from an earlier match can be opened here, not only on its results screen. */}
        {vault.capsules > 0 && vault.keys > 0 ? (
          <button type="button" {...press(onCrack)} className="flex w-full max-w-xs flex-col items-center gap-1 rounded-xl border-2 border-amber-300/60 p-3 active:scale-95" style={{ background: '#1a1238' }}>
            <CapsuleGlyph />
            <span className="text-xs font-bold text-amber-200">{t('lokParty.results.crack')}</span>
            <span className="text-xs opacity-70">{t('lokParty.results.vault', { capsules: vault.capsules, keys: vault.keys, shards: vault.shards.length })}</span>
          </button>
        ) : null}
        <button type="button" {...press(onVault)} className="rounded-xl border-2 border-fuchsia-300/60 px-5 py-2 text-sm font-black" style={{ background: '#1a1238' }}>
          {t('lokParty.vault.open', { n: vault.shards.length })}
        </button>
        <button type="button" {...press(onBack)} className="rounded-lg border border-white/30 px-5 py-2 text-sm font-bold">
          {t('lokParty.drop.back')}
        </button>
      </div>
    </div>
  );
}

