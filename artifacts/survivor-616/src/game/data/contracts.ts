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

/** Three deterministic contracts: a clear, a crowd-control quota, and a hold-the-line target. */
export function dailyContractDefs(dayKey = contractDayKey()): DailyContractDef[] {
  const roll = dayNumber(dayKey);
  const killTarget = 60 + (roll % 3) * 20;
  const surviveTarget = 75 + (roll % 3) * 15;
  return [
    {
      id: `${dayKey}:street-sweep`,
      name: 'Street Sweep',
      description: 'Clear any district. The signal wants one block quieter.',
      kind: 'clear-area',
      targetCount: 1,
      rewardCred: 55 + (roll % 2) * 15,
      rewardTokens: 0,
    },
    {
      id: `${dayKey}:crowd-control`,
      name: 'Crowd Control',
      description: `Defeat ${killTarget} enemies across your runs today.`,
      kind: 'kill-any',
      targetCount: killTarget,
      rewardCred: 65 + (roll % 3) * 10,
      rewardTokens: roll % 3 === 0 ? 1 : 0,
    },
    {
      id: `${dayKey}:hold-the-signal`,
      name: 'Hold the Signal',
      description: `Survive ${surviveTarget} seconds in a single run.`,
      kind: 'survive-sec',
      targetCount: surviveTarget,
      rewardCred: 75 + (roll % 2) * 20,
      rewardTokens: 1,
    },
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

function progressFromRun(contract: DailyContractDef, result: Pick<RunResult, 'cleared' | 'kills' | 'survivedSec'>): number {
  if (contract.kind === 'clear-area') return result.cleared ? 1 : 0;
  if (contract.kind === 'kill-any') return Math.max(0, Math.floor(result.kills));
  return Math.max(0, Math.floor(result.survivedSec));
}

export function advanceDailyContracts(
  state: DailyContractState,
  result: Pick<RunResult, 'cleared' | 'kills' | 'survivedSec'>,
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
    const next = contract.kind === 'survive-sec'
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
  };
}