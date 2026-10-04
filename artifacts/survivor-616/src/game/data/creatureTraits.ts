/**
 * The creature trait model: the data behind `docs/lokpet-creature-design.md`.
 *
 * This is design data plus a deterministic generator. It is not wired into the
 * battle or chest systems yet, and it never changes a LokPet's combat numbers
 * (those stay bounded by `data/lokPets.ts`). It exists so that:
 *
 * - every creature can be described on many named axes (not just cute and dread),
 *   by themes drawn from the game's factions and districts,
 * - the roster can be effectively infinite: a creature is a *seed*, and the same
 *   seed always rolls the same creature, so nothing needs storing but the seed,
 * - rarity has two independent dimensions: how *findable* a creature is, and
 *   what *tier* it stands in (the way a legendary or mythical creature differs
 *   from an ordinary one), and
 * - authors have one place to add axes, quirks, themes, body plans and tiers.
 *
 * To widen it: add a row to the matching list below. The tests check that every
 * list only references things that exist.
 */

/* ------------------------------------------------------------------ */
/* Deterministic helpers                                               */
/* ------------------------------------------------------------------ */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length) % list.length]!;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function weighted<T extends { weight: number }>(rand: () => number, list: readonly T[]): T {
  const total = list.reduce((sum, item) => sum + item.weight, 0);
  let roll = rand() * total;
  for (const item of list) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return list[list.length - 1]!;
}

/* ------------------------------------------------------------------ */
/* Axes                                                                */
/* ------------------------------------------------------------------ */

export type AxisGroup = 'feel' | 'nature' | 'body' | 'origin' | 'presence' | 'combat';

export interface TraitAxis {
  id: string;
  label: string;
  group: AxisGroup;
  /** What a 0 reads as. */
  low: string;
  /** What a 5 reads as. */
  high: string;
}

const axis = (id: string, label: string, group: AxisGroup, low: string, high: string): TraitAxis => ({ id, label, group, low, high });

/** Every creature has a 0 to 5 value on every axis. */
export const AXES: TraitAxis[] = [
  // How a player reacts to it.
  axis('cute', 'Cute', 'feel', 'Not adoptable', 'Fits in a hood and in your heart'),
  axis('dread', 'Dread', 'feel', 'Perfectly calm', 'Wrong in a way you feel in your teeth'),
  axis('awe', 'Awe', 'feel', 'Ordinary', 'Stops a crowd'),
  axis('goofy', 'Goofy', 'feel', 'Dignified', 'Cannot be taken seriously'),
  axis('cozy', 'Cozy', 'feel', 'Cold', 'A warm blanket with legs'),
  axis('forlorn', 'Forlorn', 'feel', 'Cheerful', 'Looks like it is waiting for someone'),
  axis('uncanny', 'Uncanny', 'feel', 'Natural', 'Almost right, and that is the problem'),
  axis('charming', 'Charming', 'feel', 'Off-putting', 'Wins any room'),
  axis('grimy', 'Grimy', 'feel', 'Spotless', 'Lives in the gutter and loves it'),
  axis('elegant', 'Elegant', 'feel', 'Clumsy', 'Moves like a held breath'),
  // How it behaves.
  axis('wild', 'Wild', 'nature', 'Tame', 'Feral'),
  axis('loyal', 'Loyal', 'nature', 'Aloof', 'Would follow you into the river'),
  axis('curious', 'Curious', 'nature', 'Incurious', 'Opens every door'),
  axis('mischievous', 'Mischievous', 'nature', 'Earnest', 'Hides your keys on purpose'),
  axis('brave', 'Brave', 'nature', 'Skittish', 'Charges first, asks later'),
  axis('patient', 'Patient', 'nature', 'Restless', 'Waits out the weather'),
  axis('hotHeaded', 'Hot-headed', 'nature', 'Unbothered', 'One bad look from a brawl'),
  axis('hungry', 'Hungry', 'nature', 'Never eats', 'Always eating'),
  axis('sleepy', 'Sleepy', 'nature', 'Wired', 'Naps mid-fight'),
  axis('loud', 'Loud', 'nature', 'Silent', 'Announces itself blocks away'),
  axis('shy', 'Shy', 'nature', 'Bold', 'Hides behind your leg'),
  axis('vain', 'Vain', 'nature', 'Humble', 'Checks every reflection'),
  // How it looks and feels to touch.
  axis('fluffy', 'Fluffy', 'body', 'Hard-edged', 'Mostly fluff'),
  axis('armored', 'Armored', 'body', 'Soft-bodied', 'Plated head to tail'),
  axis('slimy', 'Slimy', 'body', 'Dry', 'Leaves a trail'),
  axis('glowy', 'Glowy', 'body', 'Matte', 'A night light'),
  axis('ghostly', 'Ghostly', 'body', 'Solid', 'You can see the wall through it'),
  axis('lopsided', 'Lopsided', 'body', 'Symmetrical', 'Nothing matches'),
  axis('ornate', 'Ornate', 'body', 'Plain', 'Covered in detail'),
  axis('ancient', 'Ancient', 'body', 'Newborn', 'Older than the street'),
  axis('oversized', 'Oversized', 'body', 'Pocket-sized', 'Reads as huge even when small'),
  // Where it comes from.
  axis('constructed', 'Constructed', 'origin', 'Organic', 'Assembled, bolted, wired'),
  axis('cosmic', 'Cosmic', 'origin', 'Earthly', 'From somewhere with other stars'),
  axis('digital', 'Digital', 'origin', 'Analog', 'Made of addresses'),
  axis('folkloric', 'Folkloric', 'origin', 'Invented', 'Grandparents tell stories about it'),
  axis('urban', 'Urban', 'origin', 'Backcountry', 'Knows every alley and bus route'),
  axis('elemental', 'Elemental', 'origin', 'Mundane', 'Mostly fire, water, storm or frost'),
  axis('aquatic', 'Aquatic', 'origin', 'Landbound', 'Belongs in the river'),
  axis('subterranean', 'Subterranean', 'origin', 'Skyward', 'Prefers the dark and the deep'),
  // What it does to the world around it.
  axis('omen', 'Omen', 'presence', 'No portents', 'Something happens when it shows up'),
  axis('lucky', 'Lucky', 'presence', 'Unlucky', 'Finds things'),
  axis('hoarder', 'Hoarder', 'presence', 'Gives it all away', 'Keeps a stash'),
  axis('mimic', 'Mimic', 'presence', 'Itself only', 'Copies what it sees and hears'),
  axis('haunting', 'Haunting', 'presence', 'Stays put', 'Follows you at a distance'),
  axis('performer', 'Performer', 'presence', 'Never performs', 'Needs an audience'),
  // How it fights (flavor only; numbers stay bounded elsewhere).
  axis('ferocity', 'Ferocity', 'combat', 'Gentle', 'Savage'),
  axis('guard', 'Guard', 'combat', 'Exposed', 'Takes the hit for you'),
  axis('nimble', 'Nimble', 'combat', 'Plodding', 'Never where you aimed'),
  axis('supportive', 'Supportive', 'combat', 'Selfish', 'Patches the team up'),
  axis('trickery', 'Trickery', 'combat', 'Straightforward', 'Wins by cheating'),
  axis('reach', 'Reach', 'combat', 'Up close', 'Strikes from across the block'),
];

