/**
 * Travel-encounter fights on the arena engine, in three presentations that
 * share one state machine (game/engine/quickFight.ts):
 *   quick -- your lead LokPet, three moves, short.
 *   duo   -- your operator stands beside your LokPet and adds an assist every
 *            round (a punch, a Battle Deck card, or a one-time cover).
 *   arena -- the full side-by-side battle: every move, finishers, Cheer.
 * Layout adapts to the screen: phones get a stacked, single-column layout,
 * wider screens get stat panels either side of the fight and a running log.
 * The classic popup (TravelEncounterOverlay) is untouched and stays default.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, LogOut, PawPrint, Repeat2, Shield, Swords } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { CARD_MANIFESTS_BY_ID } from '@/game/data/cards';
import { ELEMENT_METADATA, getCardVariableProfile } from '@/game/data/cardVariables';
import { enemyBattleElement } from '@/game/data/lokPetBattles';
import { resolveCharacterCosmeticPalette } from '@/game/data/characterSkins';
import { lokPetRig, lokPetSpritePalette } from '@/game/data/lokPets';
import { DEFAULT_PALETTE_ID, getActivePalette } from '@/game/data/themedPalettes';
import { UNARMED_PUNCH_DAMAGE, cardThrowOutcome, describeOwnedCard, travelTeam } from '@/game/data/travelEncounters';
import {
  MATCHUP_LABEL,
  describeIntent,
  moveIntent,
  moveMatchup,
  statusChips,
  type MoveMatchup,
} from '@/game/engine/battleClarity';
import type { BattlePet } from '@/game/engine/lokPetBattleTypes';
import {
  cheerQuickFight,
  createQuickFight,
  quickFightOutcome,
  stepQuickFight,
  switchQuickFight,
  switchTargets,
  type OperatorAssist,
  type QuickFightState,
} from '@/game/engine/quickFight';
import { effectiveStats, lokPetTeamCapacity, useMeta } from '@/game/state/metaStore';
import { petEvolvedLook } from '@/game/engine/petEvolution';
import type { FightStyle } from '@/game/state/fightStyleSetting';
import { buildTravelEncounterResultFromOutcome, type ResolvedTravelEncounterOpponent } from '@/game/travelEncounter';
import type { LokPetElement } from '@/game/types';
import { HideoutVignette, type GestureAnim } from './HideoutVignette';
import { LokPetEntrance } from './LokPetEntrance';

export interface EncounterFightOverlayProps {
  style: Exclude<FightStyle, 'classic'>;
  opponent: ResolvedTravelEncounterOpponent;
  rng: () => number;
  label: string;
  onClose: () => void;
}

type GestureSide = 'left' | 'right' | 'support';
interface Gesture {
  side: GestureSide;
  anim: GestureAnim;
  nonce: number;
}

/** One chip in the Duo operator row. `assist` is what gets played; `cardId` is spent when a card is used. */
interface AssistChoice {
  id: string;
  title: string;
  detail: string;
  assist: OperatorAssist | null;
  cardId?: string;
  disabled?: boolean;
  advantage?: boolean;
}

const BEAT_MS = 420;

export const MATCHUP_STYLE: Record<MoveMatchup, string> = {
  strong: 'border-amber-400/70 bg-amber-400/[.08] text-amber-200',
  normal: 'border-white/15 bg-white/[.03] text-white/70',
  weak: 'border-slate-500/50 bg-slate-800/40 text-slate-400',
  support: 'border-sky-400/50 bg-sky-400/[.07] text-sky-200',
};

/** True below the `sm` breakpoint. Phones get the stacked layout. */
function useCompactScreen(): boolean {
  const query = '(max-width: 639px)';
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return compact;
}

