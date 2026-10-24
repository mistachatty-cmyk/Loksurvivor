/**
 * The Live Game Bar: the run's bottom bar in the new UI. Everything a player reaches for during a
 * run is packed into one compact strip along the bottom edge, so it never has to sit over the action:
 *
 *  - an XP bar across the top that sits dim until a level-up is ready, then fills with a glow and shine;
 *  - the next level-up's options shown ahead of time (dimmed), which light up and become tappable the
 *    moment the XP bar fills, with a burst when one is taken;
 *  - the power-up, dash and crew call-in buttons on the right, with other one-tap actions as chips above.
 *
 * It only draws what it is given: the run owns the world, the choices and the handlers.
 */
import { useRef, useState, type ReactNode } from 'react';
import { RefreshCw, SkipForward } from 'lucide-react';

import { useT } from '@/lib/i18n';
import type { UpgradeDef } from './types';

export interface GameBarAction {
  testId: string;
  ariaLabel: string;
  label: string;
  /** 0 to 100: how far the cooldown has recovered. */
  pct: number;
  active?: boolean;
  accent: string;
  onPress: () => void;
}

export interface GameBarChip {
  id: string;
  label: string;
  tone: 'amber' | 'fuchsia' | 'emerald' | 'cyan';
  active?: boolean;
  onPress: () => void;
}

export interface RunGameBarProps {
  level: number;
  xp: number;
  xpToNext: number;
  /** Choices owed right now. Empty means no level-up is waiting. */
  choices: readonly UpgradeDef[];
  /** The options the next level-up will offer. */
  preview: readonly UpgradeDef[];
  /** The run is paused on the level-up (the player chose pausing level-ups). */
  paused: boolean;
  rerollsLeft: number;
  onPick: (upgrade: UpgradeDef) => void;
  onReroll: () => void;
  onSkip: () => void;
  renderIcon: (upgrade: UpgradeDef) => ReactNode;
  ultimate: GameBarAction & { ready: boolean };
  dash?: GameBarAction;
  callIn?: GameBarAction;
  chips?: readonly GameBarChip[];
}

const CHIP_TONE: Record<GameBarChip['tone'], string> = {
  amber: 'border-amber-300/60 text-amber-100',
  fuchsia: 'border-fuchsia-300/60 text-fuchsia-100',
  emerald: 'border-emerald-300/60 text-emerald-100',
  cyan: 'border-cyan-300/60 text-cyan-100',
};

const KIND_MARK: Record<NonNullable<UpgradeDef['cardKind']>, string> = {
  upgrade: '▲',
  weapon: '✚',
  passive: '◈',
  evolution: '✦',
  'relic-evolution': '✦',
};

function SkillCard({ upgrade, ready, icon, onPick }: { upgrade: UpgradeDef; ready: boolean; icon: ReactNode; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!ready}
      title={upgrade.description}
      className={`game-bar-card relative flex h-[50px] min-w-0 flex-col items-start justify-center gap-0.5 overflow-hidden border px-1.5 [@media(max-height:430px)]:h-[34px] [@media(max-height:430px)]:flex-row [@media(max-height:430px)]:items-center [@media(max-height:430px)]:gap-1 text-left transition-[opacity,transform,box-shadow,border-color] duration-300 ${
        ready
          ? 'game-bar-card-ready border-primary/80 bg-primary/10 opacity-100 active:scale-95'
          : 'cursor-default border-white/15 bg-white/[0.04] opacity-50'
      }`}
      aria-label={`${upgrade.name}. ${upgrade.description}`}
      data-testid={`button-upgrade-${upgrade.id}`}
      data-ready={ready ? 'true' : 'false'}
    >
      <span className="flex w-full items-center gap-1 [@media(max-height:430px)]:w-auto">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[11px] text-primary">{icon ?? KIND_MARK[upgrade.cardKind ?? 'upgrade']}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[7px] uppercase tracking-wider text-white/45 [@media(max-height:430px)]:hidden">{upgrade.cardKind ?? 'upgrade'}</span>
      </span>
      <span className="line-clamp-2 w-full text-[9px] font-black uppercase leading-[1.05] tracking-wide text-white">{upgrade.name}</span>
    </button>
  );
}

function RoundAction({ action, size, ready }: { action: GameBarAction; size: 'lg' | 'sm'; ready: boolean }) {
  const pct = Math.max(0, Math.min(100, action.pct));
  const style =
    size === 'lg'
      ? { background: ready ? `radial-gradient(circle, ${action.accent}66, rgba(0,0,0,0.8))` : `conic-gradient(${action.accent}88 ${pct * 3.6}deg, rgba(0,0,0,0.8) 0deg)` }
      : { background: `linear-gradient(90deg, ${action.accent}88 ${pct}%, rgba(0,0,0,0.78) ${pct}%)` };
  return (
    <button
      type="button"
      onClick={action.onPress}
      disabled={!ready}
      aria-label={action.ariaLabel}
      className={
        size === 'lg'
          ? `relative h-[52px] w-[52px] shrink-0 rounded-full [@media(max-height:430px)]:h-[44px] [@media(max-height:430px)]:w-[44px] border-2 px-0.5 font-mono text-[8px] font-bold uppercase leading-tight tracking-wider text-white disabled:opacity-55 ${ready ? 'game-bar-power-ready border-white/60' : 'border-white/25'}`
          : `h-6 w-full min-w-0 truncate border px-1 font-mono text-[8px] font-bold uppercase leading-none tracking-wider text-white disabled:opacity-55 ${ready ? 'border-white/50' : 'border-white/20'}`
      }
      style={style}
      data-testid={action.testId}
    >
      {action.label}
    </button>
  );
}

