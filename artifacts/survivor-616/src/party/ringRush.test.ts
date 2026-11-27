import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minigameForRound } from './minigameKit';
import { RUSH, createRingRush, rushCourse, rushResults, stepRingRush, type RushState } from './ringRush';

const roster = (skills: number[]) => skills.map((botSkill, i) => ({ characterId: `c${i}`, bot: true, botSkill }));
function run(s: RushState, drive?: (s: RushState) => number) {
  while (!s.over) stepRingRush(s, s.runners.map((r) => (r.bot || !drive ? null : { mx: 0, target: drive(s) })), 1000 / 60);
  return s;
}

test('the course comes from the seed alone, and a run replays exactly', () => {
  assert.deepEqual(rushCourse(7), rushCourse(7));
  assert.notDeepEqual(rushCourse(7), rushCourse(8));
  assert.deepEqual(rushResults(run(createRingRush(7, roster([0.3, 0.6, 0.9])))), rushResults(run(createRingRush(7, roster([0.3, 0.6, 0.9])))));
});

test('a street is always passable: a free lane at every boulder row', () => {
  for (let seed = 1; seed <= 50; seed++) for (const row of rushCourse(seed)) if (row.type === 'boulder') assert.ok(row.lanes.length < 3);
});

test('steering well takes every ring and never crashes', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = run(createRingRush(seed, [{ characterId: 'me', bot: false }]), (st) => {
      const row = st.course[st.nextRow];
      if (!row) return 0;
      return RUSH.lanes[row.type === 'ring' ? row.lane : [0, 1, 2].find((l) => !row.lanes.includes(l))!];
    });
    assert.equal(s.runners[0].hits, 0, `seed ${seed}`);
    assert.equal(s.runners[0].rings, s.course.slice(0, s.nextRow).filter((r) => r.type === 'ring').length, `seed ${seed}`);
  }
});

test('sharper bots score more over many streets', () => {
  let weak = 0;
  let sharp = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const s = run(createRingRush(seed, roster([0.2, 0.9])));
    weak += s.runners[0].score;
    sharp += s.runners[1].score;
  }
  assert.ok(sharp > weak * 1.5, `sharp ${sharp} weak ${weak}`);
});

test('board rounds rotate through the minigames', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(minigameForRound), ['drop', 'rush', 'rumble', 'collapse', 'drop', 'rush', 'rumble']);
});
