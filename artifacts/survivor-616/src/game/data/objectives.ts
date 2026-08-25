import type { ObjectiveDef } from '@/game/types';

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'kill-any-20', label: 'Take out 20 enemies', kind: 'kill-any', targetCount: 20, rewardCred: 35, rewardTokens: 0 },
  { id: 'kill-any-40', label: 'Take out 40 enemies', kind: 'kill-any', targetCount: 40, rewardCred: 65, rewardTokens: 0 },
  { id: 'kill-any-75', label: 'Take out 75 enemies', kind: 'kill-any', targetCount: 75, rewardCred: 100, rewardTokens: 1 },
  { id: 'nightcrawler-hunt', label: 'Down 8 Nightcrawlers', kind: 'kill-enemy', enemyId: 'nightcrawler', targetCount: 8, rewardCred: 55, rewardTokens: 0 },
  { id: 'leech-hunt', label: 'Down 10 Neon Leeches', kind: 'kill-enemy', enemyId: 'neon-leech', targetCount: 10, rewardCred: 60, rewardTokens: 0 },
  { id: 'bat-hunt', label: 'Down 12 Belfry Bats', kind: 'kill-enemy', enemyId: 'belfry-bat', targetCount: 12, rewardCred: 65, rewardTokens: 0 },
  { id: 'wisp-hunt', label: 'Down 10 Ash Wisps', kind: 'kill-enemy', enemyId: 'ash-wisp', targetCount: 10, rewardCred: 60, rewardTokens: 0 },
  { id: 'elite-drop', label: 'Drop a Crypt Bouncer', kind: 'kill-enemy', enemyId: 'crypt-bouncer', targetCount: 1, rewardCred: 85, rewardTokens: 1 },
  { id: 'survive-90', label: 'Survive 90 more seconds', kind: 'survive-sec', targetCount: 90, rewardCred: 50, rewardTokens: 0 },
  { id: 'survive-120', label: 'Survive 2 more minutes', kind: 'survive-sec', targetCount: 120, rewardCred: 80, rewardTokens: 1 },
  { id: 'walk-5', label: 'Walk 5 more blocks', kind: 'walk-blocks', targetCount: 5, rewardCred: 60, rewardTokens: 0 },
  { id: 'walk-10', label: 'Walk 10 more blocks', kind: 'walk-blocks', targetCount: 10, rewardCred: 100, rewardTokens: 1 },
];

export const OBJECTIVES_BY_ID: Record<string, ObjectiveDef> = Object.fromEntries(
  OBJECTIVES.map((o) => [o.id, o]),
);
