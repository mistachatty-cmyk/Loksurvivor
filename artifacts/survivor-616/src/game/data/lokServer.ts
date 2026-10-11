/**
 * LokServer: the digital host of the LokShop, an AI-looking being with owl energy.
 * Friendly, cheery, focused on selling. This file holds its voice, the topics it can
 * talk about and the LokShop stock chart; the doc that grows its knowledge is
 * `docs/lokserver-knowledge.md`.
 *
 * Content rules match `crewVoices.ts`: kid-safe, and never the banned naming word
 * (see CLAUDE.md; use beacon, pulse, relay, static or frequency). `lokServer.test.ts`
 * enforces it. LokShop is a placeholder name.
 */
import type { CrewVoice } from '@/game/engine/crewTalk';

export interface LokServerTopicDef {
  id: string;
  /** Locale key for the button. */
  labelKey: string;
  /** What the host says, written for the template expander (`{a|b}`, `<slot>`). */
  lines: string[];
}

const OPENERS = ['Hoo, hello there!', 'Welcome in, friend!', 'Ah, a bright visitor!', 'Hoot hoot, good timing!', 'Come closer, come closer!'];
const CLOSERS = ['Anything else catch your eye?', 'Ask me anything, I never log off.', 'Hoo, I do love a happy customer.', 'Take your time. I have all the time there is.', ''];

/** Topics the player can pick. Add a row (and its label in `en.json`) for a new one. */
export const LOKSERVER_TOPICS: LokServerTopicDef[] = [
  {
    id: 'shop',
    labelKey: 'lokshop.topic.shop',
    lines: [
      'Everything on my shelves is paid in LokTokens, and every one is worth it.',
      'I keep the shelves tidy and the prices honest. Mostly.',
      'Nothing here is pay-to-win, only pay-to-sparkle.',
    ],
  },
  {
    id: 'eclipse',
    labelKey: 'lokshop.topic.eclipse',
    lines: [
      'Since the eclipse, the sky has had glyphs in it. I count them when business is slow.',
      'When the eclipse lines up with the glyphs, even my circuits hum. Try the rooftop spyglass.',
      'Life after the eclipse is strange, but strange sells well.',
    ],
  },
  {
    id: 'universes',
    labelKey: 'lokshop.topic.universes',
    lines: [
      'There are other universes past this one, and every one of them has a shop that is worse than mine.',
      'I can feel other worlds on the {frequency|relay|pulse}. I keep my ears open. Both of them.',
      'Past the eclipse there are places the city has never mapped. I have a few stories.',
    ],
  },
  {
    id: 'games',
    labelKey: 'lokshop.topic.games',
    lines: [
      'We are not the only game in the Lok family. There are others, and I hear things.',
      'Other games, other heroes, same friendly owl at the counter. I get around.',
      'Ask me again soon. My notes on the other games keep growing.',
    ],
  },
  {
    id: 'build',
    labelKey: 'lokshop.topic.build',
    lines: [
      'Things we could build? Oh, I have a list. A very long list.',
      'Between you and me, plans are being drawn. Good ones.',
      'Every good idea starts as a note on my shelf.',
    ],
  },
];

export const LOKSERVER_TOPICS_BY_ID: Record<string, LokServerTopicDef> = Object.fromEntries(LOKSERVER_TOPICS.map((topic) => [topic.id, topic]));

/** The voice the generator uses for one topic. */
export function lokServerVoice(topicId: string): CrewVoice {
  const topic = LOKSERVER_TOPICS_BY_ID[topicId] ?? LOKSERVER_TOPICS[0]!;
  return { openers: OPENERS, topics: topic.lines, closers: CLOSERS, wry: topic.lines, own: ['feathers', 'receipts', 'gold stars'] };
}

export interface LokShopItemDef {
  id: string;
  nameKey: string;
  blurbKey: string;
  /** Placeholder price in LokTokens. */
  price: number;
  /** `soon` is built next; `planned` is only on the drawing board. */
  status: 'soon' | 'planned';
}

