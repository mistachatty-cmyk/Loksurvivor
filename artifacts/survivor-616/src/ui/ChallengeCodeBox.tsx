import { useState } from 'react';

import { useMeta } from '@/game/state/metaStore';
import { decodeChallenge } from '@/lib/challengeCode';
import { useT } from '@/lib/i18n';

/** "Have a challenge code?" Plays a friend's block and night: same map, same seed. */
export function ChallengeCodeBox({ onLaunch }: { onLaunch: (areaId: string, seed: number) => void }) {
  const t = useT();
  const { unlockedAreas, lockedAreas } = useMeta();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const play = () => {
    const parsed = decodeChallenge(code, [...unlockedAreas, ...lockedAreas].map((area) => area.id));
    if (!parsed.ok) {
      setProblem(t(parsed.reason === 'area' ? 'challenge.badArea' : parsed.reason === 'check' ? 'challenge.badCheck' : 'challenge.badFormat'));
      return;
    }
    if (!unlockedAreas.some((area) => area.id === parsed.areaId)) {
      setProblem(t('challenge.locked'));
      return;
    }
    setProblem(null);
    onLaunch(parsed.areaId, parsed.seed);
  };

  return (
    <section className="mb-6 border border-border bg-card p-4" data-testid="section-challenge-code">
      <h2 className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-cyan-200">{t('challenge.title')}</h2>
      <p className="mt-1 text-xs text-white/65">{t('challenge.body')}</p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          play();
        }}
      >
        <input
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setProblem(null);
          }}
          placeholder="616.block.0000.0"
          aria-label={t('challenge.title')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-11 min-w-0 flex-1 border border-border bg-background px-3 font-mono text-xs text-white placeholder:text-white/30"
          data-testid="input-challenge-code"
        />
        <button
          type="submit"
          disabled={code.trim().length === 0}
          className="min-h-11 shrink-0 border border-cyan-100/60 bg-cyan-100 px-4 font-mono text-[10px] font-black uppercase tracking-widest text-slate-950 hover:bg-white disabled:opacity-40"
          data-testid="button-challenge-play"
        >
          {t('challenge.play')}
        </button>
      </form>
      {problem ? (
        <p role="alert" className="mt-2 text-xs text-amber-200" data-testid="text-challenge-problem">
          {problem}
        </p>
      ) : null}
    </section>
  );
}

export default ChallengeCodeBox;
