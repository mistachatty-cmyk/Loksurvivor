/**
 * Shared "classic" gallery used by the Forge's Enemies and LokPets screens:
 * browse the existing rigs, recolor one, and keep it as a cosmetic custom look.
 * A custom look never changes stats, behavior or the base entry. Full parts-level
 * forges for enemies and LokPets are a later step; until then this is the classic option.
 */
import { useMemo, useState } from 'react';

import { PALETTE_KEYS } from '@/game/data/operatorForge';
import {
  MAX_CUSTOM_VARIANTS, bumpForgeStat, deleteCustomVariant, isCustomActive, loadCustomVariants, saveCustomVariant, setCustomActive,
  type CustomVariant, type CustomVariantKind,
} from '@/game/state/operatorForgeStore';
import { applyPaletteStyle, PALETTE_STYLE_IDS, seedFromId, type PaletteStyleId } from '@/game/sprites/paletteStyles';
import type { SpritePalette, SpriteRig } from '@/game/types';
import { t } from '@/lib/i18n';
import { RigPortrait } from './RigPortrait';
import { Switch } from './EndgameControls';

const STYLE_LABELS: Record<PaletteStyleId, string> = {
  original: 'Original', nocturne: 'Nocturne', countertone: 'Countertone', 'cel-broadcast': 'Cel Broadcast', 'riso-print': 'Riso Print',
};

const BUTTON =
  'min-h-10 border border-border bg-background px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:border-primary disabled:opacity-40';
const PRIMARY =
  'min-h-10 border border-primary bg-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40';
const FIELD = 'w-full border border-border bg-background px-2 py-2 text-sm text-white';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground';

export interface VariantEntry {
  id: string;
  name: string;
  /** Grouping label used by the filter (faction, family...). */
  group: string;
  blurb: string;
  facts: string;
  rig: SpriteRig;
  palette: SpritePalette;
}

export interface VariantStudioProps {
  kind: CustomVariantKind;
  entries: VariantEntry[];
  intro: string;
  testId: string;
}

let counter = 0;
const newVariantId = (kind: CustomVariantKind, baseId: string) => {
  counter += 1;
  return `${kind}-${baseId}-${Date.now().toString(36)}${counter}`;
};

