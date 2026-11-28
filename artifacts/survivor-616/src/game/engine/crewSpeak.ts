import { CREW_VOICES, FALLBACK_VOICE, SHARED_POOLS } from '@/game/data/crewVoices';
import { STRIP_BY_TIME, STRIP_BY_WEATHER } from '@/game/data/crewStripLines';
import { expandTemplate, generateCrewLine, type Tone } from './crewTalk';
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
  /** Local hour; when given, some lines are about the time of day and the weather. */
  hour?: number;
}

const timeOf = (hour: number): keyof typeof STRIP_BY_TIME => (hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : hour >= 17 && hour < 22 ? 'evening' : 'night');

export function crewSpeak(input: SpeakInput): string {
  const voice = CREW_VOICES[input.allyId] ?? FALLBACK_VOICE;
  const crew = input.crewNames.length > 0 ? input.crewNames : ['everybody'];
  const recent = input.recent ?? [];
  // About a third of the time, say something about the weather or the hour instead of a stock line.
  if (input.hour !== undefined && input.rng() < 0.32) {
    const lines = [...STRIP_BY_WEATHER[input.weather], ...STRIP_BY_TIME[timeOf(input.hour)]];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const source = lines[Math.min(lines.length - 1, Math.floor(input.rng() * lines.length))]!;
      const line = expandTemplate(source, { tone: input.tone, pools: { ...SHARED_POOLS, crew, room: [input.roomName], weather: WEATHER_WORDS[input.weather], own: voice.own } }, input.rng);
      if (!recent.includes(line)) return line;
    }
  }
  return generateCrewLine(voice, {
    tone: input.tone,
    pools: {
      ...SHARED_POOLS,
      crew,
      room: [input.roomName],
      weather: WEATHER_WORDS[input.weather],
    },
  }, input.rng, recent);
}
