import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Trophy,
  Swords,
  Shield,
  Zap,
  Sparkles,
  Heart,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  Flame,
  Snowflake,
  Clock,
  CircleDot,
  FastForward,
  Award,
  Plus,
  Play,
  CheckCircle2,
  RefreshCw,
  Gift,
  Activity,
  Bot,
} from 'lucide-react';

import { useMeta } from '@/game/state/metaStore';
import { RigPortrait } from '@/ui/RigPortrait';
import {
  LOKPET_RIGS,
  LOKPET_VARIANTS,
  LOKPET_VARIANTS_BY_ID,
} from '@/game/data/lokPets';
import {
  BATTLE_MOVES,
  BATTLE_TRINKETS,
  LEAGUE_TIERS,
  SPARRING_DUMMIES,
  getElementalMultiplier,
} from '@/game/data/lokPetBattles';
import {
  createBattle,
  executeEnemyAi,
  executeGuard,
  executeMove,
  executeSwitch,
  executeCheer,
  getExpForLevel,
} from '@/game/engine/lokPetBattle';
import type {
  BattlePet,
  BattleState,
  LeagueTierDef,
  LokPetBattleMove,
} from '@/game/engine/lokPetBattleTypes';
import type { LokPetElement, SavedLokPet } from '@/game/types';

export interface LokPetBattleScreenProps {
  onReturnToHub: () => void;
  initialTab?: 'league' | 'sparring' | 'kennel';
  initialTierId?: string;
}

