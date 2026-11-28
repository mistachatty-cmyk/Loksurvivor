/**
 * LokDropScreen -- the playable 60-second Lok Drop prototype (Lok Party Slice 1).
 *
 * 1 player + 3 bots, 2.5D front-facing vault floor (camera tilt, depth scale, z lift), the
 * juiceEngine on every hit, and the lokparty.meta.v1 report at the end.
 *
 * Art rule: every character is our own procedural rig (drawRig). The Drive reference images
 * only informed the camera tilt, wet-asphalt lighting, ring colors and the minimal top HUD.
 */

import './partyHaptics';
import { useCallback, useState } from 'react';
import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { useMeta } from '@/game/state/metaStore';
import { useT } from '@/lib/i18n';
import { CapsulePullOverlay } from './CapsulePullOverlay';
import { BoardScreen } from './BoardScreen';
import { PartyLobby } from './PartyLobby';
import { VaultScreen } from './VaultScreen';
import type { OnlineSession } from './partyNet';
import { boardStandings, encodeGoal, type BoardState } from './lokBoard';
import { dropPerformance, dropResults, type DropState } from './lokDrop';
import {
  applyMatch,
  loadLokPartyMeta,
  markGrantPaid,
  openCapsule,
  pendingGrants,
  refreshTimers,
  saveLokPartyMeta,
  type LokPartyMeta,
  type Shard,
} from './lokPartyMeta';
import { Mode, Phase, PracticeGame, ROSTER_IDS, inviteCode, storage } from './dropShared';
import { DropArena } from './DropArena';
import { Hub, Lobby, PracticeRun, RACE_TARGETS, ReportData, Results } from './LobbyScreens';


export function LokDropScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { ensureAudioContext, getAudioContext } = useMusicPlayer();
  const { claimLokPartyGrant } = useMeta();
  const [joinCode] = useState(inviteCode);
  const [phase, setPhase] = useState<Phase>(() => (inviteCode() ? 'online' : 'hub'));
  const [mode, setMode] = useState<Mode>(() => (inviteCode() ? 'friends' : 'blitz'));
  const [online, setOnline] = useState<OnlineSession | null>(null);
  const [rounds, setRounds] = useState(10);
  const [goalKind, setGoalKind] = useState<'rounds' | 'crowns' | 'relics'>('rounds');
  const [raceLen, setRaceLen] = useState(1);
  const goalCode = goalKind === 'crowns' ? encodeGoal({ kind: 'crowns', target: RACE_TARGETS.crowns[raceLen] }, rounds) : goalKind === 'relics' ? encodeGoal({ kind: 'relics', target: RACE_TARGETS.relics[raceLen] }, rounds) : rounds;
  const [pick, setPick] = useState<string>(ROSTER_IDS[0]);
  const [meta, setMeta] = useState<LokPartyMeta>(() => loadLokPartyMeta(storage()));
  const [report, setReport] = useState<ReportData | null>(null);
  const [shards, setShards] = useState<Shard[] | null>(null);
  const [pulling, setPulling] = useState<Shard[] | null>(null);
  const [seed, setSeed] = useState(() => (Date.now() ^ 0x616) >>> 0);
  const [practice, setPractice] = useState<PracticeGame>('rumble');

  const startMatch = useCallback(() => {
    ensureAudioContext();
    void getAudioContext()?.resume?.();
    setSeed((s) => (s * 1664525 + 1013904223) >>> 0);
    setReport(null);
    setShards(null);
    setOnline(null);
    setPhase(mode === 'drop' ? 'play' : 'board');
  }, [ensureAudioContext, getAudioContext, mode]);

  const settle = useCallback(
    (perf: Parameters<typeof applyMatch>[1], seedUsed: number, extra: Omit<ReportData, 'report'>, ranked = true) => {
      let { meta: next, report: rep } = applyMatch(meta, perf, { nowMs: Date.now(), seed: seedUsed, ladder: 'solo', ranked });
      // One-way bridge: 616 pays through its own capped path; Party just marks it delivered.
      for (const g of pendingGrants(next, 'survivor616')) {
        claimLokPartyGrant(g.id, g.amount);
        next = markGrantPaid(next, g.id);
      }
      saveLokPartyMeta(storage(), next);
      setMeta(next);
      setReport({ report: rep, unranked: !ranked, ...extra });
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

  const finishBoard = useCallback(
    (s: BoardState, localSeat: number) => {
      const standings = boardStandings(s);
      const me = s.players[localSeat];
      const place = standings.find((r) => r.index === localSeat)?.place ?? 4;
      const totalCrowns = s.players.reduce((n, p) => n + p.crowns, 0) || 1;
      const rounds = Math.max(1, s.goal.kind === 'rounds' ? s.maxRounds : Math.min(s.round, s.maxRounds));
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
        // Friends' results cannot be checked yet, so online parties never move a rank.
        !online,
      );
    },
    [settle, online],
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
      {phase === 'practice' ? (
        <PracticeRun key={`${practice}-${seed}`} game={practice} seed={seed} pick={pick} tier={meta.ladders.solo.tier} getAudioContext={getAudioContext} onDone={() => setPhase('hub')} />
      ) : null}
      {phase === 'hub' ? (
        <Hub
          onPractice={(g) => {
            ensureAudioContext();
            setPractice(g);
            setSeed((Date.now() ^ 0x616) >>> 0);
            setPhase('practice');
          }}
          missions={refreshTimers(meta, Date.now()).weekly.missions}
          vault={meta.vault}
          onCrack={crack}
          onVault={() => setPhase('vault')}
          onPick={(m) => {
            setMode(m);
            setPhase(m === 'friends' ? 'online' : 'lobby');
          }}
          onBack={onBack}
          t={t}
        />
      ) : null}
      {phase === 'vault' ? (
        <VaultScreen
          meta={meta}
          onChange={(m) => {
            saveLokPartyMeta(storage(), m);
            setMeta(m);
          }}
          onBack={() => setPhase('hub')}
        />
      ) : null}
      {phase === 'online' ? (
        <PartyLobby
          characterId={pick}
          rounds={goalCode}
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
          rounds={goalCode}
          seed={seed}
          online={online ?? undefined}
          ladderTier={meta.ladders.solo.tier}
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
        <Lobby mode={mode} rounds={rounds} setRounds={setRounds} goalKind={goalKind} setGoalKind={setGoalKind} raceLen={raceLen} setRaceLen={setRaceLen} pick={pick} setPick={setPick} meta={meta} onStart={startMatch} onBack={() => setPhase('hub')} t={t} />
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
      {pulling ? (
        <CapsulePullOverlay
          characterId={pick}
          shards={pulling}
          getAudioContext={getAudioContext}
          onDone={() => {
            // Only a results screen lists what dropped; the hub just shows the new vault count.
            if (phase !== 'hub') setShards(pulling);
            setPulling(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ lobby

