/**
 * Quick fight popup: the travel-encounter scrap played on the arena engine.
 * Your lead LokPet against a street enemy or a wild LokPet, three moves each,
 * a turn cap, and the opponent's next move shown before you choose. Opt-in
 * from Settings; the classic popup (TravelEncounterOverlay) stays the default.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Shield, Swords } from 'lucide-react';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { CARD_MANIFESTS_BY_ID } from '@/game/data/cards';
import { getCardVariableProfile } from '@/game/data/cardVariables';
import { lokPetRig, lokPetSpritePalette } from '@/game/data/lokPets';
import {
  MATCHUP_LABEL,
  describeIntent,
  moveIntent,
  moveMatchup,
  statusChips,
  type MoveMatchup,
} from '@/game/engine/battleClarity';
import {
  QUICK_TURN_CAP,
  createQuickFight,
  quickFightOutcome,
  stepQuickFight,
  type QuickFightState,
} from '@/game/engine/quickFight';
import type { BattlePet } from '@/game/engine/lokPetBattleTypes';
import { useMeta } from '@/game/state/metaStore';
import { buildTravelEncounterResultFromOutcome, type ResolvedTravelEncounterOpponent } from '@/game/travelEncounter';
import type { LokPetElement } from '@/game/types';
import { HideoutVignette, type GestureAnim } from './HideoutVignette';

export interface QuickFightOverlayProps {
  opponent: ResolvedTravelEncounterOpponent;
  rng: () => number;
  label: string;
  onClose: () => void;
}

interface Gesture {
  side: 'left' | 'right';
  anim: GestureAnim;
  nonce: number;
}

const BEAT_MS = 420;

export const MATCHUP_STYLE: Record<MoveMatchup, string> = {
  strong: 'border-amber-400/70 bg-amber-400/[.08] text-amber-200',
  normal: 'border-white/15 bg-white/[.03] text-white/70',
  weak: 'border-slate-500/50 bg-slate-800/40 text-slate-400',
  support: 'border-sky-400/50 bg-sky-400/[.07] text-sky-200',
};

function HpBar({ pet, tone }: { pet: BattlePet; tone: string }) {
  const chips = statusChips(pet);
  return (
    <div>
      <p className="truncate" title={pet.name}>{pet.name}</p>
      <p className="flex justify-between text-white/45"><span>Lv.{pet.level}</span><span data-testid={`text-quickfight-hp-${pet.id}`}>{pet.hp}/{pet.maxHp} HP</span></p>
      <div className="mt-1 h-2 w-full bg-white/10"><div className={`h-full transition-[width] duration-300 ${tone}`} style={{ width: `${Math.max(0, (pet.hp / pet.maxHp) * 100)}%` }} /></div>
      <div className="mt-1 h-1 w-full bg-white/10"><div className="h-full bg-cyan-400/80 transition-[width] duration-300" style={{ width: `${Math.min(100, (pet.energy / pet.maxEnergy) * 100)}%` }} /></div>
      <div className="mt-1 flex min-h-[16px] flex-wrap gap-1">
        {chips.map((chip) => (
          <span
            key={chip.type}
            title={`${chip.label}: ${chip.hint}`}
            className={`rounded px-1 py-px text-[8px] font-bold ${chip.tone === 'bad' ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/25 text-emerald-200'}`}
            data-testid={`chip-status-${chip.type}`}
          >
            {chip.code} {chip.turns}
          </span>
        ))}
      </div>
    </div>
  );
}

export function QuickFightOverlay({ opponent, rng, label, onClose }: QuickFightOverlayProps) {
  const { meta, resolveTravelEncounter } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const leadPet = meta.selectedLokPetIds.length > 0
    ? meta.savedLokPets.find((pet) => pet.id === meta.selectedLokPetIds[0])
    : undefined;

  const [fight, setFight] = useState<QuickFightState>(() => {
    // Street enemies have no element of their own; the card system gives them one.
    const enemyElement: LokPetElement = opponent.kind === 'enemy'
      ? (getCardVariableProfile(
          CARD_MANIFESTS_BY_ID[`lok.survivor-616.card.threat-${opponent.enemyId}`] ||
            ({ id: opponent.enemyId, name: opponent.name } as never),
        ).element as LokPetElement)
      : 'none';
    return createQuickFight({ playerPet: leadPet, opponent, enemyElement });
  });
  const [busy, setBusy] = useState(false);
  const [fled, setFled] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureNonce = useRef(0);
  const settledRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => { timersRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  const outcome = fled ? 'fled' : quickFightOutcome(fight);
  useEffect(() => {
    if (outcome === 'active' || settledRef.current) return;
    settledRef.current = true;
    resolveTravelEncounter(
      buildTravelEncounterResultFromOutcome(outcome === 'won' ? 'won' : outcome === 'lost' ? 'lost' : 'fled', opponent, rng),
    );
  }, [outcome, opponent, rng, resolveTravelEncounter]);

  const playGesture = (side: 'left' | 'right', anim: GestureAnim) => {
    gestureNonce.current += 1;
    setGesture({ side, anim, nonce: gestureNonce.current });
  };
  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  const player = fight.battle.playerTeam[0]!;
  const enemy = fight.battle.enemyTeam[0]!;

  const playerRig = useMemo(() => lokPetRig(player.silhouette), [player.silhouette]);
  const playerPalette = useMemo(() => lokPetSpritePalette(player.palette), [player.palette]);

  const handleMove = (moveId: string) => {
    if (busy || outcome !== 'active') return;
    setBusy(true);
    const next = stepQuickFight(fight, moveId);
    const nextPlayer = next.battle.playerTeam[0]!;
    playGesture('left', 'attack');
    later(() => {
      setFight(next);
      playGesture('right', 'hurt');
      const won = quickFightOutcome(next) === 'won';
      sfx.play(won ? 'kill' : 'hit');
      if (won) { setBusy(false); return; }
      later(() => {
        if (nextPlayer.hp < player.hp) {
          playGesture('left', 'hurt');
          sfx.play(quickFightOutcome(next) === 'lost' ? 'playerDown' : 'playerHurt');
        }
        setBusy(false);
      }, BEAT_MS);
    }, BEAT_MS);
  };

  const handleFlee = () => {
    if (busy || outcome !== 'active') return;
    sfx.play('uiNav');
    setFled(true);
  };

  const outcomeCopy = outcome === 'won' ? 'Won the scrap.' : outcome === 'lost' ? 'Got roughed up. No reward this time.' : outcome === 'fled' ? 'Slipped away.' : '';
  const recap = fight.lastRoundLog.slice(-3);
  const roundShown = Math.min(fight.battle.turn, QUICK_TURN_CAP);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/85 p-4" data-testid="overlay-quick-fight">
      <div className="w-full max-w-md border border-fuchsia-300/40 bg-[#0a0a12] p-5">
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-fuchsia-200">{label}</p>
        <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-widest text-white/40">
          Round {roundShown} of {QUICK_TURN_CAP}
        </p>

        <div className="mt-3 flex justify-center">
          <HideoutVignette
            left={{ name: player.name, rig: playerRig, palette: playerPalette }}
            right={{ name: opponent.name, rig: opponent.rig, palette: opponent.palette }}
            size={130}
            controlledGesture={gesture}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10px] uppercase text-white/60">
          <HpBar pet={player} tone="bg-emerald-400" />
          <HpBar pet={enemy} tone="bg-rose-400" />
        </div>

        {outcome === 'active' && fight.intent && (
          <p className="mt-3 border border-rose-400/30 bg-rose-500/[.07] px-2 py-1.5 text-center font-mono text-[10px] text-rose-200" data-testid="text-quickfight-intent">
            Next: {describeIntent(fight.intent, player.element)}
          </p>
        )}

        {recap.length > 0 && (
          <div className="mt-2 space-y-0.5 text-center font-mono text-[10px] text-white/45" data-testid="text-quickfight-log">
            {recap.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
          </div>
        )}

        {outcome === 'active' ? (
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-2">
              {player.moves.map((move) => {
                const matchup = moveMatchup(move, enemy.element);
                const canAfford = player.energy >= move.energyCost;
                const intent = moveIntent(move);
                return (
                  <button
                    key={move.id}
                    type="button"
                    disabled={busy || !canAfford}
                    onClick={() => handleMove(move.id)}
                    className={`flex items-center justify-between gap-3 border p-2.5 text-left transition-all active:scale-[0.98] disabled:opacity-40 ${MATCHUP_STYLE[matchup]}`}
                    data-testid={`button-quickfight-move-${move.id}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-white">
                        {intent === 'attack' ? <Swords className="h-3.5 w-3.5 shrink-0" /> : <Shield className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{move.name}</span>
                      </span>
                      <span className="mt-0.5 block text-[9px] text-white/50">
                        {move.energyCost > 0 ? `${move.energyCost} SP` : '+20 SP'}{intent === 'attack' ? ` · Pwr ${Math.round(move.power * 100)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded border border-current px-1.5 py-0.5 font-mono text-[9px] font-black uppercase" data-testid={`label-quickfight-matchup-${move.id}`}>
                      {MATCHUP_LABEL[matchup]}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={handleFlee}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-white/10 py-2 font-mono text-[10px] font-black uppercase text-white/50 transition-all hover:text-white active:scale-[0.97] disabled:opacity-40"
              data-testid="button-quickfight-flee"
            >
              <LogOut className="h-3.5 w-3.5" />Flee
            </button>
          </div>
        ) : (
          <div className="mt-5 text-center">
            <p className="font-display text-lg font-black uppercase text-white" data-testid="text-quickfight-outcome">{outcomeCopy}</p>
            <button
              type="button"
              onClick={() => { sfx.play('uiClick'); onClose(); }}
              className="mt-4 border border-fuchsia-200/50 bg-fuchsia-300/10 px-6 py-2.5 font-mono text-[11px] font-black uppercase text-fuchsia-100 transition-all active:scale-[0.97]"
              data-testid="button-continue-quick-fight"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuickFightOverlay;
