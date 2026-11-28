/**
 * 616 Survivor's cast for `@lok/chat`: the crew's voices, topics, questions and opinions, assembled
 * from this game's content files. A new LOK app writes its own file like this one and runs
 * `validateCast` over it (see docs/LOK_CHAT.md).
 */
import type { ChatCast, TopicDef } from '@lok/chat';

import { CREW_VOICES, FALLBACK_VOICE, SHARED_POOLS } from '@/game/data/crewVoices';
import {
  CONFIDE_DEFLECTIONS,
  CREW_CONFIDES,
  CREW_FALLBACKS,
  CREW_RELATIONS,
  INTENT_RULES,
  INTENT_TEMPLATES,
  PROACTIVE_LINES,
  RUN_LINES,
  TIME_WORDS,
} from '@/game/data/lokChatData';
import { CREW_SCENES, EVENT_CALLBACKS, MOOD_OPENERS, MOOD_WORDS, SCENE_REPLIES } from '@/game/data/lokChatScenes';
import { CREW_TOPICS_MORE } from '@/game/data/lokChatTopicsCrew';
import {
  ALLY_TOPICS,
  FEELING_LINES,
  HOOKS,
  LAST_RUN_CALLBACKS,
  LAST_TOPIC_CALLBACKS,
  MORE_OFFERS,
  NO_THANKS,
  NO_TOPIC,
  QUESTIONS,
  SHARED_TOPICS,
  SMALLTALK_LINES,
  TAKE_YOUR_TIME,
  TOPIC_DEFLECTIONS,
  TOPIC_EXHAUSTED,
} from '@/game/data/lokChatTopics';

/** Each person's topics from both files, theirs first so the earlier ones are offered first. */
function mergeTopics(...maps: Array<Record<string, TopicDef[]>>): Record<string, TopicDef[]> {
  const out: Record<string, TopicDef[]> = {};
  for (const map of maps) for (const [id, topics] of Object.entries(map)) out[id] = [...(out[id] ?? []), ...topics];
  return out;
}

export const SURVIVOR_CAST: ChatCast = {
  intentRules: INTENT_RULES,
  intentTemplates: INTENT_TEMPLATES,
  confideDeflections: CONFIDE_DEFLECTIONS,
  confides: CREW_CONFIDES,
  relations: CREW_RELATIONS,
  fallbacks: CREW_FALLBACKS,
  proactiveLines: PROACTIVE_LINES,
  runLines: RUN_LINES,
  timeWords: TIME_WORDS,
  voices: CREW_VOICES,
  fallbackVoice: FALLBACK_VOICE,
  sharedPools: SHARED_POOLS,
  weatherWords: {
    clear: ['clear', 'dry', 'calm'],
    rain: ['raining', 'wet', 'pouring'],
    fog: ['foggy', 'thick with fog'],
    snow: ['snowing', 'cold and white'],
    heat: ['hot', 'sticky'],
  },
  moods: ['tired', 'hopeful', 'stubborn', 'restless', 'fine', 'a little proud of everyone', 'a little worn out', 'steady'],
  sharedTopics: SHARED_TOPICS,
  topicsByPerson: mergeTopics(ALLY_TOPICS, CREW_TOPICS_MORE),
  moreOffers: MORE_OFFERS,
  topicDeflections: TOPIC_DEFLECTIONS,
  topicExhausted: TOPIC_EXHAUSTED,
  noTopic: NO_TOPIC,
  hooks: HOOKS,
  noThanks: NO_THANKS,
  takeYourTime: TAKE_YOUR_TIME,
  lastRunCallbacks: LAST_RUN_CALLBACKS,
  lastTopicCallbacks: LAST_TOPIC_CALLBACKS,
  feelingLines: FEELING_LINES,
  smalltalkLines: SMALLTALK_LINES,
  questions: QUESTIONS,
  scenes: CREW_SCENES,
  sceneReplies: SCENE_REPLIES,
  moodWords: MOOD_WORDS,
  moodOpeners: MOOD_OPENERS,
  eventCallbacks: EVENT_CALLBACKS,
};