export const AXIS_BY_ID: Record<string, TraitAxis> = Object.fromEntries(AXES.map((a) => [a.id, a]));
export const AXIS_GROUPS: AxisGroup[] = ['feel', 'nature', 'body', 'origin', 'presence', 'combat'];

export type TraitVector = Record<string, number>;

/* ------------------------------------------------------------------ */
/* Quirks                                                              */
/* ------------------------------------------------------------------ */

export interface Quirk {
  id: string;
  label: string;
  /** Added to these axes when the creature has the quirk (clamped to 0-5). */
  shift: Record<string, number>;
}

const quirk = (id: string, label: string, shift: Record<string, number>): Quirk => ({ id, label, shift });

/** Small, specific details that make two creatures with similar numbers feel different. */
export const QUIRKS: Quirk[] = [
  quirk('too-many-eyes', 'Too many eyes', { dread: 2, uncanny: 2, cute: -1 }),
  quirk('too-many-teeth', 'Too many teeth, always smiling', { dread: 2, uncanny: 1, charming: 1 }),
  quirk('extra-mouth', 'A second mouth, somewhere unexpected', { dread: 2, uncanny: 2, goofy: 1 }),
  quirk('huge-eyes', 'Enormous shining eyes', { cute: 2, forlorn: 1 }),
  quirk('tiny-hat', 'Wears a tiny hat', { cute: 1, goofy: 2, vain: 1 }),
  quirk('carries-lantern', 'Carries a small lantern', { glowy: 2, cozy: 1, omen: 1 }),
  quirk('carries-object', 'Never lets go of one odd object', { hoarder: 2, goofy: 1, forlorn: 1 }),
  quirk('hums-to-itself', 'Hums while it fights', { cozy: 1, loud: 1, performer: 1 }),
  quirk('sings-at-night', 'Sings at night, in a human voice', { dread: 2, uncanny: 2, performer: 2 }),
  quirk('talks-in-whispers', 'Whispers advice nobody asked for', { uncanny: 2, mischievous: 1, dread: 1 }),
  quirk('copies-your-voice', 'Copies your voice a beat late', { mimic: 3, uncanny: 2, dread: 1 }),
  quirk('wrong-reflection', 'Its reflection does something else', { uncanny: 3, dread: 2, omen: 1 }),
  quirk('no-shadow', 'Casts no shadow', { ghostly: 2, uncanny: 2, dread: 1 }),
  quirk('two-shadows', 'Casts two shadows', { uncanny: 2, omen: 1, dread: 1 }),
  quirk('follows-at-distance', 'Always one block behind you', { haunting: 3, shy: 1, dread: 1 }),
  quirk('naps-anywhere', 'Naps anywhere, mid-sentence', { sleepy: 3, cozy: 2, cute: 1 }),
  quirk('hoards-bottlecaps', 'Hoards bottle caps', { hoarder: 3, lucky: 1, goofy: 1 }),
  quirk('hoards-teeth', 'Hoards teeth. Not its own.', { hoarder: 3, dread: 2, grimy: 1 }),
  quirk('leaves-puddles', 'Leaves a puddle wherever it stands', { slimy: 2, aquatic: 1, grimy: 1 }),
  quirk('leaves-embers', 'Leaves small embers behind', { elemental: 2, glowy: 1, omen: 1 }),
  quirk('leaves-flowers', 'Flowers sprout where it sleeps', { cute: 1, cozy: 1, omen: 1, elegant: 1 }),
  quirk('buzzes', 'Hums like a failing streetlight', { constructed: 1, loud: 1, uncanny: 1, glowy: 1 }),
  quirk('static-fur', 'Fur that crackles with static', { fluffy: 2, elemental: 1, cute: 1 }),
  quirk('glass-bones', 'You can see its bones through the glass', { ghostly: 1, ornate: 1, uncanny: 1, dread: 1 }),
  quirk('patchwork', 'Stitched from mismatched parts', { lopsided: 3, constructed: 1, forlorn: 1, uncanny: 1 }),
  quirk('moss-coat', 'A coat of living moss', { cozy: 1, ancient: 1, slimy: 1, wild: 1 }),
  quirk('antler-crown', 'A crown of antlers', { awe: 2, elegant: 1, ancient: 1 }),
  quirk('missing-face', 'Has no face, only an expression', { dread: 3, uncanny: 3, cute: -1 }),
  quirk('cracked-shell', 'Shell cracked and mended with gold', { armored: 1, ornate: 2, forlorn: 1, elegant: 1 }),
  quirk('pocket-void', 'Keeps a small piece of the void in its pouch', { cosmic: 2, dread: 1, hoarder: 1, omen: 1 }),
  quirk('plays-dead', 'Plays dead, badly', { goofy: 3, shy: 1, trickery: 1 }),
  quirk('steals-socks', 'Steals one sock from every pair', { mischievous: 3, goofy: 1, hoarder: 1 }),
  quirk('knocks-things-over', 'Knocks things off tables, slowly, while watching you', { mischievous: 3, curious: 1, goofy: 1 }),
  quirk('sheds-pixels', 'Sheds tiny pixels when it moves', { digital: 2, glowy: 1, ghostly: 1 }),
  quirk('flickers', 'Flickers in and out of the frame', { digital: 1, ghostly: 2, uncanny: 1, nimble: 1 }),
  quirk('rings-like-a-bell', 'Rings like a bell when startled', { loud: 2, omen: 1, performer: 1 }),
  quirk('weather-sense', 'Sulks before it rains', { omen: 2, forlorn: 1, cozy: 1 }),
  quirk('borrowed-name', 'Insists on a name that is not its own', { vain: 1, mimic: 1, goofy: 1, uncanny: 1 }),
  quirk('stands-on-hind-legs', 'Stands on its hind legs when nobody is looking', { uncanny: 2, dread: 1, folkloric: 1 }),
  quirk('plate-spinner', 'Spins things on its nose between fights', { performer: 2, goofy: 2, nimble: 1 }),
  quirk('tiny-and-furious', 'Very small, very angry', { hotHeaded: 3, cute: 1, goofy: 1, oversized: -2 }),
  quirk('gentle-giant', 'Enormous and apologetic', { oversized: 3, shy: 2, cozy: 1, ferocity: -1 }),
  quirk('rust-and-moss', 'Rusted joints, mossy seams', { constructed: 2, ancient: 2, forlorn: 1, grimy: 1 }),
  quirk('nightlight-belly', 'Belly glows like a night light', { glowy: 3, cozy: 2, cute: 1 }),
  quirk('map-on-its-back', 'A map of the city on its back', { urban: 2, curious: 1, ornate: 1, lucky: 1 }),
  quirk('grins-when-hurt', 'Grins when it is hurt', { dread: 2, brave: 1, uncanny: 1, ferocity: 1 }),
];

