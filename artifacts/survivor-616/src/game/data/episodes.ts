import type { CharacterEpisodeDef, EpisodeObjectiveDef, UnlockRule } from '@/game/types';
import { CHARACTERS_BY_ID } from './characters';
import { EVOLUTIONS_BY_ID } from './evolutions';

type EpisodeSeed = Omit<CharacterEpisodeDef, 'unlock'> & { unlock?: UnlockRule };

const episode = (seed: EpisodeSeed): CharacterEpisodeDef => {
  const character = CHARACTERS_BY_ID[seed.characterId];
  if (!character) throw new Error(`Episode references unknown character: ${seed.characterId}`);
  const evolution = EVOLUTIONS_BY_ID[seed.evolutionId];
  if (!evolution) throw new Error(`Episode references unknown evolution: ${seed.evolutionId}`);
  if (evolution.baseWeaponId !== character.weapon.id) {
    throw new Error(`Evolution ${seed.evolutionId} does not belong to ${seed.characterId}`);
  }
  return { ...seed, unlock: seed.unlock ?? character.unlock };
};

const killAny = (id: string, label: string, targetCount: number): EpisodeObjectiveDef => ({
  id, label, kind: 'kill-any', targetCount,
});
const killEnemy = (id: string, label: string, enemyId: string, targetCount: number): EpisodeObjectiveDef => ({
  id, label, kind: 'kill-enemy', enemyId, targetCount,
});
const survive = (id: string, label: string, targetCount: number): EpisodeObjectiveDef => ({
  id, label, kind: 'survive-sec', targetCount,
});
const walk = (id: string, label: string, targetCount: number): EpisodeObjectiveDef => ({
  id, label, kind: 'walk-blocks', targetCount,
});
const rescue = (id: string, label: string, allyId: string): EpisodeObjectiveDef => ({
  id, label, kind: 'rescue-ally', allyId, targetCount: 1,
});
const discover = (id: string, label: string, discoveryId: string): EpisodeObjectiveDef => ({
  id, label, kind: 'discover', discoveryId, targetCount: 1,
});
const clearArea = (id: string, label: string, areaId: string): EpisodeObjectiveDef => ({
  id, label, kind: 'clear-area', areaId, targetCount: 1,
});

