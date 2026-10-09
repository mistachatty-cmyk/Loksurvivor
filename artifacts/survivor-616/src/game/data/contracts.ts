import { AREAS } from '@/game/data/areas';
import { ENEMIES_BY_ID } from '@/game/data/enemies';
import type {
  DailyContractDef,
  DailyContractStatus,
  RunResult,
} from '@/game/types';

export interface DailyContractState {
  dayKey: string;
  progressById: Record<string, number>;
  completedIds: string[];
}

export interface DailyContractAdvance {
  dayKey: string;
  progressById: Record<string, number>;
  completedIds: string[];
  completed: DailyContractDef[];
  rewardCred: number;
  rewardTokens: number;
  rewardKeys: number;
}

/** Uses the player's local calendar, so the board turns over at local midnight. */
export function contractDayKey(now = Date.now()): string {
  const date = new Date(now);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dayNumber(dayKey: string): number {
  return [...dayKey].reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 11), 0);
}

/**
 * Targets for the rotating side jobs. Everything here is reachable from a fresh save:
 * Monroe Strip spawns every hunt target, and the districts all unlock by default.
 */
export const SIDE_JOB_HUNT_TARGETS = ['nightcrawler', 'neon-leech', 'bloodhound', 'corner-cutter', 'curb-stomper', 'crypt-bouncer'] as const;
export const SIDE_JOB_DISTRICTS = ['monroe-strip', 'monroe-strip-2x', 'mirror-mile', 'clockmouth-roundabout', 'bubbleWash'] as const;

type RunProgressInput = Pick<RunResult, 'cleared' | 'kills' | 'survivedSec'> &
  Partial<Pick<RunResult, 'areaId' | 'killsByEnemy' | 'level' | 'cred' | 'lootBoxesOpened' | 'mapFindIds'>>;

