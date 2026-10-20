import type { LokPetTraining, LokPetTrainingStat, SavedLokPet } from '@/game/types';

export const TRAINING_DATA_RESPEC_COST = 25;

export const LOKPET_TRAINING_STATS: Array<{
  id: LokPetTrainingStat;
  label: string;
  description: string;
}> = [
  { id: 'vigor', label: 'Vigor', description: '+2% maximum HP per rank.' },
  { id: 'fury', label: 'Fury', description: '+2% attack per rank.' },
  { id: 'guard', label: 'Guard', description: '+2% defense per rank.' },
  { id: 'pace', label: 'Pace', description: '+2% speed per rank.' },
  { id: 'spirit', label: 'Spirit', description: '+1% skill/ultimate power, +1.5 starting energy, and bond at every 5th rank.' },
];

export function normalizeLokPetTraining(value: unknown, starter = false): LokPetTraining {
  const record = value && typeof value === 'object' ? value as Partial<LokPetTraining> : {};
  const cap = starter ? 20 : 10;
  const rank = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(cap, Math.floor(n))) : 0;
  return {
    vigor: rank(record.vigor),
    fury: rank(record.fury),
    guard: rank(record.guard),
    pace: rank(record.pace),
    spirit: rank(record.spirit),
  };
}

/** One point for every level gained, with a bonus point at each natural evolution. */
export function lokPetTrainingAllowance(level: number | undefined, starter: boolean | undefined): number {
  const boundedLevel = Math.max(1, Math.floor(level || 1));
  const evolutionLevels = starter ? [33, 66] : [15, 30];
  return boundedLevel - 1 + evolutionLevels.filter((evolutionLevel) => boundedLevel >= evolutionLevel).length;
}

export function lokPetUnspentTrainingPoints(pet: Pick<SavedLokPet, 'level' | 'starter' | 'training'>): number {
  const training = normalizeLokPetTraining(pet.training, pet.starter);
  const spent = training.vigor + training.fury + training.guard + training.pace + training.spirit;
  return Math.max(0, lokPetTrainingAllowance(pet.level, pet.starter) - spent);
}

export function trainLokPet(pet: SavedLokPet, stat: LokPetTrainingStat): SavedLokPet | null {
  const training = normalizeLokPetTraining(pet.training, pet.starter);
  const cap = pet.starter ? 20 : 10;
  if (training[stat] >= cap || lokPetUnspentTrainingPoints(pet) < 1) return null;
  return { ...pet, training: { ...training, [stat]: training[stat] + 1 } };
}
