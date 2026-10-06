import { parseMetaFile } from './metaStore';
import type { MetaState } from '@/game/types';
import { exportForgeState, isValidForgeState, type ForgeState } from './operatorForgeStore';

const ARCHIVE_FORMAT = 'survivor616-save';

export type ParsedSaveArchive = { meta: MetaState; forge: ForgeState | null; legacy: boolean };

/** Portable progress plus Forge designs. Device-only music files are not included. */
export function serializeSaveArchive(meta: MetaState): string {
  return JSON.stringify({ format: ARCHIVE_FORMAT, version: 1, meta, forge: exportForgeState() }, null, 2);
}

export function parseSaveArchive(raw: string): ParsedSaveArchive | null {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.format === ARCHIVE_FORMAT) {
    if (record.version !== 1 || !isValidForgeState(record.forge)) return null;
    const meta = parseMetaFile(JSON.stringify(record.meta));
    return meta ? { meta, forge: record.forge as ForgeState, legacy: false } : null;
  }
  const meta = parseMetaFile(raw);
  return meta ? { meta, forge: null, legacy: true } : null;
}
