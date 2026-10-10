import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { MusicProvider } from '@/game/audio/musicPlayer';
import { useSfxPlayer } from '@/game/audio/useSfxPlayer';
import { useUiChromeLayout } from '@/game/state/uiChromeLayoutSetting';
import { Sparkles } from 'lucide-react';
import { getActiveSoundPackStyle } from '@/game/data/soundPacks';
import { AuthProvider } from '@/state/authStore';
import { CloudSyncProvider } from '@/state/cloudSyncStore';
import { LokEconomyProvider, useLokEconomy } from '@/state/lokEconomyStore';
import { getEnemy } from '@/game/data/enemies';
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
import { useVisitTheme, visitThemeStyle } from '@/lib/gsixVisitTheme';
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
import type { AreaDef, RunResult, VendorItemCategory } from '@/game/types';
import type { ArenaSeat } from '@/game/arena/arenaWorld';
import type { ArenaNetRole } from '@/game/arena/arenaNet';
import { ArchivePanel } from '@/ui/ArchivePanel';
import { DirectorTerminalPanel } from '@/ui/DirectorTerminalPanel';
import { AreaSelect } from '@/ui/AreaSelect';
import { BestiaryPanel } from '@/ui/BestiaryPanel';
import { CharacterSelect } from '@/ui/CharacterSelect';
import { HubScreen, type HubPanel } from '@/ui/HubScreen';
import { IntroScreen } from '@/ui/IntroScreen';
import { LokShopScreen } from '@/ui/LokShopScreen';
import { PhotosensitivityNotice, photosensitivityNoticeHidden } from '@/ui/PhotosensitivityNotice';
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
import { WeaponBansScreen } from '@/ui/WeaponBansScreen';
import { GrpdArmoryScreen } from '@/ui/GrpdArmoryScreen';
import { grpdArmoryLocation } from '@/game/data/grpdArmory';
import { ThreatMatrixScreen } from '@/ui/ThreatMatrixScreen';
import { LokPetBattleScreen } from '@/ui/LokPetBattleScreen';
import { DustMiteRancherPanel } from '@/ui/DustMiteRancherPanel';
import { MusicNowPlaying } from '@/ui/MusicNowPlaying';
import { FocusWidgetMount } from '@/ui/FocusWidgetMount';
import { TravelEncounterOverlay } from '@/ui/TravelEncounterOverlay';
import { EncounterFightOverlay } from '@/ui/EncounterFightOverlay';
import { ChoiceEventOverlay } from '@/ui/ChoiceEventOverlay';
import { CHOICE_TRIGGERS } from '@/game/data/choiceEvents';
import { eventPetFor, pickChoiceEvent } from '@/game/engine/choiceEvents';
import { eventsLeftToday } from '@/game/engine/hideoutRewards';
import { getFightStyle, type FightStyle } from '@/game/state/fightStyleSetting';
import { GoToPalette } from '@/ui/GoToPalette';
import { MenuDock } from '@/ui/MenuDock';
import { StarterLokPetEncounter } from '@/ui/StarterLokPetEncounter';
import { RunSetupScreen } from '@/ui/RunSetupScreen';
import { createLokPetArchiveFixtureResult } from '@/test/lokpetArchiveFixture';
import { RELIC_BY_DISCOVERY_ID } from '@/game/data/relics';
import { customMapToArea } from '@/game/data/customMaps';
import { MapBuilder } from '@/ui/MapBuilder';
import { SectorCommandScreen } from '@/ui/SectorCommandScreen';
import { ArenaSetupScreen } from '@/ui/ArenaSetupScreen';
import { ArenaJoinScreen } from '@/ui/ArenaJoinScreen';
import { ArenaScreen } from '@/game/ArenaScreen';
const StudioScreen = lazy(() => import('@/ui/StudioScreen').then(m => ({ default: m.StudioScreen })));
const RunScreen = lazy(() => import('@/game/RunScreen').then(m => ({ default: m.RunScreen })));

const queryClient = new QueryClient();

