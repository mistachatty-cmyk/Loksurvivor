import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import { DrumRack } from '@/game/audio/studio/drums';
import { unlockStudioAudio } from '@/game/audio/studio/engine';
import type { StudioController } from './useStudio';

export function StepSequencer({ studio }: { studio: StudioController }) {
  const [patternId, setPatternId] = useState<string | null>(null);
  const [kitId, setKitId] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ pad: number; step: number } | null>(null);
  const sampleInput = useRef<HTMLInputElement>(null);
  const preview = useRef<DrumRack | null>(null);
  const pattern = studio.project.patterns.find((item) => item.id === patternId) ?? studio.project.patterns[0];
  const kit = studio.project.kits.find((item) => item.id === kitId) ?? studio.project.kits[0];
  const pad = selected && kit?.pads[selected.pad];

  useEffect(() => {
    preview.current?.dispose();
    preview.current = kit ? new DrumRack(kit, studio.master) : null;
    return () => { preview.current?.dispose(); preview.current = null; };
  }, [kit, studio.master]);

  if (!pattern || !kit) return <p className="text-xs text-muted-foreground">Create a pattern and kit to start a beat.</p>;
  const hit = selected && pattern.hits.find((item) => item.pad === selected.pad && item.step === selected.step);
  const previewPad = async (index: number) => {
    await unlockStudioAudio();
    preview.current?.trigger(index, Tone.now(), 0.85);
  };

  return (
    <section className="min-w-0 space-y-3 border border-border bg-card/50 p-3" aria-label="Drum sequencer" data-testid="studio-drum-sequencer">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-xs font-bold uppercase tracking-widest text-white">Drum sequencer</h2>
        <select value={pattern.id} onChange={(event) => setPatternId(event.target.value)} aria-label="Pattern" className="border border-border bg-background px-2 py-2 text-xs text-white">
          {studio.project.patterns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" onClick={studio.newPattern} className="border border-border px-2 py-2 text-xs text-white">New pattern</button>
        <button type="button" onClick={() => studio.copyPattern(pattern.id)} className="border border-border px-2 py-2 text-xs text-white">Duplicate pattern</button>
        <select value={kit.id} onChange={(event) => setKitId(event.target.value)} aria-label="Drum kit" className="border border-border bg-background px-2 py-2 text-xs text-white">
          {studio.project.kits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" onClick={() => studio.copyKit(kit.id)} className="border border-border px-2 py-2 text-xs text-white">Duplicate kit</button>
        {studio.reusableKits.length > 0 && <select value="" onChange={(event) => { if (event.target.value) void studio.reuseKit(event.target.value); }} aria-label="Reuse a saved kit" className="border border-border bg-background px-2 py-2 text-xs text-white"><option value="">Reuse saved kit…</option>{studio.reusableKits.map((entry, index) => <option key={`${entry.kit.id}-${index}`} value={entry.kit.id}>{entry.kit.name} · {entry.projectName}</option>)}</select>}
        <button type="button" onClick={() => studio.placePattern(pattern.id, kit.id)} className="bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Add to song</button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <label>Pattern name <input value={pattern.name} onChange={(event) => studio.patchPattern(pattern.id, { name: event.target.value })} className="ml-1 w-28 border border-border bg-background px-2 py-1 text-white" /></label>
        <label>Bars <select value={pattern.bars} onChange={(event) => studio.patchPattern(pattern.id, { bars: Number(event.target.value) })} className="ml-1 border border-border bg-background px-2 py-1 text-white">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>Swing <input type="range" min="0" max="0.75" step="0.05" value={pattern.swing} onChange={(event) => studio.patchPattern(pattern.id, { swing: Number(event.target.value) })} aria-label="Pattern swing" /> {Math.round(pattern.swing * 100)}%</label>
        <label>Kit name <input value={kit.name} onChange={(event) => studio.renameKit(kit.id, event.target.value)} className="ml-1 w-32 border border-border bg-background px-2 py-1 text-white" /></label>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-max space-y-1">
          <div className="flex gap-1 pl-28">{Array.from({ length: pattern.bars * 16 }, (_, step) => <span key={step} className="w-7 text-center text-[9px] text-muted-foreground">{step % 16 === 0 ? Math.floor(step / 16) + 1 : step % 4 === 0 ? '·' : ''}</span>)}</div>
          {kit.pads.map((item, padIndex) => <div key={padIndex} className="flex items-center gap-1">
            <button type="button" onClick={() => void previewPad(padIndex)} className="w-27 shrink-0 truncate border border-border px-1 py-1 text-left text-[10px] text-white" style={{ width: 108 }} aria-label={`Preview ${item.name}`}>{item.name}</button>
            {Array.from({ length: pattern.bars * 16 }, (_, step) => {
              const active = pattern.hits.find((entry) => entry.step === step && entry.pad === padIndex);
              return <button key={step} type="button" onClick={() => { setSelected({ pad: padIndex, step }); studio.setDrumHit(pattern.id, step, padIndex, active ? 0 : 0.8); }} onContextMenu={(event) => { event.preventDefault(); setSelected({ pad: padIndex, step }); studio.setDrumHit(pattern.id, step, padIndex, active ? Math.min(1, active.velocity + 0.2) : 0.4); }} aria-label={`${item.name} step ${step + 1}`} aria-pressed={Boolean(active)} className={`h-7 w-7 shrink-0 border ${active ? 'border-primary bg-primary text-primary-foreground' : step % 4 === 0 ? 'border-white/30 bg-white/10' : 'border-border bg-background'}`} style={{ opacity: active ? 0.45 + active.velocity * 0.55 : 1 }} />;
            })}
          </div>)}
        </div>
      </div>
      {selected && pad && <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs text-white">
        <strong>{pad.name} · step {selected.step + 1}</strong>
        <label>Velocity <input type="range" min="0" max="1" step="0.05" value={hit?.velocity ?? 0} onChange={(event) => studio.setDrumHit(pattern.id, selected.step, selected.pad, Number(event.target.value))} /> {Math.round((hit?.velocity ?? 0) * 100)}%</label>
        <button type="button" onClick={() => sampleInput.current?.click()} className="border border-border px-2 py-1">Replace sound</button>
        <input ref={sampleInput} type="file" accept="audio/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void studio.importPadSample(kit.id, selected.pad, file); event.target.value = ''; }} />
        <label>Tune <input type="number" min="-24" max="24" value={pad.tuneSemitones} onChange={(event) => studio.patchPad(kit.id, selected.pad, { tuneSemitones: Number(event.target.value) })} className="w-14 border border-border bg-background px-1" /></label>
        <label>Level <input type="range" min="0" max="2" step="0.05" value={pad.gain} onChange={(event) => studio.patchPad(kit.id, selected.pad, { gain: Number(event.target.value) })} /></label>
        <label>Start <input type="number" min="0" step="0.01" value={pad.trimStartSeconds} onChange={(event) => studio.patchPad(kit.id, selected.pad, { trimStartSeconds: Number(event.target.value) })} className="w-16 border border-border bg-background px-1" /></label>
        <label>End <input type="number" min="0" step="0.01" value={pad.trimEndSeconds} onChange={(event) => studio.patchPad(kit.id, selected.pad, { trimEndSeconds: Number(event.target.value) })} className="w-16 border border-border bg-background px-1" /></label>
        <label>Choke <input type="number" min="0" max="8" value={pad.chokeGroup} onChange={(event) => studio.patchPad(kit.id, selected.pad, { chokeGroup: Number(event.target.value) })} className="w-12 border border-border bg-background px-1" /></label>
      </div>}
      <p className="text-[10px] text-muted-foreground">Tap a step to toggle it. Right click a step to raise its velocity. Add to song places the pattern on the armed track or first track.</p>
    </section>
  );
}