export function RunGameBar(props: RunGameBarProps) {
  const t = useT();
  const { level, xp, xpToNext, choices, preview, paused, rerollsLeft, onPick, onReroll, onSkip, renderIcon, ultimate, dash, callIn, chips = [] } = props;
  const ready = choices.length > 0;
  const shown = ready ? choices : preview;
  const pct = ready ? 100 : Math.max(0, Math.min(100, (xp / Math.max(1, xpToNext)) * 100));
  const [burst, setBurst] = useState(0);
  const burstFrom = useRef<string>('');

  const take = (upgrade: UpgradeDef) => {
    burstFrom.current = upgrade.name;
    setBurst((n) => n + 1);
    onPick(upgrade);
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: 'max(0.3rem, env(safe-area-inset-bottom))', paddingLeft: 'max(0.3rem, env(safe-area-inset-left))', paddingRight: 'max(0.3rem, env(safe-area-inset-right))' }}
      data-testid="run-game-bar"
      data-ready={ready ? 'true' : 'false'}
    >
      {chips.length > 0 ? (
        <div className="pointer-events-auto mb-1 flex justify-end gap-1" data-testid="game-bar-chips">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onPress}
              className={`h-6 border bg-black/80 px-2 font-mono text-[8px] font-bold uppercase tracking-wider ${CHIP_TONE[chip.tone]} ${chip.active ? 'bg-white/15' : ''}`}
              data-testid={`game-bar-chip-${chip.id}`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`pointer-events-auto relative overflow-hidden border bg-gradient-to-t from-black/92 to-black/75 p-1.5 backdrop-blur-sm transition-[border-color,box-shadow] duration-500 ${ready ? 'game-bar-ready border-primary/70' : 'border-white/15'}`}>
        {/* XP: dim and quiet until the level fills, then a full glow with a shine moving across. */}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 font-mono text-[9px] font-black tabular-nums text-white" data-testid="game-bar-level">LV {level}</span>
          <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden border border-white/15 bg-black/70" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={t('run.bar.xp')} data-testid="game-bar-xp">
            <div
              className={`h-full transition-[width,opacity] duration-200 ${ready ? 'game-bar-xp-ready bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 opacity-100' : 'bg-gradient-to-r from-[#22b8d6] to-[#6ee7ff] opacity-60'}`}
              style={{ width: `${pct}%` }}
              data-testid="bar-xp"
            />
          </div>
          <span className={`shrink-0 font-mono text-[8px] uppercase tracking-wider ${ready ? 'game-bar-label-ready font-black text-amber-200' : 'text-white/45'}`} data-testid="game-bar-status">
            {ready ? (paused ? t('run.bar.chooseNow') : t('run.bar.levelUp')) : t('run.bar.next')}
          </span>
          {ready ? (
            <>
              <button type="button" onClick={onReroll} disabled={rerollsLeft <= 0} aria-label={t('run.bar.reroll')} className="flex h-4 shrink-0 items-center gap-0.5 border border-white/20 px-1 font-mono text-[8px] text-white/70 disabled:opacity-35" data-testid="button-upgrade-reroll">
                <RefreshCw size={9} aria-hidden="true" />{rerollsLeft}
              </button>
              <button type="button" onClick={onSkip} aria-label={t('run.bar.skip')} className="flex h-4 shrink-0 items-center border border-white/20 px-1 text-white/70" data-testid="button-upgrade-skip">
                <SkipForward size={9} aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-1 flex items-stretch gap-1.5">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1" data-testid="game-bar-cards">
            {shown.length === 0 ? (
              <p className="col-span-3 flex h-[50px] [@media(max-height:430px)]:h-[34px] items-center justify-center font-mono text-[8px] uppercase tracking-wider text-white/35">{t('run.bar.noneLeft')}</p>
            ) : (
              shown.slice(0, 3).map((upgrade) => (
                <SkillCard key={upgrade.id} upgrade={upgrade} ready={ready} icon={renderIcon(upgrade)} onPick={() => take(upgrade)} />
              ))
            )}
          </div>

          <div className="flex shrink-0 items-stretch gap-1">
            {dash || callIn ? (
              <div className="flex w-[58px] flex-col justify-center gap-1">
                {callIn ? <RoundAction action={callIn} size="sm" ready={callIn.pct >= 100} /> : null}
                {dash ? <RoundAction action={dash} size="sm" ready={dash.pct >= 100} /> : null}
              </div>
            ) : null}
            <RoundAction action={ultimate} size="lg" ready={ultimate.ready} />
          </div>
        </div>

        {/* A short burst when a skill is taken. Keyed so every pick plays it again. */}
        {burst > 0 ? (
          <span key={burst} className="game-bar-burst pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="game-bar-burst-ring" />
            <span className="game-bar-burst-ring game-bar-burst-ring-late" />
            <span className="game-bar-burst-name">{burstFrom.current}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default RunGameBar;