export const QUIRK_BY_ID: Record<string, Quirk> = Object.fromEntries(QUIRKS.map((q) => [q.id, q]));

/* ------------------------------------------------------------------ */
/* Body plans                                                          */
/* ------------------------------------------------------------------ */

export type PlanKind = 'everyday' | 'fantasy' | 'scifi' | 'folk';

export interface BodyPlan {
  id: string;
  /** Noun used in generated names. */
  noun: string;
  kind: PlanKind;
}

const plan = (id: string, noun: string, kind: PlanKind): BodyPlan => ({ id, noun, kind });

/**
 * The silhouettes a creature can be built on. These are plan ids for the future
 * body-plan recipes (roadmap phase 1); only some exist as art today.
 */
export const BODY_PLANS: BodyPlan[] = [
  plan('dog', 'Hound', 'everyday'), plan('cat', 'Cat', 'everyday'), plan('rabbit', 'Hare', 'everyday'),
  plan('fox', 'Fox', 'everyday'), plan('raccoon', 'Bandit', 'everyday'), plan('otter', 'Otter', 'everyday'),
  plan('bat', 'Bat', 'everyday'), plan('owl', 'Owl', 'everyday'), plan('crow', 'Crow', 'everyday'),
  plan('pigeon', 'Pigeon', 'everyday'), plan('heron', 'Heron', 'everyday'), plan('duck', 'Duck', 'everyday'),
  plan('frog', 'Toad', 'everyday'), plan('turtle', 'Shellback', 'everyday'), plan('lizard', 'Skink', 'everyday'),
  plan('snake', 'Serpent', 'everyday'), plan('fish', 'Carp', 'everyday'), plan('eel', 'Eel', 'everyday'),
  plan('moth', 'Moth', 'everyday'), plan('beetle', 'Beetle', 'everyday'), plan('spider', 'Weaver', 'everyday'),
  plan('deer', 'Stag', 'everyday'), plan('possum', 'Possum', 'everyday'), plan('squirrel', 'Squirrel', 'everyday'),
  plan('hedgehog', 'Hedgehog', 'everyday'), plan('snail', 'Snail', 'everyday'), plan('crab', 'Crab', 'everyday'),
  plan('dragon', 'Drake', 'fantasy'), plan('griffin', 'Griffin', 'fantasy'), plan('unicorn', 'Unicorn', 'fantasy'),
  plan('phoenix', 'Phoenix', 'fantasy'), plan('kraken', 'Krakenling', 'fantasy'), plan('golem', 'Golem', 'fantasy'),
  plan('basilisk', 'Basilisk', 'fantasy'), plan('wisp', 'Wisp', 'fantasy'), plan('sprite', 'Sprite', 'fantasy'),
  plan('dogman', 'Dogman', 'folk'), plan('lake-serpent', 'Lake Serpent', 'folk'), plan('river-spirit', 'River Spirit', 'folk'),
  plan('scarecrow', 'Scarecrow', 'folk'), plan('jackalope', 'Jackalope', 'folk'), plan('will-o-wisp', 'Lantern Ghost', 'folk'),
  plan('drone', 'Drone', 'scifi'), plan('nanite-flock', 'Murmuration', 'scifi'), plan('gravity-jelly', 'Gravity Jelly', 'scifi'),
  plan('tardigrade', 'Tardigrade', 'scifi'), plan('mimic-box', 'Mimic', 'scifi'), plan('probe', 'Probe', 'scifi'),
];