function HpBar({ pet, tone, align = 'left' }: { pet: BattlePet; tone: string; align?: 'left' | 'right' }) {
  const chips = statusChips(pet);
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <p className="truncate" title={pet.name}>{pet.name}</p>
      <p className={`flex gap-2 text-white/45 ${align === 'right' ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
        <span>Lv.{pet.level}</span>
        <span data-testid={`text-fight-hp-${pet.id}`}>{pet.hp}/{pet.maxHp} HP</span>
      </p>
      <div className="mt-1 h-2 w-full bg-white/10"><div className={`h-full transition-[width] duration-300 ${tone}`} style={{ width: `${Math.max(0, (pet.hp / pet.maxHp) * 100)}%` }} /></div>
      <div className="mt-1 h-1 w-full bg-white/10"><div className="h-full bg-cyan-400/80 transition-[width] duration-300" style={{ width: `${Math.min(100, (pet.energy / pet.maxEnergy) * 100)}%` }} /></div>
      <div className={`mt-1 flex min-h-[16px] flex-wrap gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
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

export function EncounterFightOverlay({ style, opponent, rng, label, onClose }: EncounterFightOverlayProps) {
  const { meta, selectedCharacter, resolveTravelEncounter, consumeThrownCard } = useMeta();
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const compact = useCompactScreen();
  const isDuo = style === 'duo';
  const isArena = style === 'arena';
  const wide = !compact && (isDuo || isArena);

  const t = useT();
  // Duo and Arena bring the whole selected team and can swap mid-fight; Quick stays on the lead.
  const canSwitch = isDuo || isArena;
  const team = travelTeam(meta, canSwitch ? lokPetTeamCapacity(selectedCharacter) : 1);
  const powerMult = effectiveStats(selectedCharacter, meta).power;
  const operatorPalette = resolveCharacterCosmeticPalette(
    selectedCharacter,
    meta.characterSkinByCharacterId[selectedCharacter.id],
    meta.activePaletteId === DEFAULT_PALETTE_ID ? undefined : getActivePalette(meta.activePaletteId),
    meta.worldPaletteBlendEnabled,
  );

  const [fight, setFight] = useState<QuickFightState>(() => {
    // Street enemies derive their element from their own role/family/faction,
    // not a hash of their name -- so two enemies with the same role always
    // fight the same elemental way, and different roles read as different fights.
    const enemyElement: LokPetElement = opponent.kind === 'enemy'
      ? enemyBattleElement({ role: opponent.enemyRole, family: opponent.enemyFamily, faction: opponent.enemyFaction })
      : 'none';
    return createQuickFight({ playerPets: team, maxTeam: canSwitch ? team.length : 1, opponent, enemyElement, depth: isArena ? 'deep' : 'quick' });
  });
  const [busy, setBusy] = useState(false);
  const [fled, setFled] = useState(false);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [assistId, setAssistId] = useState('punch');
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

  const playGesture = (side: GestureSide, anim: GestureAnim) => {
    gestureNonce.current += 1;
    setGesture({ side, anim, nonce: gestureNonce.current });
  };
  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  const activeIndex = fight.battle.activePlayerIndex;
  const player = fight.battle.playerTeam[activeIndex]!;
  const enemy = fight.battle.enemyTeam[fight.battle.activeEnemyIndex]!;
  const teamHp = (state: QuickFightState) => state.battle.playerTeam.reduce((sum, pet) => sum + Math.max(0, pet.hp), 0);

  // The active LokPet steps in with the first-night entrance when the fight opens, on a switch, and after a faint.
  const activeSaved = team.find((pet) => player.id.includes(pet.id));
  const activeLook = activeSaved ? petEvolvedLook(activeSaved) : undefined;
  const entranceKey = `${player.id}-${activeIndex}`;
  useEffect(() => { sfx.play('lokPetEntrance'); }, [entranceKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const playerRig = useMemo(() => lokPetRig(player.silhouette), [player.silhouette]);
  const playerPalette = useMemo(() => lokPetSpritePalette(player.palette), [player.palette]);

  // Duo: what the operator can do this round.
  const assistChoices = useMemo<AssistChoice[]>(() => {
    if (!isDuo) return [];
    const punchDamage = Math.round(UNARMED_PUNCH_DAMAGE * powerMult);
    const choices: AssistChoice[] = [
      { id: 'punch', title: 'Punch', detail: `~${Math.round(punchDamage * 3.5)} dmg`, assist: { kind: 'punch', label: 'Your punch', damage: punchDamage } },
    ];
    for (const cardId of meta.battleDeckCardIds) {
      const record = meta.cardCollection.find((entry) => entry.cardId === cardId && entry.copies > 0);
      if (!record) continue;
      const info = describeOwnedCard(record.cardId);
      const outcomeFor = cardThrowOutcome(record, opponent.kind);
      const manifest = CARD_MANIFESTS_BY_ID[record.cardId];
      const profile = manifest ? getCardVariableProfile(manifest) : null;
      const elemMeta = profile ? ELEMENT_METADATA[profile.element] : null;
      const advantage = Boolean(elemMeta && enemy.element !== 'none' && elemMeta.strongVs.includes(enemy.element));
      const damage = Math.round(outcomeFor.damage * powerMult * (advantage ? 1.25 : 1));
      const name = info?.name ?? 'Card';
      choices.push({
        id: `card-${record.cardId}`,
        cardId: record.cardId,
        title: name,
        detail: `Card · ~${Math.round(damage * 3.5)} dmg${outcomeFor.heal > 0 ? ' · heals' : ''}`,
        assist: { kind: 'card', label: name, damage, heal: outcomeFor.heal || undefined },
        advantage,
      });
    }
    choices.push({
      id: 'cover',
      title: 'Cover',
      detail: fight.coverUsed ? 'Used' : 'Halves damage 2 rounds',
      assist: { kind: 'cover', label: 'Cover', damage: 0 },
      disabled: fight.coverUsed,
    });
    choices.push({ id: 'none', title: 'Hold', detail: 'No assist', assist: null });
    return choices;
  }, [isDuo, powerMult, meta.battleDeckCardIds, meta.cardCollection, opponent.kind, enemy.element, fight.coverUsed]);

  const chosenAssist = assistChoices.find((choice) => choice.id === assistId && !choice.disabled)
    ?? assistChoices.find((choice) => choice.id === 'punch');

  const handleMove = (moveId: string) => {
    if (busy || outcome !== 'active') return;
    setBusy(true);
    const assist = chosenAssist?.assist ?? undefined;
    if (chosenAssist?.cardId) consumeThrownCard(chosenAssist.cardId);
    const next = stepQuickFight(fight, moveId, Math.random, assist);
    const assistActs = Boolean(assist && assist.kind !== 'cover');
    if (assistActs) playGesture('support', 'attack');
    const lead = assistActs ? BEAT_MS : 0;
    later(() => {
      playGesture('left', 'attack');
      later(() => {
        setFight(next);
        playGesture('right', 'hurt');
        const won = quickFightOutcome(next) === 'won';
        sfx.play(won ? 'kill' : 'hit');
        if (won) { setBusy(false); return; }
        later(() => {
          if (teamHp(next) < teamHp(fight)) {
            playGesture('left', 'hurt');
            sfx.play(quickFightOutcome(next) === 'lost' ? 'playerDown' : 'playerHurt');
          }
          setBusy(false);
        }, BEAT_MS);
      }, BEAT_MS);
    }, lead);
  };

  const handleCheer = () => {
    if (busy || outcome !== 'active' || !fight.battle.cheerAvailable) return;
    sfx.play('uiClick');
    setFight(cheerQuickFight(fight));
  };

  const handleSwitch = (targetIndex: number) => {
    if (busy || outcome !== 'active') return;
    setBusy(true);
    sfx.play('uiNav');
    const next = switchQuickFight(fight, targetIndex, Math.random);
    if (next === fight) { setBusy(false); return; }
    // The new pet steps in at once (see entranceKey); the opponent's telegraphed move lands after a beat.
    setFight(next);
    later(() => {
      playGesture('right', 'attack');
      later(() => {
        if (teamHp(next) < teamHp(fight)) {
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
  const roundShown = Math.min(fight.battle.turn, fight.turnCap);
  const vignetteSize = compact ? (isDuo ? 110 : 120) : wide ? 170 : 130;

  const companionBanner = activeLook ? (
    <div className="mt-3 flex items-center justify-center gap-3" data-testid="fight-companion">
      <LokPetEntrance
        entranceKey={entranceKey}
        silhouette={player.silhouette}
        palette={player.palette}
        overlays={activeLook.overlays}
        size={40}
        flash
      />
      <div className="min-w-0 font-mono uppercase">
        <p className="truncate text-[11px] font-black text-cyan-100">{player.name}</p>
        <p className="text-[8px] tracking-wider text-white/50">{t('fight.companion.atYourSide')}</p>
      </div>
    </div>
  ) : null;

  const vignette = (
    <HideoutVignette
      left={{ name: player.name, rig: playerRig, palette: playerPalette }}
      right={{ name: opponent.name, rig: opponent.rig, palette: opponent.palette }}
      support={isDuo ? { name: selectedCharacter.name, rig: selectedCharacter.rig, palette: operatorPalette } : undefined}
      size={vignetteSize}
      controlledGesture={gesture}
    />
  );

  const moveButtons = (
    <div className={`grid gap-2 ${isArena && !compact ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {player.moves.map((move) => {
        const matchup = moveMatchup(move, enemy.element);
        const canAfford = player.energy >= move.energyCost;
        const intent = moveIntent(move);
        const isUltimate = move.kind === 'ultimate';
        return (
          <button
            key={move.id}
            type="button"
            disabled={busy || !canAfford}
            onClick={() => handleMove(move.id)}
            className={`flex items-center justify-between gap-3 border p-2.5 text-left transition-all active:scale-[0.98] disabled:opacity-40 ${
              isUltimate ? 'border-amber-400/80 bg-amber-950/30 text-amber-200' : MATCHUP_STYLE[matchup]
            }`}
            data-testid={`button-quickfight-move-${move.id}`}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-white">
                {intent === 'attack' ? <Swords className="h-3.5 w-3.5 shrink-0" /> : <Shield className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{move.name}</span>
              </span>
              <span className="mt-0.5 block text-[9px] text-white/50">
                {move.energyCost > 0 ? `${move.energyCost} SP` : '+20 SP'}
                {intent === 'attack' ? ` · Pwr ${Math.round(move.power * 100)}` : ''}
                {isArena ? ` · Acc ${Math.round(move.accuracy * 100)}%` : ''}
              </span>
              {isArena && !compact && (
                <span className="mt-1 line-clamp-2 block text-[9px] leading-tight text-white/40">{move.description}</span>
              )}
            </span>
            <span className="shrink-0 rounded border border-current px-1.5 py-0.5 font-mono text-[9px] font-black uppercase" data-testid={`label-quickfight-matchup-${move.id}`}>
              {MATCHUP_LABEL[matchup]}
            </span>
          </button>
        );
      })}
    </div>
  );

  const operatorRow = isDuo ? (
    <div className="mb-3" data-testid="row-duo-operator">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/45">
        <PawPrint className="h-3 w-3" />{selectedCharacter.name} assists, then your LokPet moves
      </p>
      <div className="flex flex-wrap gap-1.5">
        {assistChoices.map((choice) => {
          const selected = chosenAssist?.id === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              disabled={busy || choice.disabled}
              onClick={() => setAssistId(choice.id)}
              aria-pressed={selected}
              className={`border px-2 py-1.5 text-left transition-all active:scale-[0.97] disabled:opacity-35 ${
                selected
                  ? 'border-fuchsia-300/70 bg-fuchsia-400/15 text-fuchsia-100'
                  : choice.advantage
                    ? 'border-amber-400/50 bg-amber-400/[.06] text-amber-100'
                    : 'border-white/15 bg-white/[.03] text-white/70'
              }`}
              data-testid={`button-duo-assist-${choice.id}`}
            >
              <span className="block max-w-[9.5rem] truncate font-mono text-[10px] font-black uppercase">{choice.title}</span>
              <span className="block font-mono text-[8px] text-white/45">{choice.detail}</span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const logPanel = wide ? (
    <div className="flex h-full min-h-[8rem] flex-col border border-white/10 bg-black/30 p-2" data-testid="panel-fight-log">
      <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-white/40">Battle log</span>
      <div className="mt-1 flex-1 space-y-1 overflow-y-auto pr-1 font-mono text-[10px] leading-tight text-white/55" style={{ maxHeight: '14rem' }}>
        {fight.battle.combatLog.slice(0, 12).map((entry) => (
          <p key={entry.id} className={entry.type === 'crit' ? 'font-bold text-amber-300' : entry.type === 'effective' ? 'text-orange-300' : entry.type === 'status' ? 'text-cyan-300' : ''}>
            {entry.text}
          </p>
        ))}
      </div>
    </div>
  ) : recap.length > 0 ? (
    <div className="mt-2 space-y-0.5 text-center font-mono text-[10px] text-white/45" data-testid="text-quickfight-log">
      {recap.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
    </div>
  ) : null;

  const intentBanner = outcome === 'active' && fight.intent ? (
    <p className="mt-3 border border-rose-400/30 bg-rose-500/[.07] px-2 py-1.5 text-center font-mono text-[10px] text-rose-200" data-testid="text-quickfight-intent">
      Next: {describeIntent(fight.intent, player.element)}
    </p>
  ) : null;

  const reserves = switchTargets(fight);
  const switchRow = canSwitch && fight.battle.playerTeam.length > 1 ? (
    <div className="mt-2" data-testid="row-fight-switch">
      <p className="mb-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-white/45">
        <Repeat2 className="h-3 w-3" />{t('fight.switch.title')} · {t('fight.switch.hint')}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {fight.battle.playerTeam.map((pet, index) => {
          const isActive = index === activeIndex;
          const available = reserves.includes(index);
          return (
            <button
              key={pet.id}
              type="button"
              disabled={busy || !available}
              onClick={() => handleSwitch(index)}
              aria-pressed={isActive}
              className={`border px-2 py-1.5 text-left transition-all active:scale-[0.97] disabled:opacity-40 ${
                isActive ? 'border-cyan-300/70 bg-cyan-400/15 text-cyan-100' : 'border-white/15 bg-white/[.03] text-white/70'
              }`}
              data-testid={`button-fight-switch-${index}`}
            >
              <span className="block max-w-[8rem] truncate font-mono text-[10px] font-black uppercase">{pet.name}</span>
              <span className="block font-mono text-[8px] text-white/45">
                {pet.fainted ? t('fight.switch.down') : isActive ? t('fight.switch.active') : `${pet.hp}/${pet.maxHp} HP`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  const footerControls = (
    <>
      {switchRow}
      {isArena && (
        <button
          type="button"
          disabled={busy || !fight.battle.cheerAvailable}
          onClick={handleCheer}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-pink-400/40 bg-pink-500/10 py-2 font-mono text-[10px] font-black uppercase text-pink-200 transition-all active:scale-[0.97] disabled:opacity-40"
          title="Once per fight: +35% HP, +40 SP and a damage boost. Free action."
          data-testid="button-fight-cheer"
        >
          <Heart className="h-3.5 w-3.5" />Cheer (once)
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={handleFlee}
        className="mt-3 flex w-full items-center justify-center gap-2 border border-white/10 py-2 font-mono text-[10px] font-black uppercase text-white/50 transition-all hover:text-white active:scale-[0.97] disabled:opacity-40"
        data-testid="button-quickfight-flee"
      >
        <LogOut className="h-3.5 w-3.5" />Flee
      </button>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 sm:p-4" data-testid="overlay-quick-fight" data-fight-style={style} data-fight-layout={wide ? 'wide' : 'stacked'}>
      <div className="flex min-h-full items-start justify-center sm:items-center">
        <div className={`w-full border border-fuchsia-300/40 bg-[#0a0a12] p-4 sm:p-5 ${wide ? 'max-w-3xl' : 'max-w-md'}`}>
          <p className="text-center font-mono text-[10px] uppercase tracking-widest text-fuchsia-200">{label}</p>
          <p className="mt-1 text-center font-mono text-[9px] uppercase tracking-widest text-white/40">
            {isDuo ? 'Duo' : isArena ? 'Arena' : 'Quick'} · Round {roundShown} of {fight.turnCap}
          </p>

          {companionBanner}

          {wide ? (
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 font-mono text-[10px] uppercase text-white/60">
              <HpBar pet={player} tone="bg-emerald-400" />
              <div className="flex justify-center">{vignette}</div>
              <HpBar pet={enemy} tone="bg-rose-400" align="right" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex justify-center">{vignette}</div>
              <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10px] uppercase text-white/60">
                <HpBar pet={player} tone="bg-emerald-400" />
                <HpBar pet={enemy} tone="bg-rose-400" align="right" />
              </div>
            </>
          )}

          {intentBanner}
          {!wide && logPanel}

          {outcome === 'active' ? (
            wide ? (
              <div className="mt-4 grid grid-cols-[1fr_16rem] gap-4">
                <div>
                  {operatorRow}
                  {moveButtons}
                  {footerControls}
                </div>
                {logPanel}
              </div>
            ) : (
              <div className="mt-4">
                {operatorRow}
                {moveButtons}
                {footerControls}
              </div>
            )
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
    </div>
  );
}

export default EncounterFightOverlay;
