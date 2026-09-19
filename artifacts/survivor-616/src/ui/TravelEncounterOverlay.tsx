/**
 * The "classic version" travel encounter popup: player on the left, an
 * enemy or wild LokPet on the right, simple turn-based combat. See
 * .agents/memory/travel-encounters.md for why the combat here is
 * deliberately flat/uniform and isolated from engine/world.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { LogOut, PawPrint, Swords } from 'lucide-react';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { effectiveStats, useMeta } from '@/game/state/metaStore';
import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';
import {
  PET_ASSIST_DAMAGE_MULT,
  PLAYER_TRAVEL_HP,
  UNARMED_PUNCH_DAMAGE,
  cardThrowDamage,
  describeOwnedCard,
} from '@/game/data/travelEncounters';
import {
  applyFlee,
  applyOpponentAttack,
  applyPlayerAttack,
  buildTravelEncounterResult,
  createTravelEncounterState,
  type ResolvedTravelEncounterOpponent,
  type TravelEncounterState,
} from '@/game/travelEncounter';
import { HideoutVignette, type GestureAnim } from './HideoutVignette';

export interface TravelEncounterOverlayProps {
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

const BEAT_MS = 450;

export function TravelEncounterOverlay({ opponent, rng, label, onClose }: TravelEncounterOverlayProps) {
  const { meta, selectedCharacter, resolveTravelEncounter } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const selectedCharacterPalette = resolveCharacterCosmeticPalette(
    selectedCharacter,
    meta.characterSkinByCharacterId[selectedCharacter.id],
    meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId),
    meta.worldPaletteBlendEnabled,
  );
  // Ties the minigame to real character/ally progression without a bespoke
  // formula: `power` is already the game's one "you hit harder" multiplier.
  const powerMult = effectiveStats(selectedCharacter, meta).power;
  const assistPet = meta.selectedLokPetIds.length > 0
    ? meta.savedLokPets.find((pet) => pet.id === meta.selectedLokPetIds[0])
    : undefined;

  const [combat, setCombat] = useState<TravelEncounterState>(() =>
    createTravelEncounterState(
      { name: selectedCharacter.name, maxHp: PLAYER_TRAVEL_HP, hp: PLAYER_TRAVEL_HP },
      { name: opponent.name, maxHp: opponent.hp, hp: opponent.hp },
    ),
  );
  const [busy, setBusy] = useState(false);
  const [petUsed, setPetUsed] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const gestureNonce = useRef(0);
  const settledRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => { timersRef.current.forEach((id) => window.clearTimeout(id)); }, []);

  useEffect(() => {
    if (combat.status === 'active' || settledRef.current) return;
    settledRef.current = true;
    resolveTravelEncounter(buildTravelEncounterResult(combat, opponent, rng));
  }, [combat, opponent, rng, resolveTravelEncounter]);

  const playGesture = (side: 'left' | 'right', anim: GestureAnim) => {
    gestureNonce.current += 1;
    setGesture({ side, anim, nonce: gestureNonce.current });
  };

  const battleDeck = meta.battleDeckCardIds
    .map((cardId) => meta.cardCollection.find((record) => record.cardId === cardId && record.copies > 0))
    .filter((record): record is NonNullable<typeof record> => Boolean(record));

  const handleAttack = (damage: number, actionLabel?: string) => {
    if (busy || combat.status !== 'active') return;
    setBusy(true);
    const afterPlayer = applyPlayerAttack(combat, damage, actionLabel);
    const afterOpponent = afterPlayer.status === 'active' ? applyOpponentAttack(afterPlayer, opponent.damage) : afterPlayer;

    playGesture('left', 'attack');
    timersRef.current.push(window.setTimeout(() => {
      setCombat(afterPlayer);
      playGesture('right', 'hurt');
      sfx.play(afterPlayer.status === 'won' ? 'kill' : 'hit');
      if (afterPlayer.status !== 'active') {
        setBusy(false);
        return;
      }
      timersRef.current.push(window.setTimeout(() => {
        playGesture('right', 'attack');
        timersRef.current.push(window.setTimeout(() => {
          setCombat(afterOpponent);
          playGesture('left', 'hurt');
          sfx.play(afterOpponent.status === 'lost' ? 'playerDown' : 'playerHurt');
          setBusy(false);
        }, BEAT_MS));
      }, BEAT_MS));
    }, BEAT_MS));
  };

  const handleFlee = () => {
    if (busy || combat.status !== 'active') return;
    sfx.play('uiNav');
    setCombat(applyFlee(combat));
  };

  const outcomeCopy = combat.status === 'won'
    ? 'Won the scrap.'
    : combat.status === 'lost'
      ? 'Got roughed up -- no reward this time.'
      : combat.status === 'fled'
        ? 'Slipped away.'
        : '';

  const lastLog = combat.log[combat.log.length - 1];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" data-testid="overlay-travel-encounter">
      <div className="w-full max-w-md border border-fuchsia-300/40 bg-[#0a0a12] p-5">
        <p className="text-center font-mono text-[10px] uppercase tracking-widest text-fuchsia-200">{label}</p>

        <div className="mt-4 flex justify-center">
          <HideoutVignette
            left={{ name: selectedCharacter.name, rig: selectedCharacter.rig, palette: selectedCharacterPalette }}
            right={{ name: opponent.name, rig: opponent.rig, palette: opponent.palette }}
            size={130}
            controlledGesture={gesture}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-[10px] uppercase text-white/60">
          <div>
            <p className="flex justify-between"><span>{combat.player.name}</span><span>{combat.player.hp}/{combat.player.maxHp}</span></p>
            <div className="mt-1 h-2 w-full bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${(combat.player.hp / combat.player.maxHp) * 100}%` }} /></div>
          </div>
          <div>
            <p className="flex justify-between"><span>{combat.opponent.name}</span><span>{combat.opponent.hp}/{combat.opponent.maxHp}</span></p>
            <div className="mt-1 h-2 w-full bg-white/10"><div className="h-full bg-rose-400" style={{ width: `${(combat.opponent.hp / combat.opponent.maxHp) * 100}%` }} /></div>
          </div>
        </div>

        {lastLog && (
          <p className="mt-3 text-center font-mono text-[10px] text-white/45" data-testid="text-travel-encounter-log">
            {lastLog.actor === 'player'
              ? `${lastLog.label ?? 'Attack'} -- ${lastLog.damage} dmg`
              : `${combat.opponent.name} hits back -- ${lastLog.damage} dmg`}
          </p>
        )}

        {combat.status === 'active' ? (
          <div className="mt-5">
            {battleDeck.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {battleDeck.map((record) => {
                  const info = describeOwnedCard(record.cardId);
                  const damage = Math.round(cardThrowDamage(record) * powerMult);
                  return (
                    <button
                      key={record.cardId}
                      type="button"
                      disabled={busy}
                      onClick={() => handleAttack(damage, info?.name ?? 'Threw a card')}
                      className="border border-white/15 bg-white/[.03] p-2 text-left transition-all active:scale-[0.97] disabled:opacity-40"
                      data-testid={`button-throw-card-${record.cardId}`}
                    >
                      <span className="block font-display text-xs font-black uppercase text-white">{info?.name ?? 'Unknown card'}</span>
                      <span className="mt-0.5 block text-[9px] text-white/50">Throw · {damage} dmg</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAttack(Math.round(UNARMED_PUNCH_DAMAGE * powerMult), 'Threw a punch')}
                className="w-full border border-white/15 bg-white/[.03] p-3 font-mono text-xs font-black uppercase text-white transition-all active:scale-[0.97] disabled:opacity-40"
                data-testid="button-throw-punch"
              >
                <Swords className="mr-2 inline h-4 w-4" />Throw a punch · {Math.round(UNARMED_PUNCH_DAMAGE * powerMult)} dmg
              </button>
            )}
            {assistPet && !petUsed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPetUsed(true);
                  handleAttack(Math.round(assistPet.roll.stats.damage * PET_ASSIST_DAMAGE_MULT * powerMult), `Sent ${assistPet.roll.name}`);
                }}
                className="mt-2 w-full border border-sky-300/30 bg-sky-400/[.06] p-3 font-mono text-xs font-black uppercase text-sky-100 transition-all active:scale-[0.97] disabled:opacity-40"
                data-testid="button-send-lokpet"
              >
                <PawPrint className="mr-2 inline h-4 w-4" />Send {assistPet.roll.name} · {Math.round(assistPet.roll.stats.damage * PET_ASSIST_DAMAGE_MULT * powerMult)} dmg (once)
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleFlee}
              className="mt-3 flex w-full items-center justify-center gap-2 border border-white/10 py-2 font-mono text-[10px] font-black uppercase text-white/50 transition-all hover:text-white active:scale-[0.97] disabled:opacity-40"
              data-testid="button-flee-travel-encounter"
            >
              <LogOut className="h-3.5 w-3.5" />Flee
            </button>
          </div>
        ) : (
          <div className="mt-5 text-center">
            <p className="font-display text-lg font-black uppercase text-white">{outcomeCopy}</p>
            <button
              type="button"
              onClick={() => { sfx.play('uiClick'); onClose(); }}
              className="mt-4 border border-fuchsia-200/50 bg-fuchsia-300/10 px-6 py-2.5 font-mono text-[11px] font-black uppercase text-fuchsia-100 transition-all active:scale-[0.97]"
              data-testid="button-continue-travel-encounter"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TravelEncounterOverlay;
