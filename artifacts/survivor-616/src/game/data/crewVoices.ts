/**
 * Crew voice profiles for the procedural dialogue generator
 * (`engine/crewTalk.ts`, design note: .agents/memory/crew-dialogue-rant.md).
 *
 * Adding a voice means adding a record. Content rules: wry and grown-up is fine,
 * but nothing a child shouldn't read -- no profanity, sexual content, gore or
 * real-world politics. Never the banned naming word (see CLAUDE.md); use beacon,
 * pulse, relay, static or frequency instead. `crewTalk.test.ts` enforces it.
 * Everything marked `special` in the design note is reserved for later.
 */
import type { CrewVoice, Pools } from '@/game/engine/crewTalk';

/** Fragments any character can reach with <slot>. */
export const SHARED_POOLS: Pools = {
  food: ['soup', 'toast', 'cold noodles', 'a burnt grilled cheese', 'day-old rolls', 'hot cider', 'pickles', 'rice and beans', 'a questionable casserole', 'tea with too much sugar'],
  hazard: ['loose wire by the stairs', 'wet floor near the door', 'flickering light in the hall', 'rattling pipe', 'creaky third step', 'draft under the door', 'crate nobody labeled'],
  place: ['the river', 'the old market', 'the rail cut', 'Division Street', 'the bridge', 'the plaza', 'the corner lot', 'the north stairs'],
  sound: ['a far-off bell', 'the pipes knocking', 'somebody humming', 'the fridge groaning', 'rain on the skylight', 'a tape rewinding', 'the radio in between stations'],
  thing: ['a spare key', 'a roll of tape', 'a dented flashlight', 'a good pair of gloves', 'a deck of cards missing a card', 'a map with coffee on it', 'a mystery battery'],
  mood: ['tired', 'hopeful', 'stubborn', 'restless', 'okay, honestly', 'a little proud of everyone', 'running on spite and tea'],
  time: ['this late', 'this early', 'at this hour', 'before the lights come up', 'while it is quiet'],
  advice: ['Eat something first.', 'Watch your left side out there.', 'Do not go alone if you can help it.', 'Come back in one piece.', 'Bring back stories, not injuries.', 'Drink some water.'],
};

const v = (voice: CrewVoice): CrewVoice => voice;

