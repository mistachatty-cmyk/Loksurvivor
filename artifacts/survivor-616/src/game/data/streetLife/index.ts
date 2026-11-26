import { makeContext, resolvePiece } from '@/game/data/streetLife/pieceKit';
import type { ChunkRingLayout } from '@/game/data/ringRuns';
import { STREET_PIECES } from '@/game/data/streetLife/pieces';

/**
 * What a chunk carries. The origin chunk stays clear so a run never starts inside a track.
 * `pieceId` says which piece was picked, for the minimap and for tests.
 */
export function streetLifeForChunk(cx: number, cy: number, seed: number, axis: 'horizontal' | 'vertical'): ChunkRingLayout & { pieceId: string | null } {
  if (cx === 0 && cy === 0) return { free: [], track: null, pieceId: null };
  const picked = resolvePiece(STREET_PIECES, makeContext(cx, cy, seed, axis));
  if (!picked) return { free: [], track: null, pieceId: null };
  return { free: picked.output.free ?? [], track: picked.output.track ?? null, pieceId: picked.piece.id };
}

export { STREET_PIECES } from '@/game/data/streetLife/pieces';