export function VariantStudio({ kind, entries, intro, testId }: VariantStudioProps) {
  const group = kind === 'enemy' ? 'enemies' : 'pets';
  const [query, setQuery] = useState('');
  const [groupFilter, setGroup] = useState('');
  const [selectedId, setSelectedId] = useState(entries[0]?.id ?? '');
  const [palette, setPalette] = useState<SpritePalette | null>(null);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState<CustomVariant[]>(() => loadCustomVariants(kind));
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'classic' | 'styled'>('classic');
  const showStyles = kind === 'enemy';

  const groups = useMemo(() => [...new Set(entries.map((e) => e.group))].sort(), [entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => (!groupFilter || e.group === groupFilter) && (!q || e.name.toLowerCase().includes(q) || e.id.includes(q)));
  }, [entries, groupFilter, query]);

  const selected = byId.get(selectedId) ?? entries[0];
  const activePalette = palette ?? selected?.palette;

  const choose = (id: string) => {
    setSelectedId(id);
    setPalette(null);
    setName('');
    setEditingId(null);
    setMessage('');
  };

  const edit = (variant: CustomVariant) => {
    if (!byId.has(variant.baseId)) return;
    setSelectedId(variant.baseId);
    setPalette(variant.palette);
    setName(variant.name);
    setEditingId(variant.id);
  };

  const save = () => {
    if (!selected || !activePalette) return;
    const variant: CustomVariant = {
      id: editingId ?? newVariantId(kind, selected.id),
      baseId: selected.id,
      name: name.trim() || `${selected.name} Remix`,
      palette: activePalette,
      createdAt: Date.now(),
    };
    if (!saveCustomVariant(kind, variant)) {
      setMessage(t('forge.variants.full'));
      return;
    }
    if (!editingId) bumpForgeStat('recolored');
    setSaved(loadCustomVariants(kind));
    setEditingId(variant.id);
    setMessage(`${variant.name} saved.`);
  };

  if (!selected || !activePalette) return null;

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]" data-testid={testId}>
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="border border-border bg-card p-4">
          <div className="grid place-items-center border border-border/60 bg-black/30 py-3">
            <RigPortrait rig={selected.rig} palette={activePalette} size={220} />
          </div>
          <p className="mt-3 text-sm font-black uppercase">{selected.name}</p>
          <p className="text-xs text-muted-foreground">{selected.facts}</p>
          <p className="mt-2 text-xs italic text-muted-foreground">{selected.blurb}</p>
        </section>
        <section className="space-y-3 border border-border bg-card p-4">
          <label className="block">
            <span className={LABEL}>{t('forge.variants.nameLabel')}</span>
            <input className={FIELD} value={name} maxLength={40} placeholder={`${selected.name} Remix`} onChange={(e) => setName(e.target.value)} data-testid={`${testId}-name`} />
          </label>
          {showStyles && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button type="button" className={mode === 'classic' ? PRIMARY : BUTTON} onClick={() => setMode('classic')} data-testid={`${testId}-mode-classic`}>Classic (v1)</button>
                <button type="button" className={mode === 'styled' ? PRIMARY : BUTTON} onClick={() => setMode('styled')} data-testid={`${testId}-mode-styled`}>Styled (v2)</button>
              </div>
              {mode === 'styled' && (
                <div className="flex flex-wrap gap-1.5" data-testid={`${testId}-styles`}>
                  {PALETTE_STYLE_IDS.map((styleId) => (
                    <button
                      key={styleId}
                      type="button"
                      className={BUTTON}
                      onClick={() => setPalette(applyPaletteStyle(selected.palette, styleId, seedFromId(selected.id)))}
                      data-testid={`${testId}-style-${styleId}`}
                    >
                      {STYLE_LABELS[styleId]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-4 gap-2">
            {PALETTE_KEYS.map((key) => (
              <label key={key} className="block">
                <span className={LABEL}>{key === 'accentBright' ? 'bright' : key === 'bodyDark' ? 'dark' : key}</span>
                <input type="color" className="mt-1 h-9 w-full cursor-pointer border border-border bg-background" value={activePalette[key]} onChange={(e) => setPalette({ ...activePalette, [key]: e.target.value })} aria-label={`Palette ${key}`} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY} onClick={save} data-testid={`${testId}-save`}>{editingId ? t('forge.variants.saveChanges') : t('forge.variants.save')}</button>
            <button type="button" className={BUTTON} onClick={() => setPalette(null)}>{t('forge.variants.resetColors')}</button>
          </div>
          {message ? <p className="text-xs text-amber-200/80" role="status">{message}</p> : null}
        </section>
      </div>

      <div className="space-y-5">
        <section className="border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{intro}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input className={FIELD} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('forge.variants.search')} aria-label={t('forge.variants.search')} />
            <select className={FIELD} value={groupFilter} onChange={(e) => setGroup(e.target.value)} aria-label="Filter">
              <option value="">{t('forge.variants.all')}</option>
              {groups.map((g) => (<option key={g} value={g}>{g}</option>))}
            </select>
          </div>
          <ul className="mt-4 grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4" data-testid={`${testId}-grid`}>
            {visible.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => choose(e.id)}
                  aria-pressed={e.id === selected.id}
                  className={`flex w-full flex-col items-center gap-1 border p-2 ${e.id === selected.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'}`}
                >
                  <RigPortrait rig={e.rig} palette={e.palette} size={64} animated={false} />
                  <span className="w-full truncate text-center text-[11px] font-bold uppercase">{e.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="border border-border bg-card p-4">
          <h2 className="text-sm font-black uppercase tracking-wide">{t('forge.variants.saved')} ({saved.length}/{MAX_CUSTOM_VARIANTS})</h2>
          {saved.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t('forge.variants.none')}</p> : (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2" data-testid={`${testId}-saved`}>
              {saved.map((v) => {
                const base = byId.get(v.baseId);
                if (!base) return null;
                return (
                  <li key={v.id} className="flex items-center gap-3 border border-border/70 bg-background/50 p-2">
                    <RigPortrait rig={base.rig} palette={v.palette} size={64} animated={false} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black uppercase">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{base.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Switch on={isCustomActive(group, v.id)} label={t('bestiary.custom.active')} onClick={() => { setCustomActive(group, v.id, !isCustomActive(group, v.id)); setSaved(loadCustomVariants(kind)); }} testId={`switch-custom-${v.id}`} />
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t('bestiary.custom.active')}</span>
                      </div>
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" className={BUTTON} onClick={() => edit(v)}>{t('forge.variants.edit')}</button>
                        <button type="button" className={BUTTON} onClick={() => { deleteCustomVariant(kind, v.id); setSaved(loadCustomVariants(kind)); if (editingId === v.id) setEditingId(null); }}>{t('forge.variants.delete')}</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