export const BODY_PLAN_BY_ID: Record<string, BodyPlan> = Object.fromEntries(BODY_PLANS.map((p) => [p.id, p]));

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

export interface CreatureTheme {
  id: string;
  label: string;
  /** A `FactionDef.id` from data/factions.ts, when the theme is a faction. */
  faction?: string;
  /** Short, in-world description. */
  blurb: string;
  /** Axis ranges (inclusive, 0-5) a creature of this theme tends to land in. */
  bias: Record<string, [number, number]>;
  /** Quirks this theme favors. */
  quirks: string[];
  /** Plan ids it favors (any plan is still possible). */
  plans: string[];
  /** Words used as the first half of generated names. */
  words: string[];
}

export const THEMES: CreatureTheme[] = [
  {
    id: 'river-court', label: 'River Antler Court', faction: 'river-antler-court', blurb: 'Floodwall wildlife, running sideways through the street grid.',
    bias: { wild: [3, 5], aquatic: [3, 5], awe: [2, 4], elegant: [2, 4], folkloric: [2, 4], cozy: [1, 3] },
    quirks: ['antler-crown', 'moss-coat', 'leaves-puddles', 'weather-sense'], plans: ['deer', 'otter', 'heron', 'lake-serpent', 'river-spirit'],
    words: ['Floodwall', 'Antlered', 'Rapids', 'Sideways', 'Reed', 'Silt', 'Bank'],
  },
  {
    id: 'neon-arcade', label: 'Neon Arcade', faction: 'cabinet-rot', blurb: 'Cabinets glitching back to life with nothing plugged in.',
    bias: { digital: [3, 5], glowy: [3, 5], goofy: [2, 4], performer: [2, 4], loud: [2, 4], constructed: [2, 4] },
    quirks: ['flickers', 'sheds-pixels', 'buzzes', 'plate-spinner'], plans: ['drone', 'cat', 'frog', 'mimic-box', 'bat'],
    words: ['Attract-Mode', 'Neon', 'High-Score', 'Coin-Op', 'Joystick', 'Quarter', 'Pixel'],
  },
  {
    id: 'null-basement', label: 'Null Sector', faction: 'null-sector', blurb: 'A data-center basement where nothing is plugged in and everything runs.',
    bias: { digital: [3, 5], subterranean: [3, 5], uncanny: [2, 5], dread: [2, 5], constructed: [2, 4], haunting: [2, 4] },
    quirks: ['missing-face', 'flickers', 'copies-your-voice', 'sheds-pixels', 'glass-bones'], plans: ['probe', 'nanite-flock', 'spider', 'mimic-box', 'eel'],
    words: ['Null', 'Rack', 'Coldaisle', 'Idle', 'Zero', 'Voidloop', 'Basement'],
  },
  {
    id: 'arbor-canopy', label: 'Arbor Collective', faction: 'arbor-collective', blurb: 'Bio-digital canopy growth with a firewall.',
    bias: { fluffy: [2, 5], wild: [2, 4], cozy: [2, 4], digital: [1, 3], ancient: [2, 4], slimy: [1, 3] },
    quirks: ['moss-coat', 'leaves-flowers', 'sheds-pixels', 'antler-crown'], plans: ['moth', 'snail', 'hedgehog', 'sprite', 'wisp'],
    words: ['Canopy', 'Bramble', 'Holo-Leaf', 'Rootwork', 'Mossy', 'Briar', 'Understory'],
  },
  {
    id: 'lev-skyway', label: 'Lev Syndicate', faction: 'lev-syndicate', blurb: 'Skyway cartel machines and the things that nest in them.',
    bias: { constructed: [3, 5], cosmic: [1, 3], armored: [2, 4], reach: [2, 4], elegant: [1, 3], awe: [1, 3] },
    quirks: ['rust-and-moss', 'pocket-void', 'buzzes', 'cracked-shell'], plans: ['drone', 'gravity-jelly', 'crow', 'probe', 'golem'],
    words: ['Skyway', 'Gravity', 'Concourse', 'High-Tension', 'Updraft', 'Phase', 'Overpass'],
  },
  {
    id: 'firefly-hollow', label: 'Firefly Hollows', faction: 'firefly-wranglers', blurb: 'Underground prospectors, incandescent fireflies and the dark between.',
    bias: { glowy: [3, 5], subterranean: [3, 5], cozy: [1, 4], hoarder: [2, 4], curious: [2, 4], shy: [1, 3] },
    quirks: ['carries-lantern', 'nightlight-belly', 'hoards-bottlecaps', 'rings-like-a-bell'], plans: ['moth', 'beetle', 'bat', 'wisp', 'tardigrade'],
    words: ['Gloam', 'Ember-Jar', 'Hollow', 'Lantern', 'Pickaxe', 'Shaft', 'Glimmer'],
  },
  {
    id: 'bubble-haven', label: 'Haven of the Bubs', faction: 'bubblenaught-tide', blurb: 'Surfactant globes, fluid shields and an unreasonable amount of foam.',
    bias: { slimy: [2, 5], cute: [2, 5], aquatic: [2, 5], guard: [2, 4], goofy: [2, 4], cozy: [2, 4] },
    quirks: ['leaves-puddles', 'tiny-hat', 'hums-to-itself', 'plays-dead'], plans: ['frog', 'duck', 'otter', 'gravity-jelly', 'snail'],
    words: ['Foam', 'Sudsy', 'Pressurized', 'Bubbly', 'Surfactant', 'Rinse', 'Haven'],
  },
  {
    id: 'afterimage', label: 'Afterimage Choir', faction: 'afterimage-choir', blurb: 'Shadow-born things seen from the corner of the eye.',
    bias: { ghostly: [3, 5], uncanny: [3, 5], nimble: [3, 5], dread: [2, 5], shy: [2, 4], haunting: [2, 5] },
    quirks: ['no-shadow', 'two-shadows', 'follows-at-distance', 'sings-at-night', 'wrong-reflection'], plans: ['cat', 'crow', 'bat', 'wisp', 'dogman'],
    words: ['Afterimage', 'Penumbra', 'Hush', 'Sidelong', 'Dimmer', 'Echo', 'Halfway'],
  },
  {
    id: 'cinder-east', label: 'Cinder Procession', faction: 'cinder-procession', blurb: 'Armored chargers and the fire on the east side that never went out.',
    bias: { elemental: [3, 5], armored: [3, 5], ferocity: [3, 5], hotHeaded: [2, 5], brave: [3, 5], awe: [1, 3] },
    quirks: ['leaves-embers', 'tiny-and-furious', 'cracked-shell', 'grins-when-hurt'], plans: ['dog', 'dragon', 'phoenix', 'beetle', 'golem'],
    words: ['Cinder', 'Ash-Marked', 'Smolder', 'Eastside', 'Brand', 'Kiln', 'Procession'],
  },
  {
    id: 'reel-set', label: 'The Reel Syndicate', faction: 'reel-syndicate', blurb: 'The Director\'s crew and the creatures they keep on set.',
    bias: { performer: [3, 5], vain: [2, 5], mimic: [2, 4], charming: [2, 4], trickery: [2, 4], loud: [1, 3] },
    quirks: ['plate-spinner', 'copies-your-voice', 'borrowed-name', 'tiny-hat'], plans: ['raccoon', 'pigeon', 'cat', 'mimic-box', 'crow'],
    words: ['Matinee', 'Continuity', 'Take-Two', 'Spotlit', 'Backlot', 'Cut-Room', 'Reel'],
  },
  {
    id: 'high-roller', label: 'High Roller Syndicate', faction: 'high-roller-syndicate', blurb: 'The Neon Overflow stock room, dressed for the occasion.',
    bias: { vain: [3, 5], charming: [2, 5], ornate: [3, 5], lucky: [2, 5], elegant: [2, 4], glowy: [1, 3] },
    quirks: ['tiny-hat', 'hoards-bottlecaps', 'cracked-shell', 'borrowed-name'], plans: ['cat', 'crow', 'fox', 'phoenix', 'snake'],
    words: ['Marquee', 'Jackpot', 'Gilded', 'Bulb-Lit', 'High-Stakes', 'Velvet', 'Overflow'],
  },
  {
    id: 'data-gob', label: 'Data Goblins', faction: 'data-goblins', blurb: 'Small, green and chewing on anything already broken.',
    bias: { hungry: [3, 5], mischievous: [3, 5], grimy: [2, 5], goofy: [2, 4], digital: [2, 4], shy: [1, 3] },
    quirks: ['steals-socks', 'hoards-bottlecaps', 'knocks-things-over', 'plays-dead'], plans: ['raccoon', 'possum', 'beetle', 'frog', 'mimic-box'],
    words: ['Gobbling', 'Crumb', 'Chewed', 'Glitchy', 'Scrap', 'Nibble', 'Breakage'],
  },
  {
    id: 'iron-gym', label: 'Supabuilda', faction: 'supabuilda', blurb: 'A gym faction. Everything is a rep if you commit.',
    bias: { ferocity: [3, 5], armored: [2, 4], loyal: [2, 4], brave: [3, 5], oversized: [2, 5], loud: [2, 4] },
    quirks: ['gentle-giant', 'tiny-and-furious', 'grins-when-hurt', 'hums-to-itself'], plans: ['dog', 'turtle', 'crab', 'golem', 'beetle'],
    words: ['Iron', 'Spotter', 'Plate-Loaded', 'Grip', 'Deadlift', 'Chalked', 'Rep-Ready'],
  },
  {
    id: 'site-works', label: 'The Site Crew', faction: 'the-site-crew', blurb: 'Active work zones with wildlife that learned to wear a hard hat.',
    bias: { armored: [2, 4], patient: [2, 4], grimy: [2, 4], urban: [3, 5], guard: [2, 4], hoarder: [2, 4] },
    quirks: ['carries-object', 'rust-and-moss', 'tiny-hat', 'hoards-bottlecaps'], plans: ['pigeon', 'raccoon', 'beetle', 'crab', 'golem'],
    words: ['Barricade', 'Hard-Hat', 'Crane-Hook', 'Rebar', 'Detour', 'Cement', 'Worksite'],
  },
  {
    id: 'watch-light', label: 'The Watch', faction: 'the-watch', blurb: 'Sentries that sweep for movement.',
    bias: { patient: [3, 5], glowy: [2, 4], guard: [3, 5], loyal: [2, 4], dread: [1, 3], reach: [2, 4] },
    quirks: ['carries-lantern', 'huge-eyes', 'too-many-eyes', 'follows-at-distance'], plans: ['owl', 'dog', 'heron', 'probe', 'drone'],
    words: ['Sentry', 'Floodlit', 'Beam', 'Night-Shift', 'Lookout', 'Sweeping', 'Lamplit'],
  },
  {
    id: 'prism-beacon', label: 'Prism Choir', faction: 'prism-choir', blurb: 'Color-coded beacons that pull, slow or burn.',
    bias: { glowy: [3, 5], ornate: [2, 4], elemental: [2, 4], awe: [2, 4], elegant: [2, 4], performer: [2, 4] },
    quirks: ['nightlight-belly', 'glass-bones', 'hums-to-itself', 'rings-like-a-bell'], plans: ['moth', 'wisp', 'sprite', 'fish', 'phoenix'],
    words: ['Prismatic', 'Beacon', 'Refracted', 'Spectrum', 'Dichroic', 'Halo-Lit', 'Choral'],
  },
  {
    id: 'glitch-breach', label: 'Glitch Breach', faction: 'glitch-breach', blurb: 'Rendering bugs that broke free of the engine.',
    bias: { digital: [4, 5], uncanny: [2, 5], lopsided: [2, 5], nimble: [2, 4], mimic: [1, 4], ghostly: [1, 4] },
    quirks: ['flickers', 'sheds-pixels', 'patchwork', 'missing-face', 'two-shadows'], plans: ['mimic-box', 'nanite-flock', 'cat', 'tardigrade', 'probe'],
    words: ['Glitched', 'Clipping', 'Z-Fighting', 'Torn', 'Misaligned', 'Corrupt', 'Breach'],
  },
  {
    id: 'digitized-souls', label: 'Digitized Damned', faction: 'digitized-damned', blurb: 'Harvested survivors, fragmented into data and still faintly themselves.',
    bias: { forlorn: [3, 5], ghostly: [2, 5], digital: [3, 5], haunting: [2, 5], loyal: [2, 4], cozy: [1, 3] },
    quirks: ['follows-at-distance', 'wrong-reflection', 'sheds-pixels', 'borrowed-name'], plans: ['dog', 'cat', 'wisp', 'sprite', 'drone'],
    words: ['Harvested', 'Remembered', 'Fragment', 'Packet', 'Lingering', 'Misplaced', 'Archived'],
  },
  {
    id: 'lockstep-stare', label: 'Lockstep', faction: 'lockstep', blurb: 'Cones that lock on and narrow to a line.',
    bias: { patient: [3, 5], brave: [2, 4], ferocity: [2, 4], dread: [2, 4], reach: [3, 5], uncanny: [1, 3] },
    quirks: ['too-many-eyes', 'grins-when-hurt', 'missing-face'], plans: ['snake', 'basilisk', 'owl', 'probe', 'spider'],
    words: ['Locked', 'Narrowed', 'Fixed', 'Deadlocked', 'Unblinking', 'Clamp', 'Stare'],
  },
  {
    id: 'lake-folk', label: 'Great Lakes folklore', blurb: 'Stories the grandparents tell about the water and the woods.',
    bias: { folkloric: [4, 5], omen: [2, 5], ancient: [2, 5], aquatic: [1, 4], awe: [2, 4], dread: [1, 4] },
    quirks: ['stands-on-hind-legs', 'weather-sense', 'two-shadows', 'antler-crown'], plans: ['dogman', 'lake-serpent', 'river-spirit', 'jackalope', 'will-o-wisp'],
    words: ['Old', 'Lakeshore', 'Pinewood', 'Foghorn', 'Moonlit', 'Grandmother\'s', 'Tide-Marked'],
  },
  {
    id: 'cosmic-visitor', label: 'Visitors', blurb: 'Not from around here. Not from around anywhere.',
    bias: { cosmic: [4, 5], uncanny: [2, 5], awe: [2, 5], curious: [3, 5], omen: [2, 5], glowy: [1, 4] },
    quirks: ['pocket-void', 'too-many-eyes', 'extra-mouth', 'no-shadow'], plans: ['gravity-jelly', 'tardigrade', 'probe', 'nanite-flock', 'sprite'],
    words: ['Far-Off', 'Orbiting', 'Starborn', 'Drifting', 'Outbound', 'Parallax', 'Apogee'],
  },
  {
    id: 'back-alley', label: 'Back Alley', blurb: 'The ordinary city strays: loud, scruffy, and fully at home.',
    bias: { urban: [3, 5], grimy: [2, 5], wild: [1, 3], mischievous: [2, 4], hungry: [2, 4], charming: [1, 4] },
    quirks: ['steals-socks', 'knocks-things-over', 'map-on-its-back', 'naps-anywhere'], plans: ['cat', 'raccoon', 'pigeon', 'possum', 'dog'],
    words: ['Gutter', 'Alley', 'Dumpster', 'Stoop', 'Fire-Escape', 'Corner-Store', 'Curbside'],
  },
];

