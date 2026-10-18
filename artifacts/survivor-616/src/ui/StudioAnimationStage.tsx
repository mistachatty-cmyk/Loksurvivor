import { useEffect, useRef, useState } from 'react';
import { CLIPS, DIRECTIONS, renderStudioPixels, studioFrameAt, type ClipName, type Direction, type StudioProject } from '@/game/studio/v3Project';

const DIRECTION_NAMES: Record<Direction, string> = { S: 'Front', SW: 'Front left', W: 'Left', NW: 'Back left', N: 'Back', NE: 'Back right', E: 'Right', SE: 'Front right' };
const CLIP_NAMES: Record<ClipName, string> = { idle: 'Idle', walk: 'Walk', attack: 'Attack', hurt: 'Hurt', death: 'Death' };
const CHOICE = 'min-h-10 rounded-lg border px-3 py-2 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 motion-reduce:transition-none';

export function StudioAnimationStage({ project, title }: { project: StudioProject; title: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [direction, setDirection] = useState<Direction>('S');
  const [clip, setClip] = useState<ClipName>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const frames = project.views[direction][clip];
  const frameIndex = studioFrameAt(project, direction, clip, elapsed);

  useEffect(() => { setElapsed(0); }, [project.id, direction, clip]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context) renderStudioPixels(context, project, frames[frameIndex]!);
  }, [project, frames, frameIndex]);
  useEffect(() => {
    if (!playing) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) setElapsed((value) => value + Math.min(now - previous, 100));
      previous = now;
    }, 50);
    return () => window.clearInterval(timer);
  }, [playing]);

  function showFrame(index: number) {
    setPlaying(false);
    setElapsed(frames.slice(0, index).reduce((total, frame) => total + frame.ms, 0));
  }

  return <section aria-label={`${title} animation preview`} className="grid gap-4 rounded-xl border border-cyan-300/30 bg-[linear-gradient(145deg,#132a39,#0b1420)] p-3 text-slate-100 sm:grid-cols-[minmax(0,240px)_1fr] sm:p-4">
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-cyan-200/15 bg-[#080e18] p-3">
      <canvas ref={canvas} width={48} height={48} className="aspect-square w-full max-w-52 [image-rendering:pixelated]" aria-label={`${title} pixel animation`} role="img" />
      <p className="text-xs font-bold text-cyan-100">{DIRECTION_NAMES[direction]} · {CLIP_NAMES[clip]} · frame {frameIndex + 1}/{frames.length}</p>
    </div>
    <div className="min-w-0 space-y-3">
      <div><p className="text-[11px] font-black uppercase tracking-widest text-cyan-200">Direction · 8 views</p><div className="mt-2 grid grid-cols-4 gap-1.5">{DIRECTIONS.map((view) => <button key={view} type="button" aria-label={`Face ${DIRECTION_NAMES[view]}`} aria-pressed={direction === view} className={`${CHOICE} ${direction === view ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10'}`} onClick={() => setDirection(view)}>{view}</button>)}</div></div>
      <div><p className="text-[11px] font-black uppercase tracking-widest text-cyan-200">Animation · 5 actions</p><div className="mt-2 flex flex-wrap gap-1.5">{(Object.keys(CLIPS) as ClipName[]).map((action) => <button key={action} type="button" aria-pressed={clip === action} className={`${CHOICE} ${clip === action ? 'border-cyan-300 bg-cyan-300 text-slate-950' : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10'}`} onClick={() => setClip(action)}>{CLIP_NAMES[action]} <span className="opacity-70">{CLIPS[action]}</span></button>)}</div></div>
      <div className="flex flex-wrap items-center gap-2"><button type="button" className={`${CHOICE} border-cyan-300/50 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20`} aria-label={playing ? 'Pause animation' : 'Play animation'} onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'} animation</button><span className="text-xs text-slate-300">Tap a frame to inspect it.</span></div>
      <div role="group" aria-label="Animation frames" className="flex flex-wrap gap-1.5">{frames.map((_, index) => <button key={index} type="button" aria-label={`Show frame ${index + 1}`} aria-pressed={frameIndex === index} className={`${CHOICE} min-w-10 px-2 ${frameIndex === index ? 'border-amber-300 bg-amber-300/20 text-amber-100' : 'border-white/20 bg-white/5 text-slate-200 hover:bg-white/10'}`} onClick={() => showFrame(index)}>{index + 1}</button>)}</div>
    </div>
  </section>;
}
