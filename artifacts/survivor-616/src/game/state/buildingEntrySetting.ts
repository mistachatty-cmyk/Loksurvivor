/** Device-local Endless building behavior. Read once when a run starts. */
export type BuildingEntryStyle = 'seamless' | 'classic';

export const BUILDING_ENTRY_STYLES: Array<{ id: BuildingEntryStyle; label: string; blurb: string }> = [
  { id: 'seamless', label: 'Walk in', blurb: 'Step through a doorway in the same street. Enemies, pickups, and projectiles stay in play.' },
  { id: 'classic', label: 'Classic', blurb: 'The original separate prefab room, with a transition back to the street.' },
];

const KEY = 'survivor616.building-entry-style';

export function getBuildingEntryStyle(): BuildingEntryStyle {
  try {
    return window.localStorage.getItem(KEY) === 'classic' ? 'classic' : 'seamless';
  } catch {
    return 'seamless';
  }
}

export function setBuildingEntryStyle(style: BuildingEntryStyle): void {
  try {
    window.localStorage.setItem(KEY, style);
  } catch {
    // The selected button still updates for this Settings visit.
  }
}
