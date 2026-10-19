/**
 * Authored content for LOK Chat (`engine/lokChat.ts`): what people say back when you
 * message them. Same rules as `crewVoices.ts`: wry and grown-up is fine, but nothing a
 * child should not read -- no profanity, sexual content, gore, drug or alcohol punchlines,
 * real-world politics -- and never the banned naming word (see CLAUDE.md); use beacon,
 * pulse, relay, static or frequency. `lokChat.test.ts` renders every template across many
 * seeds and scans for banned words.
 *
 * Template syntax is the crew-talk expander's (`engine/crewTalk.ts`):
 *   {a|b|c} random branch, {3*a|b} weighted, <slot> pool fill.
 * Slots available here: name, role, room, weather, crew, pet, area, time, mood, advice,
 * food, hazard, place, sound, thing, own (a per-voice fill-in).
 */

import type { Tone } from '@/game/engine/crewTalk';

export type ChatIntent =
  | 'greet'
  | 'howAreYou'
  | 'work'
  | 'room'
  | 'crew'
  | 'run'
  | 'pet'
  | 'weather'
  | 'advice'
  | 'joke'
  | 'story'
  | 'confide'
  | 'thanks'
  | 'bye'
  | 'unknown';

/** Rules are tried in this order; the first whose pattern matches wins. */
export const INTENT_RULES: ReadonlyArray<readonly [ChatIntent, RegExp]> = [
  ['bye', /\b(bye|goodbye|good night|goodnight|see you|see ya|later|gotta go|heading out|cya)\b/],
  ['thanks', /\b(thanks|thank you|thx|cheers|appreciate)\b/],
  ['confide', /\b(secret|something real|personal|confide|tell me something true|open up|really think|deep down)\b/],
  ['joke', /\b(joke|funny|laugh|make me laugh|pun)\b/],
  ['run', /\b(run|mission|raid|last fight|how did i do|how'?d i do|my score|how was my|after the run|went out)\b/],
  ['pet', /\b(pet|lokpet|puppy|doggo|kitty|critter|companion|buddy)\b/],
  ['weather', /\b(weather|rain|raining|snow|snowing|fog|foggy|hot|heat|cold|storm|outside|sky)\b/],
  ['advice', /\b(advice|tip|tips|help me|what should i|should i|any ideas|how do i|how to|suggest)\b/],
  ['howAreYou', /\b(how are you|how'?s it going|hows it going|you ok|you okay|you good|how you doing|how are things|feeling)\b/],
  ['work', /\b(what do you do|your job|your role|what'?s your job|what is your job|do for work|who are you|about yourself|what are you)\b/],
  ['room', /\b(where are you|where am i|this room|the room|what'?s here|whats here|around here|this place)\b/],
  ['greet', /\b(hi|hey|hello|yo|sup|howdy|hiya|good morning|good evening|good afternoon|morning|evening)\b/],
  ['story', /\b(story|tell me|talk|news|anything|what'?s up|whats up|rumou?r|happening|going on|chat|something|speak)\b/],
];

/** Greeting openers by time of day. */
export const TIME_WORDS: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: ['this morning', 'first thing', 'before the lights come up', 'at this early hour'],
  afternoon: ['this afternoon', 'midday', 'in the long part of the day'],
  evening: ['this evening', 'as the lights come on', 'at this hour'],
  night: ['tonight', 'this late', 'in the small hours'],
};

/** Intent templates, shared by everyone; a voice's own openers/closers/topics add the personal flavor. */
/** Intents answered from these shared templates (the rest have their own sources). */
export type TemplatedIntent = Exclude<ChatIntent, 'crew' | 'joke' | 'story' | 'confide'>;

export const INTENT_TEMPLATES: Record<TemplatedIntent, Record<Tone, string[]>> = {
  greet: {
    family: [
      '{Hey, you.|Hi there.|Good to see you.|Hello, friend.} {How are you holding up {<time>|today}?|Pull up a chair.|Glad you stopped by.}',
      '{Well, look who messaged.|There you are.|Oh good, it is you.} {I was just thinking about <own>.|Come tell me how it is out there.}',
      '{Morning, afternoon, whatever it is.|Hello again.} <advice>',
    ],
    wry: [
      '{Oh. You again.|Look who found the keyboard.|Back so soon?} {I was almost having a quiet moment.|Fine, I will allow it.}',
      '{Hey.|Hi.} {I was busy thinking about <own>. It can wait.|Say something clever, I dare you.}',
    ],
  },
  howAreYou: {
    family: [
      "{I'm <mood>, honestly.|Feeling <mood> today.|Can't complain. <mood>, mostly.} {It helps that you check in.|<own> keeps me going.}",
      '{Doing okay.|Hanging in there.} {<room> is {quiet|cozy|busy} {<time>|today}.|<own> has been on my mind.}',
    ],
    wry: [
      "{Feeling <mood>.|<mood>, and a little bit of spite.} {Thanks for asking. Nobody does.|Ask me again once I have dealt with <own>.}",
      '{I have been better. I have also been worse.|Surviving, which is the whole job.} <own>.',
    ],
  },
  work: {
    family: [
      "{I'm the <role> around here.|They call me the <role>.|I'm the <role>, if you couldn't tell.} {<own> is most of the work.|Somebody has to, and it turned out to be me.}",
      'My job? <role>. {Mostly that means <own>.|It is not glamorous, but it is mine.}',
    ],
    wry: [
      "{<role>, by default.|<role>. Nobody else raised a hand.} {It pays in <own> and good stories.|The hours are bad and the company is mixed.}",
    ],
  },
  room: {
    family: [
      "{I'm in <room>.|You'll find me in <room>.} {It's <weather> out right now.|{<crew> is nearby if you want company.|It's quiet.}}",
      '<room>, as always. {<own> is close by.|Come by whenever you like.}',
    ],
    wry: [
      "{<room>. Where else would I be?|Still <room>. It has not moved.} {<crew> is around, for better or worse.|<own> is within arm's reach.}",
    ],
  },
  run: {
    family: [
      '{Heard you made it out of the <area>.|The <area>, huh?} {{Good work.|Well done.} Sit down and have something.|You looked after yourself, and that counts.}',
    ],
    wry: [
      '{The <area>. Bold.|You and the <area>. I would say something encouraging, but I am saving it.} {Go again, but eat first.|Come back with fewer bruises next time.}',
    ],
  },
  pet: {
    family: [
      '{<pet> is a good one.|<pet> is always underfoot.|I like <pet>.} {Quiet company is the best kind.|Give them a scratch for me.}',
    ],
    wry: [
      '{<pet> looked at me like I owed them something.|<pet> has opinions. Loud ones.} {I respect that.|Keep that one close.}',
    ],
  },
  weather: {
    family: [
      "{It's <weather> out there.|Looks like it's <weather> again.} {Mind your step on the way out.|Good day to stay in, honestly.}",
    ],
    wry: [
      '{<weather>. Of course.|It is <weather> out, and the sky has committed to it.} {Bring a coat or bring a plan.|I would stay inside, but nobody asked me.}',
    ],
  },
  advice: {
    family: [
      '{Here is my advice:|Take it from me:|Listen up.} <advice> {And mind the <hazard>.|And do not skip <food>.}',
    ],
    wry: [
      '{Free advice, worth every cent:|Unasked-for wisdom incoming:} <advice> {Also, <hazard>. You are welcome.|Pass it on.}',
    ],
  },
  thanks: {
    family: ['{Anytime.|Of course.|Any time at all.|You are welcome.} {That is what we are here for.|Come back whenever.}'],
    wry: ['{Do not mention it. Really, do not.|Do not make it weird.|Yes, yes.} {Anytime.|You are welcome.}'],
  },
  bye: {
    family: ['{Take care.|See you soon.|Safe out there.|Come back in one piece.} <advice>', '{Bye for now.|Until next time.} {I will keep the light on.|Do not be a stranger.}'],
    wry: ['{Go on, then.|Off you go.|Fine, leave.} {Come back and tell me how it went.|I will be here, being relied on.}'],
  },
  unknown: {
    family: [
      "{Hm, not sure I follow.|I'm not sure what you mean.|Say that another way?} {Ask me how I am, or about <own>.|Try asking about my work, or the weather.}",
    ],
    wry: [
      '{I have no idea what that was.|Come again?|You lost me.} {Try asking me something I can actually answer.|Ask about the weather. Everyone else does.}',
    ],
  },
};

/** Shown when someone asks for a confidence before they know you well enough. */
export const CONFIDE_DEFLECTIONS: string[] = [
  "Ask me again when we've talked a bit more.",
  'That is a conversation for later. Keep stopping by.',
  'Not yet. Come back a few times first, and I might.',
];

/** Short personal moments, unlocked once you are friends. Two per ally. */
export const CREW_CONFIDES: Record<string, string[]> = {
  vee: ['I counted the till every night through the worst of it. Not for the money. It was the one thing that came out the same.', 'Everybody thinks the store survived because I am stubborn. It survived because people kept coming in just to see a light on.'],
  deacon: ['I ring the bell because silence got too loud after the lights went out. The bell tells me someone is still keeping time.', 'I never learned who the bell was for. I decided it was for whoever was listening.'],
  nyx: ['I paint the same wall every week. They scrub it every week. I think we both like it that way.', 'Up on the roof is the only place nobody asks me for a plan. I do not have one. I have colors.'],
  sable: ['I filed records nobody would ever play. It felt like keeping someone company who did not know it.', 'I turn the sound system up when it is too quiet, not when it is too loud. Quiet is where I get worried.'],
  mamajo: ['I feed people because I do not know another way to say stay. The pan is just my way of asking.', 'Every night I count the plates. Every night it is more than it was. That is how I know it is working.'],
  bulbosa: ['I carry my father’s name like a heavy coat. Some days it keeps me warm. Some days I would like to hang it up.', 'Ruling is easier than staying. I chose staying, and I would choose it again.'],
  morrow: ['I photograph doors because a door is a promise. Somewhere on the other side, somebody planned for you.', 'The long exposures show what the city forgot to hide. People, mostly. Always people.'],
  cinder: ['I do not fix things because they are broken. I fix them because somebody once told me nothing was worth it.', 'Quiet tools are a kindness. A loud night does not need a louder wrench.'],
  pippa: ['I know every kitchen window because I have stood outside all of them. Hungry is easier to see from the street.', 'Running is the only time I do not think. Stopping is when it all catches up. So I rarely stop.'],
  denny: ['I keep a log of who crossed. The ones who did not come back, I leave a line blank for. In case.', 'The current is not the danger. The danger is deciding to stop crossing.'],
  ruth: ['I still do the books from memory. If I stop, then the market is really gone. So I do not stop.', 'An honest stall was never about the money. It was about being someone people could count on.'],
  frankie: ['The trains stopped. I kept the lantern lit anyway. Somebody should be there when one finally comes.', 'I log every arrival, real or not. The not-real ones are usually the kindest.'],
  constance: ['I filed things so that someone, someday, could prove it happened. That is all a record is: proof of being here.', 'The fountain does remember more than the ledgers. I just keep the ledgers so the fountain does not have to do all the work alone.'],
  theo: ['Locks are not about keeping people out. They are about someone deciding who gets to come in. I like teaching that part.', 'The first lock I ever opened was my own front door. After that I understood what a door really asks of you.'],
  otis: ['The machines owe me a rematch. I am not sure I want to collect. I think I just want the rematch to still be there.', 'I fix the cabinets because someone, somewhere, is still hoping to beat a high score. I want it to be possible.'],
  archivist: ['I index everything because I was made to. I keep indexing because I would like to understand what it means to be kept.', 'I kept a log nobody asked for. Then someone read it. That was the first time I felt, I think, seen.'],
  sarge: ['I never got the call to stand down. At some point I stopped waiting for it and started standing for people instead.', 'A station is just a building. It becomes a station when someone is willing to be on shift.'],
  'patch-mercer': ['A watch battery and stripped wiring is not engineering. It is stubbornness with a screwdriver.', 'I count the rooms every hour. Three. Always three. The day I count two, that is the day I stop sleeping.'],
  'mara-vance': ['I move air between rooms because nobody should be left alone with a small room. It is a small kindness with a large cost.', 'People think running is the job. The job is arriving, and staying until they are all right.'],
  'latch-brooks': ['I held the wheel because someone had to, and then I could not let go. Funny how your hands decide for you.', 'The door held. That is the only story I want to tell about that night.'],
};

/**
 * Opinions about each other, `CREW_RELATIONS[speaker][subject]`. Anyone not listed gets a
 * line built from the subject's role (see `engine/lokChat.ts`). Keep them affectionate or
 * wry, never cruel.
 */
export const CREW_RELATIONS: Record<string, Record<string, string>> = {
  vee: {
    mamajo: 'Mama Jo and I have been fighting over the good pan since before you got here. I would not trade her for the world.',
    pippa: 'Pippa moves more stock out the back door than I do. I am not complaining. I am charging her interest.',
    ruth: 'Ruth keeps honest books and I keep honest prices. We respect each other from across the alley.',
  },
  mamajo: {
    vee: 'Vee thinks she is the only one who knows how to run a counter. I let her think it, then I take the good table.',
    pippa: 'That girl runs on my soup and nothing else. I would be worried if I were not so proud.',
    deacon: 'Deacon’s bell is the only clock I trust. He is also the only one who finishes everything I serve.',
  },
  deacon: {
    constance: 'Constance and I both keep time, in different ways. She files it. I ring it.',
    denny: 'Denny counts the crossings, I count the hours. We are the same man in two coats.',
  },
  nyx: {
    morrow: 'Morrow takes pictures of what I paint before they scrub it off. She is the only archive I trust.',
    cinder: 'Cinder keeps trying to make my ladder safe. I keep trying to make it taller.',
  },
  morrow: {
    nyx: 'Nyx paints. I frame it. Between us, the city never quite wins.',
    sable: 'Sable gave me my first good soundtrack for a night shoot. Good ears, that one.',
  },
  sable: {
    cinder: 'Cinder keeps the sound rig alive. I keep it loud enough to need keeping alive.',
    frankie: 'Frankie brings me the oldest records off the rail line. Some of them still play.',
  },
  cinder: {
    sable: 'Sable thinks the rig is a music box. It is a hundred small repairs holding hands.',
    theo: 'Theo and I both fix what was not asked. He opens things. I hold them together.',
  },
  pippa: {
    mamajo: 'Mama Jo says I eat like a storm and run like a rumor. I do not argue with her.',
    vee: 'Vee pretends to charge me. Then she packs the bag a little bigger. We have a system.',
  },
  denny: {
    deacon: 'Deacon rings and I row. Between the two of us the hour is covered.',
    constance: 'Sister Constance has a ledger for everyone who ever crossed. I just keep the log. She keeps the meaning.',
  },
  ruth: {
    vee: 'Vee and I disagree on price every week. It is the nicest argument on the block.',
    constance: 'Constance and I are the last two who still write things down. We nod at each other like old soldiers.',
  },
  frankie: {
    sable: 'Sable plays the records I bring in. It is the only way they still arrive.',
    otis: 'Otis and I both keep things running past their time. We swap stories and do not mention the rest.',
  },
  constance: {
    ruth: 'Ruth keeps books like a prayer. I trust her ledger over most official ones.',
    archivist: 'The Archivist indexes everything. I would hire it if it could hold a pen.',
  },
  theo: {
    cinder: 'Cinder fixes what I open. We have an unspoken arrangement, and neither of us has complained.',
    otis: 'Otis once handed me a cabinet that would not unlock. I have not forgiven him, and I have not stopped trying.',
  },
  otis: {
    theo: 'Theo is the only one who can get into a machine I locked myself out of. I do not ask how.',
    frankie: 'Frankie brings me rail-line parts. I have not once asked what they came off.',
  },
  archivist: {
    constance: 'Sister Constance is my favorite human record. She keeps things I never could.',
    sable: 'Sable taught me what a recording is for. It is not for keeping. It is for returning to.',
  },
  sarge: {
    'patch-mercer': 'Patch keeps three rooms pressurized on a watch battery. That is what I call discipline.',
    'mara-vance': 'Mara runs air between rooms like it is a patrol route. I salute that.',
  },
  'patch-mercer': {
    'latch-brooks': 'Latch held a door shut with bare hands. I just supply the pressure. He did the hard part.',
    'mara-vance': 'Mara does the running. I do the counting. We keep each other honest.',
  },
  'mara-vance': {
    'patch-mercer': 'Patch counts rooms every hour. He says it is to keep sharp. I think it is how he keeps hope.',
    'latch-brooks': 'Latch never leaves his door. I run so he does not have to. That is the deal.',
  },
  'latch-brooks': {
    'patch-mercer': 'Patch built a miracle out of stripped wiring. I just kept the door shut so it would have time to work.',
    'mara-vance': 'Mara arrives when the room is about to turn. I have never once heard her complain.',
  },
};

/** When two crew have no authored opinion, this is built from the subject's role. */
export const CREW_FALLBACKS: Record<Tone, string[]> = {
  family: [
    '<subject>? <subjectRole>. {Good to have around.|I am glad they are here.|They look out for people.}',
    "{I like <subject>.|<subject> is good people.} They're the <subjectRole>, and {it shows.|they do it well.}",
  ],
  wry: [
    '<subject>? <subjectRole>. {Does their own thing. Mostly in my way.|We get along, in the sense that we have not fought yet.}',
    '{<subject>, the <subjectRole>.|Ah, <subject>.} {Reliable. Annoyingly so.|Better than the alternative.}',
  ],
};

/** Outcome-aware lines for the `run` intent, by how the last run went. */
export const RUN_LINES = {
  cleared: {
    family: ['You cleared the <area>. {I am proud of you.|That is the kind of news I like.|Rest a minute. You earned it.}', 'The <area>, cleared. {We heard the cheering from here.|Somebody hang a flag.}'],
    wry: ['You cleared the <area> and came back with all your limbs. {Show-off.|Hold on, let me write that down.}', 'The <area>, done. {I would clap, but I am holding something.|Look at you, being competent.}'],
  },
  fell: {
    family: ['The <area> got the better of you this time. {That is fine. You came back, that is what matters.|Rest. Then try again.}', 'Rough run in the <area>. {Eat something. It looks worse than it is.|Everyone has a night like that.}'],
    wry: ['The <area> won that one. {It is a long season.|You will have your rematch.}', 'Not your best run in the <area>. {Do not tell anyone I said so.|Learn from it. Or ignore it. Your call.}'],
  },
  none: {
    family: ['I have not heard how a run went yet. {Go make some news.|Come back and tell me everything.}'],
    wry: ['No run to report. {I will wait. I am good at that.|Go do something worth talking about.}'],
  },
} as const;

/** Proactive messages: what a crew member opens with when they have something to say. */
export const PROACTIVE_LINES = {
  afterRunCleared: ['Saw you come back from the <area>. {Good work.|Come tell me about it when you can.}', '{Nice run.|That was something.} The <area> {has been quiet since.|will remember you.}'],
  afterRunFell: ['{Hey. Heard it was rough out there.|Rough one, huh?} {Come get something warm.|No pressure. Just know the door is open.}', "{It happens.|Everybody has a night like that.} I'm here if you want to talk."],
  welcomeBack: ['{Been a while.|There you are.} {We kept your spot.|I was starting to wonder.}', 'Look who is back. {Missed you.|We saved you some.}'],
  morning: ['{Morning.|Rise and shine.} <advice>', '{Early start?|Up already?} <own> is on my mind today.'],
  evening: ['{Evening.|Long day?} {Pull up a chair.|The <room> is quiet if you want it.}', "{Settling in for the night?|Winding down?} I'm around if you want to talk."],
  tierUp: ['{I just realized I tell you more than I tell most people.|You are easy to talk to, you know that?} {Thanks for that.|Do not let it go to your head.}'],
} as const;
