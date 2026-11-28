/** A person's mood today: a pure function of the person and the day, so it is stable all day and varies across days. */
import { MOOD_IDS, type MoodId } from './types';

export function moodOf(personId: string, day: number): MoodId {
  let h = 2166136261 ^ day;
  for (let i = 0; i < personId.length; i += 1) h = Math.imul(h ^ personId.charCodeAt(i), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return MOOD_IDS[(h >>> 0) % MOOD_IDS.length]!;
}

/** Days since 1970 in the player's own time zone: what "today" means for scenes and moods. */
export const localDay = (now: number): number => Math.floor((now - new Date(now).getTimezoneOffset() * 60_000) / 86_400_000);
