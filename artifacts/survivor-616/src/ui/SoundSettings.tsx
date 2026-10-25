import { RotateCcw } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { EQ_LIMIT_DB, EQ_PRESETS, FLAT_EQ, applyPreset, clampDb, isFlatEq, presetFor, useEq, writeEq, type EqPresetId, type EqSettings } from '@/lib/musicEq';

const ON = 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white';

const BANDS = [
  { key: 'bassDb', label: 'sound.bass' },
  { key: 'midDb', label: 'sound.mid' },
  { key: 'trebleDb', label: 'sound.treble' },
] as const;

/** Bass, mid and treble, a handful of one-tap presets, even volume and mono. Lives in Music settings. */
export function SoundSettings() {
  const t = useT();
  const eq = useEq();
  const active = presetFor(eq);
  const set = (patch: Partial<EqSettings>) => writeEq({ ...eq, ...patch });

  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4" data-testid="section-sound-settings">
      <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('sound.title')}</h3>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('sound.body')}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {EQ_PRESETS.map((preset) => (
          <button
            key={preset.id} type="button" aria-pressed={active === preset.id}
            onClick={() => writeEq(applyPreset(eq, preset.id))}
            className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${active === preset.id ? ON : OFF}`}
            data-testid={`button-eq-preset-${preset.id}`}
          >
            {t(`sound.preset.${preset.id}` as never)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {BANDS.map(({ key, label }) => (
          <label key={key} className="block font-mono text-[10px] uppercase tracking-widest text-white/60">
            <span className="flex justify-between"><span>{t(label)}</span><span>{eq[key] > 0 ? '+' : ''}{eq[key]} dB</span></span>
            <input
              type="range" min={-EQ_LIMIT_DB} max={EQ_LIMIT_DB} step={1} value={eq[key]}
              onChange={(event) => set({ [key]: clampDb(Number(event.target.value)) })}
              aria-label={t(label)} className="mt-1 w-full accent-fuchsia-300" data-testid={`input-eq-${key}`}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={eq.evenVolume} onClick={() => set({ evenVolume: !eq.evenVolume })} className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${eq.evenVolume ? ON : OFF}`} data-testid="button-eq-even">
          {t('sound.even')}
        </button>
        <button type="button" aria-pressed={eq.mono} onClick={() => set({ mono: !eq.mono })} className={`border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest ${eq.mono ? ON : OFF}`} data-testid="button-eq-mono">
          {t('sound.mono')}
        </button>
        <button type="button" disabled={isFlatEq(eq)} onClick={() => writeEq({ ...FLAT_EQ })} className="inline-flex items-center gap-2 border border-border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:text-white disabled:opacity-30" data-testid="button-eq-reset">
          <RotateCcw className="h-3.5 w-3.5" />{t('sound.reset')}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('sound.evenBody')} {t('sound.monoBody')}</p>
    </div>
  );
}

export type { EqPresetId };
