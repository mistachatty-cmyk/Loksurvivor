import { useCallback, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { MusicProvider } from '@/game/audio/musicPlayer';
import { AuthProvider } from '@/state/authStore';
import { RunScreen } from '@/game/RunScreen';
import {
  FATIGUE_PER_RUN_PCT,
  getLokPetDiscoveries,
  MAX_FATIGUE_PCT,
  MetaProvider,
  rewardCredMultiplier,
  startingWeaponLevel,
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
import { VendorPanel } from '@/ui/VendorPanel';
import { WorkshopPanel } from '@/ui/WorkshopPanel';
import { SettingsPanel } from '@/ui/SettingsPanel';
import { AccountPanel } from '@/ui/AccountPanel';
import { FeedbackPanel } from '@/ui/FeedbackPanel';
import { MusicNowPlaying } from '@/ui/MusicNowPlaying';
import { createLokPetArchiveFixtureResult } from '@/test/lokpetArchiveFixture';
import { RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { customMapToArea } from '@/game/data/customMaps';
import { MapBuilder } from '@/ui/MapBuilder';
import { lazy, Suspense } from 'react';

const StudioScreen = lazy(() => import('@/ui/StudioScreen').then(m => ({ default: m.StudioScreen })));

const queryClient = new QueryClient();

type Screen =
  | { name: 'intro' }
  | { name: 'hub' }
  | { name: 'roster' }
  | { name: 'areas' }
  | { name: 'bestiary' }
  | { name: 'archive'; variantId?: string }
  | { name: 'music' }
  | { name: 'studio' }
  | { name: 'recovery' }
  | { name: 'vendor' }
  | { name: 'workshop' }
  | { name: 'settings' }
  | { name: 'account' }
  | { name: 'feedback' }
  | { name: 'map-editor' }
  | { name: 'run'; areaId: string; challengeIds?: string[]; episodeId?: string }
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
    if (requested === 'summary' && params.get('fixture') === 'lokpet-archive') {
      return { name: 'summary', result: createLokPetArchiveFixtureResult() };
    }
    if (
      requested === 'hub' ||
      requested === 'roster' ||
      requested === 'areas' ||
      requested === 'bestiary' ||
      requested === 'archive' ||
      requested === 'music' ||
      requested === 'studio' ||
      requested === 'recovery' ||
      requested === 'vendor' ||
      requested === 'workshop' ||
      requested === 'settings' ||
      requested === 'account' ||
      requested === 'feedback'
    ) {
      return { name: requested };
    }
  }
  return { name: onboarded ? 'hub' : 'intro' };
}

function Game() {
  const { meta, markOnboarded, selectedCharacter, completeRun, enterHideout, unlockedAreas } = useMeta();
  const [screen, setScreen] = useState<Screen>(() => initialScreen(meta.onboarded));
  const [roomId, setRoomId] = useState('main-floor');

  const goHub = useCallback(() => {
    enterHideout();
    setScreen({ name: 'hub' });
  }, [enterHideout]);

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
      case 'studio':
        setScreen({ name: 'studio' });
        break;
      case 'recovery':
        setScreen({ name: 'recovery' });
        break;
      case 'vendor':
        setScreen({ name: 'vendor' });
        break;
      case 'workshop':
        setScreen({ name: 'workshop' });
        break;
      case 'settings':
        setScreen({ name: 'settings' });
        break;
      case 'account':
        setScreen({ name: 'account' });
        break;
      case 'feedback':
        setScreen({ name: 'feedback' });
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
        newlyDiscoveredRelicIds: result.cleared && result.discoveryId && RELIC_BY_DISCOVERY_ID[result.discoveryId] &&
          !meta.knownRelicIds.includes(RELIC_BY_DISCOVERY_ID[result.discoveryId]!.id)
          ? [RELIC_BY_DISCOVERY_ID[result.discoveryId]!.id]
          : [],
      };
      completeRun(resultWithFatigue);
      setScreen({ name: 'summary', result: resultWithFatigue });
    },
    [completeRun, meta.fatigueByCharacter, meta.knownRelicIds],
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
      return <HubScreen roomId={roomId} onChangeRoom={setRoomId} onOpen={openPanel} onOpenMapEditor={() => setScreen({ name: 'map-editor' })} />;

    case 'map-editor':
      return <MapBuilder onBack={goHub} onLaunch={(mapId) => setScreen({ name: 'run', areaId: mapId })} />;

    case 'roster':
      return (
        <CharacterSelect
          onBack={goHub}
          onConfirm={() => setScreen({ name: 'areas' })}
          onLaunchEpisode={(episodeId, areaId) => setScreen({ name: 'run', areaId, episodeId })}
        />
      );

    case 'areas':
      return <AreaSelect onBack={goHub} onLaunch={(areaId, challengeIds) => setScreen({ name: 'run', areaId, challengeIds })} />;

    case 'bestiary':
      return <BestiaryPanel onBack={goHub} />;

    case 'archive':
      return <ArchivePanel onBack={goHub} focusVariantId={screen.variantId} />;

    case 'music':
      return <MusicPanel onBack={goHub} />;

    case 'studio':
      return (
        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading studio...</div>}>
          <StudioScreen onBack={goHub} />
        </Suspense>
      );

    case 'recovery':
      return <RecoveryPanel onBack={goHub} />;

    case 'vendor':
      return <VendorPanel onBack={goHub} />;

    case 'workshop':
      return <WorkshopPanel onBack={goHub} />;

    case 'settings':
      return <SettingsPanel onBack={goHub} />;

    case 'account':
      return <AccountPanel onBack={goHub} />;

    case 'feedback':
      return <FeedbackPanel onBack={goHub} />;

    case 'run':
      {
        const customMap = meta.customMaps.find((map) => map.id === screen.areaId);
        if (screen.areaId.startsWith('custom-') && !customMap) {
          return <AreaSelect onBack={goHub} onLaunch={(areaId, challengeIds) => setScreen({ name: 'run', areaId, challengeIds })} />;
        }
        return (
          <RunScreen
            key={`${screen.areaId}-${selectedCharacter.id}-${screen.episodeId ?? 'standard'}-${(screen.challengeIds ?? []).join('-')}`}
            areaId={screen.areaId}
            areaOverride={customMap ? customMapToArea(customMap) : undefined}
            characterId={selectedCharacter.id}
            challengeIds={screen.challengeIds}
            episodeId={screen.episodeId}
            startingWeaponLevel={startingWeaponLevel(meta)}
            utilityRewardMultiplier={rewardCredMultiplier(meta)}
            physicsObjectClicksEnabled={meta.physicsObjectClicksEnabled}
            onAbort={goHub}
            onFinish={handleFinish}
          />
        );
      }

    case 'summary': {
      // If the run unlocked the next district, retry should still work.
      const canRetry = unlockedAreas.some((a) => a.id === screen.result.areaId) ||
        meta.customMaps.some((map) => map.id === screen.result.areaId);
      return (
        <RunSummary
          result={screen.result}
          areaOverride={meta.customMaps.find((map) => map.id === screen.result.areaId) ? customMapToArea(meta.customMaps.find((map) => map.id === screen.result.areaId)!) : undefined}
          onReturnToHub={goHub}
          onOpenArchive={(variantId) => setScreen({ name: 'archive', variantId })}
          onRetry={() =>
            canRetry
              ? setScreen({
                  name: 'run',
                  areaId: screen.result.areaId,
                  episodeId: screen.result.episode?.id,
                  challengeIds: screen.result.challenges?.map((challenge) => challenge.id),
                })
              : goHub()
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
      <AuthProvider>
        <MetaProvider>
          <MusicProvider>
            {children}
            <MusicNowPlaying />
          </MusicProvider>
        </MetaProvider>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <Game />
      </Providers>
    </ErrorBoundary>
  );
}

export default App;
