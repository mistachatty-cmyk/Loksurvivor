import { arcBuilder, definePiece, lineBuilder, trackBuilder } from '@/game/data/streetLife/pieceKit';

/**
 * Every ring piece that can appear on a street, in roll order. Add a piece by appending one definePiece.
 * The first three keep the salts they always had, so existing seeded streets did not change.
 * New pieces go at the end so they only claim shares of chunks that were empty before.
 */
export const STREET_PIECES = [
  definePiece({
    id: 'ring-run', name: 'Ring Run', chance: 0.05,
    build: trackBuilder({ gates: [8, 11], length: 520, sway: [34, 60], salt: 2 }),
  }),
  definePiece({
    id: 'ring-field', name: 'Ring field', chance: 0.10,
    build: arcBuilder({ count: [5, 8], span: 460, bow: 70, speedShare: 0.45, coinShare: 0.40, salt: 5, kindSalt: 10 }),
  }),
  definePiece({
    id: 'ring-line', name: 'Speed line', chance: 0.15,
    build: lineBuilder({ count: [1, 3], spacing: 130, kind: 'speed', salt: 7, jitterSalt: 20 }),
  }),
  // New pieces, built from the same kit with different numbers.
  definePiece({
    id: 'sprint-lane', name: 'Sprint lane', chance: 0.03,
    build: trackBuilder({ gates: [5, 6], length: 300, sway: [20, 34], coinsPerSegment: 4, salt: 30, kindFor: (i, n) => (i === 0 ? 'coin' : i === n - 1 ? 'surge' : 'speed') }),
  }),
  definePiece({
    id: 'gauntlet', name: 'Gauntlet', chance: 0.02,
    build: trackBuilder({ gates: [12, 14], length: 560, sway: [50, 80], coinsPerSegment: 2, salt: 40 }),
  }),
  definePiece({
    id: 'jackpot-arc', name: 'Jackpot arc', chance: 0.02,
    build: arcBuilder({ count: [6, 9], span: 420, bow: 90, speedShare: 0.2, coinShare: 0.7, salt: 50, kindSalt: 100 }),
  }),
] as const;
