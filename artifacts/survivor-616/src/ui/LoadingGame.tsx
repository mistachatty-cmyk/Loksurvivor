/** The loading screen's little game: the wall-jump climb by default, or the quiet street walk if the player prefers it. */
import { useEffect, useState } from 'react';

import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { useMeta } from '@/game/state/metaStore';
import { climbLoaderPref } from '@/lib/powerSaver';
import { ClimbLoader } from './ClimbLoader';
import { WalkingLoader } from './WalkingLoader';

type Props = Parameters<typeof WalkingLoader>[0];

export function LoadingGame(props: Props) {
  const climb = climbLoaderPref.use();
  return climb ? <ClimbLoader {...props} /> : <WalkingLoader {...props} />;
}

/**
 * The Suspense fallback for heavy screens: blank at first, so a quick load never flashes anything, and the game
 * from the second it becomes a real wait.
 */
export function DelayedLoadingGame({ title, status }: { title: string; status: string }) {
  const { meta } = useMeta();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setLate(true), 900);
    return () => window.clearTimeout(timer);
  }, []);
  if (!late) return <div className="min-h-dvh bg-background" aria-busy="true" />;
  return <LoadingGame character={CHARACTERS_BY_ID[meta.selectedCharacterId] ?? null} title={title} status={status} />;
}
