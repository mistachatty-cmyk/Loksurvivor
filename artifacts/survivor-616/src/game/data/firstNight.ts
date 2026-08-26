import type { FirstNightChapter } from '@/game/types';

/**
 * The opening campaign is a light narrative rail over the existing arenas.
 * It never changes area unlock rules; it only explains what each destination
 * is teaching and why the next block matters.
 */
export const FIRST_NIGHT_CHAPTERS: FirstNightChapter[] = [
  {
    areaId: 'monroe-strip',
    chapter: 1,
    label: 'The lights stay on',
    goal: 'Keep the Monroe storefronts open long enough to find the painted crew mark.',
    worldVerb: 'MOVE',
    beatAtSec: 28,
    beatTitle: 'The mural is a map',
    beatText: 'A fresh mark points west. Someone inside the Sanctum is still waiting for a route home.',
    consequence: 'Vee follows the painted route back to the Sanctum, and the crew gains its first eyes on the street.',
    thread: 'The city is not empty. Someone is counting who makes it home.',
    nextAreaId: 'back-alley',
  },
  {
    areaId: 'back-alley',
    chapter: 2,
    label: 'Make a way through',
    goal: 'Open a path through Fulton before the alley closes around the crew.',
    worldVerb: 'IMPACT',
    beatAtSec: 38,
    beatTitle: 'The crates are arranged',
    beatText: 'The barricades are not random. Something has been herding survivors toward the hatch.',
    consequence: 'Deacon brings a warning bell and a key for the alley hatch. The Sanctum gets a second lookout.',
    thread: 'Every blocked route bends toward the same hidden room.',
    nextAreaId: 'rooftops',
  },
  {
    areaId: 'rooftops',
    chapter: 3,
    label: 'Cross the open sky',
    goal: 'Reach the far rooftop line without letting the open ground dictate your route.',
    worldVerb: 'DASH',
    beatAtSec: 46,
    beatTitle: 'The skyline answers',
    beatText: 'A pink signal flashes from the next roof. The city has a second map, written above the streets.',
    consequence: 'Nyx joins the crew with a safe route to the alley hatch and a view of the districts beyond.',
    thread: 'The safest road is sometimes the one no street sign can name.',
    nextAreaId: 'crystal-cellar',
  },
  {
    areaId: 'crystal-cellar',
    chapter: 4,
    label: 'Follow the lantern',
    goal: 'Trace the warm signal below Fulton and learn what the city is growing underground.',
    worldVerb: 'EXPLORE',
    beatAtSec: 42,
    beatTitle: 'The glass remembers',
    beatText: 'The cellar hums with a record of every route that vanished after midnight.',
    consequence: 'Sable tunes the Sanctum radio to the cellar frequency. The crew can hear the Sire’s network waking up.',
    thread: 'The strange light beneath the city is carrying a message, not just a warning.',
    nextAreaId: 'bar-siege',
  },
  {
    areaId: 'bar-siege',
    chapter: 5,
    label: 'Hold the Sanctum',
    goal: 'Keep the Sanctum standing through the siege and force the Sire to show his hand.',
    worldVerb: 'HOLD',
    beatAtSec: 52,
    beatTitle: 'The Sire is listening',
    beatText: 'A voice cuts through the static: “Every safe room becomes a ledger.” The attack turns toward home.',
    consequence: 'Mama Jo makes the Sanctum a real refuge. The Sire’s influence is no longer a rumor; it has a voice.',
    thread: 'The crew has a home now, and the thing hunting the city knows exactly where it is.',
    nextAreaId: 'riverfront',
    sireSignal: 'First confirmed Sire broadcast',
  },
  {
    areaId: 'riverfront',
    chapter: 6,
    label: 'Find the crossing',
    goal: 'Follow the floodwall marks to a bridge the Sire’s runners cannot control.',
    worldVerb: 'CROSS',
    beatAtSec: 48,
    beatTitle: 'The river splits the count',
    beatText: 'A mark under the floodwall points east. The next safe district is across the water.',
    consequence: 'The crew marks a dependable bridge route and adds the west bank to the case board.',
    thread: 'The river is a boundary, but not a dead end.',
    nextAreaId: 'old-market',
  },
  {
    areaId: 'old-market',
    chapter: 7,
    label: 'Read the aisles',
    goal: 'Search the old market for the bell that once called every survivor home.',
    worldVerb: 'READ',
    beatAtSec: 54,
    beatTitle: 'The bell rings once',
    beatText: 'One aisle light comes on by itself. Vee recognizes the mark: the Sire used this place as a counting house.',
    consequence: 'The Market Bell becomes a recorded lead, pointing the crew toward the rail deliveries.',
    thread: 'The Sire’s routes are older than tonight’s attack.',
    nextAreaId: 'northline-yard',
    sireSignal: 'Market counting house identified',
  },
  {
    areaId: 'northline-yard',
    chapter: 8,
    label: 'Follow the freight',
    goal: 'Trace the signal pattern through the rail yard and find where the city’s supplies disappear.',
    worldVerb: 'FOLLOW',
    beatAtSec: 58,
    beatTitle: 'The switch is still warm',
    beatText: 'A freight signal blinks toward the courthouse. Whatever is moving through 616 is headed for Civic Plaza.',
    consequence: 'The crew has a destination and a reason to risk the plaza: the first ledger was signed there.',
    thread: 'All roads in the case board now point south.',
    nextAreaId: 'civic-plaza',
  },
  {
    areaId: 'civic-plaza',
    chapter: 9,
    label: 'Name the influence',
    goal: 'Reach the dry fountain and confront the oldest visible mark of the Sire’s rule.',
    worldVerb: 'CONFRONT',
    beatAtSec: 62,
    beatTitle: 'The fountain remembers',
    beatText: 'The dry basin fills with red water. The ledger’s first signature is still being renewed.',
    consequence: 'The opening case is pinned: the Sire is shaping the city through routes, records, and fear.',
    thread: 'The First Night ends with a name, not an answer.',
    sireSignal: 'First ledger site confirmed',
  },
];

export const FIRST_NIGHT_BY_AREA_ID: Record<string, FirstNightChapter> =
  Object.fromEntries(FIRST_NIGHT_CHAPTERS.map((chapter) => [chapter.areaId, chapter]));

export function getFirstNightChapter(areaId: string): FirstNightChapter | undefined {
  return FIRST_NIGHT_BY_AREA_ID[areaId];
}

/**
 * Pick the next authored destination without locking the player out of any
 * already unlocked replay. The first uncompleted available chapter wins.
 */
export function recommendedFirstNightChapter(
  clearedAreaIds: string[],
  unlockedAreaIds: string[],
): FirstNightChapter | undefined {
  const unlocked = new Set(unlockedAreaIds);
  return FIRST_NIGHT_CHAPTERS.find(
    (chapter) => unlocked.has(chapter.areaId) && !clearedAreaIds.includes(chapter.areaId),
  );
}