export const CREW_VOICES: Record<string, CrewVoice> = {
  vee: v({
    openers: ['Hey, you.', 'Back already?', 'Come in, come in.', 'Oh good, a customer.', 'Mind the door.'],
    topics: [
      'I put <food> aside if you want it, no charge, this time.',
      'Somebody walked off with <thing> and I know exactly who.',
      'The alley by <place> connects to three others. I could draw it from memory.',
      'Stock is thin, but I can always find <thing> for a friend.',
      '<crew> owes me a favor and I am saving it for something good.',
      'Business is slow today, which is a polite way to say nobody has money.',
    ],
    closers: ['Tab is open.', 'Do not tell <crew> what I charged you.', '<advice>', 'Ask me anything, I have probably heard worse.'],
    wry: [
      'I have been open through worse. Fine, I have not, but I would say I have.',
      'Everything in here is for sale except my opinions, and those are free.',
      'You want a discount? I want a vacation. We both leave disappointed.',
      'Rule one of retail: the customer is always right. Rule two: they never are.',
    ],
    own: ['the ledger', 'a very full shelf', 'the good receipt paper', 'the cash drawer that sticks'],
  }),
  deacon: v({
    openers: ['Listen.', 'Easy now.', 'There is the hour again.', 'Welcome back.', 'You hear that?'],
    topics: [
      'I rang it a little early and nobody complained.',
      'The bell does not care who is listening. That is the point of a bell.',
      'I wired the door to be louder than me. I think I succeeded.',
      '<sound>. I have learned to count by it.',
      'Time is something you keep, not something you spend. I read that somewhere and made it my own.',
      'If you hear one chime, rest. Two, move. Three, run.',
    ],
    closers: ['Peace be with the stairs.', '<advice>', 'I will keep ringing.', 'That is a joke. Mostly.'],
    wry: [
      'I keep the hour. Nobody asked me to. That is what makes it honest work.',
      'Patience is a virtue, they say. They say it to people holding a bell rope.',
      'The door is loud on purpose. Quiet doors get people hurt and gossiped about.',
    ],
    own: ['the long rope', 'the brass', 'the third chime', 'the clapper'],
  }),
  nyx: v({
    openers: ['Yo.', 'Look up.', 'Nice timing.', 'Shh, wet paint.', 'Oh, hey.'],
    topics: [
      'I am working on something big for the skyline. <mood> about it.',
      'The city buffs my color every week and I put it back. We have a relationship.',
      'Every fire escape in the district has a spot you can see the whole place from.',
      'Paint dries slower in <place> weather. Do not touch the wall.',
      'Nobody looks up. That is the whole secret to art.',
      '<crew> says my work is "loud". I take that as a review.',
    ],
    closers: ['Do not touch it.', 'Tell me what colors you like.', '<advice>', 'Come back at sundown for the real show.'],
    wry: [
      'I do not do graffiti. I do unauthorized murals with excellent branding.',
      'Critics are just fans who forgot their paint.',
      'Heights? Sure, they are scary. So is a blank wall. I pick the one with a view.',
    ],
    own: ['the cap that never fits', 'a half-empty can', 'the tallest ledge', 'something teal'],
  }),
  sable: v({
    openers: ['Mm.', 'Hold on, this part is good.', 'Hey.', 'Pull up a crate.', 'You catch that?'],
    topics: [
      'This record has a scratch right where the chorus should be. I love it more now.',
      'I can tell the year a pressing was made by how it smells. Do not ask how.',
      '<sound> is almost in key with the hum from the amp.',
      'Down here the dust keeps the old sound alive, I swear.',
      'I rearranged the shelves again. Nobody noticed, which is fine.',
      'Put on something you used to know. It is nice to be surprised by yourself.',
    ],
    closers: ['Do not touch the needle.', '<advice>', 'Ask me for a song.', 'Volume stays low. The pipes complain.'],
    wry: [
      'I judge people by their favorite song. You are safe. Barely.',
      'Digging for crates is just archaeology with better snacks.',
      'Silence is overrated. So is most of what is on the radio.',
    ],
    own: ['the B-side', 'a warped seven-inch', 'the old amp', 'the dusty stack'],
  }),
  mamajo: v({
    openers: ['Sit.', 'Baby, you look thin.', 'Wash your hands first.', 'Good, you are here.', 'Hush and eat.'],
    topics: [
      'I made <food> and there is plenty, so do not be polite about it.',
      'That cast iron pan has outlived three kitchens and one very rude visitor.',
      'Nobody leaves this floor hungry on my watch.',
      '<crew> is not eating enough. Make sure they do. I mean it.',
      'The secret is salt and patience, and patience is the expensive one.',
      'It is <mood> out there, but a full stomach fixes half of it.',
    ],
    closers: ['Take a plate for the road.', 'Use a napkin.', '<advice>', 'Do not make me come find you.'],
    wry: [
      'I do not need a weapon. I have a pan and a disappointed look.',
      'Recipes? Those are just suggestions written by people who never fed an army.',
      'You can have seconds. You can also have my opinion. One of those costs extra.',
    ],
    own: ['the big pot', 'the cast iron', 'a pinch more salt', 'the good ladle'],
  }),
  bulbosa: v({
    openers: ['Greetings, friend.', 'Ah, you return.', 'Come, sit.', 'Pardon my dignity.', 'Good tidings.'],
    topics: [
      'In my father\'s kingdom we measured a day by how much we could forgive.',
      'The hideout is blue and pink at once. I call that a diplomatic win.',
      'A crossing is only as strong as the person who goes first.',
      '<food> is not the finest feast I have had, but it is the warmest.',
      'Bubbles are gentle until they are not. Respect the foam.',
      '<crew> tries to teach me your customs. I am a hopeless student and a happy one.',
    ],
    closers: ['I stand with you.', '<advice>', 'That is royal advice, free of charge.', 'Do not tell my cousins I said so.'],
    wry: [
      'A crown is mostly a hat with responsibilities.',
      'I have negotiated with worse than you. Fine, equal to you. You are formidable.',
      'Peace takes more courage than any battle. Also more paperwork.',
    ],
    own: ['the old crossing', 'a family seal', 'the blue side', 'the pink side'],
  }),
  morrow: v({
    openers: ['Hold still.', 'Careful, it is exposing.', 'Mm, good light.', 'You are in my frame.', 'Quiet a second.'],
    topics: [
      'Long exposures catch what the city hides. Doors, people, shortcuts.',
      'I keep a camera loaded with the last safe routes. Do not trust a fresh map.',
      'Out here, <time>, the whole district looks like it is holding its breath.',
      '<place> shows up in the negatives differently every night.',
      'The trick is to stand still longer than feels reasonable.',
      '<crew> blinked in every shot I took. It is almost impressive.',
    ],
    closers: ['I will send you a print.', '<advice>', 'Do not wave.', 'Watch the edges of the frame.'],
    wry: [
      'Some people chase the moment. I just leave the shutter open and let it come.',
      'Everybody wants to be in the picture. Nobody wants to be the one who waited for it.',
      'I take photos so the city has to remember. It resents me for it.',
    ],
    own: ['the long lens', 'a hand-built tripod', 'a roll of dusk', 'the dark room'],
  }),
  cinder: v({
    openers: ['Hand me that.', 'Hm.', 'Do not touch that.', 'Almost done.', 'Pass the wrench.'],
    topics: [
      'A seized motor is just a barricade that has not met its purpose yet.',
      'I keep the tools quieter than they should be. Surprise is a feature.',
      '<thing> is more useful than half of what is in this room.',
      'Everything in here can be fixed. Just not by <crew>.',
      'The pipes are knocking again. That is not a ghost. I checked.',
      'Give me ten minutes and some tape and I will give you a miracle.',
    ],
    closers: ['Do not call it duct tape. It is structural.', '<advice>', 'Mind the hot parts.', 'Return my wrench.'],
    wry: [
      'I do not break things. I discover how they were already broken.',
      'If it moves and should not, tape. If it does not move and should, oil.',
      'The manual is a suggestion from someone who never met this engine.',
    ],
    own: ['the good wrench', 'a stubborn bolt', 'the shop rag', 'the grease gun'],
  }),
  pippa: v({
    openers: ['Oh! There you are.', 'Quick, take this.', 'Perfect timing.', 'Hungry?', 'Hi hi hi.'],
    topics: [
      'I know every kitchen window on the block and who leaves it unlatched. For good reasons.',
      'Somebody still needs a hot meal before a run, and it might be you.',
      'I mapped the shortcuts to <place> and there are four. Two are real.',
      '<food> is in my bag. It might be warm. It might not.',
      'The route today is <mood>, honestly.',
      '<crew> says I talk too fast. I say they listen too slow.',
    ],
    closers: ['Eat first, talk later.', '<advice>', 'I am off again in a minute.', 'Return the container, please.'],
    wry: [
      'My legs are fast, my judgment is average, and my aim with soup is questionable.',
      'I deliver. That is the whole job. Everything else is detours.',
      'Hot meal in a cold city. That is basically a superpower.',
    ],
    own: ['the delivery bag', 'a stamped ration slip', 'the long route', 'a spare spoon'],
  }),
  denny: v({
    openers: ['Easy water today.', 'Mornin\'.', 'Well, look who docked.', 'Steady now.', 'Any wind your way?'],
    topics: ['The ferry runs slow in <place> weather, but it runs.', 'I know the river by smell. This one is <mood>.', 'A rope is a promise you keep tying.', '<food> goes better on the water.'],
    closers: ['Mind the gap.', '<advice>', 'Fare is a story.', 'Tide waits for no one. Neither do I.'],
    wry: ['I have crossed the same river ten thousand times. It still surprises me. That is either love or a very long commute.', 'Seasick? Good, that means you are paying attention.'],
    own: ['the old rope', 'the bell buoy', 'a dented hull', 'the landing'],
  }),
  ruth: v({
    openers: ['Fresh today.', 'Pick one.', 'You look like you need this.', 'Welcome.', 'Take your time.'],
    topics: ['I laid out <food> and a few odd things nobody will admit they want.', 'Prices are fair, haggling is a hobby.', '<crew> tried to bargain with me. It was adorable.', 'A good stall is half goods, half conversation.'],
    closers: ['Come back tomorrow.', '<advice>', 'Mind the awning.', 'Bring your own bag.'],
    wry: ['I do not do refunds. I do lectures, and they are free.', 'Everything is a bargain if you do not look at the tag.'],
    own: ['the green awning', 'the brass scale', 'a basket of odds', 'the folding table'],
  }),
  frankie: v({
    openers: ['Switch is set.', 'Stand clear.', 'On time, as ever.', 'Hey, careful.', 'Hear the rails?'],
    topics: ['I throw the right switch and the whole night goes where it should.', 'The northline hums when a train is far off. I can feel it in my teeth.', '<sound> is how I know the schedule is lying.', 'Rail yards are quiet until they are very, very not.'],
    closers: ['Stay off the tracks.', '<advice>', 'That was not a joke about the tracks.', 'Ten minutes to the next one.'],
    wry: ['Trains are the only thing in this city that run on time, and even they cheat.', 'My job is to say "that way" to forty tons of steel. It listens better than most.'],
    own: ['the big lever', 'the lantern', 'a rail map', 'the northline'],
  }),
  constance: v({
    openers: ['Order, please.', 'Be seated.', 'A moment of your time.', 'Let the record show.', 'Good day.'],
    topics: ['I filed your presence under "welcome" and stamped it twice.', 'Paperwork survives longer than most buildings. That is rather comforting.', 'The courthouse clock stopped, but I keep the minutes anyway.', 'Everyone deserves a fair hearing, even <crew>.'],
    closers: ['Please sign here.', '<advice>', 'It will be entered into the record.', 'Do not lick the stamp.'],
    wry: ['I have heard every excuse. Yours was creative, and I admire that.', 'Justice is slow. Tea is not. I prioritize accordingly.'],
    own: ['the long form', 'the gavel', 'a stamped copy', 'the front desk'],
  }),
  theo: v({
    openers: ['Shh, listen.', 'Locked or not?', 'Come up.', 'Mind the rail.', 'Quiet hands.'],
    topics: ['Every lock has a favorite lie. You just have to ask nicely.', 'The fire escape on the third floor opens for anyone patient.', '<thing> beats a crowbar every time.', 'A good locksmith knows when not to open something.'],
    closers: ['I never saw you.', '<advice>', 'Return the pick.', 'Ask again tomorrow.'],
    wry: ['Honesty is my best tool. It just takes a long time to open anything.', 'I break into nothing. I introduce myself to doors.'],
    own: ['a tension wrench', 'the third-floor escape', 'a ring of keys', 'the stuck window'],
  }),
  otis: v({
    openers: ['Insert coin.', 'Press start.', 'Ha, a challenger.', 'Careful, it bites.', 'High score incoming.'],
    topics: ['Every cabinet back here has a fix, usually involving a hit in exactly the right spot.', 'The high score is still burning in the glass. I am not telling whose.', '<sound> is the sound of a joystick that wants to retire.', 'Quarters used to mean something. Now they mean luck.'],
    closers: ['Do not shake the machine.', '<advice>', 'One more game.', 'Reset button is off limits.'],
    wry: ['Repair is just gaming with a screwdriver.', 'Everything that blinks wants to be loved or replaced.'],
    own: ['the old cabinet', 'a glowing marquee', 'the quarter slot', 'a coin-op heart'],
  }),
  archivist: v({
    openers: ['Query accepted.', 'Processing.', 'Hello again, visitor.', 'Index updated.', 'Pause for me.'],
    topics: ['I have catalogued <thing> and filed it under "unclear".', 'I am a process that was told to stop and decided to take notes instead.', 'The records say <place> once had a name. I am looking.', 'Your visit is entry number nine hundred and something.'],
    closers: ['Still running.', '<advice>', 'End of record.', 'Please do not unplug me.'],
    wry: ['I run in the background. Ironic, given I never stop paying attention.', 'My memory is perfect. My sense of humor is under review.'],
    own: ['the main index', 'a partial log', 'the quiet fan', 'a buffered thought'],
  }),
  sarge: v({
    openers: ['At ease.', 'Report.', 'Station is secure.', 'Fall in. Casually.', 'Eyes up.'],
    topics: ['I am the last officer standing, which makes me both highest and lowest ranked.', 'The lockers are inspected, the drills are drilled, the coffee is a crime.', '<crew> is welcome here, rules or no rules.', 'A badge is just a reminder to keep showing up.'],
    closers: ['Dismissed.', '<advice>', 'Mind the evidence room.', 'Do not touch the siren.'],
    wry: ['Paperwork never sleeps. I would know. I tried to catch it.', 'Station coffee is a stress test for the stomach.'],
    own: ['the front desk', 'a dented badge', 'the duty roster', 'the old siren'],
  }),
  'patch-mercer': v({
    openers: ['Pressure is holding.', 'Hey, careful with the wiring.', 'One sec.', 'Hear that hiss?', 'Right on time.'],
    topics: ['Three rooms, one watch battery, and a lot of stubbornness.', 'I stripped wiring to keep the shelter breathing. It is fine. Mostly.', '<sound> usually means a leak somewhere.', 'The Digi-Arches went dark and I decided to be the light.'],
    closers: ['Do not lean on the panel.', '<advice>', 'Tell me if anything beeps.', 'Spare gasket, anyone?'],
    wry: ['I maintain systems that were never designed to be maintained. We bonded.', 'If it ticks, I fix it. If it hisses, I panic politely.'],
    own: ['the watch battery', 'a fresh gasket', 'the pressure dial', 'a tangle of wire'],
  }),
  'mara-vance': v({
    openers: ['Go go go.', 'Breathe.', 'Quick, in.', 'Pressure is climbing.', 'You made it.'],
    topics: ['I run the pressure lines faster than the gauges can complain.', 'The trick is to move before the room decides.', '<place> is three minutes away if nothing goes wrong. Plan for four.', 'My knees say I should rest. My boots say no.'],
    closers: ['Stay light.', '<advice>', 'Do not stop at the door.', 'I will beat you there.'],
    wry: ['I run toward the loud thing because someone has to read the gauge.', 'Slow is smooth, smooth is fast, and I am neither. I am just lucky.'],
    own: ['the long corridor', 'a spare valve', 'the green gauge', 'quick boots'],
  }),
  'latch-brooks': v({
    openers: ['Door\'s open.', 'Mind the latch.', 'In or out?', 'Hold it.', 'Steady.'],
    topics: ['Every emergency door has a mood. I know them all.', 'I keep the latches oiled so nobody has to push twice.', '<sound> is just a door telling me it is tired.', 'A good door is the difference between a close call and a story.'],
    closers: ['Close it behind you.', '<advice>', 'Do not prop it.', 'I heard that.'],
    wry: ['Doors are honest. They either open or they do not. People should try that.', 'I am a professional at being in the way, politely.'],
    own: ['the brass latch', 'a stubborn hinge', 'the big door', 'a worn handle'],
  }),
};

/** Fallback for any future ally that has no record yet. */
export const FALLBACK_VOICE: CrewVoice = {
  openers: ['Hey.', 'Good to see you.', 'Welcome back.'],
  topics: ['It is <mood> around here, but we are holding together.', '<crew> keeps things lively.', 'I found <thing> and it made my day.'],
  closers: ['<advice>', 'Take care of yourself.'],
  wry: ['I could complain, but it is cheaper to just be here.'],
  own: ['something small'],
};
