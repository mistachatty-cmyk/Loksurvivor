/**
 * Device-local choices for crew dialogue in the hideout.
 *   mode: 'generated' -- a fresh line every time you talk to a crew member
 *         'blurb'     -- the original fixed intro line only
 *   tone: 'family'    -- warm and gentle
 *         'wry'       -- drier, more grown-up humor (still kid-safe)
 */
import type { Tone } from '@/game/engine/crewTalk';

export type CrewTalkMode = 'generated' | 'blurb';
export const CREW_TALK_MODES: CrewTalkMode[] = ['generated', 'blurb'];
export const CREW_TALK_TONES: Tone[] = ['family', 'wry'];

const MODE_KEY = 'survivor616.crewTalk.mode';
const TONE_KEY = 'survivor616.crewTalk.tone';

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* lasts until reload */ }
}

export function getCrewTalkMode(): CrewTalkMode {
  return read(MODE_KEY) === 'blurb' ? 'blurb' : 'generated';
}
export function setCrewTalkMode(mode: CrewTalkMode): void { write(MODE_KEY, mode); }

export function getCrewTalkTone(): Tone {
  return read(TONE_KEY) === 'wry' ? 'wry' : 'family';
}
export function setCrewTalkTone(tone: Tone): void { write(TONE_KEY, tone); }
