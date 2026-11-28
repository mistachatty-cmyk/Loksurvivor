/**
 * The smallest useful cast: three people in a lighthouse. It exists to prove `@lok/chat` has no
 * 616-specific assumptions, and as a copy-paste starting point for a new app (docs/LOK_CHAT.md).
 * It passes `validateCast`; a real app writes far more lines per person.
 */
import type { ChatCast, CrewVoice } from '../../src';

const voice = (own: string[], topics: string[]): CrewVoice => ({
  openers: ['Ahoy.', 'Hello there.'],
  topics,
  closers: ['Mind the stairs.'],
  wry: ['The sea does not care, but I do.'],
  own,
});

const t = (family: string[], wry: string[] = family): Record<'family' | 'wry', string[]> => ({ family, wry });

export const LIGHTHOUSE_CAST: ChatCast = {
  intentRules: [
    ['bye', /\b(bye|goodbye|see you)\b/],
    ['thanks', /\b(thanks|thank you)\b/],
    ['howAreYou', /\b(how are you|how'?s it going)\b/],
    ['work', /\b(what do you do|your job)\b/],
    ['greet', /\b(hi|hey|hello)\b/],
    ['story', /\b(story|tell me|anything)\b/],
  ],
  intentTemplates: {
    greet: t(['Hello, keeper of the lamp.', 'Good to see you.']),
    howAreYou: t(['I am <mood> today.']),
    work: t(['I am the <role>. Mostly that means <own>.']),
    room: t(['I am up in <room>.']),
    run: t(['The <area> sounds hard. Rest a while.']),
    pet: t(['<pet> is good company.']),
    weather: t(['It is <weather> out on the water.']),
    advice: t(['<advice>']),
    thanks: t(['Any time.']),
    bye: t(['Safe travels.']),
    unknown: t(['Hm. Ask me about <own>.']),
  },
  confideDeflections: ['Ask me again when we know each other better.'],
  confides: {
    mara: ['I count the ships at night so none of them are alone.', 'The lamp is only a promise that someone is awake.'],
    tobias: ['I never leave the stairs unswept. It keeps my hands honest.', 'I wrote a letter once and never sent it.'],
    wren: ['I came for the quiet and stayed for the company.', 'I draw the tide tables from memory.'],
  },
  relations: { mara: { tobias: 'Tobias keeps the stairs. I keep the light.' }, tobias: { mara: 'Mara never sleeps. I sweep around her.' } },
  fallbacks: { family: ['<subject> is the <subjectRole>. A good one.'], wry: ['<subject>, the <subjectRole>. Reliable, annoyingly.'] },
  proactiveLines: {
    afterRunCleared: ['Good run. The light is on for you.'],
    afterRunFell: ['Rough one. Come sit.'],
    welcomeBack: ['There you are. We kept the lamp lit.'],
    morning: ['Morning. <advice>'],
    evening: ['Evening. The lamp is lit.'],
    tierUp: ['I tell you more than most. Thank you for that.'],
  },
  runLines: {
    cleared: t(['You cleared the <area>. Well done.']),
    fell: t(['The <area> won this time. Try again.']),
    none: t(['No run to talk about yet.']),
  },
  timeWords: { morning: ['this morning'], afternoon: ['this afternoon'], evening: ['this evening'], night: ['tonight'] },
  voices: {
    mara: voice(['the lamp', 'the logbook'], ['The lamp turns every eleven seconds.', 'Fog rolls in at the same hour.']),
    tobias: voice(['the stairs', 'the lantern oil'], ['There are two hundred and four steps.', 'Salt gets into everything.']),
    wren: voice(['the tide tables', 'the radio'], ['The tide is early today.', 'Gulls argue about everything.']),
  },
  fallbackVoice: voice(['the work'], ['Quiet today.']),
  sharedPools: {
    advice: ['Dress warm.', 'Mind the wet steps.'],
    food: ['soup'], hazard: ['the slippery rocks'], place: ['the harbour'], sound: ['the foghorn'], thing: ['a spare lantern'],
  },
  weatherWords: { calm: ['calm', 'still'], storm: ['stormy', 'rough'] },
  moods: ['steady', 'tired', 'hopeful'],
  sharedTopics: [
    {
      key: 'sea', label: 'the sea', pattern: /\b(sea|ocean|waves?|tide)\b/,
      layers: [['The sea is a neighbour that never visits.'], ['I learned its moods like a face.'], ['I think it keeps secrets for people who ask politely.']],
    },
    {
      key: 'thanks-note', label: '', pattern: /\b(you are kind)\b/,
      layers: [['That is kind of you.']],
    },
  ],
  topicsByPerson: {},
  moreOffers: ['Want me to go on?'],
  topicDeflections: ['There is more. Ask me again once we know each other better.'],
  topicExhausted: ['That is all I have on that.'],
  noTopic: ['More of what? Ask me something.'],
  hooks: ['Ask me about <hook> sometime.'],
  noThanks: ['All right.'],
  takeYourTime: ['Take your time.'],
  lastRunCallbacks: ['Last I heard you were in the <area>.'],
  lastTopicCallbacks: ['I kept thinking about <lastTopic>.'],
  feelingLines: {
    sad: ['I am sorry. Sit with me a while.'], tired: ['Rest. The lamp will keep.'], happy: ['Good. Hold onto it.'], scared: ['Breathe. I am here.'],
    bored: ['Walk the stairs. They are good company.'], angry: ['Let it out. The sea can take it.'], lonely: ['You are not alone here.'], excited: ['Tell me everything.'],
  },
  smalltalkLines: { laugh: ['Ha. Good.'], ack: ['Mm.'], statement: ['I hear you.'], question: ['I do not know. Good question.'] },
  questions: [
    { id: 'ate', ask: 'Did you eat today?', yes: ['Good.'], no: ['Then go eat.'], unsure: ['That means no.'], other: ['Eat anyway.'] },
    { id: 'sleep', ask: 'Are you sleeping okay?', yes: ['Good.'], no: ['Rest first.'], unsure: ['In pieces, then.'], other: ['Rest when you can.'] },
  ],
};

export const LIGHTHOUSE_PEOPLE = [
  { id: 'mara', name: 'Mara', role: 'Keeper' },
  { id: 'tobias', name: 'Tobias', role: 'Caretaker' },
  { id: 'wren', name: 'Wren', role: 'Navigator' },
];
