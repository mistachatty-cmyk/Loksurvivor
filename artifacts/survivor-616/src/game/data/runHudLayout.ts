import type { HudSnapshot } from '@/game/types';

export interface RunHudSignal {
  id: string;
  label: string;
  detail?: string;
  accent: string;
  urgent: boolean;
}

/** Picks exactly one signal for the arena-safe HUD; full detail lives in the player-opened drawer. */
export function selectPrimaryRunHudSignal(hud: HudSnapshot | null, challengeNames: string[]): RunHudSignal | null {
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
  if (hud.firstNightBeat) return { id: 'story', label: hud.firstNightBeat.title, detail: hud.firstNightBeat.text, accent: '#67e8f9', urgent: false };
  const incomplete = hud.objectives.find((objective) => !objective.completed);
  if (incomplete) return { id: `objective-${incomplete.label}`, label: incomplete.label, detail: `${incomplete.progress}/${incomplete.target}`, accent: '#fbbf24', urgent: false };
  const alert = hud.alerts.at(-1);
  if (alert) return { id: `alert-${alert}`, label: alert, accent: '#ffffff', urgent: false };
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
