import { useEffect, useState } from 'react';

type UiOpacity = { all: number; hud: number; menus: number; popups: number };
const KEY = 'survivor616.ui-opacity.v1';
const DEFAULTS: UiOpacity = { all: 100, hud: 100, menus: 100, popups: 100 };

function loadOpacity(): UiOpacity {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return DEFAULTS; }
}

function applyOpacity(value: UiOpacity) {
  const root = document.documentElement.style;
  root.setProperty('--ui-opacity-all', String(value.all / 100));
  root.setProperty('--ui-opacity-hud', String(value.hud / 100));
  root.setProperty('--ui-opacity-menus', String(value.menus / 100));
  root.setProperty('--ui-opacity-popups', String(value.popups / 100));
}

export function UiTransparencyControls() {
  const [value, setValue] = useState<UiOpacity>(loadOpacity);
  useEffect(() => { applyOpacity(value); localStorage.setItem(KEY, JSON.stringify(value)); }, [value]);
  const set = (key: keyof UiOpacity, next: number) => setValue((current) => ({ ...current, [key]: next }));

  return <section className="border border-border bg-card p-5 sm:p-6" data-testid="section-ui-transparency">
    <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Interface visibility</p>
    <h2 className="mt-1 text-xl font-black uppercase text-white">UI transparency</h2>
    <p className="mt-2 text-sm text-muted-foreground">Lower everything together, then fine-tune the HUD, menus, and popups separately.</p>
    <div className="mt-4 space-y-4">
      {(['all', 'hud', 'menus', 'popups'] as const).map((key) => <label key={key} className="block">
        <span className="mb-1 flex justify-between font-mono text-[10px] font-bold uppercase tracking-widest text-white/70"><span>{key === 'all' ? 'All interface' : key}</span><span>{value[key]}%</span></span>
        <input type="range" min={35} max={100} value={value[key]} onChange={(event) => set(key, Number(event.target.value))} className="w-full accent-cyan-300" data-testid={`input-ui-opacity-${key}`} />
      </label>)}
    </div>
  </section>;
}

export function restoreUiTransparency() { applyOpacity(loadOpacity()); }
