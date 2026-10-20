/**
 * The "classic version" travel encounter popup: player on the left, an
 * enemy or wild LokPet on the right, simple turn-based combat. See
 * .agents/memory/travel-encounters.md for why the combat here is
 * deliberately simple and isolated from engine/world.ts, and for the
 * subject-type damage/effect variation layered on top of the original flat
 * formula (cardThrowOutcome in data/travelEncounters.ts).
 */
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';
import { LogOut, PawPrint, Sparkles, Swords, Zap } from 'lucide-react';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { effectiveStats, useMeta } from '@/game/state/metaStore';
import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';
import { CARD_MANIFESTS_BY_ID } from '@/game/data/cards';
import {
  getCardVariableProfile,
  ELEMENT_METADATA,
  calculateDeckSynergies,
  type CardElement,
} from '@/game/data/cardVariables';
import {
  PET_ASSIST_DAMAGE_MULT,
  PLAYER_TRAVEL_HP,
  UNARMED_PUNCH_DAMAGE,
  cardThrowOutcome,
  describeOwnedCard,
  travelLeadPet,
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
import { LokPetEntrance } from './LokPetEntrance';
import { petEvolvedLook } from '@/game/engine/petEvolution';

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
  const { meta, selectedCharacter, resolveTravelEncounter, consumeThrownCard } = useMeta();
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
  const t = useT();
  const assistPet = travelLeadPet(meta);
  // Bumped by the Send button so the pet's entrance plays again.
  const [entrance, setEntrance] = useState(0);
  const assistLook = assistPet ? petEvolvedLook(assistPet) : undefined;

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

  // The lead LokPet steps in when the scrap starts, and again whenever it is sent in.
  useEffect(() => {
    if (assistPet) sfx.play('lokPetEntrance');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrance, assistPet?.id]);

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

  // Determine opponent element alignment
  const opponentElement: CardElement =
    (opponent.lokPetRoll?.element as CardElement | undefined) ??
    (opponent.kind === 'enemy'
      ? getCardVariableProfile(
          CARD_MANIFESTS_BY_ID[`lok.survivor-616.card.threat-${opponent.enemyId}`] ||
            ({ id: opponent.enemyId, name: opponent.name } as any),
        ).element
      : 'none');
  const opponentElemMeta = opponentElement !== 'none' ? ELEMENT_METADATA[opponentElement] : null;
  const battleSynergies = calculateDeckSynergies(meta.battleDeckCardIds).filter((s) => s.active);

  const handleAttack = (damage: number, actionLabel?: string, heal = 0) => {
    if (busy || combat.status !== 'active') return;
    setBusy(true);
    // Ally cards call in support instead of hitting harder -- apply the heal
    // to a shallow-cloned state before the pure applyPlayerAttack, so that
    // function stays a plain damage-in/damage-out transform. See
    // cardThrowOutcome in data/travelEncounters.ts.
    const healedState = heal > 0
      ? { ...combat, player: { ...combat.player, hp: Math.min(combat.player.maxHp, combat.player.hp + heal) } }
      : combat;
    const afterPlayer = applyPlayerAttack(healedState, damage, actionLabel);
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

        {assistPet && assistLook && (
          <div className="mt-2 flex items-center justify-center gap-3" data-testid="travel-companion">
            <LokPetEntrance
              entranceKey={`${assistPet.id}-${entrance}`}
              silhouette={assistPet.roll.silhouette}
              palette={assistLook.palette}
              overlays={assistLook.overlays}
              size={44}
              flash
            />
            <div className="min-w-0 font-mono uppercase">
              <p className="truncate text-[11px] font-black text-sky-100">{assistPet.name ?? assistPet.roll.name}</p>
              <p className="text-[8px] tracking-wider text-white/50">{t('fight.companion.atYourSide')}</p>
            </div>
          </div>
        )}

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

        <div className="mt-2 flex items-center justify-center gap-2 font-mono text-[9px] uppercase tracking-wider text-white/50">
          {opponent.lokPetRoll ? (
            <>
              <span className="text-cyan-300 font-semibold">{opponent.lokPetRoll.elementLabel}</span>
              <span>·</span>
              <span className="text-amber-300">{opponent.lokPetRoll.rarityLabel}</span>
              <span>·</span>
              <span className="truncate">{opponent.lokPetRoll.traitLabel}</span>
            </>
          ) : opponentElemMeta ? (
            <span
              className="rounded px-1.5 py-0.2 font-mono text-[8px] font-bold"
              style={{ backgroundColor: opponentElemMeta.color, color: '#000' }}
            >
              {opponentElemMeta.icon} {opponentElemMeta.label}
            </span>
          ) : null}
        </div>

        {lastLog && (
          <p className="mt-3 text-center font-mono text-[10px] text-white/45" data-testid="text-travel-encounter-log">
            {lastLog.actor === 'player'
              ? `${lastLog.label ?? 'Attack'} -- ${lastLog.damage} dmg`
              : `${combat.opponent.name} hits back -- ${lastLog.damage} dmg`}
          </p>
        )}

        {combat.status === 'active' ? (
          <div className="mt-4">
            {/* Active Battle Deck Synergies */}
            {battleSynergies.length > 0 && (
              <div className="mb-2.5 flex flex-wrap items-center gap-1.5 border border-fuchsia-300/30 bg-fuchsia-950/40 px-2 py-1 font-mono text-[7.5px] uppercase">
                <Zap className="h-3 w-3 text-fuchsia-300 shrink-0" />
                <span className="text-white/50">Deck Resonance:</span>
                {battleSynergies.map((syn) => (
                  <span
                    key={syn.id}
                    className="rounded bg-fuchsia-400/20 px-1 py-0.2 font-bold text-fuchsia-200"
                    title={syn.description}
                  >
                    {syn.badge}
                  </span>
                ))}
              </div>
            )}

            {battleDeck.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {battleDeck.map((record) => {
                  const info = describeOwnedCard(record.cardId);
                  const outcome = cardThrowOutcome(record, opponent.kind);
                  const manifest = CARD_MANIFESTS_BY_ID[record.cardId];
                  const profile = manifest ? getCardVariableProfile(manifest) : null;
                  const elemMeta = profile ? ELEMENT_METADATA[profile.element] : null;
                  const hasAdvantage = Boolean(
                    elemMeta && opponentElement !== 'none' && elemMeta.strongVs.includes(opponentElement),
                  );
                  const damage = Math.round(outcome.damage * powerMult * (hasAdvantage ? 1.25 : 1));
                  const lastCopy = !meta.handheldDigiScopeOwned && record.copies <= 1;

                  return (
                    <button
                      key={record.cardId}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        consumeThrownCard(record.cardId);
                        handleAttack(
                          damage,
                          `${info?.name ?? 'Card'}${hasAdvantage ? ' (Super Effective!)' : ''}`,
                          outcome.heal,
                        );
                      }}
                      className={`relative border p-2 text-left transition-all active:scale-[0.97] disabled:opacity-40 ${
                        hasAdvantage
                          ? 'border-amber-400/60 bg-amber-400/[.07]'
                          : 'border-white/15 bg-white/[.03]'
                      }`}
                      data-testid={`button-throw-card-${record.cardId}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="block truncate font-display text-xs font-black uppercase text-white">
                          {info?.name ?? 'Unknown card'}
                        </span>
                        {elemMeta && (
                          <span
                            className="grid h-3.5 w-3.5 place-items-center rounded-full text-[7px] font-bold shrink-0"
                            style={{ backgroundColor: elemMeta.color, color: '#000' }}
                            title={elemMeta.label}
                          >
                            {elemMeta.icon}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center justify-between text-[8.5px]">
                        <span className="text-white/60">
                          Throw · <strong className={hasAdvantage ? 'text-amber-300 font-bold' : 'text-white'}>{damage} dmg</strong>
                          {outcome.heal > 0 ? ` · +${outcome.heal} hp` : ''}
                        </span>
                        {hasAdvantage && (
                          <span className="rounded bg-amber-400 px-1 py-0.2 font-mono text-[6.5px] font-black uppercase text-black">
                            Advantage +25%
                          </span>
                        )}
                      </div>

                      {!meta.handheldDigiScopeOwned && (
                        <span className={`mt-0.5 block text-[7.5px] uppercase tracking-wide ${lastCopy ? 'text-rose-300' : 'text-white/30'}`}>
                          {lastCopy ? 'Last one -- gone after this' : `${record.copies} left before it's gone`}
                        </span>
                      )}
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
                  setEntrance((value) => value + 1);
                  handleAttack(Math.round(assistPet.roll.stats.damage * PET_ASSIST_DAMAGE_MULT * powerMult), `Sent ${assistPet.roll.name}`);
                }}
                className="mt-2 w-full border border-sky-300/30 bg-sky-400/[.06] p-3 font-mono text-xs font-black uppercase text-sky-100 transition-all active:scale-[0.97] disabled:opacity-40"
                data-testid="button-send-lokpet"
              >
                <PawPrint className="mr-2 inline h-4 w-4" />Send {assistPet.roll.name} · {Math.round(assistPet.roll.stats.damage * PET_ASSIST_DAMAGE_MULT * powerMult)} dmg (once)
              </button>
            )}
            {opponent.kind === 'lokpet' && meta.lokPetTreats >= 1 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  handleAttack(combat.opponent.hp, 'Offered a Digi-Treat (Tamed!)');
                }}
                className="mt-2 w-full border border-pink-400/40 bg-pink-500/10 p-2.5 font-mono text-xs font-black uppercase text-pink-200 transition-all hover:bg-pink-500/20 active:scale-[0.97] disabled:opacity-40"
                data-testid="button-offer-treat"
              >
                <Sparkles className="mr-2 inline h-4 w-4 text-pink-300" />Offer Digi-Treat · Befriend ({meta.lokPetTreats} in pouch)
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