/** Three rotating side jobs, picked from a pool of six so the board never repeats back to back. */
function sideJobs(dayKey: string, roll: number): DailyContractDef[] {
  const hunt = SIDE_JOB_HUNT_TARGETS[(roll >> 1) % SIDE_JOB_HUNT_TARGETS.length]!;
  const huntName = ENEMIES_BY_ID[hunt]?.name ?? hunt;
  const district = SIDE_JOB_DISTRICTS[(roll >> 2) % SIDE_JOB_DISTRICTS.length]!;
  const districtName = AREAS.find((area) => area.id === district)?.name ?? district;
  const pool: DailyContractDef[] = [
    {
      id: `${dayKey}:job-hunt`,
      name: `Hunt: ${huntName}`,
      description: `Defeat ${12 + (roll % 4) * 4} ${huntName}s across your runs today. Monroe Strip has plenty.`,
      kind: 'kill-enemy',
      targetId: hunt,
      targetCount: 12 + (roll % 4) * 4,
      rewardCred: 70,
      rewardTokens: 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:job-level`,
      name: 'Level Up Fast',
      description: `Reach level ${6 + (roll % 3)} in a single run.`,
      kind: 'reach-level',
      targetCount: 6 + (roll % 3),
      rewardCred: 80,
      rewardTokens: 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:job-chests`,
      name: 'Crack the Crates',
      description: `Open ${2 + (roll % 3)} loot boxes across your runs today.`,
      kind: 'open-chests',
      targetCount: 2 + (roll % 3),
      rewardCred: 60,
      rewardTokens: 1,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:job-payday`,
      name: 'Payday',
      description: `Earn ${120 + (roll % 3) * 40} Cred in your runs today.`,
      kind: 'earn-cred',
      targetCount: 120 + (roll % 3) * 40,
      rewardCred: 50,
      rewardTokens: 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:job-district`,
      name: `Clear ${districtName}`,
      description: `Clear ${districtName} today. A specific block, a specific favor.`,
      kind: 'clear-district',
      targetId: district,
      targetCount: 1,
      rewardCred: 90,
      rewardTokens: 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:job-finds`,
      name: 'Eyes Open',
      description: `Pick up ${2 + (roll % 3)} map finds across your runs today.`,
      kind: 'map-finds',
      targetCount: 2 + (roll % 3),
      rewardCred: 65,
      rewardTokens: 0,
      rewardKeys: 0,
    },
  ];
  const start = roll % pool.length;
  return [0, 1, 3].map((offset) => pool[(start + offset) % pool.length]!);
}

/** Three deterministic contracts (a clear, a crowd-control quota, a hold-the-line target) plus one optional, tougher wildcard job, then three rotating side jobs. */
export function dailyContractDefs(dayKey = contractDayKey()): DailyContractDef[] {
  const roll = dayNumber(dayKey);
  const killTarget = 60 + (roll % 3) * 20;
  const surviveTarget = 75 + (roll % 3) * 15;
  const wildcardTarget = 150 + (roll % 4) * 25;
  return [
    {
      id: `${dayKey}:street-sweep`,
      name: 'Street Sweep',
      description: 'Clear any district. The city wants one block quieter.',
      kind: 'clear-area',
      targetCount: 1,
      rewardCred: 55 + (roll % 2) * 15,
      rewardTokens: 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:crowd-control`,
      name: 'Crowd Control',
      description: `Defeat ${killTarget} enemies across your runs today.`,
      kind: 'kill-any',
      targetCount: killTarget,
      rewardCred: 65 + (roll % 3) * 10,
      rewardTokens: roll % 3 === 0 ? 1 : 0,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:hold-the-signal`,
      name: 'Hold the Line',
      description: `Survive ${surviveTarget} seconds in a single run.`,
      kind: 'survive-sec',
      targetCount: surviveTarget,
      rewardCred: 75 + (roll % 2) * 20,
      rewardTokens: 1,
      rewardKeys: 0,
    },
    {
      id: `${dayKey}:open-contract`,
      name: 'Open Contract',
      description: `Optional. Defeat ${wildcardTarget} enemies across your runs today for a rare payout.`,
      kind: 'kill-any',
      targetCount: wildcardTarget,
      rewardCred: 40,
      rewardTokens: 0,
      rewardKeys: 1,
    },
    ...sideJobs(dayKey, roll),
  ];
}

export function dailyContractStatuses(
  state: DailyContractState,
  dayKey = contractDayKey(),
): DailyContractStatus[] {
  const active = state.dayKey === dayKey
    ? state
    : { dayKey, progressById: {}, completedIds: [] };
  return dailyContractDefs(dayKey).map((contract) => ({
    ...contract,
    progress: Math.min(contract.targetCount, Math.max(0, Math.floor(active.progressById[contract.id] ?? 0))),
    completed: active.completedIds.includes(contract.id),
  }));
}

function progressFromRun(contract: DailyContractDef, result: RunProgressInput): number {
  switch (contract.kind) {
    case 'clear-area': return result.cleared ? 1 : 0;
    case 'kill-any': return Math.max(0, Math.floor(result.kills));
    case 'survive-sec': return Math.max(0, Math.floor(result.survivedSec));
    case 'kill-enemy': return Math.max(0, Math.floor(result.killsByEnemy?.[contract.targetId ?? ''] ?? 0));
    case 'reach-level': return Math.max(0, Math.floor(result.level ?? 0));
    case 'open-chests': return Math.max(0, Math.floor(result.lootBoxesOpened ?? 0));
    case 'earn-cred': return Math.max(0, Math.floor(result.cred ?? 0));
    case 'clear-district': return result.cleared && result.areaId === contract.targetId ? 1 : 0;
    case 'map-finds': return result.mapFindIds?.length ?? 0;
  }
}

export function advanceDailyContracts(
  state: DailyContractState,
  result: RunProgressInput,
  now = Date.now(),
): DailyContractAdvance {
  const dayKey = contractDayKey(now);
  const current = state.dayKey === dayKey
    ? state
    : { dayKey, progressById: {}, completedIds: [] };
  const progressById = { ...current.progressById };
  const completedIds = [...current.completedIds];
  const completed: DailyContractDef[] = [];

  for (const contract of dailyContractDefs(dayKey)) {
    if (completedIds.includes(contract.id)) continue;
    const runProgress = progressFromRun(contract, result);
    const previous = progressById[contract.id] ?? 0;
    const next = contract.kind === 'survive-sec' || contract.kind === 'reach-level'
      ? Math.max(previous, runProgress)
      : previous + runProgress;
    const capped = Math.min(contract.targetCount, next);
    if (capped > 0) progressById[contract.id] = capped;
    else delete progressById[contract.id];
    if (capped >= contract.targetCount) {
      completedIds.push(contract.id);
      completed.push(contract);
    }
  }

  return {
    dayKey,
    progressById,
    completedIds,
    completed,
    rewardCred: completed.reduce((sum, contract) => sum + contract.rewardCred, 0),
    rewardTokens: completed.reduce((sum, contract) => sum + contract.rewardTokens, 0),
    rewardKeys: completed.reduce((sum, contract) => sum + contract.rewardKeys, 0),
  };
}
