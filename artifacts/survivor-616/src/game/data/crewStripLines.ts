/**
 * Extra one-liners the crew say on the hideout strip when you walk up to them, tied to the weather and
 * the time of day so the chatter changes with the world. Mixed in by `engine/crewSpeak.ts` next to each
 * person's own voice lines. Kid-safe, no profanity, never the banned naming word. Slots: weather, room,
 * crew, own, food, advice, time. `crewTalk.test.ts` / `lokChat.test.ts` scan these.
 */
import type { HideoutWeather } from '@/game/types';

export const STRIP_BY_WEATHER: Record<HideoutWeather, string[]> = {
  clear: [
    'Clear skies. Do not tell the weather I said so, it gets ideas.',
    'Good light today. Even the dust looks organised.',
    'You can see all the way down the street. I forgot it went that far.',
    'A dry night means the roofs are open. Somebody will be up there.',
    '<weather>, and nothing on fire. I will call that a win.',
  ],
  rain: [
    'Rain on the roof. Best sound there is, and I will fight anyone who disagrees.',
    'Mind the puddles by the door. They have opinions.',
    'It is <weather> out. Good day to stay in and make something.',
    'Wet boots by the door, please. <crew> knows who they are.',
    'Rain like this makes the whole place feel kept.',
  ],
  fog: [
    'The fog is thick today. Keep a hand on the wall and a song in your head.',
    'You can hear things in <weather> that you cannot see. Mostly it is nice.',
    'Fog makes everything look like a rumour. I find it restful.',
    'Do not wander off in this. Come back for supper at least.',
    'Everything is soft at the edges today. Take your time.',
  ],
  snow: [
    'Snow. Everything is quieter. Even <crew> is quieter, and that is a miracle.',
    'Wear the warm thing. I know you have a warm thing.',
    'The first footprints in snow are always the best. Leave some for me.',
    'It is <weather> out. I would stay in, but I like the walk back.',
    'Cold hands, warm kitchen. That is the whole plan.',
  ],
  heat: [
    'It is <weather> out. Water first, heroics later.',
    'Even the walls are sweating. Keep to the shade.',
    'Nobody does anything clever in this heat. Do not start.',
    'Heat like this makes the cellar the best room in the place.',
    'Drink something. I will not ask again, I will just stand here.',
  ],
};

export const STRIP_BY_TIME: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: [
    'Early start. The place is at its kindest right now.',
    'Morning. The kettle has an opinion about you, and it is good.',
    'First light always makes me think we might manage another day. We usually do.',
    'You are up before <crew>. That is a quiet kind of victory.',
  ],
  afternoon: [
    'Quiet afternoon. I will take it and not ask questions.',
    'This is the long part of the day. Pace yourself.',
    'Somebody should have lunch. I am nominating you.',
    'Afternoons are for fixing small things and ignoring large ones.',
  ],
  evening: [
    'The lights are coming on. Best hour of the day.',
    'Evening. Everybody drifts toward the warm room around now. Watch.',
    'Long day? Sit. Nobody is keeping score.',
    'Dinner soon. You will want to be near it.',
  ],
  night: [
    'Still up? Same. The building is easier to hear at night.',
    'Night shift is the quiet shift. I like it, mostly.',
    'Keep your voice low. <crew> is sleeping, finally.',
    'The best ideas show up late. So do the worst ones. Choose carefully.',
  ],
};