/** Full-screen moments where a persistent menu would intrude. */
const DOCK_HIDDEN_SCREENS = ['intro', 'photosensitivity-notice', 'starter-lokpet-encounter', 'hub', 'run-setup', 'run', 'arena', 'arena-setup', 'arena-join', 'summary', 'studio', 'map-editor', 'sector-command', 'lokpet-battle'];

/** Screens with no payload that browser Back may return to. */
const HISTORY_SCREENS = new Set(['intro', 'hub', 'roster', 'areas', 'bestiary', 'archive', 'music', 'studio', 'recovery', 'vendor', 'workshop', 'card-shop', 'lok-shop', 'weapon-bans', 'settings', 'palette-store', 'sound-booth', 'account', 'feedback']);

type Screen =
  | { name: 'intro' }
  | { name: 'photosensitivity-notice' }
  | { name: 'starter-lokpet-encounter' }
  | { name: 'hub' }
  | { name: 'roster' }
  | { name: 'areas' }
  | { name: 'bestiary' }
  | { name: 'archive'; variantId?: string }
  | { name: 'music' }
  | { name: 'studio' }
  | { name: 'recovery' }
  | { name: 'vendor'; initialCategory?: VendorItemCategory }
  | { name: 'workshop' }
  | { name: 'card-shop' }
  | { name: 'lok-shop' }
  | { name: 'weapon-bans' }
  | { name: 'grpd-armory' }
  | { name: 'settings' }
  | { name: 'palette-store' }
  | { name: 'sound-booth' }
  | { name: 'account' }
  | { name: 'feedback' }
  | { name: 'threat-matrix' }
  | { name: 'director-terminal' }
  | { name: 'dust-mite-rancher' }
  | { name: 'frog-ranch' }
  | { name: 'map-editor' }
  | { name: 'sector-command' }
  | { name: 'lokpet-battle'; initialTab?: 'league' | 'sparring' | 'kennel' }
  | { name: 'arena-setup' }
  | { name: 'arena-join'; initialCode?: string }
  | { name: 'arena'; area: AreaDef; seats: ArenaSeat[]; net?: ArenaNetRole }
  | { name: 'run-setup'; areaId?: string; challengeIds?: string[]; episodeId?: string; missionId?: string; destination: 'run' | 'hub' }
  | { name: 'run'; areaId: string; challengeIds?: string[]; episodeId?: string; missionId?: string }
  | { name: 'summary'; result: RunResult };

/** A choice event waiting on the player (from a trigger, a prop or the "something is happening" chip). */
interface PendingChoiceEvent {
  eventId: string;
  petId?: string;
  propId?: string;
  /** Runs once the scene is closed; for a trigger this is the navigation it interrupted. */
  onResolved: () => void;
}

/** Session-only breather between choice events, like the one travel fights have. */
const CHOICE_EVENT_COOLDOWN_MS = 60_000;

interface PendingTravelEncounter {
  opponent: ResolvedTravelEncounterOpponent;
  rng: () => number;
  label: string;
  /** Read once when the encounter starts, so flipping the setting never swaps a fight mid-round. */
  fightStyle: FightStyle;
  /** The navigation that was intercepted; run once the popup resolves (win/lose/flee). */
  onResolved: () => void;
}

/**
 * Lets a screen be opened directly (e.g. `?screen=areas`) so any part of the
 * game can be reached without replaying progress. Only honoured in dev.
 */
function initialScreen(): Screen {
  // `?room=CODE` is the shareable arena-invite link -- honoured in every
  // build (not dev-only like the rest of this function), since it's how a
  // friend actually joins a LokSurvivorArena online room.
  if (typeof window !== 'undefined') {
    const roomCode = new URLSearchParams(window.location.search).get('room');
    if (roomCode) return { name: 'arena-join', initialCode: roomCode };
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('screen');
    const areaId = params.get('area');
    if (requested === 'run' && areaId) return { name: 'run', areaId };
    if (requested === 'summary' && params.get('fixture') === 'lokpet-archive') {
      return { name: 'summary', result: createLokPetArchiveFixtureResult() };
    }
    if (requested === 'run-setup') return { name: 'run-setup', destination: 'hub' };
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
      requested === 'weapon-bans' ||
      requested === 'grpd-armory' ||
      requested === 'frog-ranch' ||
      requested === 'settings' ||
      requested === 'account' ||
      requested === 'feedback' ||
      requested === 'threat-matrix' ||
      requested === 'director-terminal'
    ) {
      return { name: requested };
    }
    if (requested === 'sector-command') return { name: 'sector-command' };
  }
  return { name: 'intro' };
}

