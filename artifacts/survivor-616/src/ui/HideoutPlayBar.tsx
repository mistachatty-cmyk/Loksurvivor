/**
 * The row of things to do with a LokPet, under the hideout strip. The verbs are records in
 * `data/petCare.ts`; this only shows them and reports which one was picked. The parent
 * dispatches the action (so the toast and the save agree) and tells the strip to animate it.
 */
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

import { beatBus } from '@/game/audio/beatBus';
import { PET_CARE_VERBS, careCooldownLeftMs, careVerbBlock, type CareBlock } from '@/game/data/petCare';
import { bondRankFor, petCallName } from '@/game/engine/petGrowth';
import { useT, type MessageKey } from '@/lib/i18n';
import type { SavedLokPet } from '@/game/types';

const RANK_KEYS: Record<string, MessageKey> = {
  stranger: 'hideout.play.rank.stranger',
  familiar: 'hideout.play.rank.familiar',
  friend: 'hideout.play.rank.friend',
  partner: 'hideout.play.rank.partner',
  soulbound: 'hideout.play.rank.soulbound',
};

function formatWait(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.max(1, minutes)}m`;
}

export interface HideoutPlayBarProps {
  /** The pet being played with. */
  pet: SavedLokPet;
  /** Other pets on the strip you can switch to. */
  others?: Array<{ id: string; name: string }>;
  onPlay: (verbId: string) => void;
  onSwitch?: (petId: string) => void;
}

export function HideoutPlayBar({ pet, others = [], onPlay, onSwitch }: HideoutPlayBarProps) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  const [musicPlaying, setMusicPlaying] = useState(() => beatBus.read().source !== 'none');

  // Cooldown countdowns and "needs music" change slowly; a light tick is plenty.
  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      setMusicPlaying(beatBus.read().source !== 'none');
    };
    const timer = window.setInterval(tick, 4000);
    return () => window.clearInterval(timer);
  }, []);

  const name = petCallName(pet);
  const rank = bondRankFor(pet.bond);
  const reason = (block: CareBlock, minBond?: string, waitMs = 0): string => {
    if (block === 'cooldown') return t('hideout.play.cooldown', { time: formatWait(waitMs) });
    if (block === 'music') return t('hideout.play.needsMusic');
    if (block === 'time') return t('hideout.play.needsNight');
    return t('hideout.play.needsBond', { rank: t(RANK_KEYS[minBond ?? 'familiar'] ?? 'hideout.play.rank.familiar') });
  };

  return (
    <section
      className="mb-5 border border-white/10 bg-black/50 px-3 py-2.5"
      aria-label={t('hideout.play.aria', { pet: name })}
      data-testid="hideout-play-bar"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-pink-200">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />
          {t('hideout.play.title', { pet: name })}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/55" data-testid="hideout-play-bond">
          {t('hideout.play.bond', { rank: t(RANK_KEYS[rank.id] ?? 'hideout.play.rank.stranger') })}
        </span>
        {others.length > 0 ? (
          <span className="ml-auto flex flex-wrap gap-1" role="group" aria-label={t('hideout.play.switch')}>
            {others.map((other) => (
              <button
                key={other.id}
                type="button"
                onClick={() => onSwitch?.(other.id)}
                className="border border-white/15 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white/65 hover:border-white/40 hover:text-white"
                data-testid={`button-play-switch-${other.id}`}
              >
                {other.name}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PET_CARE_VERBS.map((verb) => {
          const block = careVerbBlock(verb, pet, { now, musicPlaying });
          const status = block ? reason(block, verb.minBond, careCooldownLeftMs(verb, pet, now)) : t('hideout.play.ready');
          return (
            <button
              key={verb.id}
              type="button"
              disabled={block !== null}
              onClick={() => onPlay(verb.id)}
              title={t(verb.hintKey)}
              className={`min-h-11 min-w-[7rem] border px-3 py-1.5 text-left transition-colors ${block ? 'cursor-not-allowed border-white/10 bg-white/[.03] text-white/40' : 'border-pink-200/40 bg-pink-400/10 text-pink-50 hover:border-pink-200/80 hover:bg-pink-400/20'}`}
              data-testid={`button-play-${verb.id}`}
            >
              <span className="block text-[11px] font-black uppercase tracking-wide">{t(verb.labelKey)}</span>
              <span className="block font-mono text-[9px] uppercase tracking-wider opacity-80">{status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default HideoutPlayBar;
