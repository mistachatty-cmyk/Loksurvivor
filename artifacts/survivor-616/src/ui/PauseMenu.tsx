/**
 * The pause overlay.
 *
 * Everything on the Status tab is read from the live `HudSnapshot` the run
 * loop keeps publishing while paused -- nothing is snapshotted when the pause
 * opens, so resuming and re-pausing never shows stale numbers, and an effect
 * that expires while the menu is open counts down in place.
 *
 * The Soundtrack tab drives the same `useMusicPlayer` transport the rest of
 * the app uses; its controls are only mounted while paused, which is exactly
 * the window the pause phase is up.
 */

import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { useState } from 'react';

import { formatTime, useMusicPlayer } from '@/game/audio/musicPlayer';
import { SettingsPanel } from '@/ui/SettingsPanel';
import type { CharacterDef, HudSnapshot, PlayerEffectSnapshot } from '@/game/types';

export type PauseTab = 'status' | 'settings' | 'soundtrack';

export interface PauseMenuProps {
  hud: HudSnapshot | null;
  character: CharacterDef;
  areaName: string;
  /** Endless runs offer "head home"; timed runs do not. */
  endless: boolean;
  onResume: () => void;
  onHeadHome: () => void;
  onAbandon: () => void;
}

const TABS: Array<{ id: PauseTab; label: string }> = [
  { id: 'status', label: 'Status' },
  { id: 'settings', label: 'Settings' },
  { id: 'soundtrack', label: 'Soundtrack' },
];

/** green = buff, red = debuff, blue = neutral status. */
const EFFECT_TONE: Record<PlayerEffectSnapshot['kind'], { text: string; border: string; background: string; label: string }> = {
  buff: { text: 'text-emerald-300', border: 'border-emerald-400/40', background: 'bg-emerald-400/10', label: 'Buff' },
  debuff: { text: 'text-red-300', border: 'border-red-400/40', background: 'bg-red-400/10', label: 'Debuff' },
  status: { text: 'text-sky-300', border: 'border-sky-400/40', background: 'bg-sky-400/10', label: 'Status' },
};

