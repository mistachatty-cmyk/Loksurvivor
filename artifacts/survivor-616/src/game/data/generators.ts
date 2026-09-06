export interface GeneratorDef {
  id: string;
  name: string;
  description: string;
  /** One-time cred cost to build/rent. */
  cost: number;
  credPerMinute: number;
}

/**
 * Rentable/buildable passive cred sources, shown in the Hideout. Owning one
 * accrues cred over time (settled lazily off a timestamp, same pattern as
 * pet-elixir regeneration and fatigue recovery -- see `settleGeneratorIncome`
 * in `state/metaStore.tsx`), including while the player is away.
 */
export const RENTABLE_GENERATORS: GeneratorDef[] = [
  {
    id: 'lemonade-stand',
    name: 'Lemonade Stand',
    description: 'A folding table on Monroe. Slow, steady, wholesome.',
    cost: 150,
    credPerMinute: 2,
  },
  {
    id: 'pawn-window',
    name: 'Pawn Shop Window',
    description: 'Rented display space facing the sidewalk. Modest foot traffic, modest cut.',
    cost: 500,
    credPerMinute: 6,
  },
  {
    id: 'rooftop-antenna',
    name: 'Rooftop Antenna Lease',
    description: 'Someone always needs signal. Unglamorous, reliable, always on.',
    cost: 1200,
    credPerMinute: 14,
  },
];

export const RENTABLE_GENERATORS_BY_ID: Record<string, GeneratorDef> = Object.fromEntries(
  RENTABLE_GENERATORS.map((generator) => [generator.id, generator]),
);
