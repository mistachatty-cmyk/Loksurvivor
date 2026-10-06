/**
 * The Operator Forge: a hidden, optional screen for designing and generating
 * brand-new operators. It never edits an authored operator; everything made
 * here is saved as a separate forged operator (see `game/data/operatorForge.ts`
 * and `game/data/forgedOperators.ts`). Revealed from Settings.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { CHARACTERS, CHARACTERS_BY_ID } from '@/game/data/characters';
import { isForgeKit } from '@/game/data/forgedOperators';
import {
  CORE_SPECIES, FACTION_SPECIES,
  BODY_BUILDS, FORGE_CATEGORIES, FORGE_GROUPS, HEIGHT_RANGE, OPERATOR_FLAVORS_LIST, PALETTE_KEYS,
  PALETTE_SCHEMES, SKIN_TONES, WIDTH_RANGE, bodyFromBuild, buildOperatorRig, exportForgedOperator, featureLabel,
  generateForgedOperator, generateOperatorDesign, generateOperatorIdentity, generatePalette, importForgedOperator,
  minWidthFor, newForgedId, rerollDesign, speciesById, type FeatureField, type ForgedOperator, type OperatorDesign,
  type OperatorFlavor, type PaletteSpec, type RerollTarget,
} from '@/game/data/operatorForge';
import { deleteForgedOperator, earnedEndgameIds, earnedSlotCount, isFeatureEnabled, loadForgedOperators, saveForgedOperator } from '@/game/state/operatorForgeStore';
import { CUSTOM_SLOTS, endgameReached } from '@/game/data/endgameUnlocks';
import { useMeta } from '@/game/state/metaStore';
import type { AnimName } from '@/game/types';
import { RigPortrait } from './RigPortrait';

const BUTTON =
  'min-h-10 border border-border bg-background px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:border-primary disabled:opacity-40';
const PRIMARY =
  'min-h-10 border border-primary bg-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40';
const FIELD = 'w-full border border-border bg-background px-2 py-2 text-sm text-white';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground';

let seedCounter = 0;
function freshSeed(): string {
  seedCounter += 1;
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}${seedCounter}`;
}

type ForgeDraft = { design: OperatorDesign; identity: ReturnType<typeof generateOperatorIdentity>; kitId: string };

export interface OperatorForgePanelProps {
  onClose: () => void;
}

export function OperatorForgePanel({ onClose }: OperatorForgePanelProps) {
  const { meta } = useMeta();

  const kits = useMemo(
    () => CHARACTERS.filter((c) => isForgeKit(c) && (c.unlock.kind === 'default' || meta.unlockedCharacterIds.includes(c.id) || meta.devModeAllUnlocks)),
    [meta.unlockedCharacterIds, meta.devModeAllUnlocks],
  );

  const factionRaces = useMemo(() => isFeatureEnabled('factionRaces'), []);
  const [seed, setSeed] = useState(() => freshSeed());
  const [genSpecies, setGenSpecies] = useState('');
  const [genFlavor, setGenFlavor] = useState('');
  const [design, setDesign] = useState<OperatorDesign>(() => generateOperatorDesign(seed));
  const [identity, setIdentity] = useState(() => generateOperatorIdentity(seed, generateOperatorDesign(seed)));
  const [kitId, setKitId] = useState(() => kits[0]?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [anim, setAnim] = useState<AnimName>('idle');
  const [saved, setSaved] = useState<ForgedOperator[]>(() => loadForgedOperators());
  const [codeText, setCodeText] = useState('');
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [past, setPast] = useState<ForgeDraft[]>([]);
  const [future, setFuture] = useState<ForgeDraft[]>([]);
  const lastDraft = useRef<ForgeDraft>({ design, identity, kitId });
  const skipHistory = useRef(false);

  useEffect(() => {
    const previous = lastDraft.current;
    if (previous.design === design && previous.identity === identity && previous.kitId === kitId) return;
    lastDraft.current = { design, identity, kitId };
    if (skipHistory.current) { skipHistory.current = false; return; }
    setPast((items) => [...items.slice(-29), previous]);
    setFuture([]);
  }, [design, identity, kitId]);

  const restoreDraft = (draft: ForgeDraft) => {
    skipHistory.current = true;
    setDesign(draft.design);
    setIdentity(draft.identity);
    setKitId(draft.kitId);
    setDirty(true);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [lastDraft.current, ...items]);
    restoreDraft(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, lastDraft.current]);
    restoreDraft(next);
  };

  const rig = useMemo(() => buildOperatorRig(design), [design]);
  const kit = CHARACTERS_BY_ID[kitId];

  const notify = useCallback((text: string) => setMessage(text), []);

  const confirmDiscard = () => !dirty || window.confirm('Discard unsaved Forge changes?');
  const close = () => { if (confirmDiscard()) onClose(); };

  const loadSeed = useCallback(
    (nextSeed: string) => {
      if (dirty && !window.confirm('Replace your unsaved Forge changes with a generated design?')) return;
      skipHistory.current = true;
      setPast([]);
      setFuture([]);
      const options = { species: genSpecies || undefined, flavor: (genFlavor || undefined) as OperatorFlavor | undefined, coreOnly: !factionRaces };
      const nextDesign = generateOperatorDesign(nextSeed, options);
      setSeed(nextSeed);
      setDesign(nextDesign);
      setIdentity(generateOperatorIdentity(nextSeed, nextDesign));
      setEditingId(null);
      setDirty(true);
    },
    [genFlavor, genSpecies, factionRaces, dirty],
  );

  const reroll = (target: RerollTarget) => {
    setDesign((current) => rerollDesign(current, target, freshSeed()));
    setDirty(true);
  };

  const setSpec = (patch: Partial<PaletteSpec>) => {
    setDesign((current) => {
      const paletteSpec: PaletteSpec = { ...current.paletteSpec, skin: current.palette.skin, ...patch };
      return { ...current, paletteSpec, palette: generatePalette(paletteSpec) };
    });
    setDirty(true);
  };

  const setPaletteColor = (key: (typeof PALETTE_KEYS)[number], value: string) => {
    setDesign((current) => ({ ...current, palette: { ...current.palette, [key]: value } }));
    setDirty(true);
  };

  const setSkin = (hex: string) => {
    setDesign((current) => ({ ...current, palette: { ...current.palette, skin: hex }, paletteSpec: { ...current.paletteSpec, skin: hex } }));
    setDirty(true);
  };

  const setFeature = (field: FeatureField, value: string) => {
    setDesign((current) => ({ ...current, look: { ...current.look, [field]: value } }));
    setDirty(true);
  };

  const setFeatureColor = (colorField: string, value: string) => {
    setDesign((current) => ({ ...current, look: { ...current.look, [colorField]: value } }));
    setDirty(true);
  };

  const setBuild = (buildId: string) => {
    setDesign((current) => ({ ...current, body: bodyFromBuild(buildId) }));
    setDirty(true);
  };

  const setBodySize = (patch: Partial<{ height: number; width: number }>) => {
    setDesign((current) => ({ ...current, body: { ...current.body, ...patch } }));
    setDirty(true);
  };

  const refreshSaved = () => setSaved(loadForgedOperators());

  const save = (asNew: boolean) => {
    if (!kit) {
      notify('Pick a kit first.');
      return;
    }
    const existing = new Set(loadForgedOperators().map((o) => o.id));
    const id = !asNew && editingId ? editingId : newForgedId(`${seed}:${Date.now()}`, existing);
    const op: ForgedOperator = {
      id,
      name: identity.name.trim() || 'Unnamed Operator',
      handle: identity.handle.trim() || 'Forged',
      tagline: identity.tagline.trim() || 'Made in the Forge.',
      bio: identity.bio.trim() || 'A one-of-a-kind operator.',
      kitId,
      design,
      createdAt: Date.now(),
    };
    if (!saveForgedOperator(op)) {
      notify('Could not save. Every custom slot you have earned is full (delete one to make room), or this device is out of storage.');
      return;
    }
    setEditingId(id);
    setDirty(false);
    refreshSaved();
    notify(`${op.name} saved. Reload to add them to your roster.`);
  };

  const forgeBatch = (count: number) => {
    if (kits.length === 0 || count <= 0) return;
    const existing = new Set(loadForgedOperators().map((o) => o.id));
    let made = 0;
    for (let i = 0; i < count; i += 1) {
      const batchSeed = freshSeed();
      const pickKit = kits[Math.floor(Math.random() * kits.length)]!;
      const op = generateForgedOperator(batchSeed, pickKit.id, existing, Date.now() + i, {
        species: genSpecies || undefined,
        coreOnly: !factionRaces,
        flavor: (genFlavor || undefined) as OperatorFlavor | undefined,
      });
      existing.add(op.id);
      if (!saveForgedOperator(op)) break;
      made += 1;
    }
    refreshSaved();
    notify(made > 0 ? `Forged ${made} new operators with random kits. Reload to add them to your roster.` : 'Could not save any operators.');
  };

  const edit = (op: ForgedOperator) => {
    if (!confirmDiscard()) return;
    skipHistory.current = true;
    setPast([]);
    setFuture([]);
    setDesign(op.design);
    setIdentity({ name: op.name, handle: op.handle, tagline: op.tagline, bio: op.bio });
    setKitId(op.kitId);
    setEditingId(op.id);
    setSeed(op.id.replace(/^forge-/, ''));
    setDirty(false);
    notify(`Editing ${op.name}. Save to keep changes, or Save as new to make a copy. Reload afterwards to apply.`);
  };

  const remove = (op: ForgedOperator) => {
    if (!window.confirm(`Delete ${op.name}? This removes the forged operator from this device.`)) return;
    deleteForgedOperator(op.id);
    if (editingId === op.id) setEditingId(null);
    refreshSaved();
    notify(`${op.name} deleted. Reload to update your roster.`);
  };

  const duplicate = (op: ForgedOperator) => {
    const existing = new Set(loadForgedOperators().map((item) => item.id));
    const copy = { ...op, id: newForgedId(`${op.id}:${Date.now()}`, existing), name: `${op.name} Copy`.slice(0, 40), createdAt: Date.now() };
    if (!saveForgedOperator(copy)) {
      notify('No free custom slot is available for a copy.');
      return;
    }
    refreshSaved();
    notify(`${copy.name} saved. Reload to add them to your roster.`);
  };

  const revertEditing = () => {
    const original = saved.find((op) => op.id === editingId);
    if (!original || !window.confirm(`Restore ${original.name} to its last saved design?`)) return;
    skipHistory.current = true;
    setPast([]);
    setFuture([]);
    setDesign(original.design);
    setIdentity({ name: original.name, handle: original.handle, tagline: original.tagline, bio: original.bio });
    setKitId(original.kitId);
    setDirty(false);
    notify(`${original.name} restored to the last saved version.`);
  };

  const copyCode = async (op: ForgedOperator) => {
    const code = exportForgedOperator(op);
    try {
      await navigator.clipboard.writeText(code);
      notify(`Share code for ${op.name} copied.`);
    } catch {
      setCodeText(code);
      notify('Could not use the clipboard, so the code is in the box below. Copy it from there.');
    }
  };

  const importCode = () => {
    const existing = new Set(loadForgedOperators().map((o) => o.id));
    const op = importForgedOperator(codeText, existing, Date.now());
    if (!op) {
      notify('That does not look like a Forge share code.');
      return;
    }
    const importedKit = CHARACTERS_BY_ID[op.kitId];
    if (!importedKit || !isForgeKit(importedKit)) {
      notify('That operator uses a kit this version does not have.');
      return;
    }
    if (!saveForgedOperator(op)) {
      notify('Could not save the imported operator.');
      return;
    }
    refreshSaved();
    setCodeText('');
    notify(`${op.name} imported. Reload to add them to your roster.`);
  };

  const species = speciesById(design.species);
  const earnedIds = earnedEndgameIds();
  const slotsEarned = earnedSlotCount();
  const slotAvailable = (id: string) => (meta.devModeAccessUnlocked && meta.devModeAllUnlocks) || earnedIds.includes(id);
  const freeSlots = Math.max(0, slotsEarned - saved.length);

  return createPortal(
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-background text-white" data-testid="panel-operator-forge" role="dialog" aria-label="Operator Forge">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">End game workshop</p>
            <h1 className="mt-1 text-2xl font-black uppercase">Operator Forge</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Design new operators from scratch or generate them. Forged operators are extra roster entries: your existing
              operators are never changed. Each one borrows the stats, weapon and ultimate of a kit you have already unlocked.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={undo} disabled={past.length === 0} className={BUTTON} data-testid="button-forge-undo">Undo</button>
            <button type="button" onClick={redo} disabled={future.length === 0} className={BUTTON} data-testid="button-forge-redo">Redo</button>
            <button type="button" onClick={close} className={BUTTON} data-testid="button-forge-close">Close</button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 border border-primary/50 bg-primary/10 px-4 py-3 text-sm" role="status" data-testid="text-forge-message">
            <span className="min-w-0 flex-1">{message}</span>
            {/reload/i.test(message) ? (
              <button type="button" onClick={() => window.location.reload()} className={PRIMARY} data-testid="button-forge-reload">Reload now</button>
            ) : null}
          </div>
        ) : null}

        <div className="sticky top-0 z-20 mt-4 flex items-center gap-3 border border-primary/40 bg-card p-2 shadow-lg lg:hidden" data-testid="forge-mobile-preview">
          <RigPortrait rig={rig} palette={design.palette} anim={anim} size={88} animated={false} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black uppercase">{identity.name || 'New operator'}</p><p className="text-xs text-muted-foreground">{species.label} · {dirty ? 'Unsaved changes' : editingId ? 'Saved' : 'New design'}</p></div>
          <button type="button" className={PRIMARY} onClick={() => save(false)} disabled={!kit}>Save</button>
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Preview and identity */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
            <section className="hidden border border-border bg-card p-4 lg:block">
              <div className="grid place-items-center border border-border/60 bg-black/30 py-3" data-testid="forge-preview">
                <RigPortrait rig={rig} palette={design.palette} anim={anim} size={240} />
              </div>
              <div className="mt-3 flex gap-2">
                {(['idle', 'walk', 'attack'] as AnimName[]).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setAnim(name)}
                    aria-pressed={anim === name}
                    className={`flex-1 border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest ${anim === name ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-white'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground" data-testid="text-forge-species">
                {species.label}. {species.blurb}
                {species.lore ? <span className="mt-1 block italic">{species.lore}</span> : null}
              </p>
            </section>

            <section className="space-y-3 border border-border bg-card p-4">
              <label className="block">
                <span className={LABEL}>Name</span>
                <input className={FIELD} value={identity.name} maxLength={40} onChange={(e) => { setIdentity({ ...identity, name: e.target.value }); setDirty(true); }} data-testid="input-forge-name" />
              </label>
              <label className="block">
                <span className={LABEL}>Handle</span>
                <input className={FIELD} value={identity.handle} maxLength={32} onChange={(e) => { setIdentity({ ...identity, handle: e.target.value }); setDirty(true); }} data-testid="input-forge-handle" />
              </label>
              <label className="block">
                <span className={LABEL}>Tagline</span>
                <input className={FIELD} value={identity.tagline} maxLength={120} onChange={(e) => { setIdentity({ ...identity, tagline: e.target.value }); setDirty(true); }} />
              </label>
              <label className="block">
                <span className={LABEL}>Bio</span>
                <textarea className={`${FIELD} h-24 resize-y`} value={identity.bio} maxLength={400} onChange={(e) => { setIdentity({ ...identity, bio: e.target.value }); setDirty(true); }} />
              </label>
              <button
                type="button"
                className={BUTTON}
                onClick={() => { setIdentity(generateOperatorIdentity(freshSeed(), design)); setDirty(true); }}
                data-testid="button-forge-reroll-identity"
              >
                Reroll name and bio
              </button>
            </section>

            <section className="space-y-3 border border-border bg-card p-4">
              <label className="block">
                <span className={LABEL}>Kit (stats, weapon, ultimate)</span>
                <select className={FIELD} value={kitId} onChange={(e) => { setKitId(e.target.value); setDirty(true); }} data-testid="select-forge-kit">
                  {kits.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </label>
              {kit ? (
                <p className="text-xs text-muted-foreground" data-testid="text-forge-kit">
                  Weapon: {kit.weapon.name}. Ultimate: {kit.ultimate.name}.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={PRIMARY} onClick={() => save(false)} disabled={!kit} data-testid="button-forge-save">
                  {editingId ? 'Save changes' : 'Save operator'}
                </button>
                {editingId ? (
                  <button type="button" className={BUTTON} onClick={() => save(true)} data-testid="button-forge-save-new">Save as new</button>
                ) : null}
                {editingId && dirty ? <button type="button" className={BUTTON} onClick={revertEditing}>Revert to saved</button> : null}
              </div>
              {dirty ? <p className="text-xs text-amber-200/80">Unsaved changes.</p> : null}
            </section>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <nav className="flex flex-wrap gap-2 border border-border bg-card p-3" aria-label="Forge sections">
              {[['forge-generate', 'Generate'], ['forge-body', 'Body'], ['forge-palette', 'Palette'], ...FORGE_GROUPS.map((group) => [`forge-${group.toLowerCase().replace(/\s+/g, '-')}`, group]), ['forge-saved', 'Saved operators']].map(([id, label]) => (
                <a key={id} href={`#${id}`} className="inline-flex min-h-10 items-center border border-border px-3 text-xs font-bold uppercase text-white hover:border-primary">{label}</a>
              ))}
            </nav>
            <section id="forge-generate" className="scroll-mt-36 border border-border bg-card p-4" data-testid="section-forge-generate">
              <h2 className="text-sm font-black uppercase tracking-wide">Generate</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every seed makes the same operator every time, so a seed is a shareable recipe.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>Species</span>
                  <select className={FIELD} value={genSpecies} onChange={(e) => setGenSpecies(e.target.value)} data-testid="select-forge-species">
                    <option value="">Any</option>
                    <optgroup label="Species">
                      {CORE_SPECIES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                    </optgroup>
                    {factionRaces ? (
                      <optgroup label="Faction races">
                        {FACTION_SPECIES.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Style</span>
                  <select className={FIELD} value={genFlavor} onChange={(e) => setGenFlavor(e.target.value)} data-testid="select-forge-flavor">
                    <option value="">Any</option>
                    {OPERATOR_FLAVORS_LIST.map((f) => (<option key={f} value={f}>{featureLabel(f)}</option>))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Seed</span>
                  <input className={FIELD} value={seed} onChange={(e) => setSeed(e.target.value)} data-testid="input-forge-seed" />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={PRIMARY} onClick={() => loadSeed(freshSeed())} data-testid="button-forge-surprise">Surprise me</button>
                <button type="button" className={BUTTON} onClick={() => loadSeed(seed.trim() || freshSeed())} data-testid="button-forge-from-seed">Generate from seed</button>
                <button type="button" className={BUTTON} onClick={() => forgeBatch(freeSlots)} disabled={kits.length === 0 || freeSlots === 0} data-testid="button-forge-batch">{freeSlots === 0 ? 'No free slots' : `Fill ${freeSlots} free slot${freeSlots === 1 ? '' : 's'} randomly`}</button>
              </div>
            </section>

            <section id="forge-body" className="scroll-mt-36 border border-border bg-card p-4" data-testid="section-forge-body">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wide">Body</h2>
                <button type="button" className={BUTTON} onClick={() => reroll('body')}>Roll body</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {BODY_BUILDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBuild(b.id)}
                    aria-pressed={design.body.build === b.id}
                    className={`border px-2 py-2 font-mono text-[10px] font-bold uppercase tracking-widest ${design.body.build === b.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-white'}`}
                    data-testid={`button-forge-build-${b.id}`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>Height {design.body.height}</span>
                  <input type="range" className="w-full" min={HEIGHT_RANGE.min} max={HEIGHT_RANGE.max} value={design.body.height} onChange={(e) => setBodySize({ height: Number(e.target.value) })} data-testid="range-forge-height" />
                </label>
                <label className="block">
                  <span className={LABEL}>Width {Math.max(design.body.width, minWidthFor(design.body.build))}</span>
                  <input type="range" className="w-full" min={minWidthFor(design.body.build)} max={WIDTH_RANGE.max} value={Math.max(design.body.width, minWidthFor(design.body.build))} onChange={(e) => setBodySize({ width: Number(e.target.value) })} data-testid="range-forge-width" />
                </label>
              </div>
            </section>

            <section id="forge-palette" className="scroll-mt-36 border border-border bg-card p-4" data-testid="section-forge-palette">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wide">Palette</h2>
                <div className="flex gap-2">
                  <button type="button" className={BUTTON} onClick={() => reroll('palette')} data-testid="button-forge-roll-palette">Roll palette</button>
                  <button type="button" className={BUTTON} onClick={() => reroll('colors')} data-testid="button-forge-roll-colors">Reshuffle item colors</button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>Scheme</span>
                  <select className={FIELD} value={design.paletteSpec.scheme} onChange={(e) => setSpec({ scheme: e.target.value as PaletteSpec['scheme'] })} data-testid="select-forge-scheme">
                    {PALETTE_SCHEMES.map((s) => (<option key={s} value={s}>{featureLabel(s)}</option>))}
                  </select>
                </label>
                <label className="block">
                  <span className={LABEL}>Hue {design.paletteSpec.hue}</span>
                  <input type="range" className="w-full" min={0} max={359} value={design.paletteSpec.hue} onChange={(e) => setSpec({ hue: Number(e.target.value) })} data-testid="range-forge-hue" />
                </label>
                <label className="block">
                  <span className={LABEL}>Lightness</span>
                  <input type="range" className="w-full" min={0} max={100} value={Math.round(design.paletteSpec.shade * 100)} onChange={(e) => setSpec({ shade: Number(e.target.value) / 100 })} />
                </label>
              </div>
              <div className="mt-3">
                <span className={LABEL}>Skin tone</span>
                <div className="mt-1 flex flex-wrap gap-1.5" data-testid="forge-skin-tones">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      title={tone.label}
                      aria-label={`Skin tone ${tone.label}`}
                      aria-pressed={design.palette.skin.toLowerCase() === tone.hex}
                      onClick={() => setSkin(tone.hex)}
                      className={`h-7 w-7 border-2 ${design.palette.skin.toLowerCase() === tone.hex ? 'border-white' : 'border-border'} ${tone.fantasy ? 'rotate-45' : ''}`}
                      style={{ backgroundColor: tone.hex }}
                      data-testid={`button-forge-skin-${tone.id}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                {PALETTE_KEYS.map((key) => (
                  <label key={key} className="block text-center">
                    <span className={LABEL}>{key === 'accentBright' ? 'bright' : key === 'bodyDark' ? 'dark' : key}</span>
                    <input type="color" className="mt-1 h-9 w-full cursor-pointer border border-border bg-background" value={design.palette[key]} onChange={(e) => setPaletteColor(key, e.target.value)} aria-label={`Palette ${key}`} />
                  </label>
                ))}
              </div>
            </section>

            {FORGE_GROUPS.map((group) => (
              <section key={group} id={`forge-${group.toLowerCase().replace(/\s+/g, '-')}`} className="scroll-mt-36 border border-border bg-card p-4" data-testid={`section-forge-${group.toLowerCase()}`}>
                <h2 className="text-sm font-black uppercase tracking-wide">{group}</h2>
                <div className="mt-3 space-y-2">
                  {FORGE_CATEGORIES.filter((c) => c.group === group).map((cat) => (
                    <div key={cat.field} className="grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[130px_1fr_130px_auto]">
                      <span className="col-span-2 text-xs font-bold uppercase tracking-wide text-white sm:col-span-1 sm:pb-2">{cat.label}</span>
                      <select
                        className={FIELD}
                        value={design.look[cat.field]}
                        onChange={(e) => setFeature(cat.field, e.target.value)}
                        aria-label={`${cat.label} style`}
                        data-testid={`select-forge-${cat.field}`}
                      >
                        {cat.ids.map((id) => (<option key={id} value={id}>{featureLabel(id)}</option>))}
                      </select>
                      <div className="flex items-center gap-1 sm:col-start-3">
                        <span className="h-5 w-5 shrink-0 border border-border" style={{ backgroundColor: design.palette[design.look[cat.colorField]] }} aria-hidden />
                        <select
                          className={FIELD}
                          value={design.look[cat.colorField]}
                          onChange={(e) => setFeatureColor(cat.colorField, e.target.value)}
                          aria-label={`${cat.label} color`}
                          data-testid={`select-forge-${cat.field}-color`}
                        >
                          {PALETTE_KEYS.map((key) => (<option key={key} value={key}>{key === 'accentBright' ? 'bright accent' : key === 'bodyDark' ? 'dark body' : key}</option>))}
                        </select>
                      </div>
                      <button type="button" className={BUTTON} onClick={() => reroll(cat.field)} aria-label={`Roll ${cat.label}`} data-testid={`button-forge-roll-${cat.field}`}>Roll</button>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section id="forge-saved" className="scroll-mt-36 border border-border bg-card p-4" data-testid="section-forge-saved">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-wide">Custom slots ({Math.min(saved.length, slotsEarned)}/{slotsEarned} used, {CUSTOM_SLOTS.length} total)</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Each slot holds one operator you made, built on a copy of a premade operator&apos;s kit. Your premade operators are never replaced.</p>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="list-forge-saved">
                {(() => {
                  let cursor = 0;
                  return CUSTOM_SLOTS.map((slot) => {
                    if (!slotAvailable(slot.id)) {
                      return (
                        <li key={slot.id} className="border border-dashed border-border/70 bg-background/30 p-3 opacity-80" data-testid={`slot-locked-${slot.id}`}>
                          <p className="text-sm font-black uppercase">{slot.label} <span className="font-mono text-[10px] tracking-widest text-muted-foreground">locked</span></p>
                          <p className="text-xs text-muted-foreground">{slot.how}{endgameReached(meta) ? '' : ' Clear every standard map first.'}</p>
                        </li>
                      );
                    }
                    const op = saved[cursor];
                    cursor += 1;
                    if (!op) {
                      return (
                        <li key={slot.id} className="border border-dashed border-amber-300/50 bg-amber-300/5 p-3" data-testid={`slot-empty-${slot.id}`}>
                          <p className="text-sm font-black uppercase">{slot.label} <span className="font-mono text-[10px] tracking-widest text-amber-200">empty</span></p>
                          <p className="text-xs text-muted-foreground">Save the operator in the preview to fill this slot.</p>
                        </li>
                      );
                    }
                    return (
                      <li key={slot.id} className="flex gap-3 border border-amber-300/40 bg-background/50 p-3" data-testid={`item-forge-${op.id}`}>
                        <RigPortrait rig={buildOperatorRig(op.design)} palette={op.design.palette} size={72} animated={false} />
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[9px] uppercase tracking-widest text-amber-200">{slot.label}</p>
                          <p className="truncate text-sm font-black uppercase">{op.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{op.handle} - kit: {CHARACTERS_BY_ID[op.kitId]?.name ?? 'missing'}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" className={BUTTON} onClick={() => edit(op)}>Edit</button>
                            <button type="button" className={BUTTON} onClick={() => duplicate(op)}>Duplicate</button>
                            <button type="button" className={BUTTON} onClick={() => void copyCode(op)}>Copy code</button>
                            <button type="button" className={BUTTON} onClick={() => remove(op)}>Delete</button>
                          </div>
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
              {saved.length > slotsEarned ? (
                <div className="mt-4" data-testid="list-forge-extra">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Made before slots existed (kept, not lost)</p>
                  <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                    {saved.slice(slotsEarned).map((op) => (
                      <li key={op.id} className="flex gap-3 border border-border/70 bg-background/50 p-3" data-testid={`item-forge-${op.id}`}>
                        <RigPortrait rig={buildOperatorRig(op.design)} palette={op.design.palette} size={72} animated={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black uppercase">{op.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{op.handle}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" className={BUTTON} onClick={() => edit(op)}>Edit</button>
                            <button type="button" className={BUTTON} onClick={() => void copyCode(op)}>Copy code</button>
                            <button type="button" className={BUTTON} onClick={() => remove(op)}>Delete</button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="mt-4">
                <span className={LABEL}>Import a share code</span>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <input className={FIELD} value={codeText} onChange={(e) => setCodeText(e.target.value)} placeholder="FORGE1:..." data-testid="input-forge-code" />
                  <button type="button" className={BUTTON} onClick={importCode} disabled={!codeText.trim()} data-testid="button-forge-import">Import</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