/** Items on the drawing board. Empty now: Chest Pass and Rider Saddle shipped as LokShop perks (`lokShopPerks.ts`). */
export const LOKSHOP_STOCK: LokShopItemDef[] = [
];

export type LokServerMood = 'greet' | 'pleased' | 'sly' | 'sad';

export interface LokServerContext {
  rapportTier: 'stranger' | 'regular' | 'favorite' | 'confidant';
  firstVisit: boolean;
  stamps: number;
  charms: number;
  charmTotal: number;
  hasPassport: boolean;
  ownedPerks: number;
}

/** A line that reacts to what the player has done here. Plain strings (no template slots). */
export const LOKSERVER_GREETINGS = {
  firstVisit: ['Hoo! A new face. Mind the glitter, it does not come off.', 'First time? Wonderful. Everything is on the house. (It is not.)'],
  stranger: ['Welcome back. I only remember your name when you spend. Kidding. Mostly.'],
  regular: ['Ah, a regular! I saved you the good perch.', 'Back again? The shelves missed you, and so did I.'],
  favorite: ['My favorite customer, and I say that to nobody. Okay, to three people.', 'Come, come. I put the best feathers aside for you.'],
  confidant: ['Old friend. The back room is yours, and so is the last good chair.', 'Hoo, there you are. Sit. Tell me everything the city did today.'],
  passport: ['Passport out! I have a fresh stamp with your name on it.'],
  complete: ['Every charm in the set. You know me better than my own logs do.'],
  empty: ['A shop with no charms and no stamps is a shop with a story to start. Try the feather game.'],
} as const;

export function lokServerGreeting(ctx: LokServerContext, rng: () => number): { line: string; mood: LokServerMood } {
  const pick = (list: readonly string[]) => list[Math.floor(rng() * list.length)]!;
  if (ctx.charmTotal > 0 && ctx.charms >= ctx.charmTotal) return { line: pick(LOKSERVER_GREETINGS.complete), mood: 'pleased' };
  if (ctx.firstVisit) return { line: pick(LOKSERVER_GREETINGS.firstVisit), mood: 'greet' };
  if (ctx.hasPassport && ctx.stamps > 0) return { line: pick(LOKSERVER_GREETINGS.passport), mood: 'pleased' };
  if (ctx.charms === 0 && ctx.ownedPerks === 0 && ctx.rapportTier === 'stranger') return { line: pick(LOKSERVER_GREETINGS.empty), mood: 'sly' };
  return { line: pick(LOKSERVER_GREETINGS[ctx.rapportTier]), mood: ctx.rapportTier === 'stranger' ? 'greet' : 'pleased' };
}

/** Lines for the feather game and purchases. */
export const LOKSERVER_REACTIONS = {
  win: ['The golden one! Hoo, you have an eye for it.', 'Gold! I would say it was luck, but I watched you think.'],
  lose: ['Not that one. The best birds hide well.', 'Close! A plain feather, but a fair try.'],
  charm: ['And a charm falls out! Keep it safe, it is not on any shelf.', 'Oh, one of the rare ones. Do not tell the others.'],
  noTries: ['That is plenty of feathers for today. Come back when the sun does.'],
  bought: ['Pleasure doing business. I will note it in the ledger, in gold.', 'Sold! You will not regret it. Probably.'],
  locked: ['The back room is for friends and pass holders. Visit a few days and I will open it.'],
} as const;

/** Back-room whispers. `tier` is the rapport tier index (0 stranger .. 3 confidant) that unlocks each. */
export const LOKSERVER_BACKROOM_NOTES: Array<{ tier: number; text: string }> = [
  { tier: 0, text: 'The feather game is rigged in exactly one way: the golden feather is never in the same place twice.' },
  { tier: 1, text: 'Supporters scroll across the bottom of the world. I read every name out loud when nobody is looking.' },
  { tier: 2, text: 'I keep a ledger of every kindness. The Lifetime page is written in gold ink and it never fades.' },
  { tier: 3, text: 'Confidants hear it first: new shelves are always built the night before an eclipse.' },
];
