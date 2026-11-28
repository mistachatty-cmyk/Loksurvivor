/**
 * Crew-to-crew scenes for LOK Chat's `#hideout` channel, plus the moods and "remember when" lines.
 * Same rules as the rest of the chat content (kid-safe, no profanity, never the banned naming word,
 * `{a|b}` and `<slot>` syntax; slots here: a, b, c = who is speaking, weather, area, time, ref).
 * Avoid pronouns for people: the crew's pronouns are not fixed, so address them by name. `validateCast`
 * and `lokChat.test.ts` scan every string. Pair scenes are `between: [a, b]` (a speaks first).
 */
import type { ChatEventKind, MoodId, SceneDef } from '@lok/chat';

const s = (id: string, between: [string, string] | undefined, lines: Array<['a' | 'b' | 'c', string]>, when?: SceneDef['when']): SceneDef => ({
  id,
  ...(between ? { between } : {}),
  ...(when ? { when } : {}),
  lines: lines.map(([who, text]) => ({ who, text })),
});

export const CREW_SCENES: SceneDef[] = [
  /* Pairs */
  s('pair:good-pan', ['vee', 'mamajo'], [['a', 'Mama Jo, I will trade you two cans of peaches for the good pan.'], ['b', 'Vee, that pan has seen things. You could not afford its stories.'], ['a', 'Three cans.'], ['b', 'Sit down and eat first.']]),
  s('pair:ladder', ['nyx', 'cinder'], [['a', 'Cinder, I added two more rungs to the ladder.'], ['b', 'Of course you did. I put a rail on it.'], ['a', 'Rails are for people who plan to fall.'], ['b', 'Rails are for people who plan to keep painting.']]),
  s('pair:hours', ['deacon', 'denny'], [['a', 'Denny, the bell says it is time to cross.'], ['b', 'The river says ten more minutes.'], ['a', 'Then I will ring it twice.'], ['b', 'Ring it three times and I will row faster.']]),
  s('pair:soundtrack', ['sable', 'morrow'], [['a', 'Morrow, I found a song for your night shoot.'], ['b', 'Is it quiet?'], ['a', 'It is quiet that hums.'], ['b', 'That is the best kind.']]),
  s('pair:soup', ['pippa', 'mamajo'], [['a', 'Mama Jo, is there any soup left?'], ['b', 'For you there is always soup, and a bowl for the way back.'], ['a', 'You are the best.'], ['b', 'Run slower and I will believe it.']]),
  s('pair:prices', ['ruth', 'vee'], [['a', 'Vee, you undercut me on the apples again.'], ['b', 'They were bruised, Ruth. I was being honest.'], ['a', 'You were being cheap.'], ['b', 'Honest and cheap are cousins.']]),
  s('pair:humming', ['frankie', 'otis'], [['a', 'Otis, did that cabinet hum again last night?'], ['b', 'Every night. It sounds like your northline.'], ['a', 'Then it is a train in a box.'], ['b', 'Do not say that where the cabinet can hear.']]),
  s('pair:filing', ['constance', 'archivist'], [['a', 'Archivist, I filed your last note under welcome.'], ['b', 'Thank you. I have indexed the filing. It is a good filing.'], ['a', 'High praise.'], ['b', 'I have no other kind.']]),
  s('pair:stuck-door', ['theo', 'otis'], [['a', 'Otis, the cabinet door is stuck again.'], ['b', 'It is not stuck. It is thinking.'], ['a', 'I will introduce myself.'], ['b', 'Be polite.']]),
  s('pair:status', ['sarge', 'patch-mercer'], [['a', 'Patch, status.'], ['b', 'Three rooms, one watch battery.'], ['a', 'Good. Carry on.'], ['b', 'Yes, Sarge. Mind the wiring.']]),
  s('pair:through', ['mara-vance', 'latch-brooks'], [['a', 'Latch, I am coming through.'], ['b', 'Door is open.'], ['a', 'Thank you.'], ['b', 'Close it behind you, Mara.'], ['a', 'I always do.']]),
  s('pair:diplomacy', ['bulbosa', 'vee'], [['a', 'Vee, the foam respects a fair price.'], ['b', 'Then tell it to respect the till.'], ['a', 'I shall negotiate on its behalf.'], ['b', 'Bring snacks.']]),
  s('pair:ledger', ['denny', 'constance'], [['a', 'Sister, I have an entry for your ledger. Someone crossed safe.'], ['b', 'Then it is filed under good news. Thank you, Denny.']]),
  s('pair:archive', ['nyx', 'morrow'], [['a', 'Morrow, can you photograph the new wall before they scrub it?'], ['b', 'Already did. I was on the fire escape at dawn.'], ['a', 'You are an archive.'], ['b', 'A sleepy one.']]),
  s('pair:tape', ['cinder', 'patch-mercer'], [['a', 'Patch, how much tape is left?'], ['b', 'Enough for a miracle and a half.'], ['a', 'That is what I like to hear.']]),
  s('pair:keys', ['theo', 'latch-brooks'], [['a', 'Latch, your brass latch is smiling at me.'], ['b', 'It does that when it likes someone.'], ['a', 'I like it too.'], ['b', 'Do not open it. It is happy as it is.']]),

  /* Anyone, by weather */
  s('any:rain', undefined, [['a', 'Do you hear the rain on the roof, <b>?'], ['b', 'It is a good sound. It makes the whole place feel kept.'], ['a', 'Tea?'], ['b', 'Always.']], { weather: ['rain'] }),
  s('any:snow', undefined, [['a', 'It is <weather> out, <b>.'], ['b', 'Everything is quieter. I like it.'], ['a', 'Wear a scarf.'], ['b', 'Yes, <a>.']], { weather: ['snow'] }),
  s('any:fog', undefined, [['a', 'The fog is <weather> today, <b>.'], ['b', 'Good day to stay in and make something.'], ['a', 'I will find the kettle.']], { weather: ['fog'] }),
  s('any:heat', undefined, [['a', 'It is <weather>, <b>. Even the walls are sweating.'], ['b', 'Water first. Heroics later.'], ['a', 'Wise words.']], { weather: ['heat'] }),
  s('any:clear', undefined, [['a', 'Look at that sky, <b>.'], ['b', 'Clear all the way up. I could get used to it.'], ['a', 'Do not say that out loud. The weather listens.']], { weather: ['clear'] }),

  /* Anyone, by time of day */
  s('any:morning', undefined, [['a', 'Morning, <b>. Sleep okay?'], ['b', 'In pieces. You?'], ['a', 'Same. Something warm will fix it.'], ['b', 'Warm fixes everything it can.']], { time: ['morning'] }),
  s('any:afternoon', undefined, [['a', 'Quiet afternoon, <b>.'], ['b', 'I will take it. Quiet is underrated.'], ['a', 'Do not tell it that. It will get ideas.']], { time: ['afternoon'] }),
  s('any:evening', undefined, [['a', 'Long day, <b>?'], ['b', 'Long and good. The kind I would repeat.'], ['a', 'Sit. I saved you a seat.']], { time: ['evening'] }),
  s('any:night', undefined, [['a', 'Still up, <b>?'], ['b', 'Listening to the building settle.'], ['a', 'Same. Goodnight, whenever you get to it.']], { time: ['night'] }),

  /* Anyone, after a run */
  s('any:cleared', undefined, [['a', 'Did you hear about the <area>, <b>?'], ['b', 'Cleared. I heard the cheering from here.'], ['a', 'I am proud of them.'], ['b', 'So am I. Do not tell them. They will get big heads.']], { run: 'cleared' }),
  s('any:fell', undefined, [['a', 'The <area> was rough, <b>.'], ['b', 'It happens. We will have something warm waiting.'], ['a', 'And no questions.'], ['b', 'Not until they have eaten.']], { run: 'fell' }),

  /* Three people */
  s('any:three', undefined, [['a', '<b>, tell <c> what you told me.'], ['b', 'I said nothing.'], ['c', 'Somebody said plenty.'], ['a', 'It was warm and encouraging.'], ['b', 'It was a lot of words.']]),
];

