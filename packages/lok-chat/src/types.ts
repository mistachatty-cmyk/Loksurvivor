/** Shared types for LOK Chat and the `ChatCast` an app supplies. */
import type { Feeling } from './talk';
import type { CrewVoice, Pools, Tone } from './template';

export type ChatFeature =
  | 'chat' | 'depth' | 'questionsBack' | 'twoBubbles' | 'proactive' | 'memory'
  | 'strip' | 'scenes' | 'group' | 'moods' | 'presence' | 'reactions';

export type ChatIntent =
  | 'greet' | 'howAreYou' | 'work' | 'room' | 'crew' | 'run' | 'pet' | 'weather' | 'advice' | 'joke' | 'story'
  | 'confide' | 'thanks' | 'bye' | 'topic' | 'followUp' | 'feeling' | 'smalltalk' | 'unknown';

/** Intents answered from the shared templates (the rest have their own sources). */
export type TemplatedIntent = Exclude<ChatIntent, 'crew' | 'joke' | 'story' | 'confide' | 'topic' | 'followUp' | 'feeling' | 'smalltalk'>;

export type TimeBucket = 'morning' | 'afternoon' | 'evening' | 'night';
export type ProactiveKind = 'afterRunCleared' | 'afterRunFell' | 'welcomeBack' | 'morning' | 'evening' | 'tierUp';

/** A topic has layers. Layer 1 is for anyone, 2 opens at "friend", 3 at "close". One layer = a reaction. */
export interface TopicDef {
  key: string;
  /** How it reads in "Want to hear about <label>?". Empty for reactions. */
  label: string;
  pattern: RegExp;
  layers: string[][];
}

export interface QuestionDef {
  id: string;
  ask: string;
  /** Free-form questions react the same way to any answer. */
  free?: boolean;
  yes: string[];
  no: string[];
  unsure: string[];
  other: string[];
}

/**
 * Everything an app authors to give its characters a voice. `validateCast` checks it. Template
 * syntax is the crew-talk expander's: `{a|b}` branches, `<slot>` pool fills.
 */
export interface ChatCast {
  intentRules: ReadonlyArray<readonly [ChatIntent, RegExp]>;
  intentTemplates: Record<TemplatedIntent, Record<Tone, string[]>>;
  confideDeflections: readonly string[];
  /** Two or more personal lines per person, told once you are friends. */
  confides: Record<string, readonly string[]>;
  /** Opinions: `relations[speaker][subject]`. */
  relations: Record<string, Record<string, string>>;
  /** Built from the subject's role when two people have no authored opinion. */
  fallbacks: Record<Tone, readonly string[]>;
  proactiveLines: Record<ProactiveKind, readonly string[]>;
  runLines: Record<'cleared' | 'fell' | 'none', Record<Tone, readonly string[]>>;
  timeWords: Record<TimeBucket, readonly string[]>;
  voices: Record<string, CrewVoice>;
  fallbackVoice: CrewVoice;
  sharedPools: Pools;
  /** Words for each weather state an app can report. Unknown states fall back to the state name. */
  weatherWords: Record<string, readonly string[]>;
  moods: readonly string[];
  sharedTopics: readonly TopicDef[];
  topicsByPerson: Record<string, readonly TopicDef[]>;
  moreOffers: readonly string[];
  topicDeflections: readonly string[];
  topicExhausted: readonly string[];
  noTopic: readonly string[];
  hooks: readonly string[];
  noThanks: readonly string[];
  takeYourTime: readonly string[];
  lastRunCallbacks: readonly string[];
  lastTopicCallbacks: readonly string[];
  feelingLines: Record<Feeling, readonly string[]>;
  smalltalkLines: { laugh: readonly string[]; ack: readonly string[]; statement: readonly string[]; question: readonly string[] };
  questions: readonly QuestionDef[];
}
