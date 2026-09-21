import { lazy, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
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
import {
  TRAVEL_ENCOUNTER_COOLDOWN_MS,
  TRAVEL_ENCOUNTER_MIN_TOTAL_RUNS,
  TRAVEL_ENCOUNTER_TRIGGERS,
  type TravelEncounterSource,
} from '@/game/data/travelEncounters';
import {
  pickTravelEncounterOpponent,
  resolveTravelEncounterOpponent,
  type ResolvedTravelEncounterOpponent,
} from '@/game/travelEncounter';
import type { AreaDef, RunResult } from '@/game/types';
import type { ArenaSeat } from '@/game/arena/arenaWorld';
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
import { PaletteGalleryPanel } from '@/ui/PaletteGalleryPanel';
import { SoundBoothPanel } from '@/ui/SoundBoothPanel';
import { AccountPanel } from '@/ui/AccountPanel';
import { FeedbackPanel } from '@/ui/FeedbackPanel';
import { CardShopPanel } from '@/ui/CardShopPanel';
import { ThreatMatrixScreen } from '@/ui/ThreatMatrixScreen';
import { LokPetBattleScreen } from '@/ui/LokPetBattleScreen';
import { MusicNowPlaying } from '@/ui/MusicNowPlaying';
import { FocusWidgetMount } from '@/ui/FocusWidgetMount';
import { TravelEncounterOverlay } from '@/ui/TravelEncounterOverlay';
import { StarterLokPetEncounter } from '@/ui/StarterLokPetEncounter';
import { RunSetupScreen } from '@/ui/RunSetupScreen';
import { createLokPetArchiveFixtureResult } from '@/test/lokpetArchiveFixture';
import { RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { customMapToArea } from '@/game/data/customMaps';
import { MapBuilder } from '@/ui/MapBuilder';
import { SectorCommandScreen } from '@/ui/SectorCommandScreen';
import { ArenaSetupScreen } from '@/ui/ArenaSetupScreen';
import { ArenaScreen } from '@/game/ArenaScreen';
const StudioScreen = lazy(() => import('@/ui/StudioScreen').then(m => ({ default: m.StudioScreen })));
const RunScreen = lazy(() => import('@/game/RunScreen').then(m => ({ default: m.RunScreen })));

const queryClient = new QueryClient();

type Screen =
  | { name: 'intro' }
  | { name: 'starter-lokpet-encounter' }
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
  | { name: 'lokpet-battle'; initialTab?: 'league' | 'sparring' | 'kennel' }
  | { name: 'arena-setup' }
  | { name: 'arena'; area: AreaDef; seats: ArenaSeat[] }
  | { name: 'run-setup'; areaId?: string; challengeIds?: string[]; episodeId?: string; missionId?: string; destination: 'run' | 'hub' }
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
function initialScreen(): Screen {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('screen');
    const areaId = params.get('area');
    if (requested === 'run' && areaId) return { name: 'run', areaId };
    if (requested === 'summary' && params.get('fixture') === 'lokpet-archive') {
      return { name: 'summary', result: createLokPetArchiveFixtureResult() };
    }
    if (requested === 'lokpet-battle') return { name: 'lokpet-battle' };
    if (requested === 'starter-lokpet-encounter') return { name: 'starter-lokpet-encounter' };
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
  return { name: 'intro' };
}

function Game() {
  const { meta, markOnboarded, selectedCharacter, completeRun, completeSectorMission, enterHideout, unlockedAreas } = useMeta();
  const [screen, setScreen] = useState<Screen>(() => initialScreen());
  const [roomId, setRoomId] = useState('main-floor');
  const [travelEncounter, setTravelEncounter] = useState<PendingTravelEncounter | null>(null);
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);

  const goHub = useCallback(() => {
    sfx.play('uiNav');
    enterHideout();
    setScreen({ name: 'hub' });
  }, [enterHideout, sfx]);

  const prepareRun = useCallback((run: Omit<Extract<Screen, { name: 'run' }>, 'name'>) => {
    // Looks & LokPets is a persistent preference surface, not a mandatory
    // pre-match interruption. The floating hideout control can reopen it.
    setScreen({ name: 'run', ...run });
  }, []);

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

  const lastTravelEncounterAtRef = useRef(0);

  const attemptTravelEncounter = useCallback(
    (source: TravelEncounterSource, targetRoomId: string | undefined, proceed: () => void) => {
      // Never ambush a brand-new player before they've finished a real run
      // and learned the basics, and never fire back-to-back within a
      // session -- both gaps in the original v1 rollout.
      if (
        !meta.travelEncountersEnabled ||
        meta.totalRuns < TRAVEL_ENCOUNTER_MIN_TOTAL_RUNS ||
        Date.now() - lastTravelEncounterAtRef.current < TRAVEL_ENCOUNTER_COOLDOWN_MS
      ) {
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
      lastTravelEncounterAtRef.current = Date.now();
      const rng = createRng(Date.now());
      const opponent = resolveTravelEncounterOpponent(pickTravelEncounterOpponent(rng), rng);
      setTravelEncounter({ opponent, rng, label: trigger.label, onResolved: proceed });
    },
    [meta.travelEncountersEnabled, meta.totalRuns],
  );

  function renderScreen(): ReactNode {
  switch (screen.name) {
    case 'intro':
      return (
        <IntroScreen
          onBegin={() => {
            markOnboarded();
            if (!meta.starterLokPetOnboardingComplete && meta.totalRuns === 0 && meta.savedLokPets.length === 0) {
              setScreen({ name: 'starter-lokpet-encounter' });
            } else {
              goHub();
            }
          }}
          onSignIn={() => {
            markOnboarded();
            setScreen({ name: 'account' });
          }}
        />
      );

    case 'starter-lokpet-encounter':
      return (
        <StarterLokPetEncounter
          onEnterHideout={() => {
            enterHideout();
            setScreen({ name: 'card-shop' });
          }}
        />
      );

    case 'hub':
      return (
        <HubScreen
          roomId={roomId}
          onChangeRoom={(nextRoomId) => {
            if (nextRoomId === 'the-storefront') {
              sfx.play('uiNav');
              setScreen({ name: 'card-shop' });
              return;
            }
            attemptTravelEncounter('hub-room', nextRoomId, () => { sfx.play('uiNav'); setRoomId(nextRoomId); });
          }}
          onOpen={openPanel}
          onOpenMapEditor={() => setScreen({ name: 'map-editor' })}
          onOpenSectorCommand={() => setScreen({ name: 'sector-command' })}
          onOpenLokPetBattle={() => setScreen({ name: 'lokpet-battle' })}
          onOpenArena={() => setScreen({ name: 'arena-setup' })}
          onOpenRunSetup={() => setScreen({ name: 'run-setup', destination: 'hub' })}
          onBack={() => setScreen({ name: 'intro' })}
        />
      );

    case 'lokpet-battle':
      return <LokPetBattleScreen onReturnToHub={goHub} initialTab={screen.initialTab} />;

    case 'arena-setup':
      return (
        <ArenaSetupScreen
          onBack={goHub}
          onLaunch={(area, seats) => setScreen({ name: 'arena', area, seats })}
        />
      );

    case 'arena':
      return <ArenaScreen area={screen.area} seats={screen.seats} onExit={goHub} />;

    case 'sector-command':
      return (
        <SectorCommandScreen
          onBack={goHub}
          onLaunch={(missionId) => prepareRun({ areaId: missionId, missionId })}
        />
      );

    case 'map-editor':
      return <MapBuilder onBack={goHub} onLaunch={(mapId) => prepareRun({ areaId: mapId })} />;

    case 'roster':
      return (
        <CharacterSelect
          onBack={goHub}
          onConfirm={() => setScreen({ name: 'areas' })}
          onLaunchEpisode={(episodeId, areaId) => prepareRun({ areaId, episodeId })}
        />
      );

    case 'areas':
      return (
        <AreaSelect
          onBack={goHub}
          onLaunch={(areaId, challengeIds) =>
            attemptTravelEncounter('run-launch', undefined, () => prepareRun({ areaId, challengeIds }))
          }
        />
      );

    case 'run-setup':
      return (
        <RunSetupScreen
          intent={screen.destination === 'run' ? 'launch' : 'manage'}
          onBack={goHub}
          onComplete={() => {
            if (screen.destination === 'hub' || !screen.areaId) {
              goHub();
              return;
            }
            setScreen({ name: 'run', areaId: screen.areaId, challengeIds: screen.challengeIds, episodeId: screen.episodeId, missionId: screen.missionId });
          }}
        />
      );

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
      return <VendorPanel onBack={goHub} onOpenThreatMatrix={() => setScreen({ name: 'threat-matrix' })} />;

    case 'workshop':
      return <WorkshopPanel onBack={goHub} />;

    case 'card-shop':
      return <CardShopPanel onBack={goHub} />;

    case 'settings':
      return <SettingsPanel onBack={goHub} />;

    case 'palette-store':
      return <PaletteGalleryPanel onBack={goHub} />;

    case 'sound-booth':
      return <SoundBoothPanel onBack={goHub} />;

    case 'account':
      return <AccountPanel onBack={goHub} />;

    case 'feedback':
      return <FeedbackPanel onBack={goHub} />;

    case 'threat-matrix':
      return <ThreatMatrixScreen onBack={goHub} />;

    case 'run':
      {
        const customMap = meta.customMaps.find((map) => map.id === screen.areaId);
        if (screen.areaId.startsWith('custom-') && !customMap) {
          return <AreaSelect onBack={goHub} onLaunch={(areaId, challengeIds) => prepareRun({ areaId, challengeIds })} />;
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
        <RunSummary
          result={screen.result}
          areaOverride={meta.customMaps.find((map) => map.id === screen.result.areaId) ? customMapToArea(meta.customMaps.find((map) => map.id === screen.result.areaId)!) : undefined}
          onReturnToHub={goHub}
          onOpenArchive={(variantId) => setScreen({ name: 'archive', variantId })}
          onOpenAccount={() => setScreen({ name: 'account' })}
          onRetry={() =>
            canRetry
              ? prepareRun({
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

  return (
    <>
      {renderScreen()}
      {travelEncounter && (
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
    <div
      data-ui-theme={meta.uiTheme}
      data-ui-swatch={activeUiThemeSwatchId(meta)}
      data-lokpet-art-style={meta.lokPetArtStyle}
      data-ui-border-style={meta.uiBorderStyle}
      className="min-h-[100dvh]"
    >
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
