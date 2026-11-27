/**
 * cartridges.tsx -- the list of Lok Party minigames. To add a game: write its screen and sim,
 * wrap it in a small adapter that returns a MiniOutcome, and add one entry to CARTRIDGES.
 * The hub card, the lobby, the solo flow and the board's round rotation all read this list.
 */

import type { ComponentType } from 'react';
import type { MessageKey } from '@/lib/i18n';
import { DropArena } from './LokDropScreen';
import { RingRunArena } from './RingRunScreen';
import { dropPerformance, dropResults } from './lokDrop';
import { rushPerformance, rushResults } from './ringRun';
import type { CartridgeProps, MiniOutcome } from './cartridge';

export interface LokMinigameCartridge {
  id: string;
  titleKey: MessageKey;
  pitchKey: MessageKey;
  hubPitchKey: MessageKey;
  controlsKeysKey: MessageKey;
  /** Hub button color. */
  accent: string;
  /** Length when played alone from the hub, and as a board round. */
  soloMs: number;
  boardMs: number;
  Component: ComponentType<CartridgeProps>;
}

function DropCartridge(p: CartridgeProps) {
  return (
    <DropArena
      seed={p.seed}
      playerId={p.playerId}
      botSkills={p.botSkills}
      durationMs={p.durationMs}
      getAudioContext={p.getAudioContext}
      onDone={(d) => {
        const res = dropResults(d);
        const mine = res.find((r) => !r.bot) ?? res[0];
        const out: MiniOutcome = {
          seed: d.seed,
          results: res.map((r) => ({ characterId: r.characterId, placement: r.placement, banked: r.banked })),
          perf: dropPerformance(d, mine),
          placement: mine.placement,
          players: res.length,
          banked: mine.banked,
        };
        p.onDone(out);
      }}
    />
  );
}

function RushCartridge(p: CartridgeProps) {
  return (
    <RingRunArena
      seed={p.seed}
      playerId={p.playerId}
      botSkills={p.botSkills}
      durationMs={p.durationMs}
      getAudioContext={p.getAudioContext}
      onDone={(s, newBest) => {
        const res = rushResults(s);
        const mine = res.find((r) => !r.bot) ?? res[0];
        let best = mine.banked;
        try {
          best = Number(window.localStorage.getItem('lokparty.rush.best.v1')) || mine.banked;
        } catch {
          /* private mode */
        }
        const out: MiniOutcome = {
          seed: s.seed,
          results: res.map((r) => ({ characterId: r.characterId, placement: r.placement, banked: r.banked })),
          perf: rushPerformance(s, mine),
          placement: mine.placement,
          players: res.length,
          banked: mine.banked,
          extra: [
            { key: 'lokParty.rush.statRings', params: { count: mine.rings } },
            { key: 'lokParty.rush.statPeak', params: { mult: mine.peakMult } },
            newBest ? { key: 'lokParty.rush.statNewBest', params: { score: best } } : { key: 'lokParty.rush.statBest', params: { score: best } },
          ],
        };
        p.onDone(out);
      }}
    />
  );
}

export const CARTRIDGES: readonly LokMinigameCartridge[] = [
  {
    id: 'rush',
    titleKey: 'lokParty.rush.title',
    pitchKey: 'lokParty.rush.pitch',
    hubPitchKey: 'lokParty.rush.hubPitch',
    controlsKeysKey: 'lokParty.rush.controlsKeys',
    accent: '#ff8fe6',
    soloMs: 30_000,
    boardMs: 30_000,
    Component: RushCartridge,
  },
  {
    id: 'drop',
    titleKey: 'lokParty.drop.title',
    pitchKey: 'lokParty.drop.pitch',
    hubPitchKey: 'lokParty.hub.dropPitch',
    controlsKeysKey: 'lokParty.drop.controlsKeys',
    accent: '#7cff6b',
    soloMs: 60_000,
    boardMs: 30_000,
    Component: DropCartridge,
  },
];

export const CARTRIDGE_IDS: readonly string[] = CARTRIDGES.map((c) => c.id);

export function cartridgeById(id: string): LokMinigameCartridge | undefined {
  return CARTRIDGES.find((c) => c.id === id);
}
