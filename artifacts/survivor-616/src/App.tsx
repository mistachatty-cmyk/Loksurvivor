import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { MusicProvider } from '@/game/audio/musicPlayer';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { AuthProvider } from '@/state/authStore';
import { CloudSyncProvider } from '@/state/cloudSyncStore';
import {
  FATIGUE_PER_RUN_PCT,
  getLokPetDiscoveries,
  MAX_FATIGUE_PCT,
  MetaProvider,
  activeUiThemeSwatchId,
  rewardCredMultiplier,
  startingWeaponLevel,
  useMeta,
} from '@/game/state/metaStore';
import { advanceDailyContracts } from '@/game/data/contracts';
import { createRng } from '@/game/engine/math';
import { TRAVEL_ENCOUNTER_TRIGGERS, type TravelEncounterSource } from '@/game/data/travelEncounters';
import {
  pickTravelEncounterOpponent,
  resolveTravelEncounterOpponent,
  type ResolvedTravelEncounterOpponent,
} from '@/game/travelEncounter';
import type { AreaDef, RunResult } from '@/game/types';
import type { ArenaSeat } from '@/game/arena/arenaWorld';
import { HubScreen, type HubPanel } from '@/ui/HubScreen';
import { IntroScreen } from '@/ui/IntroScreen';
import { MusicNowPlaying } from '@/ui/MusicNowPlaying';
import { FocusWidgetMount } from '@/ui/FocusWidgetMount';
import { createLokPetArchiveFixtureResult } from '@/test/lokpetArchiveFixture';
import { RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { customMapToArea } from '@/game/data/customMaps';

const StudioScreen = lazy(() => import('@/ui/StudioScreen').then(m => ({ default: m.StudioScreen })));
const RunScreen = lazy(() => import('@/game/RunScreen').then(m => ({ default: m.RunScreen })));
const ArchivePanel = lazy(() => import('@/ui/ArchivePanel').then(m => ({ default: m.ArchivePanel })));
const AreaSelect = lazy(() => import('@/ui/AreaSelect').then(m => ({ default: m.AreaSelect })));
const BestiaryPanel = lazy(() => import('@/ui/BestiaryPanel').then(m => ({ default: m.BestiaryPanel })));
const CharacterSelect = lazy(() => import('@/ui/CharacterSelect').then(m => ({ default: m.CharacterSelect })));
const MusicPanel = lazy(() => import('@/ui/MusicPanel').then(m => ({ default: m.MusicPanel })));
const RunSummary = lazy(() => import('@/ui/RunSummary').then(m => ({ default: m.RunSummary })));
const RecoveryPanel = lazy(() => import('@/ui/RecoveryPanel').then(m => ({ default: m.RecoveryPanel })));
const VendorPanel = lazy(() => import('@/ui/VendorPanel').then(m => ({ default: m.VendorPanel })));
const WorkshopPanel = lazy(() => import('@/ui/WorkshopPanel').then(m => ({ default: m.WorkshopPanel })));
const SettingsPanel = lazy(() => import('@/ui/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const PaletteGalleryPanel = lazy(() => import('@/ui/PaletteGalleryPanel').then(m => ({ default: m.PaletteGalleryPanel })));
const SoundBoothPanel = lazy(() => import('@/ui/SoundBoothPanel').then(m => ({ default: m.SoundBoothPanel })));
const AccountPanel = lazy(() => import('@/ui/AccountPanel').then(m => ({ default: m.AccountPanel })));
const FeedbackPanel = lazy(() => import('@/ui/FeedbackPanel').then(m => ({ default: m.FeedbackPanel })));
const CardShopPanel = lazy(() => import('@/ui/CardShopPanel').then(m => ({ default: m.CardShopPanel })));
const ThreatMatrixScreen = lazy(() => import('@/ui/ThreatMatrixScreen').then(m => ({ default: m.ThreatMatrixScreen })));
const MapBuilder = lazy(() => import('@/ui/MapBuilder').then(m => ({ default: m.MapBuilder })));
const SectorCommandScreen = lazy(() => import('@/ui/SectorCommandScreen').then(m => ({ default: m.SectorCommandScreen })));
const ArenaSetupScreen = lazy(() => import('@/ui/ArenaSetupScreen').then(m => ({ default: m.ArenaSetupScreen })));
const ArenaScreen = lazy(() => import('@/game/ArenaScreen').then(m => ({ default: m.ArenaScreen })));
const TravelEncounterOverlay = lazy(() => import('@/ui/TravelEncounterOverlay').then(m => ({ default: m.TravelEncounterOverlay })));

const queryClient = new QueryClient();

function ScreenFallback() {
  return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
}

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
  | { name: 'card-shop' }
  | { name: 'settings' }
  | { name: 'palette-store' }
  | { name: 'sound-booth' }
  | { name: 'account' }
  | { name: 'feedback' }
  | { name: 'threat-matrix' }
  | { name: 'map-editor' }
  | { name: 'sector-command' }
  | { name: 'arena-setup' }
  | { name: 'arena'; area: AreaDef; seats: ArenaSeat[] }
  | { name: 'run'; areaId: string; challengeIds?: string[]; episodeId?: string; missionId?: string }
  | { name: 'summary'; result: RunResult };

interface PendingTravelEncounter {
  opponent: ResolvedTravelEncounterOpponent;
  rng: () => number;
  label: string;
  /** The navigation that was intercepted; run once the popup resolves (win/lose/flee). */
  onResolved: () => void;
}

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
      requested === 'card-shop' ||
      requested === 'settings' ||
      requested === 'account' ||
      requested === 'feedback' ||
      requested === 'threat-matrix'
    ) {
      return { name: requested };
    }
    if (requested === 'sector-command') return { name: 'sector-command' };
  }
  return { name: onboarded ? 'hub' : 'intro' };
}

