/**
 * The conversational half of LOK Chat's understanding: what a message is *like* (a
 * question, a feeling, a "why?", a "yes") and what the conversation is currently about.
 * Pure: no clock, no storage, no randomness. `engine/lokChat.ts` uses it to answer;
 * `state/lokChatStore.ts` saves the `ConvState` it hands back. Only structured ids and
 * counts are ever kept, never the words a player typed.
 */

export type Feeling = 'sad' | 'tired' | 'happy' | 'scared' | 'bored' | 'angry' | 'lonely' | 'excited';
export type Follow = 'why' | 'more' | 'yes' | 'no' | 'unsure' | 'andYou' | 'laugh' | 'ack' | 'pronoun';

export interface Analysis {
  /** Lowercased, punctuation-light text, used for matching only and never shown. */
  flat: string;
  question: boolean;
  /** Three words or fewer. */
  short: boolean;
  feeling?: Feeling;
  follow?: Follow;
}

/** Where the conversation is, kept per person. */
export interface ConvState {
  topic: { key: string; depth: number } | null;
  /** What they are waiting for you to answer: `more`, `offer:<topic>` or `q:<question>`. */
  pending: string;
  /** How many layers of each topic have been told. */
  depths: Record<string, number>;
  /** The last few questions they asked, so they do not repeat. */
  asked: string[];
  lastSubjectId: string;
  lastTopicLabel: string;
}

export const emptyConv = (): ConvState => ({ topic: null, pending: '', depths: {}, asked: [], lastSubjectId: '', lastTopicLabel: '' });

const FEELINGS: ReadonlyArray<readonly [Feeling, RegExp]> = [
  ['lonely', /\b(lonely|alone|no one|nobody)\b/],
  ['sad', /\b(sad|down|upset|crying|cried|depressed|miserable|bad day|rough day|awful|terrible|hurts?)\b/],
  ['tired', /\b(tired|exhausted|sleepy|worn out|drained|cant sleep|can't sleep|no sleep)\b/],
  ['scared', /\b(scared|afraid|nervous|anxious|worried|frightened|spooked|terrified)\b/],
  ['angry', /\b(angry|mad|furious|annoyed|frustrated|ugh|rage)\b/],
  ['bored', /\b(bored|boring|nothing to do)\b/],
  ['excited', /\b(excited|hyped|pumped|cant wait|can't wait)\b/],
  ['happy', /\b(happy|great|awesome|good day|amazing|glad|proud|best day|wonderful)\b/],
];

const FOLLOWS: ReadonlyArray<readonly [Follow, RegExp]> = [
  ['andYou', /\b(and you|what about you|how about you)\b/],
  ['more', /\b(tell me more|go on|keep going|and then|what else|then what|elaborate|explain|what happened next|more)\b/],
  ['why', /^(why|how come|but why|why not|why is that|what for)\b/],
  ['unsure', /\b(maybe|not sure|i guess|idk|dunno|i don'?t know|kinda|sort of|perhaps)\b/],
  ['no', /^(no|nope|nah|not really|never|i don'?t|i do not|i did not|i didn'?t|not yet)\b/],
  ['yes', /^(yes|yeah|yep|yup|sure|definitely|of course|i do|i am|i did|absolutely|uh huh|mhm|please|yes please)\b/],
  ['laugh', /^(lol|lmao|lmfao|haha+|hehe+|heh|ha+)\b/],
  ['ack', /^(hmm+|ok+|okay|cool|nice|wow|oh|ah|i see|huh|interesting|right|fair|true|k|kk)\b/],
  ['pronoun', /\b(her|him|she|he|them)\b/],
];

export function analyze(flat: string, rawHadQuestionMark = false): Analysis {
  const words = flat.split(' ').filter(Boolean);
  const short = words.length <= 3;
  const question = rawHadQuestionMark || /^(who|what|why|how|when|where|do you|are you|can you|could you|would you|is it|did you|have you|will you)\b/.test(flat);
  let feeling: Feeling | undefined;
  for (const [f, re] of FEELINGS) if (re.test(flat)) { feeling = f; break; }
  let follow: Follow | undefined;
  for (const [f, re] of FOLLOWS) {
    if (!re.test(flat)) continue;
    // Pronouns only count in a short message ("what about her?"); a long sentence with "he" is something else.
    if (f === 'pronoun' && words.length > 5) continue;
    if ((f === 'why' || f === 'more' || f === 'laugh' || f === 'ack') && words.length > 5) continue;
    if ((f === 'yes' || f === 'no') && words.length > 6) continue;
    follow = f;
    break;
  }
  // "I am so tired" is a feeling, not a yes.
  if (feeling && (follow === 'yes' || follow === 'no' || follow === 'ack')) follow = undefined;
  return { flat, question, short, feeling, follow };
}

/** A made-up analysis for a quick-reply button, so "Tell me more" works the same as typing it. */
export const analysisFor = (follow: Follow): Analysis => ({ flat: follow, question: false, short: true, follow });
