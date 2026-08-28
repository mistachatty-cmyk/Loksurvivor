import type { HideoutSceneDef, HideoutWeather } from '@/game/types';

/**
 * The hideout's scene layer is deliberately authored data, not a simulation.
 * Weather is room-specific so refreshes remain stable and never touch runs.
 */
export const HIDEOUT_SCENES: Record<string, HideoutSceneDef> = {
  'main-floor': {
    biome: 'sanctum',
    weather: 'rain',
    weatherLabel: 'Rain on the awning',
    weatherDescription: 'A steady roof-rattle keeps the Sanctum feeling occupied.',
    homeName: 'The lit corner',
    homeDescription: 'A warm bar, patched windows, and a bell cord that reaches every room.',
    homeAccent: '#f59e0b',
    skyAccent: '#334155',
    motionKind: 'birds',
    flavorLines: [
      'The rain makes everyone talk a little closer to the music.',
      'Someone marks the safest dry route home on a napkin.',
      'The awning holds. For tonight, that counts as a victory.',
    ],
  },
  'rooftop-perch': {
    biome: 'rooftop',
    weather: 'fog',
    weatherLabel: 'River fog',
    weatherDescription: 'Fog rolls between the towers, turning every rooftop into a lookout.',
    homeName: 'The water-tower nest',
    homeDescription: 'A patched lookout nest with signal lamps, spare blankets, and a view of the grid.',
    homeAccent: '#38bdf8',
    skyAccent: '#164e63',
    motionKind: 'drones',
    flavorLines: [
      'The fog swallows the sirens before they can find the roof.',
      'A signal lamp blinks twice: someone out there made it home.',
      'The city disappears at the edges, leaving only the people beside you.',
    ],
  },
  'the-cellar': {
    biome: 'cellar',
    weather: 'heat',
    weatherLabel: 'Glass heat',
    weatherDescription: 'Warmth from the glass growths wavers through the old brick.',
    homeName: 'The record grotto',
    homeDescription: 'A listening nook grown around the old cellar pipes, glowing softly from within.',
    homeAccent: '#2dd4bf',
    skyAccent: '#134e4a',
    motionKind: 'motes',
    flavorLines: [
      'The records sound better when the glass is warm.',
      'Someone leaves the cellar door open so the kitchen can borrow the heat.',
      'The pipes hum a note nobody remembers teaching them.',
    ],
  },
  'the-alley': {
    biome: 'alley',
    weather: 'clear',
    weatherLabel: 'Quiet night',
    weatherDescription: 'The service lamp holds a steady circle of light over the crates.',
    homeName: 'The fire-escape bench',
    homeDescription: 'A workbench built from salvage, close enough to the door to hear the street.',
    homeAccent: '#fb923c',
    skyAccent: '#1c1917',
    motionKind: 'motes',
    flavorLines: [
      'Someone is still sorting the night\'s salvage by lamp light.',
      'The propped door lets the street noise in, low and familiar.',
      'A crate gets restacked for the third time. Nobody minds.',
    ],
  },
  'the-storefront': {
    biome: 'archive',
    weather: 'fog',
    weatherLabel: 'Streetlight haze',
    weatherDescription: 'Fog off the river blurs the shuttered windows into soft light.',
    homeName: 'The ledger counter',
    homeDescription: 'A front counter stacked with record books, every name in the block written down somewhere.',
    homeAccent: '#a78bfa',
    skyAccent: '#1e1b3a',
    motionKind: 'drones',
    flavorLines: [
      'Someone is cross-referencing a name against the old ledger again.',
      'The shutters rattle once and settle. Just the wind off the river.',
      'A new page gets added to the book. Nobody reads it out loud.',
    ],
  },
};

export const DEFAULT_HIDEOUT_SCENE: HideoutSceneDef = HIDEOUT_SCENES['main-floor'];

export function getHideoutScene(roomId: string): HideoutSceneDef {
  return HIDEOUT_SCENES[roomId] ?? DEFAULT_HIDEOUT_SCENE;
}

export function weatherClass(weather: HideoutWeather): string {
  return `hideout-weather-${weather}`;
}