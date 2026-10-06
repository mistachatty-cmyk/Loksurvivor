import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialMeta, serializeMeta } from './state/metaStore';
import { earnedSlotCount, exportForgeState, importForgeState, loadForgedOperators } from './state/operatorForgeStore';
import { parseSaveArchive, serializeSaveArchive } from './state/saveArchive';
import { generateForgedOperator } from './data/operatorForge';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('a portable save includes validated Forge designs and an old save keeps them separate', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
  try {
    const meta = createInitialMeta();
    const operator = generateForgedOperator('archive-check', 'foreman', new Set(), 1);
    assert.equal(importForgeState({ unlocked: true, earned: [], toggles: {}, operators: [operator] }), true);
    const archive = parseSaveArchive(serializeSaveArchive(meta));
    assert.ok(archive);
    assert.equal(archive.legacy, false);
    assert.equal(archive.forge?.operators[0]?.id, operator.id);
    assert.equal(parseSaveArchive(serializeMeta(meta))?.legacy, true);
    assert.equal(parseSaveArchive('{"format":"survivor616-save","version":1,"meta":{},"forge":null}'), null);
    assert.equal(loadForgedOperators().length, 1);
    assert.equal(exportForgeState().operators.length, 1);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('Dev Mode provides all five Forge slots before any end-game unlocks are earned', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    assert.equal(earnedSlotCount(), 0);
    storage.setItem('survivor616.meta.v1', JSON.stringify({ devModeAccessUnlocked: true, devModeAllUnlocks: true }));
    assert.equal(earnedSlotCount(), 5);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
