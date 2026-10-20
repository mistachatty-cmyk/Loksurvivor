/**
 * Conversation content for LOK Chat's deeper layer (`engine/lokChat.ts`): topics that go
 * several layers deep, questions the crew ask back, and in-voice reactions to how you feel.
 * Same rules as `lokChatData.ts`: kid-safe, no profanity, never the banned naming word
 * (use beacon, pulse, relay, static or frequency), and `lokChat.test.ts` scans every
 * string here. Template syntax is the crew-talk expander's: {a|b} random branch and
 * <slot> pool fill (name, role, room, weather, crew, pet, area, time, mood, advice, food,
 * hazard, place, sound, thing, own, hook, lastTopic). Write plain text otherwise: no angle
 * brackets, braces or bars outside that syntax.
 *
 * A topic has layers. Layer 1 is what anyone gets; layer 2 opens at "friend" and layer 3
 * at "close", so closeness changes what is said, not only how warmly. A topic with a single
 * layer is a reaction (a compliment, an apology): it answers once and sets nothing.
 */

export interface TopicDef {
  key: string;
  /** How it reads in "Want to hear about <label>?". Empty for reactions. */
  label: string;
  pattern: RegExp;
  layers: string[][];
}

export const MORE_OFFERS = ['{Want me to go on?|Should I keep going?|Do you want the rest?}'];
export const TOPIC_DEFLECTIONS = [
  'There is more to that story. Ask me again once we know each other better.',
  'I could say more. Not yet. Keep stopping by and I might.',
  'That one has another chapter. It is for people I have known a while.',
];
export const TOPIC_EXHAUSTED = [
  'That is about all I have on that one. {For now.|Ask me something else.}',
  'I have told you the whole of it. {Your turn to surprise me.|Pick another.}',
];
export const NO_TOPIC = [
  'More of what? {Ask me something and I will go deeper.|Pick a thing and I will keep going.}',
  'Go on with what? {Give me a thread to pull.|Ask about something and I will stay with it.}',
];
export const HOOKS = [
  '{Want to hear about <hook>?|I could tell you about <hook>, if you like.|Ask me about <hook> sometime.}',
  '{We could talk about <hook>.|Or ask me about <hook>.}',
];
export const NO_THANKS = ['{Fair enough.|No problem.|All right.}', '{Another time, then.|That is fine.}'];
export const TAKE_YOUR_TIME = ['{Take your time.|No rush.|Think on it.}'];
export const LAST_RUN_CALLBACKS = [
  'Last I heard you were in the <area>. Is it still on your mind?',
  'I keep thinking about the <area>. How is that sitting with you?',
];
export const LAST_TOPIC_CALLBACKS = [
  'I was still thinking about <lastTopic>, after we talked.',
  'Funny, <lastTopic> came back to me today. Anyway.',
];

/** Short in-voice reactions to a feeling the player states. A hook is added after. */
export const FEELING_LINES = {
  sad: ['I am sorry it is a rough one. You do not have to explain it. I will sit here.', 'That sounds heavy. Put it down here a minute and I will watch it.', 'Hard days happen. You are allowed to have one.'],
  tired: ['Then rest. I mean it. The street will still be there.', 'Tired is your body being honest. Listen to it for once.', 'Sit. Drink something. Nothing needs you for ten minutes.'],
  happy: ['Now that is the best thing I have heard all day.', 'Good. Hold onto it, and tell somebody else too.', 'I am glad. It suits you.'],
  scared: ['Being scared means you understand the stakes. It does not mean you cannot do it.', 'Okay. Breathe. Forty slow steps and it gets smaller.', 'I am right here. Scared is allowed.'],
  bored: ['Bored is a luxury, remember. I will take it any day.', 'Then go find a little trouble. Politely.', 'Walk the hideout. Somebody always has something half finished.'],
  angry: ['Go on, be angry. It means something matters to you.', 'Let it out here, not out there. I can take it.', 'Anger is a worry that put on boots. Tell me what it is about, if you want.'],
  lonely: ['You are not alone in here. I mean it. Come sit.', 'Lonely is a bad guest. Let us crowd it out with company.', 'I am right here, and so is everybody else down the hall.'],
  excited: ['That energy is contagious. Tell me everything.', 'Good! Save some of it for the run.', 'Excitement looks good on you.'],
} as const;

