import type { HudSnapshot } from '@/game/types';

export interface RunHudSignal {
  id: string;
  label: string;
  detail?: string;
  accent: string;
  urgent: boolean;
  /** Transient signals leave the arena automatically and stay suppressed for the run. */
  ttlMs?: number;
}

export type RunHudZoneId = 'top-bar' | 'primary-signal' | 'intel-drawer' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface RunHudZoneDefinition {
  id: RunHudZoneId;
  occupancy: 'permanent' | 'transient' | 'player-opened';
  maxHeightPx: number;
  maxWidthPx?: number;
  capturesInput: boolean;
}

/** Every run overlay must claim one of these zones so new features cannot silently rebuild the old stacked HUD. */
export const RUN_HUD_ZONES: Record<RunHudZoneId, RunHudZoneDefinition> = {
  'top-bar': { id: 'top-bar', occupancy: 'permanent', maxHeightPx: 32, capturesInput: true },
  'primary-signal': { id: 'primary-signal', occupancy: 'transient', maxHeightPx: 24, maxWidthPx: 310, capturesInput: false },
  'intel-drawer': { id: 'intel-drawer', occupancy: 'player-opened', maxHeightPx: 430, maxWidthPx: 300, capturesInput: true },
  'bottom-left': { id: 'bottom-left', occupancy: 'player-opened', maxHeightPx: 270, maxWidthPx: 190, capturesInput: true },
  'bottom-center': { id: 'bottom-center', occupancy: 'player-opened', maxHeightPx: 150, maxWidthPx: 240, capturesInput: true },
  'bottom-right': { id: 'bottom-right', occupancy: 'permanent', maxHeightPx: 80, maxWidthPx: 80, capturesInput: true },
};

export const RUN_HUD_ZONE_CLASSES: Record<RunHudZoneId, string> = {
  'top-bar': 'absolute inset-x-0 top-0 min-h-8',
  'primary-signal': 'absolute left-1/2 top-[max(2.15rem,calc(env(safe-area-inset-top)+2rem))] h-6 w-[min(62vw,310px)] -translate-x-1/2',
  'intel-drawer': 'absolute right-1 top-[max(2.15rem,calc(env(safe-area-inset-top)+2rem))] max-h-[min(56dvh,430px)] w-[min(78vw,300px)]',
  'bottom-left': 'absolute bottom-3 left-3 max-h-[min(32dvh,270px)]',
  'bottom-center': 'absolute bottom-2 left-1/2 max-h-[min(24dvh,150px)] w-[min(72vw,240px)] -translate-x-1/2',
  'bottom-right': 'absolute bottom-5 right-3 h-16 w-16 sm:bottom-8 sm:right-6 sm:h-20 sm:w-20',
};

export function runHudArenaBudget(viewportHeightPx: number): { protectedHeightPx: number; protectedRatio: number } {
  const occupiedTop = RUN_HUD_ZONES['top-bar'].maxHeightPx + RUN_HUD_ZONES['primary-signal'].maxHeightPx + 8;
  const occupiedBottom = RUN_HUD_ZONES['bottom-right'].maxHeightPx;
  const protectedHeightPx = Math.max(0, viewportHeightPx - occupiedTop - occupiedBottom);
  return { protectedHeightPx, protectedRatio: viewportHeightPx > 0 ? protectedHeightPx / viewportHeightPx : 0 };
}

function isSuppressed(id: string, suppressedSignalIds?: ReadonlySet<string>): boolean {
  return suppressedSignalIds?.has(id) === true;
}

/** Picks exactly one signal for the arena-safe HUD; full detail lives in the player-opened drawer. */
export function selectPrimaryRunHudSignal(
  hud: HudSnapshot | null,
  challengeNames: string[],
  suppressedSignalIds?: ReadonlySet<string>,
): RunHudSignal | null {
  if (!hud) return null;
  if (hud.rescueAvailable) return {
    id: 'rescue',
    label: hud.rescueAllyName ? `${hud.rescueAllyName} is caged` : 'Rescue nearby',
    detail: hud.rescueProgressPct > 0 ? `${hud.rescueProgressPct}%` : 'Stand with them',
    accent: '#ffe08a', urgent: true,
  };
  if (hud.districtIncursion && hud.districtIncursion.phase === 'active') return {
    id: `incursion-${hud.districtIncursion.id}`,
    label: hud.districtIncursion.title,
    detail: `${hud.districtIncursion.progress}/${hud.districtIncursion.target} · ${hud.districtIncursion.remainingSec}s`,
    accent: hud.districtIncursion.accent, urgent: true,
  };
  if (hud.firstNightBeat) {
    const id = `story-${hud.firstNightBeat.title}-${hud.firstNightBeat.text}`;
    if (!isSuppressed(id, suppressedSignalIds)) {
      return { id, label: hud.firstNightBeat.title, detail: hud.firstNightBeat.text, accent: '#67e8f9', urgent: false, ttlMs: 5_000 };
    }
  }
  const incomplete = hud.objectives.find((objective) => !objective.completed);
  if (incomplete) return { id: `objective-${incomplete.label}`, label: incomplete.label, detail: `${incomplete.progress}/${incomplete.target}`, accent: '#fbbf24', urgent: false };
  const alert = hud.alerts.at(-1);
  if (alert) {
    const id = `alert-${alert}`;
    if (!isSuppressed(id, suppressedSignalIds)) return { id, label: alert, accent: '#ffffff', urgent: false, ttlMs: 3_200 };
  }
  if (hud.episode && !hud.episode.completed) return { id: `episode-${hud.episode.id}`, label: hud.episode.title, detail: `${hud.episode.progress}/${hud.episode.target}`, accent: '#fbbf24', urgent: false };
  if (challengeNames.length > 0) return { id: 'contracts', label: `${challengeNames.length} contract${challengeNames.length === 1 ? '' : 's'} active`, detail: challengeNames[0], accent: '#fca5a5', urgent: false };
  return null;
}

export function runHudIntelCount(hud: HudSnapshot | null, challengeCount: number): number {
  if (!hud) return challengeCount;
  return challengeCount
    + hud.loadout.weapons.length
    + hud.loadout.passives.length
    + hud.activeEffects.length
    + hud.lokPets.length
    + hud.objectives.filter((objective) => !objective.completed).length
    + (hud.crewRumor ? 1 : 0)
    + (hud.evolution ? 1 : 0)
    + (hud.relicWorkshop.activeRecipe ? 1 : 0);
}
