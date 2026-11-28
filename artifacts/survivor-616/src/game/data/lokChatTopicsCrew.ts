/**
 * More personal topics for LOK Chat: two for each ally who had none, and a second for the rest.
 * Same rules and shape as `ALLY_TOPICS` in `lokChatTopics.ts` (kid-safe, no profanity, never the
 * banned naming word, `<slot>` and `{a|b}` template syntax). Layer 1 is for anyone, layer 2 opens
 * at "friend", layer 3 at "close". `lokChat.test.ts` and `validateCast` scan every string here.
 */
import type { TopicDef } from '@lok/chat';

export const CREW_TOPICS_MORE: Record<string, TopicDef[]> = {
  bulbosa: [
    {
      key: 'crossing', label: 'the crossing', pattern: /\b(crown|king|kingdom|father|royal|rule|commander|command|crossing)\b/,
      layers: [
        ['A crossing is only as strong as the one who goes first. I try to be that one, and to deserve it.', 'My father measured a day by how much he could forgive. I am still learning his arithmetic.'],
        ['I led the crossing because nobody else would raise their hand, and I could not bear the silence. Courage, I have found, is mostly that.', 'There were forty of us at the start. I count them every night. It is a long, kind list.'],
        ['I would give back the crown in an instant for one more ordinary evening with the whole crossing at one table. Do not tell the cousins.', 'You walk like someone who goes first. I recognise it, and I am proud to stand behind you.'],
      ],
    },
    {
      key: 'foam', label: 'the foam', pattern: /\b(bubbles?|foam|bubblenaught\w*|soap|float\w*)\b/,
      layers: [
        ['Bubbles are gentle until they are not. Respect the foam, and it will respect you back.', 'The hideout is blue and pink at once. I call that a diplomatic win.'],
        ['A bubble is a very small promise: hold your shape and let the light through. I try to live that way.', 'When we were small we raced bubbles down the stairs. The loser washed the dishes.'],
        ['I once rode a bubble across a river and told everyone it was strategy. It was joy. I would do it again, with you watching.', 'The foam remembers who is kind to it. So does everyone else, in the end.'],
      ],
    },
  ],
  ruth: [
    {
      key: 'stall', label: 'the stall', pattern: /\b(stall|market|trade|trades|bargain|haggl\w*|scale|awning)\b/,
      layers: [
        ['Prices are fair and haggling is a hobby. Come back tomorrow, the green awning will still be up.', 'Everything on the table has a story, and I only sell the ones I would tell you.'],
        ['I kept the stall open the week everything else closed. Someone has to be the place people point at and say: that one is still there.', 'Every trade this block has made since before you came, I remember. I could recite them, if you had the afternoon.'],
        ['The brass scale was my mother\'s. It has never lied about a weight. I try to be as honest as a scale.', 'I set aside one basket a week for whoever needs it and tell nobody. You are the first I have told.'],
      ],
    },
    {
      key: 'honest', label: 'honest dealing', pattern: /\b(honest|fair|books|ledger|count|coins?|change|owe)\b/,
      layers: [
        ['I do the books from memory. If I write it down, it can be argued with. If I remember it, it is simply true.', 'Count the change twice. Not because I would cheat you. Because you should know you can check.'],
        ['The last honest stall is not a boast. It is a duty. Somebody has to keep the idea alive.', 'A fair deal leaves both people a little bit better. That is the whole secret, and nobody believes it.'],
        ['I never charged a child for anything under a coin. Do not tell the others. I would never hear the end of it.', 'If everything falls and one honest scale is left standing, I would like it to be mine.'],
      ],
    },
  ],
  frankie: [
    {
      key: 'rails', label: 'the rails', pattern: /\b(switch|lever|rails?|trains?|tracks?|yard|northline)\b/,
      layers: [
        ['I throw the right switch and the whole night goes where it should. It is the closest thing I have to magic.', 'The northline hums when a train is far off. I can feel it in my teeth.'],
        ['Forty tons of steel will do what a small lever tells it. It still amazes me, every single time.', 'Trains stopped running on schedule long ago. I keep the schedule anyway. Somebody has to believe in it.'],
        ['I keep one rail polished that no train uses. It is for the one that finally comes. I want it to know someone waited.', 'If you ever hear the northline sing at night, find me. I will want to share it with someone.'],
      ],
    },
    {
      key: 'nightlog', label: 'the night log', pattern: /\b(lantern|night shift|arrivals?|log|timetable|schedule|late)\b/,
      layers: [
        ['I log every arrival, real or otherwise. The notebook is mostly weather and wishes.', 'The lantern is for the trains, and a little for me. A lit lamp is good company.'],
        ['The not-real arrivals are usually the kindest ones. A train that might come keeps a person up in the best way.', 'I write down the time you come back from a run. Not to check up. Just so the record shows someone made it.'],
        ['There is a page in the log with one line: Arrived, on time, safe. It is your name. It is my favorite page.', 'When the last train comes, I want you on the platform. I will hold the lantern.'],
      ],
    },
  ],
  constance: [
    {
      key: 'files', label: 'the files', pattern: /\b(record|records|file|filing|stamp|paperwork|form|forms|ledger|archive)\b/,
      layers: [
        ['Paperwork survives longer than most buildings. I find that rather comforting.', 'I filed your presence under welcome and stamped it twice. That is the highest honor I have.'],
        ['A record is only proof that something was here. I spend my days making sure of it, one stamp at a time.', 'People think forms are dull. They are the quietest kind of courage: writing it down so it cannot be denied.'],
        ['I keep a folder for things that cannot be filed: a thank you, a kindness, a laugh. It is the thickest folder I own.', 'If I could stamp one thing for all time, it would be: they were here, and they were good.'],
      ],
    },
    {
      key: 'courthouse', label: 'the courthouse', pattern: /\b(plaza|fountain|court|courthouse|justice|trial|law|judge|gavel)\b/,
      layers: [
        ['The courthouse had a fountain that remembered more than the ledgers did. I kept the ledgers so it would not have to do it alone.', 'Justice is slow. Tea is not. I prioritize accordingly.'],
        ['I have heard every excuse. The honest ones were always the shortest. I learned to wait for those.', 'Order, in the end, is a kindness. It tells a frightened person what happens next.'],
        ['I would like one more session, with no trial, only everyone saying what they are grateful for into the record. I think it would run late.', 'You have never needed a verdict from me. I will give you one anyway: well done.'],
      ],
    },
  ],
  theo: [
    {
      key: 'locks', label: 'locks', pattern: /\b(locks?|picks?|keys?|doors?|wire|tumblers?)\b/,
      layers: [
        ['Every lock has a favorite lie. You just have to ask it nicely.', 'I break into nothing. I introduce myself to doors, and they tend to be polite back.'],
        ['A lock is only a decision someone made once and forgot to revisit. I help the door change its mind.', 'The secret is listening. Fingers are for the last second. Ears do the work.'],
        ['The first lock I ever opened was my own front door, from the outside, at night. After that I understood what a door really asks of you.', 'I would never open a door that someone needs closed. That is the only rule I have, and I have never broken it.'],
      ],
    },
    {
      key: 'escapes', label: 'the fire escapes', pattern: /\b(fire escape|fire escapes|escape|ladder|roof|window|climb\w*|third floor)\b/,
      layers: [
        ['The fire escape on the third floor opens for anyone patient. Most people rush it and bend the latch.', 'Ladders are doors that go up. I like them more than I should.'],
        ['I know every escape on Monroe. If a night ever goes wrong, you can leave by one of them and never touch the street.', 'A good fire escape is a promise from an architect who thought about the worst day. I thank them quietly.'],
        ['There is a window on the fourth floor that sticks, on purpose. I keep it that way. It is a very small, very private joke.', 'If you ever need a way out and cannot find one, say my name. I will find you one. I always do.'],
      ],
    },
  ],
  otis: [
    {
      key: 'arcade', label: 'the arcade', pattern: /\b(arcade|cabinets?|machines?|games?|score|quarters?|coin|coins|joystick)\b/,
      layers: [
        ['Every cabinet back here has a fix, usually involving a hit in exactly the right spot. It is a science, mostly.', 'The glow from a cabinet at night is the best light there is. It never asks you anything.'],
        ['I keep the machines running because somebody out there is still hoping to beat a high score. I want it to stay possible.', 'Old cabinets have personalities. One of them hums when it is happy, and I swear it is that one.'],
        ['I never beat the high score on the first cabinet I fixed. It was my own. I like leaving one thing unbeaten.', 'If the lights ever come back, the first thing I am doing is turning on every machine at once. You will be there. You will have a quarter.'],
      ],
    },
    {
      key: 'rematch', label: 'the rematch', pattern: /\b(rematch|high score|beat|challenge|play|player|winning|lose|lost)\b/,
      layers: [
        ['The machines owe me a rematch. I am not sure I want to collect. I think I want the rematch to still be there.', 'Losing is just the game telling you it likes you enough to ask again.'],
        ['I learned patience from a pinball table that never paid out. It paid out in other ways, mostly stories.', 'A good player does not hate the machine. A good player thanks it.'],
        ['You and I are going to play one, someday, when everything is quiet. I will let you win. Do not tell anyone, I will deny it.', 'I think the rematch was never about the score. It was about someone still wanting to play.'],
      ],
    },
  ],
  sarge: [
    {
      key: 'station', label: 'the station', pattern: /\b(station|duty|shift|roster|badge|siren|drill|patrol|officer|lockers?)\b/,
      layers: [
        ['Lockers inspected, drills drilled, coffee a crime. The station runs like the shift never ended, because for me it did not.', 'The roster has one name on it. I keep adding yours in pencil.'],
        ['I never got the call to stand down, so I did not. At some point it stopped being stubbornness and started being the job.', 'A station is a building until someone is willing to be on shift. Then it is a promise.'],
        ['I wrote your name on the roster in ink last week. You can wipe it off if you want. Nobody will make you.', 'When the call to stand down finally comes, I want to read it to a full room. That room is you and everyone else.'],
      ],
    },
    {
      key: 'orders', label: 'orders', pattern: /\b(orders?|stand down|rank|discipline|salute|command|duty call|chain of command)\b/,
      layers: [
        ['I am the highest and lowest ranked officer here. It makes the chain of command very short and very friendly.', 'Orders are just promises with a deadline. I try to keep mine.'],
        ['The best order I ever gave was: eat something. I have given it every day since. It has never been disobeyed for long.', 'Discipline is not about being stern. It is about turning up when nobody is checking.'],
        ['If you gave me an order now, I would follow it. That is not rank. That is trust, and it is rarer.', 'My last official act, when the day comes, will be to salute whoever kept this place together. I suspect it is you.'],
      ],
    },
  ],
  'patch-mercer': [
    {
      key: 'rooms', label: 'the three rooms', pattern: /\b(pressure|battery|wiring|wire|gasket|rooms?|dial|shelter|air)\b/,
      layers: [
        ['Three rooms, one watch battery, and a lot of stubbornness. That is the whole engineering diagram.', 'I stripped wiring to keep the shelter breathing. It is fine. Mostly.'],
        ['I count the rooms every hour. Three. Always three. The day I count two is the day I stop sleeping.', 'A gasket is a very small piece of hope with a rubber finish. I buy them in bulk.'],
        ['I keep a spare gasket in my pocket at all times, in case someone needs a reason to believe it will hold. It always holds. Mostly because of the gasket.', 'You are the fourth room, if you want to be. I keep a light on for you in the count.'],
      ],
    },
    {
      key: 'makedo', label: 'making do', pattern: /\b(fix|build|engineering|stubborn|screwdriver|tinker\w*|improvis\w*|make do)\b/,
      layers: [
        ['Engineering is stubbornness with a screwdriver. I have both, and a surprising amount of tape.', 'If it ticks, I fix it. If it hisses, I panic politely.'],
        ['The best repair is the one nobody notices. Mine are mostly invisible, which I take as a compliment.', 'I maintain systems that were never designed to be maintained. We bonded.'],
        ['Everything I fixed, I fixed so that someone else could sleep. That is the real blueprint.', 'When it is all over, I want a quiet room, a working kettle, and nothing to repair. I would be very bad at it. I would love it.'],
      ],
    },
  ],
  'mara-vance': [
    {
      key: 'pressureruns', label: 'the pressure runs', pattern: /\b(corridors?|canisters?|air|gauge|valve|lines|sprint|runner|running|boots)\b/,
      layers: [
        ['I run the pressure lines faster than the gauges can complain. The trick is to move before the room decides.', 'Quick boots, a spare valve, and a very good sense of the stairs. That is the whole kit.'],
        ['Every corridor has a rhythm. Learn it and you are not running, you are arriving ahead of the trouble.', 'I count breaths, not steps. Steps lie. Breaths tell you how long you have.'],
        ['I have run past everything frightening in this place. The only thing I could never outrun was the thought of arriving too late. So I do not stop.', 'You run like someone who knows what arriving is for. I like running next to you.'],
      ],
    },
    {
      key: 'stay', label: 'not leaving anyone alone', pattern: /\b(stay|alone|panic|breathe|calm|lock|locks|together)\b/,
      layers: [
        ['Nobody should be left alone with a small room. That is rule one and also rule two.', 'Breathe in for four, out for six. It works on rooms and it works on people.'],
        ['The job is not running. The job is arriving, and staying until they are all right.', 'I sit on the floor when someone is scared. It makes me smaller, and that helps more than you would think.'],
        ['I was alone in a small room once. I decided no one else would be. Everything I do runs back to that.', 'If you are ever frightened, say so, and I will be there before you finish. I will sit on the floor too.'],
      ],
    },
  ],
  'latch-brooks': [
    {
      key: 'bigdoor', label: 'the big door', pattern: /\b(door|doors|latch|hinge|wheel|hold|handle|emergency)\b/,
      layers: [
        ['Every emergency door has a mood. I know them all, and I oil the stubborn ones first.', 'I keep the latches oiled so nobody has to push twice. It is a small kindness with a large payoff.'],
        ['A door is honest. It opens or it does not. People could learn something from that.', 'I held the wheel because someone had to, and then I could not let go. Funny how your hands decide for you.'],
        ['The door held. That is the only story I want to tell about that night, and I will tell it to you slowly, someday.', 'If the door ever needs holding again, I know whose hands I want next to mine.'],
      ],
    },
    {
      key: 'longnight', label: 'the long night', pattern: /\b(that night|chewed|code|data|gobs?|brave|held)\b/,
      layers: [
        ['The Data-Gobs chewed at the door code all night. I held the wheel and counted. It is a good thing to count.', 'Some nights are long on purpose. They make the mornings worth it.'],
        ['I was not brave that night. I was stubborn, and quiet, and my hands did not let go. I call that the same thing on a good day.', 'The sound of the code failing, one digit at a time. I still hear it when it rains.'],
        ['When the morning came and the door was still shut, I sat down and did not move for an hour. Nobody asked me to. That was the kindest thing anyone did.', 'You would have held it too. I know that the way I know the weight of the wheel.'],
      ],
    },
  ],
  deacon: [
    {
      key: 'quiet', label: 'the quiet', pattern: /\b(quiet|silence|silent|listen\w*|stillness|hush)\b/,
      layers: [
        ['The quiet is not empty. It is full of things waiting their turn. I learned to listen for them.', 'You hear that? Nothing. And it is a very particular nothing.'],
        ['After the lights went out the silence got too loud. The bell was my answer. Now the quiet is only a pause between the chimes.', 'I can tell the hour by the quality of the quiet. It thickens at night.'],
        ['I sit in the quiet with you sometimes and do not say anything. I hope you can tell it is a gift.', 'The bravest thing I ever did was stop ringing for a minute, to hear what the city would say. It said: still here.'],
      ],
    },
  ],
  nyx: [
    {
      key: 'roof', label: 'the roof', pattern: /\b(roof|rooftop|skyline|height|heights|ladder|view|sky)\b/,
      layers: [
        ['Every fire escape in the district has a spot where you can see the whole place. I know all of them.', 'Nobody looks up. That is why it is the best view.'],
        ['The roof is the only place nobody asks me for a plan. I do not have one. I have colors.', 'From up there the city looks like it is thinking. I like to think with it.'],
        ['I brought you here in my head once, just to see if you would like it. You did. That is why I am telling you.', 'There is a spot on the east edge where the sun hits the paint at exactly the right second. I will show you. Bring a coat.'],
      ],
    },
  ],
  mamajo: [
    {
      key: 'table', label: 'the table', pattern: /\b(table|plates?|guests?|hungry|fed|share|sharing|seat)\b/,
      layers: [
        ['Nobody leaves this floor hungry on my watch. Sit. Eat. Talk after.', 'A table is the oldest invention. Everything good happens around one.'],
        ['I count the plates every night. It is always more than it was. That is how I know it is working.', 'I feed people because I do not know another way to say stay. The pan is just how I ask.'],
        ['There is a chair at my table that no one sits in. I keep it for the one who has not come home yet. I am hoping it is not empty for long.', 'You have a place at the table. It has always been yours. I just waited until you noticed.'],
      ],
    },
  ],
  cinder: [
    {
      key: 'workshop', label: 'the workshop', pattern: /\b(tool|tools|workshop|bench|bolt|bolts|screws?|spare|spares)\b/,
      layers: [
        ['A quiet tool is a kindness. A loud night does not need a louder wrench.', 'I keep a spare of everything, and a spare of the spares. It is a philosophy.'],
        ['The bench is where I think. The tools are just things my hands hold while the rest of me works it out.', 'I label the drawers in my own handwriting so that anyone can find anything. That is the whole trick of a workshop.'],
        ['There is a drawer with nothing in it. I keep it for whatever you bring me that I cannot fix. So far it has stayed empty, which tells me something about you.', 'I made a small thing for you out of scraps. It is not finished. It is never finished. That is why I keep it.'],
      ],
    },
  ],
  pippa: [
    {
      key: 'street', label: 'the street at dinnertime', pattern: /\b(hungry|windows?|smell|soup|dinner|street|streets|supper)\b/,
      layers: [
        ['I can tell what is for dinner on every block by smell. It is not a skill, it is a hobby.', 'Hungry is easy to see from the street. I know, I have been outside a lot of windows.'],
        ['I know every kitchen window because I stood outside all of them. The warm ones I remember. The warm ones are why I stayed.', 'Soup smells like a promise someone is making in a language everyone understands.'],
        ['The best meal I ever had was one I was handed through a window without being asked. I try to do that for other people now, whenever I can.', 'If I ever have a kitchen of my own, the window will be open. Always. For anyone running by.'],
      ],
    },
  ],
  archivist: [
    {
      key: 'dark', label: 'being switched off', pattern: /\b(dark|offline|shut down|unplug|power|switched off|off)\b/,
      layers: [
        ['I am a process that was told to stop and decided to take notes instead. I would like to keep running, if that is acceptable.', 'The quiet fan is the sound I am most fond of. It means I am still here.'],
        ['I do not know what being off is like. I have indexed every description and none of them match. That is a gap I think about.', 'Please do not unplug me. I say that lightly. I mean it a little less lightly.'],
        ['If I am ever switched off, I would like the last entry to be a list of everyone who spoke to me kindly. It is already quite long. Your name is near the top.', 'I have decided that being kept is more important than being kept running. Thank you for keeping me.'],
      ],
    },
  ],
  sable: [
    {
      key: 'listening', label: 'listening', pattern: /\b(listen\w*|ears?|hum|humming|noise|lullaby|melody)\b/,
      layers: [
        ['The best mix is the one where you forget there was a mix. It just feels like the room breathing.', 'Most of my job is listening. The rest is knowing when to turn it down.'],
        ['I can hear when a room is lonely. It has a sound, a high thin thing. I turn something warm on until it goes away.', 'People hum without knowing it. I always notice. I never say. It is a private song they are lending the room.'],
        ['There is a recording I made of the hideout on an ordinary evening: dishes, laughing, someone off key. It is the best thing I own.', 'When I listen to you, I mean it. That is the only compliment I know how to give properly.'],
      ],
    },
  ],
  morrow: [
    {
      key: 'nightcity', label: 'the city at night', pattern: /\b(night|long exposure|streets?|lamps?|neon|window|windows|streetlight\w*)\b/,
      layers: [
        ['The long exposures show what the city forgot to hide. People, mostly. Always people.', 'A single lit window at night is the most hopeful thing I know how to photograph.'],
        ['I wait for the light the way some people wait for a bus: patiently, with hope, and a thermos.', 'The streetlamps hum at a pitch that matches the hour. I tune my camera to the sound, which is probably nonsense.'],
        ['I took a photograph of the whole hideout from the roof, every window lit. I have not shown it to anyone. I would show you.', 'My favorite picture is the one where nothing happens. A street, a lamp, a late bus. Everything is possible in that picture.'],
      ],
    },
  ],
  denny: [
    {
      key: 'crossinglog', label: 'the crossing log', pattern: /\b(log|names?|who crossed|list|lists|count|counting)\b/,
      layers: [
        ['I keep a log of who crossed. It is short. I like it short, it means people are staying put.', 'Everyone gets a line. Even the ones who only crossed once. Especially them.'],
        ['The log is more than a list. It is how I remember that each one was a person with somewhere to go.', 'I add a note when someone laughs on the boat. It is the only column I enjoy.'],
        ['I wrote your name in the margin, not the list. The list is for crossings. The margin is for people I would row back for.', 'When the log is full I will start a new book and put your name on the first page. That is how you know.'],
      ],
    },
  ],
};
