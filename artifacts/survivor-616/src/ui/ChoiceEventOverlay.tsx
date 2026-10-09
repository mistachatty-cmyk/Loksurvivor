/**
 * A choice event: a short scene, two or three options, and a result. The scene is a record in
 * `data/choiceEvents.ts`; the rules are in `engine/choiceEvents.ts`. Rendered from App.tsx, next
 * to the travel overlays, because it is a `position: fixed` modal and the hideout screen sits
 * under an animated wrapper (see .agents/memory/fixed-popups-and-ancestor-filters.md).
 *
 * Choosing previews the outcome with the same seed the reducer then uses, so what you read is
 * what was paid. Closing without choosing claims nothing, so a missed moment costs nothing.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { CHOICE_EVENTS_BY_ID } from '@/game/data/choiceEvents';
import { EVENT_BUFFS_BY_ID, EVENT_BUFF_MS, describePercent, type EventBuffEffect } from '@/game/data/eventBuffs';
import { applyChoice, choiceBlock } from '@/game/engine/choiceEvents';
import { petCallName } from '@/game/engine/petGrowth';
import { ELIXIR_CAP, useMeta } from '@/game/state/metaStore';
import { useT, type MessageKey } from '@/lib/i18n';
import { describeReward } from '@/ui/hideoutRewardText';

type Translate = (key: MessageKey, vars?: Record<string, unknown>) => string;

/** Reads like "+8% Speed" or "-5% Power". */
function describeEffect(effect: EventBuffEffect, t: Translate): string {
  const pct = describePercent(effect);
  return `${pct > 0 ? '+' : ''}${pct}% ${t(`eventbuff.stat.${effect.stat}` as MessageKey)}`;
}

export interface ChoiceEventOverlayProps {
  eventId: string;
  /** The pet the scene is about, when there is one. */
  petId?: string;
  /** The prop that offered the scene, whose daily use is spent when you choose. */
  propId?: string;
  onClose: () => void;
}

const RANK_KEYS: Record<string, MessageKey> = {
  stranger: 'hideout.play.rank.stranger',
  familiar: 'hideout.play.rank.familiar',
  friend: 'hideout.play.rank.friend',
  partner: 'hideout.play.rank.partner',
  soulbound: 'hideout.play.rank.soulbound',
};

export function ChoiceEventOverlay({ eventId, petId, propId, onClose }: ChoiceEventOverlayProps) {
  const t = useT();
  const { meta, resolveChoiceEvent } = useMeta();
  const def = CHOICE_EVENTS_BY_ID[eventId];
  const pet = petId ? meta.savedLokPets.find((candidate) => candidate.id === petId) : undefined;
  const [result, setResult] = useState<{ text: string; found: string; buffLine: string } | null>(null);
  const [gone, setGone] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  const vars = useMemo(
    () => ({ pet: pet ? petCallName(pet) : t('hideout.event.ui.fallbackPet'), you: pet?.names?.callsYou?.trim() || 'you' }),
    // `t` never changes identity; the pet's name and what it calls you are the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pet?.id, pet?.name, pet?.names?.callsYou],
  );

  useEffect(() => {
    firstRef.current?.focus();
  }, [result]);

  // Escape leaves before choosing; once chosen, only the OK button closes it.
  useEffect(() => {
    if (result) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, onClose]);

  if (!def) return null;

  const choose = (choiceId: string) => {
    if (result) return;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const now = Date.now();
    const preview = applyChoice(meta, def.id, choiceId, seed, { now, petId: pet?.id, propId, elixirCap: ELIXIR_CAP });
    if (!preview.ok || !preview.outcome) {
      setGone(true);
      return;
    }
    resolveChoiceEvent(def.id, choiceId, seed, pet?.id, propId);
    const text = preview.usedFallback ? t('hideout.event.ui.fizzle') : t(preview.outcome.textKey, vars);
    const buff = preview.outcome.buffId ? EVENT_BUFFS_BY_ID[preview.outcome.buffId] : undefined;
    const buffLine = buff
      ? t('eventbuff.line', {
          boost: `${t(`eventbuff.${buff.id}.name` as never)} ${describeEffect(buff.boost, t)}`,
          cost: describeEffect(buff.cost, t),
          minutes: Math.round(EVENT_BUFF_MS / 60000),
        })
      : '';
    setResult({ text, found: describeReward(preview.applied, t), buffLine });
  };

  return (
    <div
      className="fixed inset-0 z-[130] overflow-y-auto bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="choice-event-title"
      data-testid="overlay-choice-event"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-md border border-pink-200/40 bg-[#0d0d15] p-5 shadow-2xl">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[.25em] text-pink-200">{t('hideout.event.ui.kicker')}</p>
          <h2 id="choice-event-title" className="mt-1 font-display text-xl font-black uppercase text-white">{t(def.titleKey, vars)}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/80">{t(def.bodyKey, vars)}</p>

          {gone ? (
            <>
              <p className="mt-4 text-sm text-white/70" data-testid="choice-event-gone">{t('hideout.event.ui.gone')}</p>
              <button type="button" ref={firstRef} onClick={onClose} className="mt-4 min-h-11 w-full border border-white/30 bg-white/10 px-4 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-white/20" data-testid="button-choice-event-ok">
                {t('hideout.event.ui.ok')}
              </button>
            </>
          ) : result ? (
            <>
              <p className="mt-4 border-l-2 border-pink-200/60 pl-3 text-sm leading-relaxed text-white" data-testid="choice-event-result">{result.text}</p>
              {result.found ? <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-amber-200">{t('hideout.life.found', { items: result.found })}</p> : null}
              {result.buffLine ? <p className="mt-2 font-mono text-[11px] uppercase tracking-wider text-cyan-200" data-testid="choice-event-buff">{result.buffLine}</p> : null}
              <button type="button" ref={firstRef} onClick={onClose} className="mt-4 min-h-11 w-full border border-pink-200/50 bg-pink-400/15 px-4 font-mono text-xs font-bold uppercase tracking-widest text-pink-50 hover:bg-pink-400/25" data-testid="button-choice-event-ok">
                {t('hideout.event.ui.ok')}
              </button>
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-2">
                {def.choices.map((choice, index) => {
                  const block = choiceBlock(choice, pet);
                  const reason = block === 'pet'
                    ? t('hideout.event.ui.lockedPet')
                    : block === 'bond'
                      ? t('hideout.event.ui.lockedBond', { rank: t(RANK_KEYS[choice.requires?.minBond ?? 'familiar'] ?? 'hideout.play.rank.familiar') })
                      : null;
                  // A locked option that needs a pet you do not have is not worth showing at all.
                  if (block === 'pet') return null;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      ref={index === 0 ? firstRef : undefined}
                      disabled={block !== null}
                      onClick={() => choose(choice.id)}
                      className={`min-h-11 border px-4 py-2 text-left text-sm font-bold transition-colors ${block ? 'cursor-not-allowed border-white/10 bg-white/[.03] text-white/40' : 'border-white/25 bg-white/[.06] text-white hover:border-pink-200/70 hover:bg-pink-400/10'}`}
                      data-testid={`button-choice-${choice.id}`}
                    >
                      {t(choice.labelKey, vars)}
                      {reason ? <span className="mt-0.5 block font-mono text-[9px] font-normal uppercase tracking-wider">{reason}</span> : null}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={onClose} className="mt-3 w-full py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-white/45 hover:text-white" data-testid="button-choice-event-close">
                {t('hideout.event.ui.close')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChoiceEventOverlay;
