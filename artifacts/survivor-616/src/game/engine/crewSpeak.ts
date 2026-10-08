import { CREW_VOICES, FALLBACK_VOICE, SHARED_POOLS } from '@/game/data/crewVoices';
import { generateCrewLine, type Tone } from './crewTalk';
import type { HideoutWeather } from '@/game/types';

const WEATHER_WORDS: Record<HideoutWeather, string[]> = {
  clear: ['clear skies', 'a quiet sky', 'a dry night'],
  rain: ['the rain', 'wet streets', 'rain on the roof'],
  fog: ['the fog', 'a thick gray morning', 'low fog'],
  snow: ['the snow', 'a white street', 'cold flakes'],
  heat: ['the heat', 'a sticky afternoon', 'warm air'],
};

export interface SpeakInput {
  allyId: string;
  roomName: string;
  weather: HideoutWeather;
  /** Names of other rescued crew, for <crew>. */
  crewNames: string[];
  tone: Tone;
  rng: () => number;
  recent?: readonly string[];
}

export function crewSpeak(input: SpeakInput): string {
  const voice = CREW_VOICES[input.allyId] ?? FALLBACK_VOICE;
  const crew = input.crewNames.length > 0 ? input.crewNames : ['everybody'];
  return generateCrewLine(voice, {
    tone: input.tone,
    pools: {
      ...SHARED_POOLS,
      crew,
      room: [input.roomName],
      weather: WEATHER_WORDS[input.weather],
    },
  }, input.rng, input.recent ?? []);
}
