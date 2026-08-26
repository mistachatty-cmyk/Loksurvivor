import { useCallback, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { MusicProvider } from '@/game/audio/musicPlayer';
import { RunScreen } from '@/game/RunScreen';
import {
  FATIGUE_PER_RUN_PCT,
  getLokPetDiscoveries,
  MAX_FATIGUE_PCT,
  MetaProvider,
  useMeta,
} from '@/game/state/metaStore';
import type { RunResult } from '@/game/types';
import { ArchivePanel } from '@/ui/ArchivePanel';
import { AreaSelect } from '@/ui/AreaSelect';
import { BestiaryPanel } from '@/ui/BestiaryPanel';
import { CharacterSelect } from '@/ui/CharacterSelect';
import { HubScreen, type HubPanel } from '@/ui/HubScreen';
import { IntroScreen } from '@/ui/IntroScreen';
import { MusicPanel } from '@/ui/MusicPanel';
import { RunSummary } from '@/ui/RunSummary';
import { RecoveryPanel } from '@/ui/RecoveryPanel';
import { MusicNowPlaying } from '@/ui/MusicNowPlaying';

const queryClient = new QueryClient();

type Screen =
  | { name: 'intro' }
  | { name: 'hub' }
  | { name: 'roster' }
  | { name: 'areas' }
  | { name: 'bestiary' }
  | { name: 'archive'; variantId?: string }
  | { name: 'music' }
  | { name: 'recovery' }
  | { name: 'run'; areaId: string }
  | { name: 'summary'; result: RunResult };

/**
 * Lets a screen be opened directly (e.g. `?screen=areas`) so any part of the
 * game can be reached without replaying progress. Only honoured in dev.
 */
function initialScreen(onboarded: boolean): Screen {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('screen');
    const areaId = params.get('area');
    if (requested === 'run' && areaId) return { name: 'run', areaId };
    if (
      requested === 'hub' ||
      requested === 'roster' ||
      requested === 'areas' ||
      requested === 'bestiary' ||
      requested === 'archive' ||
      requested === 'music' ||
      requested === 'recovery'
    ) {
      return { name: requested };
    }
  }
  return { name: onboarded ? 'hub' : 'intro' };
}

function Game() {
  const { meta, markOnboarded, selectedCharacter, completeRun, unlockedAreas } = useMeta();
  const [screen, setScreen] = useState<Screen>(() => initialScreen(meta.onboarded));
  const [roomId, setRoomId] = useState('main-floor');

  const goHub = useCallback(() => setScreen({ name: 'hub' }), []);

  const openPanel = useCallback((panel: HubPanel) => {
    switch (panel) {
      case 'runs':
        setScreen({ name: 'areas' });
        break;
      case 'roster':
        setScreen({ name: 'roster' });
        break;
      case 'bestiary':
        setScreen({ name: 'bestiary' });
        break;
      case 'unlocks':
        setScreen({ name: 'archive' });
        break;
      case 'music':
        setScreen({ name: 'music' });
        break;
      case 'recovery':
        setScreen({ name: 'recovery' });
        break;
    }
  }, []);

  const handleFinish = useCallback(
    (result: RunResult) => {
      const fatigueBefore = meta.fatigueByCharacter[result.characterId] ?? 0;
      const fatigueAfter = Math.min(MAX_FATIGUE_PCT, fatigueBefore + FATIGUE_PER_RUN_PCT);
      const resultWithFatigue = {
        ...result,
        fatigueAddedPct: fatigueAfter - fatigueBefore,
        fatigueAfterPct: fatigueAfter,
        lokPetDiscoveries: getLokPetDiscoveries(meta.lokPetCatalog, result.lokPets),
      };
      completeRun(resultWithFatigue);
      setScreen({ name: 'summary', result: resultWithFatigue });
    },
    [completeRun, meta.fatigueByCharacter],
  );

  switch (screen.name) {
    case 'intro':
      return (
        <IntroScreen
          onBegin={() => {
            markOnboarded();
            goHub();
          }}
        />
      );

    case 'hub':
      return <HubScreen roomId={roomId} onChangeRoom={setRoomId} onOpen={openPanel} />;

    case 'roster':
      return <CharacterSelect onBack={goHub} onConfirm={() => setScreen({ name: 'areas' })} />;

    case 'areas':
      return <AreaSelect onBack={goHub} onLaunch={(areaId) => setScreen({ name: 'run', areaId })} />;

    case 'bestiary':
      return <BestiaryPanel onBack={goHub} />;

    case 'archive':
      return <ArchivePanel onBack={goHub} focusVariantId={screen.variantId} />;

    case 'music':
      return <MusicPanel onBack={goHub} />;

    case 'recovery':
      return <RecoveryPanel onBack={goHub} />;

    case 'run':
      return (
        <RunScreen
          key={`${screen.areaId}-${selectedCharacter.id}`}
          areaId={screen.areaId}
          characterId={selectedCharacter.id}
          onAbort={goHub}
          onFinish={handleFinish}
        />
      );

    case 'summary': {
      // If the run unlocked the next district, retry should still work.
      const canRetry = unlockedAreas.some((a) => a.id === screen.result.areaId);
      return (
        <RunSummary
          result={screen.result}
          onReturnToHub={goHub}
          onOpenArchive={(variantId) => setScreen({ name: 'archive', variantId })}
          onRetry={() =>
            canRetry ? setScreen({ name: 'run', areaId: screen.result.areaId }) : goHub()
          }
        />
      );
    }

    default:
      return null;
  }
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MetaProvider>
        <MusicProvider>
          {children}
          <MusicNowPlaying />
        </MusicProvider>
      </MetaProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

function App() {
  return (
    <Providers>
      <ErrorBoundary>
        <Game />
      </ErrorBoundary>
    </Providers>
  );
}

export default App;
