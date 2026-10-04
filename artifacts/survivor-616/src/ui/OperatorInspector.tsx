/**
 * Full-screen operator viewer. Opened from a roster tile's magnifier (or by
 * double-clicking a tile), it shows the operator's real sprite rig at a large,
 * pixel-perfect size with every animation, a few backdrops, the palette, and
 * previous/next browsing across everyone unlocked, so a big roster can be
 * inspected without leaving the page.
 *
 * It is read-only: the only thing it can change is the selected operator, and
 * only when the player presses "Take out" in the panel.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import type { AnimName, CharacterDef, SpritePalette } from '@/game/types';
import { RigPortrait } from './RigPortrait';

export interface InspectorEntry {
  character: CharacterDef;
  palette: SpritePalette;
}

export interface OperatorInspectorProps {
  entries: InspectorEntry[];
  /** The character to show first. */
  startId: string;
  selectedId: string;
  onSelect: (characterId: string) => void;
  onClose: () => void;
}

const ANIMS: AnimName[] = ['idle', 'walk', 'attack', 'hurt', 'death'];
const BACKDROPS = [
  { id: 'night', label: 'Night', style: { background: 'radial-gradient(circle at 50% 40%, #1d1d2a 0%, #08080d 75%)' } },
  { id: 'day', label: 'Day', style: { background: 'radial-gradient(circle at 50% 40%, #f4f1e8 0%, #cfcabb 80%)' } },
  {
    id: 'grid',
    label: 'Grid',
    style: {
      backgroundColor: '#14141c',
      backgroundImage:
        'linear-gradient(#242433 1px, transparent 1px), linear-gradient(90deg, #242433 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    },
  },
] as const;
const PALETTE_LABELS: Array<[keyof SpritePalette, string]> = [
  ['ink', 'Ink'], ['body', 'Body'], ['bodyDark', 'Body dark'], ['accent', 'Accent'],
  ['accentBright', 'Bright accent'], ['skin', 'Skin'], ['glow', 'Glow'],
];
/** Baked frames are 4x, so steps of 4 keep every sprite pixel the same size. */
const SCALE_STEP = 4;
const FIGURE_FRACTION = 0.82;
const MAX_CANVAS = 1100;

function useViewport() {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function OperatorInspector({ entries, startId, selectedId, onSelect, onClose }: OperatorInspectorProps) {
  const viewport = useViewport();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(() => Math.max(0, entries.findIndex((e) => e.character.id === startId)));
  const [anim, setAnim] = useState<AnimName>('idle');
  const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]['id']>('night');
  const [zoomStep, setZoomStep] = useState<number | null>(null);

  const entry = entries[index] ?? entries[0];
  const character = entry?.character;
  const count = entries.length;

  const isWide = viewport.w >= 900;
  const stageMax = Math.max(160, Math.min(MAX_CANVAS, isWide ? viewport.h - 190 : viewport.h * 0.52, isWide ? viewport.w - 460 : viewport.w - 40));
  const pixelHeight = character?.rig.pixelHeight ?? 20;
  const canvasFor = useCallback((step: number) => Math.ceil((pixelHeight * SCALE_STEP * step) / FIGURE_FRACTION), [pixelHeight]);
  const maxStep = useMemo(() => {
    let step = 1;
    while (canvasFor(step + 1) <= stageMax) step += 1;
    return step;
  }, [canvasFor, stageMax]);
  const step = Math.min(zoomStep ?? maxStep, maxStep);
  const canvasSize = canvasFor(step);

  const go = useCallback(
    (delta: number) => {
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
      else if (event.key === '+' || event.key === '=') setZoomStep((s) => Math.min(maxStep, (s ?? maxStep) + 1));
      else if (event.key === '-') setZoomStep((s) => Math.max(1, (s ?? maxStep) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, maxStep, onClose]);

  if (!entry || !character) return null;
  const backdropStyle = BACKDROPS.find((b) => b.id === backdrop)!.style;

  // Portaled to the body so it sits above the page's own stacking contexts (floating Back, music button).
  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${character.name}`}
      className="fixed inset-0 z-[110] flex flex-col bg-black/90 text-white outline-none backdrop-blur-sm"
      data-testid="panel-operator-inspector"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-primary">Inspect operator</p>
          <h2 className="truncate text-xl font-black uppercase leading-tight" data-testid="text-inspector-name">{character.name}</h2>
          <p className="truncate text-xs font-bold uppercase tracking-wider text-primary/90">{character.handle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline" data-testid="text-inspector-count">
            {index + 1} / {count}
          </span>
          <button type="button" onClick={() => go(-1)} className="border border-border bg-background p-2 hover:border-primary" aria-label="Previous operator" data-testid="button-inspector-prev"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" onClick={() => go(1)} className="border border-border bg-background p-2 hover:border-primary" aria-label="Next operator" data-testid="button-inspector-next"><ChevronRight className="h-5 w-5" /></button>
          <button type="button" onClick={onClose} className="border border-border bg-background p-2 hover:border-primary" aria-label="Close" data-testid="button-inspector-close"><X className="h-5 w-5" /></button>
        </div>
      </div>

      <div className={`flex min-h-0 flex-1 gap-4 overflow-y-auto p-4 ${isWide ? 'flex-row' : 'flex-col'}`}>
        <div className="flex min-h-0 min-w-0 flex-1 items-start justify-center overflow-auto border border-border/60" data-testid="inspector-stage"
          // On a phone the stack scrolls, so the stage needs a real height or the figure is cropped.
          style={{ ...backdropStyle, ...(isWide ? {} : { minHeight: canvasSize + 4 }) }}
        >
          <RigPortrait
            key={character.id}
            rig={character.rig}
            palette={entry.palette}
            anim={anim}
            size={canvasSize}
            pixelScale={step * SCALE_STEP}
            className="shrink-0"
          />
        </div>

        <aside className={`${isWide ? 'w-[26rem] shrink-0' : 'w-full'} space-y-4`}>
          <section className="border border-border bg-card p-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Animation</p>
            <div className="mt-2 grid grid-cols-5 gap-1">
              {ANIMS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setAnim(name)}
                  aria-pressed={anim === name}
                  className={`border px-1 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider ${anim === name ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-white'}`}
                  data-testid={`button-inspector-anim-${name}`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label htmlFor="inspector-zoom" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                Zoom <span className="text-white" data-testid="text-inspector-zoom">{step * SCALE_STEP}x</span>
              </label>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Keys: + / -, arrows, Esc</span>
            </div>
            <input
              id="inspector-zoom"
              type="range"
              min={1}
              max={maxStep}
              value={step}
              onChange={(event) => setZoomStep(Number(event.target.value))}
              className="mt-1 w-full"
              data-testid="range-inspector-zoom"
            />
            <div className="mt-3 flex gap-1">
              {BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBackdrop(b.id)}
                  aria-pressed={backdrop === b.id}
                  className={`flex-1 border px-2 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider ${backdrop === b.id ? 'border-primary bg-primary/15 text-primary' : 'border-border text-muted-foreground hover:text-white'}`}
                  data-testid={`button-inspector-backdrop-${b.id}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </section>

          <section className="border border-border bg-card p-3">
            <p className="text-sm font-bold text-white">{character.tagline}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{character.bio}</p>
            <dl className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Weapon</dt><dd className="text-right font-bold text-white">{character.weapon.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Ultimate</dt><dd className="text-right font-bold text-white">{character.ultimate.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Sprite</dt><dd className="text-right font-mono text-white">{pixelHeight}px, {character.rig.parts.length} parts</dd></div>
            </dl>
          </section>

          <section className="border border-border bg-card p-3">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Palette</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
              {PALETTE_LABELS.map(([key, label]) => (
                <li key={key} className="flex items-center gap-2 text-[11px]">
                  <span className="h-4 w-4 shrink-0 border border-white/30" style={{ backgroundColor: entry.palette[key] }} aria-hidden />
                  <span className="truncate text-muted-foreground">{label}</span>
                  <span className="ml-auto font-mono text-[10px] text-white">{entry.palette[key]}</span>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            onClick={() => { onSelect(character.id); onClose(); }}
            disabled={character.id === selectedId}
            className="w-full bg-primary px-4 py-3 font-black uppercase tracking-widest text-primary-foreground transition-colors hover:bg-white disabled:cursor-default disabled:bg-primary/40"
            data-testid="button-inspector-select"
          >
            {character.id === selectedId ? 'Already selected' : `Select ${character.name}`}
          </button>
        </aside>
      </div>
    </div>,
    document.body,
  );
}

export default OperatorInspector;