function formatRemaining(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s remaining`;
}

/** Turn the 0..1 day/night phase into something readable at a glance. */
function formatCyclePhase(phase: number): string {
  const hours = ((phase % 1) + 1) % 1 * 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/10 py-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">{label}</span>
      <span className="font-mono text-xs font-bold tabular-nums text-white">{value}</span>
    </div>
  );
}

function StatusTab({ hud, character, areaName }: { hud: HudSnapshot | null; character: CharacterDef; areaName: string }) {
  if (!hud) {
    return <p className="font-mono text-xs text-white/50">Reading run state…</p>;
  }

  const { stats } = hud;
  return (
    <div className="grid gap-5 md:grid-cols-2" data-testid="pause-tab-status">
      <section>
        <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
          {character.name} · {areaName}
        </h3>
        <div data-testid="pause-stats">
          <StatRow label="Health" value={`${hud.hp} / ${hud.maxHp}`} />
          <StatRow label="Level" value={`${hud.level} (${hud.xp}/${hud.xpToNext} xp)`} />
          <StatRow label="Move speed" value={stats.speed.toFixed(0)} />
          <StatRow label="Damage" value={`${(stats.power * 100).toFixed(0)}%`} />
          <StatRow label="Range / area" value={`${(stats.area * 100).toFixed(0)}%`} />
          <StatRow label="Attack rate" value={`${(1 / Math.max(0.01, stats.haste) * 100).toFixed(0)}%`} />
          <StatRow label="Armor" value={`${(stats.armor * 100).toFixed(0)}%`} />
          <StatRow label="Crit" value={`${(stats.crit * 100).toFixed(0)}%`} />
          <StatRow label="Lifesteal" value={`${(stats.lifesteal * 100).toFixed(0)}%`} />
          <StatRow label="Pickup range" value={stats.magnet.toFixed(0)} />
          <StatRow label="Kills" value={`${hud.kills}`} />
          <StatRow
            label="World clock"
            value={hud.timeless ? `${formatCyclePhase(hud.cyclePhase)} · held` : formatCyclePhase(hud.cyclePhase)}
          />
          {hud.timeMultiplier !== 1 ? (
            <StatRow label="Time flow" value={`${hud.timeMultiplier.toFixed(2)}x`} />
          ) : null}
        </div>
      </section>

      <div className="space-y-5">
        <section>
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Weapons</h3>
          <ul className="space-y-1" data-testid="pause-weapons">
            {hud.loadout.weapons.length === 0 ? (
              <li className="font-mono text-xs text-white/40">Nothing equipped yet.</li>
            ) : (
              hud.loadout.weapons.map((weapon) => (
                <li
                  key={weapon.id}
                  className="flex items-center justify-between gap-3 border border-white/15 bg-black/40 px-2 py-1"
                  data-testid={`pause-weapon-${weapon.id}`}
                >
                  <span className="truncate font-mono text-xs text-white" style={weapon.color ? { color: weapon.color } : undefined}>
                    {weapon.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-white/60">
                    Lv {weapon.level}
                  </span>
                </li>
              ))
            )}
          </ul>
          {hud.loadout.passives.length > 0 ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/40">
              {hud.loadout.passives.map((passive) => `${passive.name} x${passive.stacks}`).join(' · ')}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">Active effects</h3>
          <ul className="space-y-1" data-testid="pause-effects">
            {hud.playerEffects.length === 0 ? (
              <li className="font-mono text-xs text-white/40">Nothing riding on you right now.</li>
            ) : (
              hud.playerEffects.map((effect) => {
                const tone = EFFECT_TONE[effect.kind];
                return (
                  <li
                    key={effect.id}
                    className={`flex items-center justify-between gap-3 border px-2 py-1 ${tone.border} ${tone.background}`}
                    data-testid={`pause-effect-${effect.id}`}
                  >
                    <span className="min-w-0">
                      <span className={`block truncate font-mono text-xs font-bold ${tone.text}`}>
                        {effect.name} ({formatRemaining(effect.remainingMs)})
                      </span>
                      <span className="block truncate font-mono text-[10px] text-white/45">{effect.detail}</span>
                    </span>
                    <span className={`shrink-0 font-mono text-[9px] uppercase tracking-widest ${tone.text}`}>{tone.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SoundtrackTab() {
  const player = useMusicPlayer();

  return (
    <div className="space-y-3" data-testid="pause-tab-soundtrack">
      <div className="flex items-center gap-2 border border-white/15 bg-black/40 px-3 py-2">
        <Music className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-white">
          {player.currentTrack ? player.currentTrack.title : 'Nothing queued'}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/50">
          {formatTime(player.progressSec)} / {formatTime(player.durationSec)}
        </span>
        <button
          type="button"
          onClick={player.previous}
          className="grid h-8 w-8 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
          aria-label="Previous track"
          data-testid="button-pause-music-previous"
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={player.togglePlay}
          className="grid h-8 w-8 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
          aria-label={player.isPlaying ? 'Pause soundtrack' : 'Play soundtrack'}
          data-testid="button-pause-music-toggle"
        >
          {player.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={player.next}
          className="grid h-8 w-8 shrink-0 place-items-center border border-white/20 text-white hover:border-primary hover:text-primary"
          aria-label="Skip to next track"
          data-testid="button-pause-music-next"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto" data-testid="pause-track-list">
        {player.tracks.map((track, index) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => player.playTrack(track.id)}
              className={`flex w-full items-center justify-between gap-3 border px-2 py-1.5 text-left ${
                index === player.currentIndex
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-white/15 bg-black/40 text-white/80 hover:border-white/40'
              }`}
              data-testid={`button-pause-track-${track.id}`}
            >
              <span className="min-w-0 truncate font-mono text-xs">{track.title}</span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-white/40">{formatTime(track.duration)}</span>
            </button>
          </li>
        ))}
      </ul>
      {player.error ? <p className="font-mono text-[10px] text-red-300">{player.error}</p> : null}
    </div>
  );
}

export function PauseMenu({ hud, character, areaName, endless, onResume, onHeadHome, onAbandon }: PauseMenuProps) {
  const [tab, setTab] = useState<PauseTab>('status');

  return (
    <div className="absolute inset-0 z-[60] overflow-y-auto bg-black/90 p-4 sm:p-6" data-testid="overlay-paused">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-black uppercase tracking-wider text-white">Paused</h2>
          <button
            type="button"
            onClick={onResume}
            className="rounded-sm border border-white/25 bg-white/10 px-5 py-2 font-bold uppercase tracking-widest text-white"
            data-testid="button-resume"
          >
            Resume
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/15" role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-widest ${
                tab === entry.id ? 'border-primary text-primary' : 'border-transparent text-white/50 hover:text-white/80'
              }`}
              data-testid={`tab-pause-${entry.id}`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'status' ? <StatusTab hud={hud} character={character} areaName={areaName} /> : null}
        {tab === 'soundtrack' ? <SoundtrackTab /> : null}
        {tab === 'settings' ? (
          <div className="-mx-4 sm:-mx-6" data-testid="pause-tab-settings">
            <SettingsPanel onBack={() => setTab('status')} />
          </div>
        ) : null}

        {tab !== 'settings' ? (
          <div className="flex flex-wrap gap-2 pt-2">
            <p className="w-full font-mono text-[10px] uppercase tracking-widest text-white/40">
              WASD or arrows to move. Space for {character.ultimate.name}.
            </p>
            {endless ? (
              <button
                type="button"
                onClick={onHeadHome}
                className="rounded-sm border border-primary/50 bg-primary/10 px-4 py-2 font-bold uppercase tracking-widest text-primary"
                data-testid="button-head-home"
              >
                Head home
              </button>
            ) : null}
            <button
              type="button"
              onClick={onAbandon}
              className="rounded-sm border border-white/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-white/70"
              data-testid="button-abandon"
            >
              Abandon run
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