export const SMALLTALK_LINES = {
  laugh: ['Ha. Good.', 'I will take that laugh as a review.', 'Glad that landed.'],
  ack: ['Mm.', 'Right.', 'Fair enough.', 'Yeah.'],
  statement: ['{I hear you.|Noted.|Okay.|Mm, I follow.}', '{That is something.|I will think about that.}'],
  question: [
    '{Honest answer: I do not know.|Good question. I do not have an answer for it.}',
    '{That one is beyond me.|I wish I knew.} {But I like that you asked.|Ask me something closer to home.}',
  ],
} as const;

/** Questions the crew ask back, and how they take each kind of answer. */
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

export const QUESTIONS: QuestionDef[] = [
  {
    id: 'ate', ask: '{By the way,|Quick thing.} Did you eat today? Honestly.',
    yes: ['Good. That is half the battle.', 'Good. Keep that up.'],
    no: ['Then that is the first thing you do. Go. I will wait.', 'Eat. Then come back and tell me I was right.'],
    unsure: ['That means no. Go eat something.'],
    other: ['Hm. I will take that as a sort of. Eat anyway.'],
  },
  {
    id: 'sleep', ask: 'Are you sleeping okay lately?',
    yes: ['Good. Hang on to that.', 'Lucky you. Do not tell anyone, they will get jealous.'],
    no: ['Try something warm and something boring to listen to. It helps.', 'Then rest first, run later. I mean it.'],
    unsure: ['In pieces, then. That counts, a little.'],
    other: ['Mm. Rest when you can. That is all anyone gets.'],
  },
  {
    id: 'fun', ask: 'Do you actually enjoy the runs, or is it just duty?',
    yes: ['Good. Enjoying it keeps you sharp.', 'Well, do not tell anyone I said it, but I love hearing that.'],
    no: ['Then take a day. The street can wait one afternoon.', 'That is fair. Duty is heavy. Set it down for an hour.'],
    unsure: ['Both, probably. Most good things are.'],
    other: ['I will think about that. Thank you for being honest.'],
  },
  {
    id: 'company', ask: 'Do you like it here with us?',
    yes: ['That is the best thing you could have said.', 'Then we are doing something right.'],
    no: ['Tell me what to change. I mean it.', 'Fair. It is not perfect. Tell me what would make it better.'],
    unsure: ['That is honest. It takes time. Keep stopping by.'],
    other: ['Thank you for saying so. Really.'],
  },
  {
    id: 'better', ask: 'Did anything go right for you today?',
    yes: ['Good. Hold onto it.', 'Then today was a good one. Remember it when tomorrow is not.'],
    no: ['Then let me be the thing that goes right. Sit a minute.', 'Tomorrow, then. I will save you a seat.'],
    unsure: ['Small wins count. Think again. I bet there was one.'],
    other: ['I am glad you told me. Go easy on yourself.'],
  },
  {
    id: 'plan', ask: 'Have you got a plan for the next run, or are we winging it?',
    yes: ['Good. A plan beats luck. Most days.', 'Tell me how it goes. I like those stories.'],
    no: ['Winging it has worked before. Eat first.', 'Then pick one thing to do well. Just one.'],
    unsure: ['Pick the first corner and the rest will show itself.'],
    other: ['All right. Whatever it is, come back and tell me.'],
  },
  {
    id: 'scariest', free: true, ask: 'What is the scariest thing you have come across out there?',
    yes: [], no: [], unsure: [],
    other: ['I hear you. Thank you for telling me. It stays between us.', 'That would have got me too. You are still here, and that says something.', 'Hm. I will think about that. Come sit if it follows you home.'],
  },
  {
    id: 'missing', free: true, ask: 'What do you miss most from before?',
    yes: [], no: [], unsure: [],
    other: ['That is a good one to carry. I hope we find a way to bring a little of it back.', 'I understand that more than you know.', 'Thank you. I will keep that in mind.'],
  },
];

/* ------------------------------------------------------------------ */
/* Topics everyone can talk about                                      */
/* ------------------------------------------------------------------ */

