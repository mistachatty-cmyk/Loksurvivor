import type { HudSnapshot } from '@/game/types';

const CELEBRATION_LABEL: Record<'mild' | 'big' | 'legendary', string> = {
  mild: 'Horde called in.',
  big: 'Big pull!',
  legendary: 'JACKPOT!',
};

/** Periodic run-modifier event banner: a spin, a landed tier, then the horde countdown. See `RunModifiers.hordeSpinEnabled`. */
export function HordeSpinWheel({ wheelSpin }: { wheelSpin: NonNullable<HudSnapshot['wheelSpin']> }) {
  if (wheelSpin.phase === 'idle') return null;

  return (
    <div
      className="mx-auto flex w-fit max-w-full flex-col items-center gap-1 border border-fuchsia-400/50 bg-black/85 px-4 py-2 text-center"
      data-testid="row-hordespin"
    >
      {wheelSpin.phase === 'spinning' ? (
        <>
          <div
            className="h-10 w-10 rounded-full border-4 border-fuchsia-300 border-t-transparent"
            style={{ animation: 'hordespin-spin 480ms linear infinite' }}
          />
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-200">HordeSpin...</p>
        </>
      ) : null}
      {wheelSpin.phase === 'result' ? (
        <>
          <p
            className={`text-2xl font-black uppercase ${wheelSpin.rare ? 'text-amber-300' : 'text-fuchsia-200'}`}
            style={{ animation: 'hordespin-land 260ms ease-out' }}
          >
            {wheelSpin.resultLabel}
          </p>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
            {CELEBRATION_LABEL[wheelSpin.celebration]}
          </p>
        </>
      ) : null}
      {wheelSpin.phase === 'active' ? (
        <>
          <p className={`font-mono text-xs font-bold uppercase tracking-[0.2em] ${wheelSpin.rare ? 'text-amber-300' : 'text-fuchsia-200'}`}>
            {wheelSpin.resultLabel} horde -- {wheelSpin.activeRemainingSec}s
          </p>
          <p className="text-[10px] text-white/70">Clear it for +{wheelSpin.rewardCred} cred{wheelSpin.rare ? ' and a rare pet' : ''}.</p>
        </>
      ) : null}
      <style>{`
        @keyframes hordespin-spin { to { transform: rotate(360deg); } }
        @keyframes hordespin-land { 0% { opacity: 0; transform: scale(0.7); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

export default HordeSpinWheel;
