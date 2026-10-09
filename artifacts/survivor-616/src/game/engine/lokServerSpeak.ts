import { generateCrewLine } from '@/game/engine/crewTalk';
import { SHARED_POOLS } from '@/game/data/crewVoices';
import { lokServerVoice } from '@/game/data/lokServer';

/** One line from LokServer about `topicId`, avoiding the last few it said. */
export function lokServerSay(topicId: string, rng: () => number, recent: readonly string[] = []): string {
  return generateCrewLine(lokServerVoice(topicId), { tone: 'family', pools: { ...SHARED_POOLS, crew: ['everybody'], room: ['the LokShop'], weather: ['a quiet sky'] } }, rng, recent);
}