export const THEME_BY_ID: Record<string, CreatureTheme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

/* ------------------------------------------------------------------ */
/* Rarity: findability and tier are separate                           */
/* ------------------------------------------------------------------ */

/**
 * How often you run into it. A pure encounter-rate dimension. A tier-mythic
 * creature can be easy to find (it is simply remarkable), and a plain wild one
 * can be very hard to find (an unusually shy pigeon).
 */
export interface Findability {
  id: string;
  label: string;
  /** Relative chance in an encounter roll. */
  weight: number;
  /** How much a hint or clue a player sees before meeting one (0 = none, 3 = a full tip). */
  hintLevel: 0 | 1 | 2 | 3;
}

export const FINDABILITY: Findability[] = [
  { id: 'ubiquitous', label: 'Ubiquitous', weight: 3000, hintLevel: 3 },
  { id: 'common', label: 'Common', weight: 1800, hintLevel: 3 },
  { id: 'uncommon', label: 'Uncommon', weight: 800, hintLevel: 2 },
  { id: 'scarce', label: 'Scarce', weight: 320, hintLevel: 2 },
  { id: 'rare', label: 'Rare', weight: 120, hintLevel: 1 },
  { id: 'elusive', label: 'Elusive', weight: 40, hintLevel: 1 },
  { id: 'hidden', label: 'Hidden', weight: 8, hintLevel: 0 },
];