export const SHARED_TOPICS: TopicDef[] = [
  {
    key: 'city', label: 'the city', pattern: /\b(city|616|grand rapids|town|streets?|neighbou?rhood|downtown|river|home ?town)\b/,
    layers: [
      ['616 is not what it was, but the bones are good. The river still runs where it always ran.', 'Some blocks I know by heart, some I have never seen at night. <place> is where I would start.'],
      ['I remember when every window on this street was lit. I do not say that to be sad. I say it so you know what we are fixing.', 'People talk about the city like it left. It did not leave. It is sitting very still, waiting to see who stays.'],
      ['If the lights come all the way back, I want to be standing on a corner when it happens. That is my whole plan.', 'I stayed because leaving felt like agreeing with whatever did this. I would rather be stubborn.'],
    ],
  },
  {
    key: 'food', label: 'food', pattern: /\b(food|eat|eating|hungry|dinner|lunch|breakfast|cook|cooking|recipe|snack|meal|soup|pizza|coffee)\b/,
    layers: [
      ['I try to eat something hot every day. It sounds small. It is not small.', '<food> is about my speed today. Simple, warm, and no questions.'],
      ['The best meal I ever had was an ordinary one, at a table that was full. I think about the table more than the meal.', 'When things are bad I eat slowly. It makes the bad part take up less of the day.'],
      ['If you come back from a run and nobody asks whether you ate, something is wrong with a place. Here, somebody asks. Keep it that way.', 'I save you a plate sometimes and tell nobody. Now you know.'],
    ],
  },
  {
    key: 'music', label: 'music', pattern: /\b(music|songs?|sing|singing|band|playlist|radio|dance|dancing|guitar|drums?|beat|tune)\b/,
    layers: [
      ['I like anything with a steady beat. It keeps my feet honest.', 'Somebody down the hall hums the same four notes all day. I have started humming them back.'],
      ['A song can hold a whole afternoon in it. I know one that is nothing but a Tuesday in the summer, and I would not trade it.', 'I never learned to play. I learned to listen, which is the same job from the other side.'],
      ['When it is quiet I put on the song I am sure nobody else knows. Then someone walks in humming it. That is the best feeling I have.', 'If there is ever a night when the whole hideout sings something together, I want to be there. I think about it more than I admit.'],
    ],
  },
  {
    key: 'fear', label: 'being afraid', pattern: /\b(scared of|afraid of|fears?|frightened|nightmares?|the dark|dark|monsters?|spooky|creepy|brave|courage)\b/,
    layers: [
      ['Everybody is scared of something. The trick is to be scared and go anyway, a little at a time.', 'I do not like the long dark corridors. I walk them anyway. That is all courage is, as far as I can tell.'],
      ['I count my steps when I am afraid. Forty steps and it is usually over. It is a silly trick and it works.', 'The things that scare me are never the loud ones. It is the quiet where something should be making noise.'],
      ['I am scared of being the reason someone does not come back. I carry that every day. It makes me careful, and I decided careful is enough.', 'You are brave, you know. Not because you are not scared. Because you keep walking out of that door.'],
    ],
  },
  {
    key: 'enemies', label: 'those things outside', pattern: /\b(enem(y|ies)|creatures?|horde|zombies?|those things|what are they|where do they come from|attackers?|bosses|boss)\b/,
    layers: [
      ['I have watched them from the window long enough to learn their rhythm. They get loud right before they turn the corner.', 'They do not tire the way we do. So we have to be smarter than tired.'],
      ['The ones that unsettle me most look almost like someone I knew. I do not say it out loud in front of everyone.', 'Every pack has a pattern. Find the pattern and you have a chance. Ignore it and you have a bruise.'],
      ['I do not hate them. I just refuse to let them have the street. Those feel like different things to me.', 'If it ever ends, I want to understand what they were. Not forgive. Understand.'],
    ],
  },
  {
    key: 'gear', label: 'gear', pattern: /\b(weapons?|gear|equipment|tools|upgrades?|build|loadout|bat|knife|shield|armou?r)\b/,
    layers: [
      ['Take what fits your hands. A fancy tool you cannot hold steady is worse than a plain one you can.', 'Check your gear before you go, not after. After is when it matters least.'],
      ['Best advice I ever got about gear: carry one thing you trust completely. Everything else is a bonus.', 'I watch how you move, not just what you carry. Lean into what you are already good at.'],
      ['Honestly, the best gear you have is the people who wait for you. Do not leave them behind to save a few seconds.', 'When you think you have it all figured out, ask me again. I will tell you what I would change.'],
    ],
  },
  {
    key: 'sleep', label: 'sleep', pattern: /\b(sleep|sleeping|sleepy|bed|dreams?|nap|awake|insomnia|rest)\b/,
    layers: [
      ['Sleep when you can, in short pieces if you have to. The body forgives you for it.', 'I keep my boots by the bed, in case. I still sleep better with them there.'],
      ['I dream about ordinary things. A bus stop. A bakery. I wake up wanting a bus stop. Strange thing to miss.', 'Some nights I do not sleep. I just stay quiet and keep the room company. It counts as rest if you decide it does.'],
      ['On the nights you are out there, I do not sleep until I hear the door. I never told you that.', 'When all this is over I am going to sleep for a week. Then I am going to find a bus stop.'],
    ],
  },
  {
    key: 'friends', label: 'friends and family', pattern: /\b(friends?|friendship|family|miss (someone|them|you)|love|care about|trust|together)\b/,
    layers: [
      ['Friends are the people who notice when you are late. I notice when you are late.', 'Family is whoever is at the table. It does not have to be who you started with.'],
      ['I lost people. I am still learning how to let new ones in without bracing for it.', 'Trust is a lot of small boring things done on time. That is all it is. Nobody tells you.'],
      ['You are one of the ones I would turn around for. I do not say that lightly, and I will not say it twice.', 'If I had to name my people, you would be on the short list. There. I said it. Moving on.'],
    ],
  },
  {
    key: 'dreams', label: 'what comes next', pattern: /\b(future|plans?|someday|when this is over|hopes?|wish|goals?|want to be|after all this)\b/,
    layers: [
      ['Someday I want a long, boring week. Nothing happening. I would pay for that.', 'My plan is simple: be here tomorrow. Then do it again.'],
      ['I would like to build something that lasts longer than I do. A room, a rule, a habit. Something.', 'Hope is not a feeling for me. It is a chore I do every morning, and it works anyway.'],
      ['I picture a day when you walk in and I have nothing important to say, and that is the best thing that could happen.', 'If the city comes back, I want to be the one who unlocks the first door. That is all.'],
    ],
  },
  {
    key: 'past', label: 'how things were', pattern: /\b(before all this|before the lights|your past|where are you from|your life before|used to|back then|childhood|grew up|backstory|your story)\b/,
    layers: [
      ['I had an ordinary life once. Mornings, errands, a favorite chair. It seems very far away and very close.', 'I am from around here, like most of us. I knew these streets before they went quiet.'],
      ['There is a version of me who never had to learn any of this. I do not envy that one. I just wave sometimes.', 'The thing I miss most is how loud ordinary days were. Nobody noticed. I would notice now.'],
      ['I do not talk about it much because I am afraid it will get smaller if I say it out loud. With you, I think it might get bigger. That is a nice surprise.', 'If I could show you one day from before, it would be a Saturday. Nothing special. That is why.'],
    ],
  },
  /* Reactions: one layer, answered once, nothing carries over. */
  {
    key: 'real', label: '', pattern: /\b(are you real|are you human|are you a bot|are you an? ai|are you a robot|who made you|who programmed you|are you alive)\b/,
    layers: [['I am as real as this conversation. You talk, I answer, and I am glad of it.', 'Real enough to be glad you asked. Real enough to worry about you.']],
  },
  {
    key: 'compliment', label: '', pattern: /\b(you are (great|awesome|amazing|the best|cool|kind|funny|nice|wonderful)|you'?re (great|awesome|amazing|the best|cool|kind|funny|nice|wonderful)|i like you|i love you|good job|nice work|well done|you rock)\b/,
    layers: [['That is kind of you. I am going to be insufferable for an hour.', 'Careful, I might get used to that.', 'Thank you. I needed that more than I let on.']],
  },
  {
    key: 'tease', label: '', pattern: /\b(you suck|you are bad|you'?re bad|you are boring|you'?re boring|shut up|stupid|dumb|ugly|useless|annoying)\b/,
    layers: [['Ouch. I will pretend that was affection.', 'Noted. I will be hurt about it later, in private.', 'Bold. I respect bold. Try a kinder one tomorrow.']],
  },
  {
    key: 'sorry', label: '', pattern: /\b(sorry|my bad|forgive me|apologi[sz]e)\b/,
    layers: [['No need. We are fine.', 'Already forgotten. Come here, sit down.', 'Apology accepted, and also unnecessary.']],
  },
  {
    key: 'favourite', label: '', pattern: /\b(favou?rite|favorite)\b/,
    layers: [['My favorite changes by the day. Right now it is <thing> and a quiet hour.', 'Ask me tomorrow. Today it is <food>, and I am not budging.']],
  },
  {
    key: 'hobby', label: '', pattern: /\b(hobbies|hobby|for fun|free time|what do you like)\b/,
    layers: [['For fun? Mostly thinking about <own>. It is not a hobby if it keeps people going, but it is close.', 'Free time is rare. When I get some I like a long look out of the window and a cup of something hot.']],
  },
];

/* ------------------------------------------------------------------ */
/* Topics that belong to one person                                    */
/* ------------------------------------------------------------------ */

export const ALLY_TOPICS: Record<string, TopicDef[]> = {
  vee: [
    {
      key: 'shop', label: 'the shop', pattern: /\b(shop|store|counter|till|stock|customers?|prices?|business|sell|selling)\b/,
      layers: [
        ['The shop runs on three rules. Fair prices, a clean counter, and a light in the window. Break one and the others fall over.', 'Every item on that shelf has a story. Half of them are true.'],
        ['I opened up because somebody had to, and then it became the reason I got up. A light on is a promise to the street.', 'I know every regular by their footsteps. The ones who stopped coming, I still listen for.'],
        ['I price things low on purpose when I know someone is struggling. Do not tell the others. They think I am just bad at math.', 'The day somebody walks in and does not need anything, only wants to see a lit room, that is the day I know the shop did its job.'],
      ],
    },
    {
      key: 'alleys', label: 'the back alleys', pattern: /\b(alley|alleys|shortcut|shortcuts|back streets|back door)\b/,
      layers: [
        ['The alley by <place> connects to three others. I could draw the whole network from memory.', 'Shortcuts are just roads nobody was proud of. They still get you home.'],
        ['I learned the alleys the hard way, by running through them with a bag I should not have had. I am better at the quiet routes now.', 'There is an alley behind the shop that is the safest place in the district. I will show you someday.'],
        ['If you ever need to vanish for a night, the back door of the shop is unlocked. Never use the front. Tell no one I said so.', 'I know the alleys the way some people know a song. If you ever get lost, hum and I will find you.'],
      ],
    },
  ],
  deacon: [
    {
      key: 'bell', label: 'the bell', pattern: /\b(bell|chime|chimes|ringing|clock|hour|hours|time)\b/,
      layers: [
        ['One chime, rest. Two, move. Three, run. It is the whole system and it has never let anyone down.', 'The bell does not care who is listening. That is the point of a bell.'],
        ['I started ringing because silence got too loud. Now it is the only clock I trust, and nobody can tell me the hour is wrong.', 'Some mornings I ring it a little early. Nobody has complained. I think they like the company.'],
        ['I used to think the bell was for warning people. Lately I think it is for reminding them someone is still keeping time.', 'If I ever stop ringing, check on me first and the bell second. In that order.'],
      ],
    },
  ],
  nyx: [
    {
      key: 'walls', label: 'the walls', pattern: /\b(paint|painting|walls?|graffiti|art|mural|rooftop|spray|colou?rs?)\b/,
      layers: [
        ['Nobody looks up. That is the whole secret to art. Put it where people forget to look and they find it by accident.', 'The city buffs my color every week and I put it back. We have a relationship.'],
        ['I pick colors by what the block is missing. Gray blocks get orange. Loud blocks get a single blue line. It is not complicated, it is just kind.', 'The best wall I ever did lasted one night. I still count that as a win.'],
        ['I would like one wall that stays. Not for the credit. So that someone, someday, sees it and thinks someone else was here and cared.', 'I painted your name on a roof once, small, in the corner. Do not go looking. Okay, go looking.'],
      ],
    },
  ],
  mamajo: [
    {
      key: 'kitchen', label: 'the kitchen', pattern: /\b(pan|kitchen|stew|cast iron|recipes?|salt|oven|stove)\b/,
      layers: [
        ['The secret is salt and patience, and patience is the expensive one.', 'That cast iron pan has outlived three kitchens and one very rude visitor.'],
        ['I learned to cook from someone who never measured anything. Her hands knew. Now mine do too, and they will not explain it either.', 'Everybody gets a bowl, no questions. Questions are for after the soup.'],
        ['I cook for forty because I am hoping forty will come. So far it is working. Do not tell the pan.', 'When you are away I set a place anyway. Do not make a fuss about it. Just come home hungry.'],
      ],
    },
  ],
  cinder: [
    {
      key: 'fixing', label: 'fixing things', pattern: /\b(fix|fixing|repair|repairs|broken|tape|wrench|pipes?|motor|engine|tinker\w*)\b/,
      layers: [
        ['A seized motor is just a barricade that has not found its purpose yet. Give me ten minutes and some tape.', 'Everything in here can be fixed. Just not by <crew>.'],
        ['I do not fix things because they are broken. I fix them because someone told me once that nothing was worth fixing.', 'The trick is to listen. A machine tells you exactly where it hurts if you stop talking.'],
        ['There is a radio in the corner that has never worked. I keep it because I want to be there the day it does.', 'Some things are not mine to fix. People are not machines. I still stand next to them with a wrench, just in case.'],
      ],
    },
  ],
  pippa: [
    {
      key: 'deliveries', label: 'the routes', pattern: /\b(deliver\w*|packages?|routes?|courier|errands?|kitchen windows?)\b/,
      layers: [
        ['Fastest way is never the straight one. I know six ways to cross the district and four of them involve a fence.', 'I can tell what is for dinner on every block by smell. It is not a skill, it is a hobby.'],
        ['Every route has a rhythm. Learn it and you are not running, you are dancing with a very rude city.', 'I take the long way home on purpose some nights. Home is nicer when you have earned it.'],
        ['I run because stopping is when I think. With you around I stop more. That is not a complaint. It is the first time I have noticed.', 'If you ever need something carried across the district in a hurry, I will do it before you finish asking.'],
      ],
    },
  ],
  archivist: [
    {
      key: 'records', label: 'the records', pattern: /\b(records?|archives?|logs?|index|indexing|memory|memories|remember)\b/,
      layers: [
        ['I index everything. It is how I know where a thing is, and how I know it happened at all.', 'There are eleven thousand entries so far. Four of them are about you. I hope that is acceptable.'],
        ['A record is proof that something was here. I did not know why that mattered until someone read mine.', 'I keep a gap in the index for things I do not understand yet. It is getting larger. I find it interesting rather than worrying.'],
        ['I have an entry I do not file. It is only a list of times someone said thank you. I read it when the index feels very long.', 'I would like to be remembered the way a good record is: accurately, and by someone who wanted to look.'],
      ],
    },
  ],
  sable: [
    {
      key: 'sound', label: 'the sound system', pattern: /\b(vinyl|booth|mix|sound system|speakers?|volume|turntable|loud)\b/,
      layers: [
        ['I turn the sound up when it is too quiet, not when it is too loud. Quiet is where I get worried.', 'The best mix is the one where you forget there was a mix. It just feels like the room breathing.'],
        ['I filed records nobody would ever play. It felt like keeping someone company who did not know it.', 'A good speaker is honest. It will not make a bad song good. It will make a good one feel true.'],
        ['There is a record in the booth I have never played. I am saving it for the night the whole place needs it. I will know.', 'If you ever want to hear something, tell me the mood and not the song. I will find it.'],
      ],
    },
  ],
  morrow: [
    {
      key: 'photos', label: 'photographs', pattern: /\b(photos?|photograph\w*|camera|film|lens|doors?|exposure|pictures?)\b/,
      layers: [
        ['Long exposures show what the city forgot to hide. People, mostly. Always people.', 'I photograph doors. A door is a promise that somebody planned for you.'],
        ['The best picture I ever took was an accident. A blur of someone running past a lit window. I keep it above my bed.', 'Light does most of the work. My job is to be there and not blink at the wrong time.'],
        ['I have taken one picture of you. It is not posed. It is the one where you do not know I am looking. You look like someone who is going to be fine.', 'Someday I want to print them all and hang them where everyone can walk through. A hallway of proof.'],
      ],
    },
  ],
  denny: [
    {
      key: 'river', label: 'the river', pattern: /\b(river|boat|boats|crossing|crossings|rowing|oars?|current|water|dock)\b/,
      layers: [
        ['The current is not the danger. The danger is deciding to stop crossing.', 'I keep a log of who crossed. It is short. I like it short, it means people are staying put.'],
        ['I row slowly on purpose. The slow ones always arrive and the fast ones always have a story about why they did not.', 'The river sounds different at night. It sounds like it is thinking. I leave it alone and let it.'],
        ['There are lines in my log I left blank for the ones who did not come back. I check them sometimes. In case.', 'If you ever need to get across and nobody will take you, ring the dock bell once. I will come.'],
      ],
    },
  ],
};
