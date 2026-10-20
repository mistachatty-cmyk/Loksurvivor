import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALLIES } from '@/game/data/progression';
import { CREW_VOICES, SHARED_POOLS } from '@/game/data/crewVoices';
import { createRng } from '@/game/engine/math';
import { expandTemplate } from '@/game/engine/crewTalk';
import { crewSpeak } from '@/game/engine/crewSpeak';

const BANNED = /\b(signal\w*|damn\w*|hell|crap\w*|shit\w*|fuck\w*|bitch\w*|bastard\w*|ass|piss\w*|sex\w*|kill\w*|murder\w*|blood\w*|gore|drunk|drugs?|weed|beer|whiskey)\b/i;
const WEATHERS = ['clear', 'rain', 'fog', 'snow', 'heat'] as const;

describe('crew talk', () => {
  it('expands choices, weights, slots and capitalization', () => {
    const rng = createRng(1);
    assert.equal(expandTemplate('hello {a|a} <x>.', { tone: 'family', pools: { x: ['w'] } }, rng), 'Hello a w.');
    assert.equal(expandTemplate('{9*yes|no}', { tone: 'family', pools: {} }, () => 0), 'Yes');
  });

  it('gives every ally a voice', () => {
    for (const ally of ALLIES) assert.ok(CREW_VOICES[ally.id], `missing voice for ${ally.id}`);
  });

  it('is deterministic for a seed and varied across seeds', () => {
    const args = (seed: number) => ({ allyId: 'vee', roomName: 'The Sanctum', weather: 'rain' as const, crewNames: ['Nyx'], tone: 'family' as const, rng: createRng(seed) });
    assert.equal(crewSpeak(args(7)), crewSpeak(args(7)));
    const lines = new Set(Array.from({ length: 200 }, (_, i) => crewSpeak(args(i))));
    assert.ok(lines.size > 100, `only ${lines.size} distinct lines`);
  });

  it('never renders banned words or empty/unresolved text, in either tone', () => {
    for (const ally of ALLIES) {
      for (const tone of ['family', 'wry'] as const) {
        for (let seed = 0; seed < 150; seed += 1) {
          const line = crewSpeak({ allyId: ally.id, roomName: 'The Cellar', weather: WEATHERS[seed % 5]!, crewNames: ['Vee', 'Nyx'], tone, rng: createRng(seed * 31 + 3) });
          assert.ok(line.length > 8, `${ally.id}: "${line}"`);
          assert.ok(!/[<>{}|]/.test(line), `unresolved markup in ${ally.id}: ${line}`);
          assert.ok(!BANNED.test(line), `banned word in ${ally.id}: ${line}`);
        }
      }
    }
  });

  it('keeps the source text clean too', () => {
    const all = JSON.stringify([CREW_VOICES, SHARED_POOLS]);
    assert.ok(!BANNED.test(all), BANNED.exec(all)?.[0]);
  });
});