/**
 * How remarkable it is, the way a legendary or mythical creature stands apart
 * from an ordinary one: stronger identity, more extreme traits, more quirks,
 * a grander name, and a limit on how many can exist in one save. Tier is about
 * standing and story, not raw power.
 */
export interface CreatureTier {
  id: string;
  label: string;
  weight: number;
  /** How many axes are pushed to an extreme (0 or 5). */
  extremes: number;
  /** Inclusive quirk count range. */
  quirks: [number, number];
  /** How names read at this tier. */
  nameStyle: 'plain' | 'epithet' | 'title' | 'proper';
  /** At most this many of the tier per save (Infinity for no limit). */
  maxPerSave: number;
  /** Whether a creature of this tier may be rerolled, bred or traded away. */
  transferable: boolean;
}

export const TIERS: CreatureTier[] = [
  { id: 'wild', label: 'Wild', weight: 6000, extremes: 0, quirks: [0, 1], nameStyle: 'plain', maxPerSave: Infinity, transferable: true },
  { id: 'notable', label: 'Notable', weight: 2500, extremes: 1, quirks: [1, 2], nameStyle: 'plain', maxPerSave: Infinity, transferable: true },
  { id: 'exalted', label: 'Exalted', weight: 1000, extremes: 2, quirks: [2, 3], nameStyle: 'epithet', maxPerSave: Infinity, transferable: true },
  { id: 'fabled', label: 'Fabled', weight: 400, extremes: 3, quirks: [3, 4], nameStyle: 'title', maxPerSave: 12, transferable: true },
  { id: 'mythic', label: 'Mythic', weight: 90, extremes: 4, quirks: [4, 5], nameStyle: 'title', maxPerSave: 3, transferable: false },
  { id: 'singular', label: 'Singular', weight: 10, extremes: 6, quirks: [5, 6], nameStyle: 'proper', maxPerSave: 1, transferable: false },
];

