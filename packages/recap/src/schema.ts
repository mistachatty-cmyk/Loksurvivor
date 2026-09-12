import { z } from 'zod';

/**
 * The contract between the game and the renderer.
 *
 * Everything the video shows has to arrive through here — no reaching into game
 * state from inside a composition. That keeps the video renderable from a saved
 * JSON blob months after the run happened, and keeps Studio props editable.
 */

export const milestoneSchema = z.object({
  /** Seconds into the run. */
  at: z.number().min(0),
  kind: z.enum(['level', 'boss', 'evolve', 'close-call', 'pickup']),
  label: z.string(),
});

export const runRecapSchema = z.object({
  player: z.object({
    name: z.string(),
    signedIn: z.boolean().default(false),
  }),
  run: z.object({
    character: z.string(),
    stage: z.string(),
    mode: z.enum(['standard', 'endless']),
    seed: z.string().optional(),
    /** ISO timestamp — used for the date stamp only. */
    endedAt: z.string(),
    outcome: z.enum(['died', 'cleared', 'quit']),
    /** What actually killed them. Shown in the send-off. */
    endedBy: z.string().optional(),
  }),
  stats: z.object({
    timeSurvivedSeconds: z.number().min(0),
    kills: z.number().min(0),
    level: z.number().min(0),
    cred: z.number().min(0),
    damageTaken: z.number().min(0).optional(),
  }),
  /** Previous personal best, when there is one. Drives the gold treatment. */
  best: z
    .object({
      timeSurvivedSeconds: z.number().min(0),
      kills: z.number().min(0),
    })
    .nullable()
    .default(null),
  /** Level-ups, bosses, evolves. Sorted ascending by `at`; capped at 12 in the arc scene. */
  milestones: z.array(milestoneSchema).default([]),
});

export type RunRecapProps = z.infer<typeof runRecapSchema>;
export type Milestone = z.infer<typeof milestoneSchema>;

/** Studio default so the composition is never empty on open. */
export const sampleRecap: RunRecapProps = {
  player: { name: 'IWEU', signedIn: true },
  run: {
    character: 'Static Priest',
    stage: 'Undercity Grid',
    mode: 'endless',
    seed: '7F4-QQ2',
    endedAt: '2026-09-11T05:05:00.000Z',
    outcome: 'died',
    endedBy: 'Warden swarm',
  },
  stats: {
    timeSurvivedSeconds: 1284,
    kills: 3172,
    level: 41,
    cred: 8640,
    damageTaken: 912,
  },
  best: { timeSurvivedSeconds: 1105, kills: 2988 },
  milestones: [
    { at: 42, kind: 'level', label: 'Lv 5' },
    { at: 180, kind: 'evolve', label: 'Arc Lash evolved' },
    { at: 305, kind: 'boss', label: 'Meter Warden down' },
    { at: 470, kind: 'level', label: 'Lv 20' },
    { at: 612, kind: 'close-call', label: '4 HP' },
    { at: 840, kind: 'boss', label: 'Twin Feeds down' },
    { at: 1010, kind: 'evolve', label: 'Ledger Halo evolved' },
    { at: 1284, kind: 'level', label: 'Lv 41' },
  ],
};
