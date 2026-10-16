import { REQUIRED_FRAMES } from '@/game/studio/v3Project';

interface StudioJourneyProps {
  approvedFrames: number;
  emptyFrames: number;
  firstPoseHasArt: boolean;
  complete: boolean;
  visible: boolean;
  onToggle: () => void;
  onFirstPose: () => void;
  onSeed: () => void;
  onNextReview: () => void;
}

const ACTION = 'min-h-11 rounded-lg border border-cyan-300/50 bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 transition-colors hover:bg-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none';
const SECONDARY = 'min-h-10 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none';

export function StudioJourney({ approvedFrames, emptyFrames, firstPoseHasArt, complete, visible, onToggle, onFirstPose, onSeed, onNextReview }: StudioJourneyProps) {
  if (!visible) return <button type="button" className={SECONDARY} onClick={onToggle}>Show first character guide</button>;

  const milestones = [
    { label: 'Sketch', done: firstPoseHasArt },
    { label: 'Fill', done: emptyFrames === 0 },
    { label: 'Review', done: approvedFrames > 0 },
    { label: 'Ready', done: complete },
  ];
  const reached = milestones.filter((step) => step.done).length;
  const quest = !firstPoseHasArt ? 'Draw your first pose' : emptyFrames > 0 ? 'Give empty frames a starting shape' : !complete ? 'Bring every pose to life' : 'Your character is ready';

  return <section aria-label="First character guide" className="rounded-2xl border border-cyan-300/25 bg-[linear-gradient(145deg,#162636,#101a29)] p-4 text-slate-100 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Creator path · {reached}/4</p><h3 className="mt-1 text-lg font-black">{quest}</h3></div>
      <button type="button" className={SECONDARY} onClick={onToggle}>Hide guide</button>
    </div>
    <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Creation milestones">
      {milestones.map((step, index) => <li key={step.label} className={`min-w-0 rounded-lg border px-1 py-2 text-center ${step.done ? 'border-emerald-300/45 bg-emerald-300/10 text-emerald-100' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}>
        <span className="block text-sm font-black" aria-hidden="true">{step.done ? '✓' : String(index + 1).padStart(2, '0')}</span>
        <span className="block text-[10px] font-bold sm:text-xs">{step.label}</span>
      </li>)}
    </ol>
    {!firstPoseHasArt ? <div className="mt-4 space-y-2"><p className="text-xs leading-relaxed text-slate-300">Start on the south idle frame. Draw with touch, mouse, pen, or the exact X/Y controls.</p><button type="button" className={ACTION} onClick={onFirstPose}>Go to first pose</button><button type="button" className={SECONDARY} disabled>Seed empty frames from first pose</button></div>
      : emptyFrames > 0 ? <div className="mt-4 space-y-2"><p className="text-xs leading-relaxed text-slate-300">{emptyFrames} frames are empty. Seed them from your first pose, then redraw movement, attacks, hurt, and death.</p><div className="flex flex-wrap gap-2"><button type="button" className={ACTION} onClick={onSeed}>Seed empty frames from first pose</button><button type="button" className={SECONDARY} onClick={onFirstPose}>Go to first pose</button></div></div>
        : !complete ? <div className="mt-4 space-y-2"><p className="text-xs leading-relaxed text-slate-300">Every frame has art. Preview each action and direction, refine the poses, then approve what you have inspected. {REQUIRED_FRAMES - approvedFrames} frames still need review.</p><button type="button" className={ACTION} onClick={onNextReview}>Next unreviewed frame</button></div>
          : <p className="mt-4 text-xs leading-relaxed text-emerald-100">All {REQUIRED_FRAMES} frames are approved. Save to your account and submit for staff review when you are ready.</p>}
    <p className="mt-4 border-t border-white/10 pt-3 text-[11px] leading-relaxed text-slate-400">These milestones track your draft. They do not spend tokens or publish your work.</p>
  </section>;
}