export const TIER_BY_ID: Record<string, CreatureTier> = Object.fromEntries(TIERS.map((t) => [t.id, t]));
export const FINDABILITY_BY_ID: Record<string, Findability> = Object.fromEntries(FINDABILITY.map((f) => [f.id, f]));

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

export interface CreatureGenome {
  /** The seed that produced this creature. The seed is the creature. */
  seed: string;
  name: string;
  plan: string;
  /** A second plan a hybrid borrows parts from, if any. */
  partsFrom?: string;
  themes: string[];
  tier: string;
  findability: string;
  traits: TraitVector;
  quirks: string[];
}

export interface RollOptions {
  tier?: string;
  findability?: string;
  themes?: string[];
  plan?: string;
  /** Chance (0-1) that a creature borrows parts from a second plan. Default 0.25. */
  hybridChance?: number;
}

const EPITHETS = ['the Patient', 'the Unlit', 'of the Long Night', 'the Borrowed', 'the Quiet', 'Who Waits', 'the Unwelcome', 'the Fond', 'Underfoot'];
const TITLES = ['Warden of', 'Last of', 'Keeper of', 'Herald of', 'Regent of', 'Whisper of', 'Heir to'];
const PROPER = ['Marrow', 'Vesper', 'Pennywhistle', 'Cassiopeia', 'Ludo', 'Orpheus', 'Mabel', 'Thistle', 'Nox', 'Juniper', 'Gideon', 'Sable', 'Quill', 'Osiris', 'Tallow'];

