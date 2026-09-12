import { runRecapSchema, type Milestone, type RunRecapProps } from './schema';

export { runRecapSchema, sampleRecap } from './schema';
export type { RunRecapProps, Milestone } from './schema';

/**
 * Loose shape of what the game already has on hand when RunSummary mounts.
 * Declared structurally (not imported) so this package stays free of a
 * workspace dependency on the game — the recap renderer must be buildable on
 * its own, from JSON, without the game's module graph.
 *
 * FIELD MAP — check these four against the real RunSummary props when wiring:
 *   timeSurvivedSeconds  <- summary.elapsed (confirm ms vs seconds)
 *   cred                 <- summary.cred
 *   endedBy              <- summary.killedBy?.displayName
 *   milestones           <- summary.events (may need filtering, see below)
 */
export interface GameRunSummaryLike {
  playerName?: string | null;
  signedIn?: boolean;
  characterId: string;
  characterName?: string;
  stageName?: string;
  endless?: boolean;
  seed?: string;
  endedAt?: string | number | Date;
  outcome?: 'died' | 'cleared' | 'quit';
  killedBy?: string;
  elapsedSeconds: number;
  kills: number;
  level: number;
  cred: number;
  damageTaken?: number;
  personalBest?: { elapsedSeconds: number; kills: number } | null;
  events?: Array<{
    atSeconds: number;
    type: string;
    label: string;
  }>;
}

const MILESTONE_KINDS: Milestone['kind'][] = [
  'level',
  'boss',
  'evolve',
  'close-call',
  'pickup',
];

const toKind = (type: string): Milestone['kind'] =>
  (MILESTONE_KINDS as string[]).includes(type)
    ? (type as Milestone['kind'])
    : 'pickup';

/**
 * Keeps the twelve most legible beats: every boss and evolve, then level-ups
 * spread evenly across the run. A recap that lists all 41 level-ups is a log,
 * not a highlight.
 */
const pickMilestones = (
  events: NonNullable<GameRunSummaryLike['events']>,
): Milestone[] => {
  const mapped = events
    .map((e) => ({ at: e.atSeconds, kind: toKind(e.type), label: e.label }))
    .sort((a, b) => a.at - b.at);

  const priority = mapped.filter(
    (m) => m.kind === 'boss' || m.kind === 'evolve' || m.kind === 'close-call',
  );
  const filler = mapped.filter((m) => !priority.includes(m));

  const slots = Math.max(0, 12 - priority.length);
  const step = filler.length > slots ? Math.ceil(filler.length / slots) : 1;
  const thinned = filler.filter((_, i) => i % step === 0).slice(0, slots);

  return [...priority, ...thinned].sort((a, b) => a.at - b.at);
};

export const toRecapProps = (summary: GameRunSummaryLike): RunRecapProps =>
  runRecapSchema.parse({
    player: {
      name: summary.playerName?.trim() || 'Survivor',
      signedIn: summary.signedIn ?? false,
    },
    run: {
      character: summary.characterName ?? summary.characterId,
      stage: summary.stageName ?? 'Unknown stage',
      mode: summary.endless ? 'endless' : 'standard',
      seed: summary.seed,
      endedAt: new Date(summary.endedAt ?? Date.now()).toISOString(),
      outcome: summary.outcome ?? 'died',
      endedBy: summary.killedBy,
    },
    stats: {
      timeSurvivedSeconds: Math.round(summary.elapsedSeconds),
      kills: summary.kills,
      level: summary.level,
      cred: summary.cred,
      damageTaken: summary.damageTaken,
    },
    best: summary.personalBest
      ? {
          timeSurvivedSeconds: summary.personalBest.elapsedSeconds,
          kills: summary.personalBest.kills,
        }
      : null,
    milestones: pickMilestones(summary.events ?? []),
  });

/** mm:ss — shared by the video and any caller that wants matching copy. */
export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * Re-exported so the game has one import specifier for the whole share path.
 * Nothing in this module graph imports `remotion`, so pulling it into the game
 * bundle costs only the drawing code — the video renderer stays out.
 */
export {
  drawPosterCard,
  posterToBlob,
  shareRecapCard,
} from './poster/drawPosterCard';
