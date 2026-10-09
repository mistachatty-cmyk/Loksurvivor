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

/** The stock chart. Nothing here can be bought yet; the shelf shows what is coming. */
export const LOKSHOP_STOCK: LokShopItemDef[] = [
  { id: 'ball', nameKey: 'lokshop.item.ball.name', blurbKey: 'lokshop.item.ball.blurb', price: 120, status: 'soon' },
  { id: 'chest-pass', nameKey: 'lokshop.item.chest-pass.name', blurbKey: 'lokshop.item.chest-pass.blurb', price: 200, status: 'soon' },
  { id: 'pet-rider-saddle', nameKey: 'lokshop.item.pet-rider-saddle.name', blurbKey: 'lokshop.item.pet-rider-saddle.blurb', price: 350, status: 'planned' },
];