export const SCENE_REPLIES = [
  'Ha. You would say that.',
  'That is fair, <a>.',
  'I will think about that.',
  'Careful. The walls have ears.',
  'Mm. Coming from you, I will take it.',
];

export const MOOD_WORDS: Record<MoodId, string[]> = {
  bright: ['bright', 'glad', 'full of beans'],
  steady: ['steady', 'fine', 'even'],
  tired: ['tired', 'worn out', 'a bit slow'],
  restless: ['restless', 'fidgety', 'wound up'],
  wistful: ['wistful', 'quiet', 'thoughtful'],
};

export const MOOD_OPENERS: Record<MoodId, string[]> = {
  bright: ['Good day so far.', 'I woke up in a good mood and I am not sorry.'],
  steady: ['Steady as ever.', 'Nothing to report, which is the best report.'],
  tired: ['Long night.', 'Bear with me, I am running slow today.'],
  restless: ['I cannot sit still today.', 'Pardon the fidgeting.'],
  wistful: ['Quiet kind of day.', 'I have been thinking about old times.'],
};

export const EVENT_CALLBACKS: Partial<Record<ChatEventKind, string[]>> = {
  cleared: ['I keep thinking about the <ref>. You did something good out there.', 'Word about the <ref> went round the whole hideout.'],
  fell: ['I was thinking about the <ref>. Rest up. There is always another go.', 'The <ref> is not the end of anything. Eat first.'],
  rescued: ['It still feels good that <ref> is with us.', 'Funny, I keep noticing <ref> around. I like it.'],
  pet: ['<ref> has been the talk of the place.'],
};