function Game() {
  const { meta, markOnboarded, selectedCharacter, completeRun, completeSectorMission, enterHideout, unlockedAreas, unlockedRooms } = useMeta();
  const [screen, setScreen] = useState<Screen>(() => initialScreen());
  const chromeLayout = useUiChromeLayout();
  const looksReturnRef = useRef<Screen | null>(null);
  const screenRef = useRef<Screen>(screen);
  const [roomId, setRoomId] = useState('main-floor');
  const [travelEncounter, setTravelEncounter] = useState<PendingTravelEncounter | null>(null);
  const [choiceEvent, setChoiceEvent] = useState<PendingChoiceEvent | null>(null);
  const sfx = useSfxPlayer(getActiveSoundPackStyle(meta.activeSoundPackId), meta.sfxEnabled);
  const { earn: earnLokTokens } = useLokEconomy();

  const goHub = useCallback(() => {
    sfx.play('uiNav');
    enterHideout();
    // Daily cap of 1 (per lok_earn_rules) makes repeat hub visits the same
    // day a safe no-op server-side; the date-scoped idemKey below just keeps
    // the ledger's ref readable, it isn't what prevents double-crediting.
    earnLokTokens('daily_login', { refType: 'day', refId: new Date().toISOString().slice(0, 10) });
    setScreen({ name: 'hub' });
  }, [enterHideout, sfx, earnLokTokens]);

  const openLooks = useCallback(() => {
    looksReturnRef.current = screen;
    setScreen({ name: 'run-setup', destination: 'hub' });
  }, [screen]);

  const returnFromLooks = useCallback(() => {
    const previous = looksReturnRef.current;
    looksReturnRef.current = null;
    if (previous) setScreen(previous);
    else goHub();
  }, [goHub]);

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
      case 'kennel':
        setScreen({ name: 'vendor', initialCategory: 'lokpet' });
        break;
      case 'workshop':
        setScreen({ name: 'workshop' });
        break;
      case 'card-shop':
        setScreen({ name: 'card-shop' });
        break;
      case 'lok-shop':
        setScreen({ name: 'lok-shop' });
        break;
      case 'weapon-bans':
        setScreen({ name: 'weapon-bans' });
        break;
      case 'grpd-armory':
        setScreen({ name: 'grpd-armory' });
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
      case 'dust-mite-rancher':
        setScreen({ name: 'dust-mite-rancher' });
        break;
      case 'frog-ranch':
        setScreen({ name: 'frog-ranch' });
        break;
      case 'director-terminal':
        setScreen({ name: 'director-terminal' });
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
          rewardKeys: contract.rewardKeys,
        })),
      };
      completeRun(resultWithFatigue);
      // Campaign credit follows the mission's own objectives, not the run's
      // generic `cleared` -- otherwise idling out the clock banks the mission.
      if (result.missionId && result.missionComplete) completeSectorMission(result.missionId);

      const runRef = { refType: 'run', refId: `${result.areaId}-${Date.now()}` };
      earnLokTokens('run_complete', runRef);
      if (result.cleared) earnLokTokens('area_cleared', runRef);
      const killedBoss = Object.keys(result.killsByEnemy).some(
        (enemyId) => getEnemy(enemyId).family === 'Boss',
      );
      if (killedBoss) earnLokTokens('boss_kill', runRef);

      setScreen({ name: 'summary', result: resultWithFatigue });
    },
    [completeRun, completeSectorMission, meta.fatigueByCharacter, meta.knownRelicIds, earnLokTokens],
  );

  const lastTravelEncounterAtRef = useRef(0);
  const lastChoiceEventAtRef = useRef(0);

  /** Starts a travel fight when one fires; returns whether it did. */
  const tryTravelFight = useCallback(
    (source: TravelEncounterSource, targetRoomId: string | undefined, proceed: () => void): boolean => {
      // Never ambush a brand-new player before they've finished a real run
      // and learned the basics, and never fire back-to-back within a
      // session -- both gaps in the original v1 rollout.
      if (
        !meta.travelEncountersEnabled ||
        meta.totalRuns < TRAVEL_ENCOUNTER_MIN_TOTAL_RUNS ||
        Date.now() - lastTravelEncounterAtRef.current < TRAVEL_ENCOUNTER_COOLDOWN_MS
      ) {
        return false;
      }
      const trigger = TRAVEL_ENCOUNTER_TRIGGERS.find(
        (candidate) => candidate.source === source && (source !== 'hub-room' || candidate.roomId === targetRoomId),
      );
      if (!trigger || Math.random() >= trigger.chance) return false;
      lastTravelEncounterAtRef.current = Date.now();
      const rng = createRng(Date.now());
      const opponent = resolveTravelEncounterOpponent(pickTravelEncounterOpponent(rng), rng);
      setTravelEncounter({ opponent, rng, label: trigger.label, fightStyle: getFightStyle(), onResolved: proceed });
      return true;
    },
    [meta.travelEncountersEnabled, meta.totalRuns],
  );

  /**
   * Offers a choice event on the same navigation points as the travel fights (never both for one
   * move). It has its own switch in Settings, its own session breather and a daily limit, and a
   * missed or closed scene costs nothing.
   */
  const tryChoiceEvent = useCallback(
    (source: TravelEncounterSource, targetRoomId: string | undefined, proceed: () => void): boolean => {
      const now = Date.now();
      if (
        meta.hideoutChoiceEvents === 'off' ||
        meta.totalRuns < TRAVEL_ENCOUNTER_MIN_TOTAL_RUNS ||
        now - lastChoiceEventAtRef.current < CHOICE_EVENT_COOLDOWN_MS ||
        eventsLeftToday(meta.hideoutLedger, now) <= 0
      ) {
        return false;
      }
      const trigger = CHOICE_TRIGGERS.find(
        (candidate) => candidate.source === source && (source !== 'hub-room' || candidate.roomId === targetRoomId),
      );
      if (!trigger || Math.random() >= trigger.chance * (meta.hideoutChoiceEvents === 'quiet' ? 0.4 : 1)) return false;
      const pet = eventPetFor(meta);
      const picked = pickChoiceEvent(trigger.pool, meta.hideoutClaims, { now, pet }, Math.random);
      if (!picked) return false;
      lastChoiceEventAtRef.current = now;
      setChoiceEvent({ eventId: picked.id, petId: pet?.id, onResolved: proceed });
      return true;
    },
    [meta],
  );

  const attemptTravelEncounter = useCallback(
    (source: TravelEncounterSource, targetRoomId: string | undefined, proceed: () => void) => {
      if (tryTravelFight(source, targetRoomId, proceed)) return;
      if (tryChoiceEvent(source, targetRoomId, proceed)) return;
      proceed();
    },
    [tryTravelFight, tryChoiceEvent],
  );

  // Browser/OS Back support: screens without a payload get a history entry, so Back walks the
  // player through the menus they visited instead of leaving the site. Screens that carry
  // state (a run in progress, a summary) are never re-entered from history.
  const lastPushedScreen = useRef<string | null>(null);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const name = (event.state as { screen?: string } | null)?.screen;
      lastPushedScreen.current = name ?? null;
      if (screenRef.current.name === 'run' || screenRef.current.name === 'arena') {
        // Never abandon a live run on a stray Back press.
        window.history.pushState({ screen: screenRef.current.name }, '');
        return;
      }
      if (name && HISTORY_SCREENS.has(name)) setScreen({ name } as Screen);
      else if (name === undefined) goHub();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [goHub]);
  useEffect(() => {
    screenRef.current = screen;
    if (lastPushedScreen.current === screen.name) return;
    const isFirst = lastPushedScreen.current === null;
    lastPushedScreen.current = screen.name;
    // The first screen replaces the entry the browser opened with, so Back from the title leaves the site.
    if (isFirst) window.history.replaceState({ screen: screen.name }, '');
    else window.history.pushState({ screen: screen.name }, '');
  }, [screen]);

  const unlockedFeatures = useMemo(() => new Set<string>(unlockedRooms.flatMap((room) => room.features)), [unlockedRooms]);
  const goToScreen = useCallback(
    (id: string) => {
      sfx.play('uiNav');
      if (id === 'hub') goHub();
      else if (id === 'looks') openLooks();
      else if (id === 'areas') setScreen({ name: 'areas' });
      else setScreen({ name: id } as Screen);
    },
    [goHub, openLooks, sfx],
  );

  /** Where the title screen leads once the player is ready: the starter pet meeting, or the hideout. */
  function enterAfterIntro() {
    if (!meta.starterLokPetOnboardingComplete && meta.totalRuns === 0 && meta.savedLokPets.length === 0) {
      setScreen({ name: 'starter-lokpet-encounter' });
    } else {
      goHub();
    }
  }

  function renderScreen(): ReactNode {
  switch (screen.name) {
    case 'intro':
      return (
        <IntroScreen
          onBegin={() => {
            markOnboarded();
            if (photosensitivityNoticeHidden()) enterAfterIntro();
            else setScreen({ name: 'photosensitivity-notice' });
          }}
          onSignIn={() => {
            markOnboarded();
            setScreen({ name: 'account' });
          }}
        />
      );

    case 'photosensitivity-notice':
      return <PhotosensitivityNotice onContinue={enterAfterIntro} />;

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
              attemptTravelEncounter('hub-room', nextRoomId, () => {
                sfx.play('uiNav');
                setScreen({ name: 'card-shop' });
              });
              return;
            }
            if (nextRoomId === 'studio-28') {
              attemptTravelEncounter('hub-room', nextRoomId, () => {
                sfx.play('uiNav');
                setScreen({ name: 'weapon-bans' });
              });
              return;
            }
            attemptTravelEncounter('hub-room', nextRoomId, () => { sfx.play('uiNav'); setRoomId(nextRoomId); });
          }}
          onOpen={openPanel}
          onOpenMapEditor={() => setScreen({ name: 'map-editor' })}
          onOpenSectorCommand={() => setScreen({ name: 'sector-command' })}
          onOpenLokPetBattle={() => setScreen({ name: 'lokpet-battle' })}
          onOpenArena={() => setScreen({ name: 'arena-setup' })}
          onOpenRunSetup={openLooks}
          onStartChoiceEvent={(eventId, propId) => {
            lastChoiceEventAtRef.current = Date.now();
            setChoiceEvent({ eventId, propId, petId: eventPetFor(meta)?.id, onResolved: () => undefined });
          }}
          onBack={() => setScreen({ name: 'intro' })}
        />
      );

    case 'lokpet-battle':
      return <LokPetBattleScreen onReturnToHub={goHub} initialTab={screen.initialTab} />;

    case 'arena-setup':
      return (
        <ArenaSetupScreen
          onBack={goHub}
          onLaunch={(area, seats, net) => setScreen({ name: 'arena', area, seats, net })}
          onJoinOnline={() => setScreen({ name: 'arena-join' })}
        />
      );

    case 'arena-join':
      return (
        <ArenaJoinScreen
          initialCode={screen.initialCode}
          onBack={goHub}
          onLaunch={(area, seats, net) => setScreen({ name: 'arena', area, seats, net })}
        />
      );

    case 'arena':
      return <ArenaScreen area={screen.area} seats={screen.seats} net={screen.net} onExit={goHub} />;

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
          onBack={screen.destination === 'hub' ? returnFromLooks : goHub}
          onComplete={() => {
            if (screen.destination === 'hub' || !screen.areaId) {
              returnFromLooks();
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
      return <VendorPanel initialCategory={screen.initialCategory} onBack={goHub} onOpenThreatMatrix={() => setScreen({ name: 'threat-matrix' })} />;

    case 'workshop':
      return <WorkshopPanel onBack={goHub} />;

    case 'card-shop':
      return <CardShopPanel onBack={goHub} />;

    case 'lok-shop':
      return <LokShopScreen onBack={goHub} />;

    case 'weapon-bans':
      return <WeaponBansScreen onBack={goHub} />;

    case 'grpd-armory':
      return <GrpdArmoryScreen onBack={() => { setRoomId(grpdArmoryLocation(meta.grpdArmoryAnchor, unlockedRooms.some((room) => room.id === 'grpd-station')) === 'hideout' ? 'main-floor' : 'grpd-station'); goHub(); }} />;

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

    case 'dust-mite-rancher':
      return <DustMiteRancherPanel onBack={goHub} onOpenLokPetBattle={() => setScreen({ name: 'lokpet-battle' })} />;

    case 'frog-ranch':
      return <DustMiteRancherPanel initialCategory="frogs" onBack={goHub} onOpenLokPetBattle={() => setScreen({ name: 'lokpet-battle' })} />;

    case 'director-terminal':
      return <DirectorTerminalPanel onBack={goHub} />;

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
      {!(screen.name === 'hub' && chromeLayout === 'new') && <MusicNowPlaying placement={['intro', 'hub', 'run', 'arena'].includes(screen.name) ? 'default' : 'menu'} />}
      <GoToPalette
        unlockedFeatures={unlockedFeatures}
        disabled={['intro', 'photosensitivity-notice', 'starter-lokpet-encounter', 'run-setup', 'run', 'arena'].includes(screen.name)}
        showButton={screen.name === 'hub'}
        onGo={goToScreen}
      />
      {!DOCK_HIDDEN_SCREENS.includes(screen.name) && <MenuDock screenName={screen.name} onGo={goToScreen} />}
      {!['intro', 'hub', 'run-setup', 'run', 'arena', 'starter-lokpet-encounter'].includes(screen.name) && (
        <button type="button" onClick={openLooks} className="fixed right-[max(0.75rem,var(--safe-right))] top-[max(0.75rem,var(--safe-top))] z-[110] inline-flex min-h-11 active:scale-95 items-center gap-2 border border-cyan-200/35 bg-slate-950/85 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-50 shadow-xl backdrop-blur transition hover:border-cyan-100" data-testid="button-global-looks-lokpets"><Sparkles className="h-4 w-4 text-cyan-200" />Looks & LokPets</button>
      )}
      {choiceEvent && (
        <ChoiceEventOverlay
          eventId={choiceEvent.eventId}
          petId={choiceEvent.petId}
          propId={choiceEvent.propId}
          onClose={() => {
            const proceed = choiceEvent.onResolved;
            setChoiceEvent(null);
            proceed();
          }}
        />
      )}
      {travelEncounter && (() => {
        const close = () => {
          const proceed = travelEncounter.onResolved;
          setTravelEncounter(null);
          proceed();
        };
        if (travelEncounter.fightStyle === 'classic') {
          return (
            <TravelEncounterOverlay
              opponent={travelEncounter.opponent}
              rng={travelEncounter.rng}
              label={travelEncounter.label}
              onClose={close}
            />
          );
        }
        return (
          <EncounterFightOverlay
            style={travelEncounter.fightStyle}
            opponent={travelEncounter.opponent}
            rng={travelEncounter.rng}
            label={travelEncounter.label}
            onClose={close}
          />
        );
      })()}
    </>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MetaProvider>
          <CloudSyncProvider>
            <LokEconomyProvider>
              <MusicProvider>
                {children}
                <FocusWidgetMount />
              </MusicProvider>
            </LokEconomyProvider>
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
  const visitTheme = useVisitTheme();
  return (
    <div
      style={visitTheme ? visitThemeStyle(visitTheme) : undefined}
      data-ui-theme={meta.uiTheme}
      data-ui-swatch={activeUiThemeSwatchId(meta)}
      data-lokpet-art-style={meta.lokPetArtStyle}
      data-ui-border-style={meta.uiBorderStyle}
      data-lokpet-border-style={meta.lokPetBorderStyle}
      data-character-border-style={meta.characterBorderStyle}
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