export const CHARACTER_EPISODES: CharacterEpisodeDef[] = [
  episode({
    id: 'shade-afterglow', characterId: 'shade', title: 'Afterglow',
    teaser: 'The dark left a receipt on Monroe.',
    cityLocation: 'Monroe Strip · the dead streetlights',
    areaId: 'monroe-strip', crewAllyId: 'vee',
    objective: killEnemy('shade-afterglow-kills', 'Down 8 Nightcrawlers', 'nightcrawler', 8),
    completionText: 'Shade learns the blackout has an echo—and it answers back.',
    evolutionId: 'void-echo',
  }),
  episode({
    id: 'queenbee-hive-signal', characterId: 'queenbee', title: 'Hive Signal',
    teaser: 'A lost frequency is calling the hive below Fulton.',
    cityLocation: 'Fulton Back Alley · the painted service door',
    areaId: 'back-alley', crewAllyId: 'deacon',
    objective: rescue('queenbee-hive-signal-rescue', 'Free the trapped signal runner', 'deacon'),
    completionText: 'The hive finds its second voice in the alley walls.',
    evolutionId: 'queen-swarm',
  }),
  episode({
    id: 'lilstinger-rooftop-guard', characterId: 'lilstinger', title: 'Rooftop Guard',
    teaser: 'The roofline needs one small lookout with a very large bee.',
    cityLocation: 'Rooftop Line · the water tower',
    areaId: 'rooftops', crewAllyId: 'nyx',
    objective: killEnemy('lilstinger-rooftop-bats', 'Down 12 Belfry Bats', 'belfry-bat', 12),
    completionText: 'Lil Stinger marks the roof as safe enough for the next signal.',
    evolutionId: 'king-crown',
  }),
  episode({
    id: 'masky-sanctum-floor', characterId: 'masky', title: 'Sanctum Floor',
    teaser: 'The Sanctum has one more fight left in its floorboards.',
    cityLocation: 'Siege on the Sanctum · the back room',
    areaId: 'bar-siege', crewAllyId: 'mamajo',
    objective: clearArea('masky-sanctum-clear', 'Clear the Sanctum siege', 'bar-siege'),
    completionText: 'Masky turns a hard landing into a welcome mat.',
    evolutionId: 'mask-breaker',
  }),
  episode({
    id: 'llamaste-cellar-breath', characterId: 'llamaste', title: 'Cellar Breath',
    teaser: 'Something beneath the cellar is holding its breath.',
    cityLocation: 'Crystal Cellar · the lantern steps',
    areaId: 'crystal-cellar', crewAllyId: 'sable',
    objective: discover('llamaste-cellar-discovery', 'Find the lantern shard', 'lantern-shard'),
    completionText: 'Llamasté leaves the cellar quieter than he found it.',
    evolutionId: 'lotus-tide',
  }),
  episode({
    id: 'glacierwarden-floodwall-watch', characterId: 'glacierwarden', title: 'Floodwall Watch',
    teaser: 'The river fog is freezing around a moving constellation.',
    cityLocation: 'Grand River Floodwall · the west bank',
    areaId: 'riverfront', crewAllyId: 'sable',
    objective: killEnemy('glacierwarden-stags', 'Down 8 Current Stags', 'current-stag', 8),
    completionText: 'The Warden gives the river a line it cannot cross.',
    evolutionId: 'glacier-constellation',
  }),
  episode({
    id: 'riftwitch-market-glitch', characterId: 'riftwitch', title: 'Market Glitch',
    teaser: 'Old Market is selling a shortcut that was never built.',
    cityLocation: 'Old Market Hall · the shuttered arcade',
    areaId: 'old-market', crewAllyId: 'vee',
    objective: discover('riftwitch-market-discovery', 'Find the market bell', 'market-bell'),
    completionText: 'Rift Witch folds the false shortcut into a usable door.',
    evolutionId: 'rift-lattice',
  }),
  episode({
    id: 'prismrunner-seven-color-route', characterId: 'prismrunner', title: 'Seven-Color Route',
    teaser: 'A courier route is still missing its final seven blocks.',
    cityLocation: 'Rooftop Line · the impossible shortcut',
    areaId: 'rooftops', crewAllyId: 'nyx',
    objective: walk('prismrunner-route-walk', 'Walk 7 blocks through the roofline', 7),
    completionText: 'Prism Runner redraws the city in a route enemies cannot predict.',
    evolutionId: 'prism-splinter',
  }),
  episode({
    id: 'cinderhalo-last-match', characterId: 'cinderhalo', title: 'Last Match',
    teaser: 'One ember stayed lit after the rooftop went dark.',
    cityLocation: 'Rooftop Line · the maintenance flare',
    areaId: 'rooftops', crewAllyId: 'nyx',
    objective: killEnemy('cinderhalo-wisps', 'Down 10 Ash Wisps', 'ash-wisp', 10),
    completionText: 'Cinder Halo teaches the last match how to travel.',
    evolutionId: 'cinder-crescendo',
  }),
  episode({
    id: 'orbitanchor-aphelion', characterId: 'orbitanchor', title: 'Aphelion',
    teaser: 'The Floodwall sky has one orbit that refuses to close.',
    cityLocation: 'Grand River Floodwall · the broken gauge',
    areaId: 'riverfront', crewAllyId: 'sable',
    objective: survive('orbitanchor-aphelion-survive', 'Hold the gauge for 75 seconds', 75),
    completionText: 'Orbit Anchor gives the runaway orbit somewhere safe to land.',
    evolutionId: 'orbit-apogee',
  }),
  episode({
    id: 'triangle-saint-civic-mercy', characterId: 'triangle-saint', title: 'Civic Mercy',
    teaser: 'Three angles of the plaza are glowing for the wrong reasons.',
    cityLocation: 'Civic Plaza · the fountain steps',
    areaId: 'civic-plaza', crewAllyId: 'mamajo',
    objective: killEnemy('triangle-saint-scribes', 'Down 8 Ring Scribes', 'ring-scribe', 8),
    completionText: 'Triangle Saint blesses the space between every angle.',
    evolutionId: 'triangle-triad',
  }),
  episode({
    id: 'mile-marker-northline', characterId: 'mile-marker', title: 'Northline',
    teaser: 'The rail yard keeps pointing somewhere that is not on the map.',
    cityLocation: 'Northline Rail Yard · the mile post',
    areaId: 'northline-yard', crewAllyId: 'deacon',
    objective: clearArea('mile-marker-yard-clear', 'Clear Northline Rail Yard', 'northline-yard'),
    completionText: 'Mile Marker makes a lane through the city’s dead end.',
    evolutionId: 'mile-crossing',
  }),
  episode({
    id: 'emberback-cellar-trail', characterId: 'emberback', title: 'Cellar Trail',
    teaser: 'The cellar’s heat is moving without a body to carry it.',
    cityLocation: 'Crystal Cellar · the warm stone',
    areaId: 'crystal-cellar', crewAllyId: 'sable',
    objective: killAny('emberback-cellar-kills', 'Take out 45 cellar threats', 45),
    completionText: 'Emberback leaves a trail the dark cannot smother.',
    evolutionId: 'emberback-drift',
  }),
  episode({
    id: 'horse-you-back-alley', characterId: 'horse-you', title: 'Back-Alley Punchline',
    teaser: 'The alley has been waiting for one honest impact.',
    cityLocation: 'Fulton Back Alley · the loose pavement',
    areaId: 'back-alley', crewAllyId: 'deacon',
    objective: killEnemy('horse-you-bouncer', 'Drop a Crypt Bouncer', 'crypt-bouncer', 1),
    completionText: 'The Horse You gives the alley its punchline in one clean hit.',
    evolutionId: 'horsepower',
  }),
  episode({
    id: 'glass-eel-floodwall', characterId: 'glass-eel', title: 'Glass Tide',
    teaser: 'The river remembers every place the eel blinked through.',
    cityLocation: 'Grand River Floodwall · the frozen wake',
    areaId: 'riverfront', crewAllyId: 'sable',
    objective: survive('glass-eel-flood-survive', 'Survive the floodwall for 60 seconds', 60),
    completionText: 'Glass Eel turns a retreat into a current of its own.',
    evolutionId: 'glass-tide',
  }),
  episode({
    id: 'acid-botanist-rooftop-garden', characterId: 'acid-botanist', title: 'Rooftop Garden',
    teaser: 'A garden has taken root where the roof used to be.',
    cityLocation: 'Rooftop Line · the greenhouse skeleton',
    areaId: 'rooftops', crewAllyId: 'nyx',
    objective: clearArea('acid-botanist-rooftop-clear', 'Clear Rooftop Line', 'rooftops'),
    completionText: 'Acid Botanist gets the garden growing in every direction.',
    evolutionId: 'acid-orchard',
  }),
  episode({
    id: 'allymaker-market-call', characterId: 'allymaker', title: 'Market Call',
    teaser: 'Old Market has one customer who keeps changing sides.',
    cityLocation: 'Old Market Hall · the closed food court',
    areaId: 'old-market', crewAllyId: 'vee',
    objective: rescue('allymaker-market-rescue', 'Free the market’s missing caller', 'vee'),
    completionText: 'Allymaker proves that one temporary friend can start a whole crew.',
    evolutionId: 'ally-chorus',
  }),
  episode({
    id: 'orbit-whale-endless-deep', characterId: 'orbit-whale', title: 'Endless Deep',
    teaser: 'Beyond the known blocks, something large is swimming through the sky.',
    cityLocation: 'Endless Streets · the far blue district',
    areaId: 'endless-streets', crewAllyId: 'deacon',
    objective: walk('orbit-whale-deep-walk', 'Walk 12 blocks into the endless city', 12),
    completionText: 'Orbit Whale breaches through the skyline and brings the sky with it.',
    evolutionId: 'deep-skyfall',
  }),
  episode({
    id: 'blink-choir-sanctum-exit', characterId: 'blink-choir', title: 'One Exit',
    teaser: 'The Sanctum has four voices and only one way out.',
    cityLocation: 'Siege on the Sanctum · the service exit',
    areaId: 'bar-siege', crewAllyId: 'mamajo',
    objective: survive('blink-choir-sanctum-survive', 'Survive the service exit for 70 seconds', 70),
    completionText: 'Blink Choir leaves one echo behind to hold the door.',
    evolutionId: 'choir-echo',
  }),
  episode({
    id: 'punchline-civic-reprise', characterId: 'punchline', title: 'Civic Reprise',
    teaser: 'The plaza joke is still waiting for the right delay.',
    cityLocation: 'Civic Plaza · the public-address steps',
    areaId: 'civic-plaza', crewAllyId: 'vee',
    objective: killAny('punchline-civic-kills', 'Take out 60 plaza threats', 60),
    completionText: 'Punchline gets the whole plaza laughing on the second beat.',
    evolutionId: 'punchline-reprise',
  }),
];

export const CHARACTER_EPISODES_BY_ID: Record<string, CharacterEpisodeDef> =
  Object.fromEntries(CHARACTER_EPISODES.map((entry) => [entry.id, entry]));
export const CHARACTER_EPISODE_BY_CHARACTER_ID: Record<string, CharacterEpisodeDef> =
  Object.fromEntries(CHARACTER_EPISODES.map((entry) => [entry.characterId, entry]));

export function getCharacterEpisode(characterId: string): CharacterEpisodeDef | undefined {
  return CHARACTER_EPISODE_BY_CHARACTER_ID[characterId];
}