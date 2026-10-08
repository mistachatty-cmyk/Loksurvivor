import { useState } from 'react';
import { getSongSpinSettings, setSongSpinSettings, type SongSpinSettings } from '@/game/state/songSpinSetting';

const CHIP = 'border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors';
const ON = 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white';

/** Hideout settings for LokPets spinning when a song starts. */
export function SongSpinSetting() {
  const [s, setS] = useState<SongSpinSettings>(getSongSpinSettings);
  const update = (patch: Partial<SongSpinSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    setSongSpinSettings(next);
  };
  const chip = (active: boolean, label: string, onClick: () => void, testId: string) => (
    <button key={testId} type="button" onClick={onClick} aria-pressed={active} className={`${CHIP} ${active ? ON : OFF}`} data-testid={testId}>{label}</button>
  );
  return (
    <div data-testid="settings-song-spin">
      <h3 className="mt-4 text-sm font-black uppercase tracking-wide text-white">LokPets spin to songs</h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
        When a song starts in the hideout your LokPets can spin. Choose which songs, for how long, and whether closer pets join in more often.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Spin to songs">
        {chip(s.enabled, 'On', () => update({ enabled: true }), 'button-song-spin-on')}
        {chip(!s.enabled, 'Off', () => update({ enabled: false }), 'button-song-spin-off')}
      </div>
      {s.enabled ? (
        <>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">When</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Which songs">
            {chip(s.cadence === 'every', 'Every song', () => update({ cadence: 'every' }), 'button-song-spin-every')}
            {chip(s.cadence === 'other', 'Every other song', () => update({ cadence: 'other' }), 'button-song-spin-other')}
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">How long</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="How long">
            {chip(s.length === 'burst', 'Short burst', () => update({ length: 'burst' }), 'button-song-spin-burst')}
            {chip(s.length === 'song', 'Whole song', () => update({ length: 'song' }), 'button-song-spin-song')}
          </div>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">Who</p>
          <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="Who spins">
            {chip(s.byBond, 'By happiness (bond)', () => update({ byBond: true }), 'button-song-spin-bond')}
            {chip(!s.byBond, 'All pets', () => update({ byBond: false }), 'button-song-spin-all')}
          </div>
          {s.byBond ? <p className="mt-2 max-w-xl text-xs text-muted-foreground">Strangers rarely join in; friends mostly do; partners and soulbound pets always spin.</p> : null}
        </>
      ) : null}
    </div>
  );
}
