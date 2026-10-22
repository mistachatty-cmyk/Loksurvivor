import { Disc3, Library, Music } from 'lucide-react';
import { useState } from 'react';

import { useMusicPlayer, formatTime } from '@/game/audio/musicPlayer';
import { useMeta } from '@/game/state/metaStore';
import { DISC_PULSE_LEVELS, readDiscPulse, writeDiscPulse, type DiscPulseLevel } from '@/lib/discPulse';
import { useT } from '@/lib/i18n';
import { REACTIVE_BG_LEVELS, readReactiveBg, readTheaterMix, writeReactiveBg, writeTheaterMix, type ReactiveBgLevel } from '@/lib/jukeboxPrefs';
import { ArrivalDiscsToggle } from './ArrivalDiscsToggle';

const ON = 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white';

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div className="flex shrink-0 gap-2">{children}</div>
      </div>
    </div>
  );
}

/** All the music-related settings in one place: the discs, their pulse, the Jukebox Room and the soundtrack itself. */
export function JukeboxSettings({ onOpenScreen }: { onOpenScreen?: (id: string) => void }) {
  const t = useT();
  const { meta, setMusicReactive, unlockedRooms } = useMeta();
  const player = useMusicPlayer();
  const [pulse, setPulse] = useState<DiscPulseLevel>(readDiscPulse);
  const [mix, setMix] = useState(readTheaterMix);
  const [bg, setBg] = useState<ReactiveBgLevel>(readReactiveBg);
  const roomOpen = unlockedRooms.some((room) => room.id === 'jukebox-room');

  return (
    <section id="settings-jukebox" className="scroll-mt-24 border border-border bg-card p-5 sm:p-6" data-testid="section-jukebox-settings">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-sky-300/40 bg-sky-400/10 text-sky-200">
          <Disc3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-200">{t('settings.jukebox.kicker')}</p>
          <h2 className="mt-1 text-xl font-black uppercase text-white">{t('settings.jukebox.title')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.jukebox.intro')}</p>

          <Row title={t('settings.jukebox.volume')} body={t('settings.jukebox.volumeBody', { percent: String(Math.round(player.volume * 100)) })}>
            <input
              type="range" min={0} max={1} step={0.01} value={player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label={t('settings.jukebox.volume')} className="w-40 accent-fuchsia-300" data-testid="input-jukebox-volume"
            />
          </Row>

          <Row title={t('settings.jukebox.react')} body={t('settings.jukebox.reactBody')}>
            <button type="button" aria-pressed={meta.musicReactiveEnabled} onClick={() => setMusicReactive(!meta.musicReactiveEnabled)} className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${meta.musicReactiveEnabled ? ON : OFF}`}>
              {meta.musicReactiveEnabled ? 'On' : 'Off'}
            </button>
          </Row>

          <ArrivalDiscsToggle />

          <Row title={t('settings.jukebox.pulse')} body={t('settings.jukebox.pulseBody')}>
            {DISC_PULSE_LEVELS.map((level) => (
              <button
                key={level} type="button" aria-pressed={pulse === level}
                onClick={() => { writeDiscPulse(level); setPulse(level); }}
                className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${pulse === level ? ON : OFF}`}
                data-testid={`button-disc-pulse-${level}`}
              >
                {t(`settings.jukebox.pulse.${level}` as never)}
              </button>
            ))}
          </Row>

          <Row title={t('settings.jukebox.bg')} body={t('settings.jukebox.bgBody')}>
            {REACTIVE_BG_LEVELS.map((level) => (
              <button
                key={level} type="button" aria-pressed={bg === level}
                onClick={() => { writeReactiveBg(level); setBg(level); }}
                className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${bg === level ? ON : OFF}`}
                data-testid={`button-reactive-bg-${level}`}
              >
                {t(`settings.jukebox.pulse.${level}` as never)}
              </button>
            ))}
          </Row>

          <Row title={t('settings.jukebox.autoplay')} body={t('settings.jukebox.autoplayBody')}>
            <button type="button" aria-pressed={player.autoStart} onClick={() => player.setAutoStart(!player.autoStart)} className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${player.autoStart ? ON : OFF}`} data-testid="button-jukebox-autoplay">
              {player.autoStart ? 'On' : 'Off'}
            </button>
          </Row>

          <Row title={t('settings.jukebox.shuffle')} body={t('settings.jukebox.shuffleBody')}>
            <button type="button" aria-pressed={player.shuffle} onClick={player.toggleShuffle} className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${player.shuffle ? ON : OFF}`} data-testid="button-jukebox-shuffle">
              {player.shuffle ? 'On' : 'Off'}
            </button>
          </Row>

          <Row title={t('settings.jukebox.repeat')} body={t('settings.jukebox.repeatBody')}>
            <button type="button" onClick={player.cycleRepeat} className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${player.repeat === 'off' ? OFF : ON}`} data-testid="button-jukebox-repeat">
              {t(`settings.jukebox.repeat.${player.repeat}` as never)}
            </button>
          </Row>

          <Row title={t('settings.jukebox.theater')} body={t('settings.jukebox.theaterBody')}>
            <button type="button" aria-pressed={mix} onClick={() => { writeTheaterMix(!mix); setMix(!mix); }} className={`border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${mix ? ON : OFF}`} data-testid="button-theater-mix">
              {mix ? 'On' : 'Off'}
            </button>
          </Row>

          <div className="mt-4 flex flex-wrap gap-2">
            {roomOpen && onOpenScreen ? (
              <button type="button" onClick={() => onOpenScreen('jukebox')} className="inline-flex items-center gap-2 border border-sky-300/50 bg-sky-400/10 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-sky-100" data-testid="button-open-jukebox-room">
                <Disc3 className="h-4 w-4" />{t('settings.jukebox.openRoom')}
              </button>
            ) : null}
            {onOpenScreen ? (
              <button type="button" onClick={() => onOpenScreen('music')} className="inline-flex items-center gap-2 border border-border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-white" data-testid="button-open-music-library">
                <Library className="h-4 w-4" />{t('settings.jukebox.openLibrary')}
              </button>
            ) : null}
          </div>
          {player.currentTrack ? (
            <p className="mt-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
              <Music className="h-3.5 w-3.5" />{player.currentTrack.title} · {formatTime(player.durationSec)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