function Game() {
  const { meta, markOnboarded, selectedCharacter, completeRun, completeSectorMission, enterHideout, unlockedAreas } = useMeta();
  const [screen, setScreen] = useState<Screen>(() => initialScreen(meta.onboarded));
  const [roomId, setRoomId] = useState('main-floor');
  const [travelEncounter, setTravelEncounter] = useState<PendingTravelEncounter | null>(null);
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);

  const goHub = useCallback(() => {
    sfx.play('uiNav');
    enterHideout();
    setScreen({ name: 'hub' });
  }, [enterHideout, sfx]);

  const openPanel = useCallback((panel: HubPanel) => {
    sfx.play('uiNav');
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
      case 'card-shop':
        setScreen({ name: 'card-shop' });
        break;
      case 'settings':
        setScreen({ name: 'settings' });
        break;
      case 'palette-store':
        setScreen({ name: 'palette-store' });
        break;
      case 'sound-booth':
        setScreen({ name: 'sound-booth' });
        break;
      case 'account':
        setScreen({ name: 'account' });
        break;
      case 'feedback':
        setScreen({ name: 'feedback' });
        break;
      case 'threat-matrix':
        setScreen({ name: 'threat-matrix' });
        break;
    }
  }, [sfx]);

  const handleFinish = useCallback(
    (result: RunResult) => {
      const fatigueBefore = meta.fatigueByCharacter[result.characterId] ?? 0;
      const fatigueAfter = Math.min(MAX_FATIGUE_PCT, fatigueBefore + FATIGUE_PER_RUN_PCT);
      const dailyContracts = advanceDailyContracts(
        {
          dayKey: meta.dailyContractDayKey,
          progressById: meta.dailyContractProgressById,
          completedIds: meta.completedDailyContractIds,
        },
        result,
      );
      const resultWithFatigue = {
        ...result,
        fatigueAddedPct: fatigueAfter - fatigueBefore,
        fatigueAfterPct: fatigueAfter,
        lokPetDiscoveries: getLokPetDiscoveries(meta.lokPetCatalog, result.lokPets),
        newlyDiscoveredRelicIds: result.cleared && result.discoveryId && RELIC_BY_DISCOVERY_ID[result.discoveryId] &&
          !meta.knownRelicIds.includes(RELIC_BY_DISCOVERY_ID[result.discoveryId]!.id)
          ? [RELIC_BY_DISCOVERY_ID[result.discoveryId]!.id]
          : [],
        completedDailyContracts: dailyContracts.completed.map((contract) => ({
          id: contract.id,
          name: contract.name,
          rewardCred: contract.rewardCred,
          rewardTokens: contract.rewardTokens,
        })),
      };
      completeRun(resultWithFatigue);
      // Campaign credit follows the mission's own objectives, not the run's
      // generic `cleared` -- otherwise idling out the clock banks the mission.
      if (result.missionId && result.missionComplete) completeSectorMission(result.missionId);
      setScreen({ name: 'summary', result: resultWithFatigue });
    },
    [completeRun, completeSectorMission, meta.fatigueByCharacter, meta.knownRelicIds],
  );

  const attemptTravelEncounter = useCallback(
    (source: TravelEncounterSource, targetRoomId: string | undefined, proceed: () => void) => {
      if (!meta.travelEncountersEnabled) {
        proceed();
        return;
      }
      const trigger = TRAVEL_ENCOUNTER_TRIGGERS.find(
        (candidate) => candidate.source === source && (source !== 'hub-room' || candidate.roomId === targetRoomId),
      );
      if (!trigger || Math.random() >= trigger.chance) {
        proceed();
        return;
      }
      const rng = createRng(Date.now());
      const opponent = resolveTravelEncounterOpponent(pickTravelEncounterOpponent(rng), rng);
      setTravelEncounter({ opponent, rng, label: trigger.label, onResolved: proceed });
    },
    [meta.travelEncountersEnabled],
  );

  function renderScreen(): ReactNode {
  switch (screen.name) {
    case 'intro':
      return (
        <IntroScreen
          onBegin={() => {
            markOnboarded();
            goHub();
          }}
          onSignIn={() => {
            markOnboarded();
            setScreen({ name: 'account' });
          }}
        />
      );

    case 'hub':
      return (
        <HubScreen
          roomId={roomId}
          onChangeRoom={(nextRoomId) => attemptTravelEncounter('hub-room', nextRoomId, () => { sfx.play('uiNav'); setRoomId(nextRoomId); })}
          onOpen={openPanel}
          onOpenMapEditor={() => setScreen({ name: 'map-editor' })}
          onOpenSectorCommand={() => setScreen({ name: 'sector-command' })}
          onOpenArena={() => setScreen({ name: 'arena-setup' })}
          onBack={() => setScreen({ name: 'intro' })}
        />
      );

    case 'sector-command':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <SectorCommandScreen
            onBack={goHub}
            onLaunch={(missionId) => setScreen({ name: 'run', areaId: missionId, missionId })}
          />
        </Suspense>
      );

    case 'arena-setup':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <ArenaSetupScreen
            onBack={goHub}
            onLaunch={(area, seats) => setScreen({ name: 'arena', area, seats })}
          />
        </Suspense>
      );

    case 'arena':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <ArenaScreen area={screen.area} seats={screen.seats} onExit={goHub} />
        </Suspense>
      );

    case 'map-editor':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <MapBuilder onBack={goHub} onLaunch={(mapId) => setScreen({ name: 'run', areaId: mapId })} />
        </Suspense>
      );

    case 'roster':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <CharacterSelect
            onBack={goHub}
            onConfirm={() => setScreen({ name: 'areas' })}
            onLaunchEpisode={(episodeId, areaId) => setScreen({ name: 'run', areaId, episodeId })}
          />
        </Suspense>
      );

    case 'areas':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <AreaSelect
            onBack={goHub}
            onLaunch={(areaId, challengeIds) =>
              attemptTravelEncounter('run-launch', undefined, () => setScreen({ name: 'run', areaId, challengeIds }))
            }
          />
        </Suspense>
      );

    case 'bestiary':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <BestiaryPanel onBack={goHub} />
        </Suspense>
      );

    case 'archive':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <ArchivePanel onBack={goHub} focusVariantId={screen.variantId} />
        </Suspense>
      );

    case 'music':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <MusicPanel onBack={goHub} />
        </Suspense>
      );

    case 'studio':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <StudioScreen onBack={goHub} />
        </Suspense>
      );

    case 'recovery':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <RecoveryPanel onBack={goHub} />
        </Suspense>
      );

    case 'vendor':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <VendorPanel onBack={goHub} onOpenThreatMatrix={() => setScreen({ name: 'threat-matrix' })} />
        </Suspense>
      );

    case 'workshop':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <WorkshopPanel onBack={goHub} />
        </Suspense>
      );

    case 'card-shop':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <CardShopPanel onBack={goHub} />
        </Suspense>
      );

    case 'settings':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <SettingsPanel onBack={goHub} />
        </Suspense>
      );

    case 'palette-store':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <PaletteGalleryPanel onBack={goHub} />
        </Suspense>
      );

    case 'sound-booth':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <SoundBoothPanel onBack={goHub} />
        </Suspense>
      );

    case 'account':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <AccountPanel onBack={goHub} />
        </Suspense>
      );

    case 'feedback':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <FeedbackPanel onBack={goHub} />
        </Suspense>
      );

    case 'threat-matrix':
      return (
        <Suspense fallback={<ScreenFallback />}>
          <ThreatMatrixScreen onBack={goHub} />
        </Suspense>
      );

    case 'run':
      {
        const customMap = meta.customMaps.find((map) => map.id === screen.areaId);
        if (screen.areaId.startsWith('custom-') && !customMap) {
          return <AreaSelect onBack={goHub} onLaunch={(areaId, challengeIds) => setScreen({ name: 'run', areaId, challengeIds })} />;
        }
        return (
          <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-black font-mono text-xs uppercase tracking-[0.25em] text-blue-200">Loading block…</div>}>
            <RunScreen
              key={`${screen.areaId}-${selectedCharacter.id}-${screen.episodeId ?? 'standard'}-${(screen.challengeIds ?? []).join('-')}`}
              areaId={screen.areaId}
              areaOverride={customMap ? customMapToArea(customMap) : undefined}
              missionId={screen.missionId}
              characterId={selectedCharacter.id}
              challengeIds={screen.challengeIds}
              episodeId={screen.episodeId}
              startingWeaponLevel={startingWeaponLevel(meta)}
              utilityRewardMultiplier={rewardCredMultiplier(meta)}
              physicsObjectClicksEnabled={meta.physicsObjectClicksEnabled}
              onAbort={goHub}
              onFinish={handleFinish}
            />
          </Suspense>
        );
      }

    case 'summary': {
      // If the run unlocked the next district, retry should still work.
      const canRetry = unlockedAreas.some((a) => a.id === screen.result.areaId) ||
        meta.customMaps.some((map) => map.id === screen.result.areaId);
      return (
        <Suspense fallback={<ScreenFallback />}>
          <RunSummary
            result={screen.result}
            areaOverride={meta.customMaps.find((map) => map.id === screen.result.areaId) ? customMapToArea(meta.customMaps.find((map) => map.id === screen.result.areaId)!) : undefined}
            onReturnToHub={goHub}
            onOpenArchive={(variantId) => setScreen({ name: 'archive', variantId })}
            onOpenAccount={() => setScreen({ name: 'account' })}
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
        </Suspense>
      );
    }

    default:
      return null;
  }
  }

  return (
    <>
      {renderScreen()}
      {travelEncounter && (
        <Suspense fallback={null}>
          <TravelEncounterOverlay
            opponent={travelEncounter.opponent}
            rng={travelEncounter.rng}
            label={travelEncounter.label}
            onClose={() => {
              const proceed = travelEncounter.onResolved;
              setTravelEncounter(null);
              proceed();
            }}
          />
        </Suspense>
      )}
    </>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MetaProvider>
          <CloudSyncProvider>
            <MusicProvider>
              {children}
              <MusicNowPlaying />
              <FocusWidgetMount />
            </MusicProvider>
          </CloudSyncProvider>
        </MetaProvider>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}

/** Theme attributes live above every screen, including the canvas run. */
function ThemedGame() {
  const { meta } = useMeta();
  return (
    <div data-ui-theme={meta.uiTheme} data-ui-swatch={activeUiThemeSwatchId(meta)} className="min-h-[100dvh]">
      <Game />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Providers>
        <ThemedGame />
      </Providers>
    </ErrorBoundary>
  );
}

export default App;