export function LokPetBattleScreen({
  onReturnToHub,
  initialTab = 'sparring',
  initialTierId,
}: LokPetBattleScreenProps) {
  const {
    meta,
    recordLokPetBattleResult,
    feedLokPetTreat,
    toggleFavoriteLokPet,
    equipLokPetTrinket,
    draftStarterLokPets,
  } = useMeta();

  const [activeTab, setActiveTab] = useState<'league' | 'sparring' | 'kennel'>(initialTab);
  const [battleState, setBattleState] = useState<BattleState | null>(null);

  // Lit Corner Sparring Sandbox Config
  const [selectedDummyPreset, setSelectedDummyPreset] = useState<string>('dummy-wood');
  const [customDummyVariant, setCustomDummyVariant] = useState<string>('gyro-sentry');
  const [customDummyLevel, setCustomDummyLevel] = useState<number>(10);

  // Switch Modal
  const [showSwitchModal, setShowSwitchModal] = useState<boolean>(false);

  // Kennel Selected Pet
  const [selectedKennelPetId, setSelectedKennelPetId] = useState<string | null>(
    meta.savedLokPets[0]?.id || null,
  );

  // Canvas VFX Overlay Ref
  const vfxCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-draft starter companions if player has none yet
  useEffect(() => {
    if (meta.savedLokPets.length === 0) {
      draftStarterLokPets();
    }
  }, [meta.savedLokPets.length, draftStarterLokPets]);

  // If initialTierId is passed, launch that battle immediately
  useEffect(() => {
    if (initialTierId && !battleState) {
      const tier = LEAGUE_TIERS.find((t) => t.id === initialTierId);
      if (tier) {
        startLeagueBattle(tier);
      }
    }
  }, [initialTierId]);

  // Turn orchestration: AI turn delay
  useEffect(() => {
    if (!battleState || battleState.phase !== 'select-action') return;
    if (battleState.currentTurnActor === 'enemy') {
      const delay = Math.max(350, 750 / battleState.battleSpeed);
      const timer = setTimeout(() => {
        setBattleState((prev) => {
          if (!prev || prev.currentTurnActor !== 'enemy' || prev.phase !== 'select-action') return prev;
          return executeEnemyAi(prev);
        });
      }, delay);
      return () => clearTimeout(timer);
    } else if (battleState.autoBattle && battleState.currentTurnActor === 'player') {
      // Auto-battle logic for player turn
      const delay = Math.max(350, 650 / battleState.battleSpeed);
      const timer = setTimeout(() => {
        setBattleState((prev) => {
          if (!prev || prev.currentTurnActor !== 'player' || prev.phase !== 'select-action') return prev;
          const activePet = prev.playerTeam[prev.activePlayerIndex];
          if (!activePet) return prev;
          // Priority: Ultimate if ready, otherwise elemental skill, otherwise basic strike
          const ult = activePet.moves.find((m) => m.kind === 'ultimate' && activePet.energy >= m.energyCost);
          if (ult) return executeMove(prev, ult.id, 'player');
          const skill = activePet.moves.find((m) => m.kind === 'skill' && activePet.energy >= m.energyCost);
          if (skill) return executeMove(prev, skill.id, 'player');
          return executeMove(prev, activePet.moves[0].id, 'player');
        });
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [battleState]);

  // Canvas VFX Rendering
  useEffect(() => {
    const canvas = vfxCanvasRef.current;
    if (!canvas || !battleState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const renderVfx = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();

      // Render Active Move VFX Animation
      if (battleState.activeAnimation?.active) {
        const anim = battleState.activeAnimation;
        const elapsed = now - anim.startedAt;
        const progress = Math.min(1, elapsed / anim.durationMs);

        if (progress < 1) {
          const targetX = anim.target === 'enemy' ? canvas.width * 0.72 : canvas.width * 0.28;
          const targetY = canvas.height * 0.45;

          ctx.save();
          if (anim.animKind === 'strike' || anim.animKind === 'claw') {
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(targetX - 40 * (1 - progress), targetY - 40 * (1 - progress));
            ctx.lineTo(targetX + 40 * progress, targetY + 40 * progress);
            ctx.stroke();

            ctx.strokeStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(targetX + 35 * (1 - progress), targetY - 35 * (1 - progress));
            ctx.lineTo(targetX - 35 * progress, targetY + 35 * progress);
            ctx.stroke();
          } else if (anim.animKind === 'burst') {
            const rad = progress * 60;
            ctx.fillStyle = `rgba(249, 115, 22, ${1 - progress})`;
            ctx.beginPath();
            ctx.arc(targetX, targetY, rad, 0, Math.PI * 2);
            ctx.fill();
          } else if (anim.animKind === 'beam') {
            const sourceX = anim.attacker === 'player' ? canvas.width * 0.28 : canvas.width * 0.72;
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 14 * Math.sin(progress * Math.PI);
            ctx.shadowColor = '#0284c7';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(sourceX, targetY);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
          } else if (anim.animKind === 'meteor') {
            const currentY = targetY - (1 - progress) * 120;
            ctx.fillStyle = '#f97316';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(targetX, currentY, 20 + progress * 25, 0, Math.PI * 2);
            ctx.fill();
          } else if (anim.animKind === 'heal') {
            ctx.fillStyle = `rgba(74, 222, 128, ${0.8 - progress * 0.8})`;
            ctx.beginPath();
            ctx.arc(targetX, targetY, progress * 70, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      // Render Floating Combat Numbers
      if (battleState.floatingTexts.length > 0) {
        for (const ft of battleState.floatingTexts) {
          const age = now - ft.createdAt;
          if (age < 1200) {
            const progress = age / 1200;
            const baseX = ft.target === 'enemy' ? canvas.width * 0.72 : canvas.width * 0.28;
            const y = canvas.height * 0.4 - progress * 40;
            const alpha = 1 - progress;

            ctx.save();
            ctx.font = 'bold 16px "Plus Jakarta Sans", monospace';
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = alpha;
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, baseX, y);
            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(renderVfx);
    };

    renderVfx();
    return () => cancelAnimationFrame(animId);
  }, [battleState]);

  // Start League Battle
  const startLeagueBattle = (tier: LeagueTierDef) => {
    const battle = createBattle({
      gameMode: 'league',
      tierDef: tier,
      playerPets: meta.savedLokPets,
    });
    setBattleState(battle);
  };

  // Start Sparring Match
  const startSparringBattle = () => {
    let dummyVariant = customDummyVariant;
    let dummyLvl = customDummyLevel;

    const preset = SPARRING_DUMMIES.find((d) => d.id === selectedDummyPreset);
    if (preset) {
      dummyVariant = preset.variantId;
      dummyLvl = preset.level;
    }

    const battle = createBattle({
      gameMode: 'sparring',
      playerPets: meta.savedLokPets,
      dummyCustomVariant: dummyVariant,
      dummyLevel: dummyLvl,
    });
    setBattleState(battle);
  };

  // Claim Rewards & Finish
  const handleClaimVictory = () => {
    if (!battleState || !battleState.rewards) return;
    const winningIds = battleState.playerTeam.map((p) => p.originalSavedPetId).filter(Boolean) as string[];
    recordLokPetBattleResult(battleState.rewards, winningIds);
    setBattleState(null);
  };

  // Renders Elemental Badge
  const renderElementBadge = (element: LokPetElement) => {
    switch (element) {
      case 'fire':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-orange-500/50 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-orange-300">
            <Flame className="h-3 w-3" /> Fire
          </span>
        );
      case 'freeze':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-cyan-500/50 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
            <Snowflake className="h-3 w-3" /> Freeze
          </span>
        );
      case 'slow':
        return (
          <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
            <Clock className="h-3 w-3" /> Chrono
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded border border-slate-500/50 bg-slate-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
            <CircleDot className="h-3 w-3" /> Kinetic
          </span>
        );
    }
  };

  // Active Battle Screen View
  if (battleState) {
    const activePlayerPet = battleState.playerTeam[battleState.activePlayerIndex];
    const activeEnemyPet = battleState.enemyTeam[battleState.activeEnemyIndex];
    const isPlayerTurn = battleState.currentTurnActor === 'player' && battleState.phase === 'select-action';

    const playerRigFactory = LOKPET_RIGS[activePlayerPet.silhouette];
    const playerRig = playerRigFactory ? playerRigFactory() : null;

    const enemyRigFactory = LOKPET_RIGS[activeEnemyPet.silhouette];
    const enemyRig = enemyRigFactory ? enemyRigFactory() : null;

    const isVictory = battleState.phase === 'victory';
    const isDefeat = battleState.phase === 'defeat';

    return (
      <div className="relative flex min-h-[100dvh] flex-col bg-slate-950 text-slate-100">
        {/* Top Battle Header */}
        <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setBattleState(null)}
              className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" /> Forfeit / Exit
            </button>
            <span className="h-4 w-px bg-slate-800" />
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Round {battleState.turn} · {battleState.gameMode === 'league' ? 'Sanctum League' : 'Sparring Dojo'}
            </span>
          </div>

          {/* Speed & Auto Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setBattleState((prev) =>
                  prev ? { ...prev, battleSpeed: prev.battleSpeed === 1 ? 2 : prev.battleSpeed === 2 ? 3 : 1 } : prev,
                )
              }
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-slate-300 hover:border-slate-500"
              title="Battle Animation Speed"
            >
              <FastForward className="h-3.5 w-3.5 text-cyan-400" /> {battleState.battleSpeed}x Speed
            </button>

            <button
              type="button"
              onClick={() =>
                setBattleState((prev) => (prev ? { ...prev, autoBattle: !prev.autoBattle } : prev))
              }
              className={`flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-mono font-bold transition ${
                battleState.autoBattle
                  ? 'border-emerald-500 bg-emerald-950/80 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="h-3.5 w-3.5" /> Auto: {battleState.autoBattle ? 'ON' : 'OFF'}
            </button>
          </div>
        </header>

        {/* The Battle Stage */}
        <div className="relative flex flex-1 flex-col items-center justify-between p-6">
          {/* Canvas VFX Layer */}
          <canvas
            ref={vfxCanvasRef}
            width={900}
            height={420}
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          />

          {/* Arena Background Grid & Lighting */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black opacity-80" />
          <div className="absolute inset-x-0 bottom-1/4 h-32 bg-gradient-to-t from-cyan-950/20 via-transparent to-transparent" />

          {/* Combatants Display */}
          <div className="relative z-10 grid w-full max-w-5xl flex-1 grid-cols-1 items-center gap-8 md:grid-cols-2">
            {/* Player Active Companion Card */}
            <div className="flex flex-col items-center rounded-xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm md:items-start">
              <div className="flex w-full items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-white">{activePlayerPet.name}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-cyan-400">
                      Lv.{activePlayerPet.level}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {renderElementBadge(activePlayerPet.element)}
                    <span className="font-mono text-[10px] text-slate-400 uppercase">{activePlayerPet.rarity}</span>
                  </div>
                </div>

                {/* Team Bench Icons */}
                <div className="flex gap-1">
                  {battleState.playerTeam.map((p, i) => (
                    <div
                      key={p.id}
                      className={`h-3 w-3 rounded-full border ${
                        p.fainted
                          ? 'border-slate-700 bg-slate-800 opacity-40'
                          : i === battleState.activePlayerIndex
                          ? 'border-cyan-400 bg-cyan-500 shadow-sm'
                          : 'border-emerald-500/70 bg-emerald-500/30'
                      }`}
                      title={`${p.name} (HP: ${p.hp}/${p.maxHp})`}
                    />
                  ))}
                </div>
              </div>

              {/* HP Bar */}
              <div className="mt-4 w-full">
                <div className="flex justify-between font-mono text-xs font-semibold">
                  <span className="text-slate-400">VITALITY (HP)</span>
                  <span className="text-white">
                    {activePlayerPet.hp} / {activePlayerPet.maxHp}
                  </span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, (activePlayerPet.hp / activePlayerPet.maxHp) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* SP Energy Bar */}
              <div className="mt-2.5 w-full">
                <div className="flex justify-between font-mono text-xs font-semibold">
                  <span className="text-slate-400">SPECIAL ENERGY (SP)</span>
                  <span className={activePlayerPet.energy >= 80 ? 'text-amber-300 font-bold animate-pulse' : 'text-cyan-300'}>
                    {activePlayerPet.energy} / {activePlayerPet.maxEnergy}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
                  <div
                    className={`h-full transition-all duration-300 ${
                      activePlayerPet.energy >= 80
                        ? 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_10px_#facc15]'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, (activePlayerPet.energy / activePlayerPet.maxEnergy) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Sprite Visual Stage */}
              <div className="relative mt-4 flex h-36 w-full items-center justify-center">
                {activePlayerPet.isGuarding && (
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/80 bg-cyan-400/10 shadow-[0_0_20px_#38bdf8] animate-pulse" />
                )}
                {playerRig && (
                  <RigPortrait
                    rig={playerRig}
                    palette={activePlayerPet.palette}
                    anim={activePlayerPet.isGuarding ? 'walk' : 'idle'}
                    size={110}
                    className="drop-shadow-lg filter transition-transform"
                  />
                )}
              </div>

              {/* Active Status Effects */}
              {activePlayerPet.statusEffects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activePlayerPet.statusEffects.map((e, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono uppercase text-cyan-300 border border-cyan-500/40"
                    >
                      {e.type} ({e.duration}r)
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Enemy Companion Card */}
            <div className="flex flex-col items-center rounded-xl border border-red-500/30 bg-slate-900/80 p-5 shadow-lg backdrop-blur-sm md:items-end">
              <div className="flex w-full items-center justify-between">
                {/* Team Bench Icons */}
                <div className="flex gap-1">
                  {battleState.enemyTeam.map((p, i) => (
                    <div
                      key={p.id}
                      className={`h-3 w-3 rounded-full border ${
                        p.fainted
                          ? 'border-slate-700 bg-slate-800 opacity-40'
                          : i === battleState.activeEnemyIndex
                          ? 'border-red-400 bg-red-500 shadow-sm'
                          : 'border-red-500/70 bg-red-500/30'
                      }`}
                      title={`${p.name} (HP: ${p.hp}/${p.maxHp})`}
                    />
                  ))}
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-red-400">
                      Lv.{activeEnemyPet.level}
                    </span>
                    <span className="font-bold text-lg text-white">{activeEnemyPet.name}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 justify-end">
                    <span className="font-mono text-[10px] text-slate-400 uppercase">{activeEnemyPet.rarity}</span>
                    {renderElementBadge(activeEnemyPet.element)}
                  </div>
                </div>
              </div>

              {/* Enemy HP Bar */}
              <div className="mt-4 w-full">
                <div className="flex justify-between font-mono text-xs font-semibold">
                  <span className="text-slate-400">VITALITY (HP)</span>
                  <span className="text-white">
                    {activeEnemyPet.hp} / {activeEnemyPet.maxHp}
                  </span>
                </div>
                <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, (activeEnemyPet.hp / activeEnemyPet.maxHp) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Enemy SP Energy Bar */}
              <div className="mt-2.5 w-full">
                <div className="flex justify-between font-mono text-xs font-semibold">
                  <span className="text-slate-400">SPECIAL ENERGY (SP)</span>
                  <span className="text-red-300 font-mono">
                    {activeEnemyPet.energy} / {activeEnemyPet.maxEnergy}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, (activeEnemyPet.energy / activeEnemyPet.maxEnergy) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Sprite Visual Stage */}
              <div className="relative mt-4 flex h-36 w-full items-center justify-center">
                {activeEnemyPet.isGuarding && (
                  <div className="absolute inset-0 rounded-full border-2 border-red-400/80 bg-red-400/10 shadow-[0_0_20px_#ef4444] animate-pulse" />
                )}
                {enemyRig && (
                  <RigPortrait
                    rig={enemyRig}
                    palette={activeEnemyPet.palette}
                    anim={activeEnemyPet.isGuarding ? 'walk' : 'idle'}
                    size={110}
                    className="drop-shadow-lg filter transition-transform [transform:scaleX(-1)]"
                  />
                )}
              </div>

              {/* Active Enemy Status Effects */}
              {activeEnemyPet.statusEffects.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activeEnemyPet.statusEffects.map((e, idx) => (
                    <span
                      key={idx}
                      className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[9px] font-mono uppercase text-red-300 border border-red-500/40"
                    >
                      {e.type} ({e.duration}r)
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Command Bar & Combat Log */}
          <div className="relative z-20 mt-6 grid w-full max-w-5xl grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
            {/* Action Buttons Panel */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                  {isPlayerTurn ? 'Choose Action' : 'Opponent Turn...'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isPlayerTurn}
                    onClick={() => setBattleState((prev) => (prev ? executeGuard(prev) : prev))}
                    className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
                    title="Guard: Reduce incoming damage and gain +25 SP"
                  >
                    <Shield className="h-3.5 w-3.5 text-cyan-400" /> Guard (+25 SP)
                  </button>

                  <button
                    type="button"
                    disabled={!isPlayerTurn || battleState.playerTeam.length <= 1}
                    onClick={() => setShowSwitchModal(true)}
                    className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-40"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-emerald-400" /> Switch Pet
                  </button>

                  <button
                    type="button"
                    disabled={!isPlayerTurn || !battleState.cheerAvailable}
                    onClick={() => setBattleState((prev) => (prev ? executeCheer(prev) : prev))}
                    className="flex items-center gap-1.5 rounded border border-pink-500/40 bg-pink-950/40 px-3 py-1.5 text-xs font-semibold text-pink-300 transition hover:bg-pink-900/60 disabled:opacity-40"
                    title="Once per battle: +35% HP, +40 SP, +30% Attack boost!"
                  >
                    <Heart className="h-3.5 w-3.5 text-pink-400" /> Cheer (1x)
                  </button>
                </div>
              </div>

              {/* 4 Primary Moves */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {activePlayerPet.moves.map((move) => {
                  const canAfford = activePlayerPet.energy >= move.energyCost;
                  const isUltimate = move.kind === 'ultimate';
                  const elemMult = getElementalMultiplier(move.element, activeEnemyPet.element);

                  return (
                    <button
                      key={move.id}
                      type="button"
                      disabled={!isPlayerTurn || !canAfford}
                      onClick={() =>
                        setBattleState((prev) => (prev ? executeMove(prev, move.id, 'player') : prev))
                      }
                      className={`group flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                        isUltimate
                          ? canAfford
                            ? 'border-amber-400/80 bg-gradient-to-b from-amber-950/60 to-slate-900 shadow-[0_0_15px_#facc1544] hover:border-amber-300'
                            : 'border-amber-500/30 bg-slate-900/50 opacity-50'
                          : canAfford
                          ? 'border-slate-700 bg-slate-800/80 hover:border-cyan-500/80 hover:bg-slate-800'
                          : 'border-slate-800 bg-slate-900/40 opacity-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold text-xs ${isUltimate ? 'text-amber-300' : 'text-white'}`}>
                            {move.name}
                          </span>
                          <span className="font-mono text-[10px] text-cyan-400">
                            {move.energyCost > 0 ? `${move.energyCost} SP` : '+20 SP'}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] text-slate-400 leading-tight">
                          {move.description}
                        </p>
                      </div>

                      <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-1.5 font-mono text-[9px]">
                        <span className="text-slate-400">Pwr: {move.power * 100}</span>
                        {elemMult.multiplier > 1.2 && (
                          <span className="text-orange-400 font-bold">Effective!</span>
                        )}
                        <span className="text-slate-500">Acc: {move.accuracy * 100}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Combat Log Box */}
            <div className="flex h-44 flex-col rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-xl">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Combat Log
              </span>
              <div className="mt-2 flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                {battleState.combatLog.map((log) => (
                  <p
                    key={log.id}
                    className={`leading-tight ${
                      log.type === 'crit'
                        ? 'text-amber-300 font-bold'
                        : log.type === 'effective'
                        ? 'text-orange-400'
                        : log.type === 'damage'
                        ? 'text-red-300'
                        : log.type === 'status'
                        ? 'text-cyan-300'
                        : 'text-slate-400'
                    }`}
                  >
                    • {log.text}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Switch Companion Modal */}
        {showSwitchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Switch Companion</h3>
              <p className="mt-1 text-xs text-slate-400">Select an active bench teammate to take the field.</p>
              <div className="mt-4 space-y-2">
                {battleState.playerTeam.map((pet, idx) => {
                  const isCurrent = idx === battleState.activePlayerIndex;
                  return (
                    <button
                      key={pet.id}
                      type="button"
                      disabled={isCurrent || pet.fainted}
                      onClick={() => {
                        setBattleState((prev) => (prev ? executeSwitch(prev, idx) : prev));
                        setShowSwitchModal(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                        isCurrent
                          ? 'border-cyan-500 bg-cyan-950/40'
                          : pet.fainted
                          ? 'border-slate-800 bg-slate-900/50 opacity-40'
                          : 'border-slate-800 bg-slate-800/80 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{pet.name}</span>
                          <span className="text-xs font-mono text-cyan-400">Lv.{pet.level}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          {renderElementBadge(pet.element)}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className={pet.fainted ? 'text-red-400' : 'text-emerald-400'}>
                          {pet.fainted ? 'FAINTED' : `${pet.hp} / ${pet.maxHp} HP`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setShowSwitchModal(false)}
                className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-bold uppercase text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Victory / Defeat Modal */}
        {(isVictory || isDefeat) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-center">
              {isVictory ? (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                    <Trophy className="h-8 w-8 animate-bounce" />
                  </div>
                  <h2 className="mt-4 text-2xl font-black uppercase tracking-wider text-white">
                    VICTORY ACHIEVED!
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Your companion team proved victorious in the Sanctum Coliseum!
                  </p>

                  {battleState.rewards && (
                    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950 p-4 text-left">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Battle Spoils & Experience
                      </span>
                      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-center">
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                          <span className="block text-xs text-amber-300 font-bold">+{battleState.rewards.cred}</span>
                          <span className="text-[10px] text-slate-400">CRED</span>
                        </div>
                        <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-2">
                          <span className="block text-xs text-cyan-300 font-bold">+{battleState.rewards.cardCredits}</span>
                          <span className="text-[10px] text-slate-400">CARD CREDITS</span>
                        </div>
                        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                          <span className="block text-xs text-emerald-300 font-bold">+{battleState.rewards.treats}</span>
                          <span className="text-[10px] text-slate-400">TREATS</span>
                        </div>
                      </div>

                      {/* Level Ups */}
                      {battleState.rewards.levelUps.length > 0 && (
                        <div className="mt-3 border-t border-slate-800 pt-2">
                          {battleState.rewards.levelUps.map((lvl, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
                              <span>🎉 {lvl.petName} Leveled Up!</span>
                              <span>Lv.{lvl.oldLevel} → Lv.{lvl.newLevel}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Badge Earned */}
                      {battleState.rewards.badgeName && (
                        <div className="mt-3 flex items-center gap-2 rounded border border-amber-400/50 bg-amber-400/20 p-2 text-xs text-amber-200">
                          <Award className="h-4 w-4 text-amber-300" />
                          <span>Sanctum Badge Awarded: <strong>{battleState.rewards.badgeName}</strong></span>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleClaimVictory}
                    className="mt-6 w-full rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 py-3 font-bold uppercase tracking-wider text-black transition hover:brightness-110 shadow-lg"
                  >
                    Claim Rewards & Return
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
                    <Shield className="h-8 w-8" />
                  </div>
                  <h2 className="mt-4 text-2xl font-black uppercase tracking-wider text-white">
                    COMPANIONS COLLAPSED
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Your team fell in battle. Tend to your companions in the kennel and try again!
                  </p>
                  <button
                    type="button"
                    onClick={() => setBattleState(null)}
                    className="mt-6 w-full rounded-lg border border-slate-700 bg-slate-800 py-3 font-bold uppercase tracking-wider text-white transition hover:bg-slate-700"
                  >
                    Return to Arena Hub
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Arena Hub / Tabs View (Sanctum League, Sparring Dojo, Kennel)
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 p-6 flex flex-col">
      {/* Top Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onReturnToHub}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Hideout
          </button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Swords className="h-6 w-6 text-amber-400" /> LokPet Sanctum Coliseum
            </h1>
            <p className="text-xs text-slate-400">
              Turn-based Companion Battles · Lit Corner Dojo Testing · League Tiers
            </p>
          </div>
        </div>

        {/* Resources Badges */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-slate-400">Wins:</span>
            <span className="font-bold text-white">{meta.lokPetBattleWins || 0}</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 flex items-center gap-1.5">
            <Gift className="h-4 w-4 text-pink-400" />
            <span className="text-slate-400">Treats:</span>
            <span className="font-bold text-pink-300">{meta.lokPetTreats || 0}</span>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 flex items-center gap-1.5">
            <Award className="h-4 w-4 text-cyan-400" />
            <span className="text-slate-400">Badges:</span>
            <span className="font-bold text-cyan-300">{(meta.lokPetBattleBadges || []).length} / 5</span>
          </div>
        </div>
      </header>

      {/* Mode Switcher Tabs */}
      <nav className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('sparring')}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'sparring'
              ? 'border-amber-400 bg-amber-500/20 text-amber-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="h-4 w-4" /> The Lit Corner Dojo (Test Arena)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('league')}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'league'
              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="h-4 w-4" /> Sanctum League Circuit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('kennel')}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'kennel'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Heart className="h-4 w-4" /> Companion Kennel & Trinkets ({meta.savedLokPets.length})
        </button>
      </nav>

      {/* TAB 1: THE LIT CORNER DOJO (TEST SANDBOX) */}
      {activeTab === 'sparring' && (
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" /> Lit Corner Sparring Sandbox
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Instantly test combat mechanics, element multipliers, damage formulas, and ultimate moves against custom sparring targets.
            </p>

            {/* Sparring Dummies Presets */}
            <div className="mt-6">
              <label className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Select Sparring Dummy Preset
              </label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SPARRING_DUMMIES.map((dummy) => {
                  const isSelected = selectedDummyPreset === dummy.id;
                  return (
                    <div
                      key={dummy.id}
                      onClick={() => setSelectedDummyPreset(dummy.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_12px_#f59e0b22]'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-white">{dummy.name}</span>
                        <span className="font-mono text-xs text-amber-400 font-semibold">Lv.{dummy.level}</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed">{dummy.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Target Constructor */}
            <div className="mt-6 border-t border-slate-800 pt-5">
              <label className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Or Configure Custom Sparring Opponent
              </label>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs text-slate-300 mb-1 font-semibold">Opponent LokPet Variant:</span>
                  <select
                    value={customDummyVariant}
                    onChange={(e) => {
                      setCustomDummyVariant(e.target.value);
                      setSelectedDummyPreset('');
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-amber-400"
                  >
                    {LOKPET_VARIANTS.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {variant.name} ({variant.element.toUpperCase()} · {variant.rarity.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-xs text-slate-300 mb-1 font-semibold">Target Level: {customDummyLevel}</span>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={customDummyLevel}
                    onChange={(e) => {
                      setCustomDummyLevel(parseInt(e.target.value, 10));
                      setSelectedDummyPreset('');
                    }}
                    className="w-full accent-amber-400"
                  />
                  <div className="flex justify-between font-mono text-[10px] text-slate-500 mt-1">
                    <span>Lv.1</span>
                    <span>Lv.25</span>
                    <span>Lv.50</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <button
              type="button"
              onClick={startSparringBattle}
              className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3.5 font-bold uppercase tracking-wider text-black transition hover:brightness-110 shadow-lg"
            >
              <Play className="h-5 w-5 fill-black" /> Enter Lit Corner Sparring Test
            </button>
          </div>

          {/* Quick Active Companion Preview */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Battle Companion
            </h3>
            {meta.savedLokPets.length > 0 ? (
              (() => {
                const leadPet = meta.savedLokPets[0];
                const rigFactory = LOKPET_RIGS[leadPet.roll.silhouette];
                const rig = rigFactory ? rigFactory() : null;

                return (
                  <div className="mt-4 flex flex-col items-center text-center">
                    <div className="h-32 w-32 grid place-items-center rounded-2xl border border-slate-800 bg-slate-950 p-2">
                      {rig && <RigPortrait rig={rig} palette={leadPet.roll.palette} size={100} />}
                    </div>
                    <h4 className="mt-3 font-bold text-lg text-white">{leadPet.roll.name}</h4>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-xs text-cyan-400 font-bold">Lv.{leadPet.level || 1}</span>
                      {renderElementBadge(leadPet.roll.element)}
                    </div>
                    <p className="mt-2 text-xs text-slate-400 italic">“{leadPet.roll.personality.label}”</p>

                    <div className="mt-4 w-full border-t border-slate-800 pt-3 text-left font-mono text-xs space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Battles Won:</span>
                        <span className="text-white">{leadPet.battlesWon || 0}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Equipped Trinket:</span>
                        <span className="text-amber-300">
                          {leadPet.equippedTrinket
                            ? BATTLE_TRINKETS.find((t) => t.id === leadPet.equippedTrinket)?.name || 'None'
                            : 'None'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('kennel')}
                      className="mt-5 w-full rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-bold uppercase text-slate-300 hover:bg-slate-700"
                    >
                      Manage Kennel & Party
                    </button>
                  </div>
                );
              })()
            ) : (
              <div className="mt-4 text-center text-slate-400">No companions in kennel.</div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SANCTUM LEAGUE CIRCUIT */}
      {activeTab === 'league' && (
        <div className="flex-1 space-y-4">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-400" /> Sanctum League Circuit Championship
            </h2>
            <p className="mt-1 text-xs text-cyan-200/80">
              Climb the 5 authored tiers of the 616 Sanctum League. Defeat each syndicate trainer to earn rare badges, card credits, and title recognition!
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {LEAGUE_TIERS.map((tier) => {
              const hasBadge = (meta.lokPetBattleBadges || []).includes(tier.rewards.badgeId);
              const isUnlocked = tier.tierNumber === 1 || (meta.lokPetBattleBadges || []).length >= tier.tierNumber - 1;

              return (
                <div
                  key={tier.id}
                  className={`flex flex-col justify-between rounded-xl border p-5 transition ${
                    hasBadge
                      ? 'border-amber-400/50 bg-slate-900/90 shadow-[0_0_15px_#f59e0b11]'
                      : isUnlocked
                      ? 'border-slate-800 bg-slate-900/60 hover:border-cyan-500/50'
                      : 'border-slate-800/40 bg-slate-900/20 opacity-50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                        Tier {tier.tierNumber} · {tier.title}
                      </span>
                      {hasBadge ? (
                        <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-amber-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> CLEARED
                        </span>
                      ) : null}
                    </div>

                    <h3 className="mt-2 text-lg font-bold text-white">{tier.trainerName}</h3>
                    <p className="text-xs text-slate-400">{tier.trainerTitle}</p>

                    <p className="mt-3 text-xs italic text-slate-300 leading-relaxed">
                      “{tier.flavorQuote}”
                    </p>

                    {/* Opponent Team Lineup */}
                    <div className="mt-4 border-t border-slate-800 pt-3">
                      <span className="font-mono text-[10px] font-bold uppercase text-slate-400">
                        Trainer Team ({tier.team.length} Pets):
                      </span>
                      <div className="mt-2 space-y-1.5">
                        {tier.team.map((member, mIdx) => {
                          const variant = LOKPET_VARIANTS_BY_ID[member.variantId];
                          return (
                            <div key={mIdx} className="flex items-center justify-between font-mono text-xs">
                              <span className="text-slate-200">
                                {member.name} <span className="text-slate-500">({variant?.name || member.variantId})</span>
                              </span>
                              <span className="text-cyan-400">Lv.{member.level}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-800 pt-3">
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-3">
                      <span>Reward: +{tier.rewards.cred} Cred · +{tier.rewards.treats} Treats</span>
                      <span className="text-amber-300">{tier.rewards.badgeName}</span>
                    </div>

                    <button
                      type="button"
                      disabled={!isUnlocked}
                      onClick={() => startLeagueBattle(tier)}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-bold uppercase tracking-wider text-xs transition ${
                        isUnlocked
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {hasBadge ? 'Rematch Trainer' : isUnlocked ? 'Challenge League Match' : 'Locked'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: KENNEL & COMPANION MANAGEMENT */}
      {activeTab === 'kennel' && (
        <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          {/* Pet Cards Grid */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Heart className="h-5 w-5 text-emerald-400" /> Companion Kennel
                </h2>
                <p className="text-xs text-slate-400">
                  Select a companion to feed treats, check move loadouts, or equip combat trinkets.
                </p>
              </div>

              <button
                type="button"
                onClick={draftStarterLokPets}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" /> Draft Starters
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {meta.savedLokPets.map((pet) => {
                const isSelected = selectedKennelPetId === pet.id;
                const rigFactory = LOKPET_RIGS[pet.roll.silhouette];
                const rig = rigFactory ? rigFactory() : null;

                return (
                  <div
                    key={pet.id}
                    onClick={() => setSelectedKennelPetId(pet.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_#10b98122]'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 shrink-0 grid place-items-center rounded-lg border border-slate-800 bg-slate-950">
                        {rig && <RigPortrait rig={rig} palette={pet.roll.palette} size={50} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white truncate">{pet.roll.name}</span>
                          <span className="font-mono text-xs text-cyan-400 font-bold">Lv.{pet.level || 1}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {renderElementBadge(pet.roll.element)}
                        </div>
                        <div className="mt-2 font-mono text-[10px] text-slate-400">
                          Won: <span className="text-emerald-400">{pet.battlesWon || 0}</span> · Stamina: {pet.stamina}/3
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Pet Detail / Upgrade Panel */}
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            {(() => {
              const pet = meta.savedLokPets.find((p) => p.id === selectedKennelPetId) || meta.savedLokPets[0];
              if (!pet) {
                return <div className="text-center text-slate-400">No companion selected.</div>;
              }

              const rigFactory = LOKPET_RIGS[pet.roll.silhouette];
              const rig = rigFactory ? rigFactory() : null;
              const level = pet.level || 1;
              const exp = pet.exp || 0;
              const expNext = getExpForLevel(level);

              return (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                      Companion Profile
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFavoriteLokPet(pet.id)}
                      className={`flex items-center gap-1 font-mono text-xs ${
                        pet.favorite ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${pet.favorite ? 'fill-pink-400' : ''}`} />
                      {pet.favorite ? 'Favorite' : 'Mark Favorite'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-col items-center text-center">
                    <div className="h-28 w-28 grid place-items-center rounded-xl border border-slate-800 bg-slate-950 p-2">
                      {rig && <RigPortrait rig={rig} palette={pet.roll.palette} size={90} />}
                    </div>
                    <h3 className="mt-3 font-bold text-lg text-white">{pet.roll.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-xs text-cyan-400 font-bold">Level {level}</span>
                      {renderElementBadge(pet.roll.element)}
                    </div>
                  </div>

                  {/* EXP Bar */}
                  <div className="mt-4 w-full font-mono text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>EXP PROGRESS</span>
                      <span className="text-white">{exp} / {expNext}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${Math.min(100, (exp / expNext) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Feed Treat Button */}
                  <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Gift className="h-4 w-4 text-pink-400" /> Treat Feeding
                      </span>
                      <span className="font-mono text-xs text-pink-300">
                        Available: {meta.lokPetTreats || 0}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Feeding consumes 1 treat, restores +1 Stamina, and grants +75 EXP toward the next level.
                    </p>
                    <button
                      type="button"
                      disabled={(meta.lokPetTreats || 0) < 1}
                      onClick={() => feedLokPetTreat(pet.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-pink-600 py-2 text-xs font-bold uppercase text-white hover:bg-pink-500 disabled:opacity-40"
                    >
                      Feed Treat (+75 EXP)
                    </button>
                  </div>

                  {/* Trinket Equip Slot */}
                  <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-amber-400" /> Equipped Combat Trinket
                    </span>
                    <select
                      value={pet.equippedTrinket || ''}
                      onChange={(e) => equipLokPetTrinket(pet.id, e.target.value || undefined)}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white focus:outline-none"
                    >
                      <option value="">None (Unequipped)</option>
                      {BATTLE_TRINKETS.map((trinket) => (
                        <option key={trinket.id} value={trinket.id}>
                          {trinket.icon} {trinket.name} ({trinket.description.split('.')[0]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
