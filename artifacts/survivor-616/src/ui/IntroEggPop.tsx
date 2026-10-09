/**
 * Corner badge for the title-screen easter eggs in `data/introEggs.ts`.
 * Drifts in on its own once in a while, or on demand when its word is typed.
 * Pure flavor; it never blocks input and holds still under reduced motion.
 */
import { useEffect, useState } from 'react';

import { INTRO_EGG_SHOW_MS, eggForTyped, pickIntroEgg, type IntroEggDef } from '@/game/data/introEggs';
import { useT } from '@/lib/i18n';

const TYPED_BUFFER = 16;

export function IntroEggPop() {
  const t = useT();
  const [egg, setEgg] = useState<IntroEggDef | null>(null);

  useEffect(() => {
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = (next: IntroEggDef) => {
      if (hide) clearTimeout(hide);
      setEgg(next);
      hide = setTimeout(() => setEgg(null), INTRO_EGG_SHOW_MS);
    };
    const arrive = setTimeout(() => {
      const picked = pickIntroEgg(Math.random);
      if (picked) show(picked);
    }, 2500);
    let typed = '';
    const onKey = (event: KeyboardEvent) => {
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return;
      typed = (typed + event.key.toLowerCase()).slice(-TYPED_BUFFER);
      const match = eggForTyped(typed);
      if (match) {
        typed = '';
        show(match);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(arrive);
      if (hide) clearTimeout(hide);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!egg) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 max-w-[16rem]" role="status" data-testid={`intro-egg-${egg.id}`}>
      <style>{`
        @keyframes intro-egg-pop { 0% { transform: translateY(16px) scale(.9); opacity: 0 } 12%,88% { transform: none; opacity: 1 } 100% { transform: translateY(8px); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .intro-egg-badge { animation: none !important } }
      `}</style>
      <div
        className="intro-egg-badge border bg-black/80 px-3 py-2 text-left shadow-lg"
        style={{ borderColor: egg.accent, boxShadow: `0 0 18px ${egg.accent}55`, animation: `intro-egg-pop ${INTRO_EGG_SHOW_MS}ms ease-out forwards` }}
      >
        <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: egg.accent }}>{t(egg.titleKey as never)}</p>
        <p className="mt-0.5 text-xs text-foreground">{t(egg.lineKey as never)}</p>
      </div>
    </div>
  );
}