function rollTraits(rand: () => number, themes: CreatureTheme[], tier: CreatureTier, quirkIds: string[]): TraitVector {
  const traits: TraitVector = {};
  // A plain creature sits near the middle; themes then pull axes into their ranges.
  for (const a of AXES) traits[a.id] = clamp(Math.round(1 + rand() * 3), 0, 5);
  const themed: string[] = [];
  for (const theme of themes) {
    for (const [axisId, [lo, hi]] of Object.entries(theme.bias)) {
      traits[axisId] = clamp(Math.round(lo + rand() * (hi - lo)), 0, 5);
      themed.push(axisId);
    }
  }
  // Higher tiers push some axes to the extreme, preferring ones the theme already cares about.
  const pool = themed.length > 0 ? [...themed] : AXES.map((a) => a.id);
  for (let i = 0; i < tier.extremes; i += 1) {
    const id = pick(rand, i < pool.length ? pool : AXES.map((a) => a.id));
    traits[id] = (traits[id] ?? 2) >= 3 || rand() < 0.7 ? 5 : 0;
  }
  for (const quirkId of quirkIds) {
    for (const [axisId, delta] of Object.entries(QUIRK_BY_ID[quirkId]!.shift)) {
      traits[axisId] = clamp((traits[axisId] ?? 2) + delta, 0, 5);
    }
  }
  return traits;
}

function rollName(rand: () => number, tier: CreatureTier, themes: CreatureTheme[], planNoun: string, hybridNoun?: string): string {
  const word = pick(rand, themes[0]?.words ?? ['Odd']);
  const noun = hybridNoun ? `${planNoun}-${hybridNoun}` : planNoun;
  switch (tier.nameStyle) {
    case 'plain': return `${word} ${noun}`;
    case 'epithet': return `${word} ${noun} ${pick(rand, EPITHETS)}`;
    case 'title': return `${pick(rand, PROPER)}, ${pick(rand, TITLES)} ${themes[0]?.label ?? 'the Block'}`;
    case 'proper': return `${pick(rand, PROPER)} ${noun}`;
  }
}

/** Rolls one creature. The same seed and options always give the same creature, so the roster is unbounded. */
export function rollCreature(seed: string, options: RollOptions = {}): CreatureGenome {
  const rand = mulberry32(hashString(`creature:${seed}`));
  const tier = options.tier ? TIER_BY_ID[options.tier]! : weighted(rand, TIERS);
  const findability = options.findability ? FINDABILITY_BY_ID[options.findability]! : weighted(rand, FINDABILITY);
  const themeIds = options.themes && options.themes.length > 0 ? options.themes : [pick(rand, THEMES).id];
  const themes = themeIds.map((id) => THEME_BY_ID[id]!).filter(Boolean);
  const planId = options.plan ?? (rand() < 0.7 ? pick(rand, themes[0]?.plans ?? ['dog']) : pick(rand, BODY_PLANS).id);
  const bodyPlan = BODY_PLAN_BY_ID[planId]!;
  let partsFrom: string | undefined;
  if (rand() < (options.hybridChance ?? 0.25)) {
    const other = pick(rand, BODY_PLANS);
    if (other.id !== planId) partsFrom = other.id;
  }
  const quirkCount = tier.quirks[0] + Math.floor(rand() * (tier.quirks[1] - tier.quirks[0] + 1));
  const quirkPool = [...new Set(themes.flatMap((t) => t.quirks))];
  const quirks: string[] = [];
  for (let i = 0; i < quirkCount; i += 1) {
    const candidate = rand() < 0.65 && quirkPool.length > 0 ? pick(rand, quirkPool) : pick(rand, QUIRKS).id;
    if (!quirks.includes(candidate)) quirks.push(candidate);
  }
  const traits = rollTraits(rand, themes, tier, quirks);
  const name = rollName(rand, tier, themes, bodyPlan.noun, partsFrom ? BODY_PLAN_BY_ID[partsFrom]!.noun : undefined);
  return { seed, name, plan: planId, partsFrom, themes: themeIds, tier: tier.id, findability: findability.id, traits, quirks };
}

/** The axes a creature is most defined by: furthest from the middle, strongest first. */
export function definingTraits(traits: TraitVector, count = 4): Array<{ axis: TraitAxis; value: number }> {
  return AXES
    .map((a) => ({ axis: a, value: traits[a.id] ?? 0 }))
    .sort((a, b) => Math.abs(b.value - 2.5) - Math.abs(a.value - 2.5) || a.axis.id.localeCompare(b.axis.id))
    .slice(0, count);
}

/** A short feel label from the two axes players notice first. */
export function feelLabel(traits: TraitVector): string {
  const cute = traits.cute ?? 0;
  const dread = traits.dread ?? 0;
  if (cute >= 4 && dread >= 4) return 'Adorably terrifying';
  if (dread >= 4) return 'Terrifying';
  if (cute >= 4) return 'Adorable';
  if (dread >= 3 && cute >= 3) return 'Sweet but wrong';
  if (dread >= 3) return 'Eerie';
  if (cute >= 3) return 'Charming';
  return 'Ordinary';
}
