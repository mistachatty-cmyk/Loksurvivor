import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import {
  CUSTOM_MAP_ASSETS,
  CUSTOM_MAP_ASSET_CATEGORIES,
  CUSTOM_MAP_GRID,
  MAX_CUSTOM_MAP_PLACEMENTS,
  customMapToArea,
  customMapValidationIssues,
  createCustomMap,
  normalizeCustomMap,
  normalizeCustomMaps,
  areaToCustomMapTemplate,
  generateCustomMap,
} from '@/game/data/customMaps';
import { MAP_PREFABS, expandMapPrefab } from '@/game/data/mapPack';

test('custom map catalog has an asset for every supported editor category', () => {
  for (const category of CUSTOM_MAP_ASSET_CATEGORIES) {
    assert.ok(CUSTOM_MAP_ASSETS.some((asset) => asset.category === category.id), `missing ${category.id} asset`);
  }
  assert.ok(CUSTOM_MAP_ASSETS.some((asset) => asset.category === 'ground' && asset.areaId));
  assert.ok(CUSTOM_MAP_ASSETS.some((asset) => asset.category === 'enemy' && asset.enemyId));
  assert.ok(CUSTOM_MAP_ASSETS.some((asset) => asset.category === 'encounter' && asset.wave));
});

test('normalization safely removes invalid and oversized placements', () => {
  const source = createCustomMap('custom-normalize');
  const validEnemy = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'enemy')!;
  const validPlacement = {
    id: 'valid',
    assetId: validEnemy.id,
    category: 'enemy' as const,
    x: 99999,
    y: -99999,
    w: 999,
    h: 1,
  };
  const normalized = normalizeCustomMap({
    ...source,
    placements: [
      ...Array.from({ length: MAX_CUSTOM_MAP_PLACEMENTS + 5 }, (_, index) => ({ ...validPlacement, id: `enemy-${index}` })),
      { id: 'bad', assetId: 'not-real', category: 'enemy', x: 0, y: 0, w: 10, h: 10 },
    ],
  }, source.id)!;

  assert.equal(normalized.placements.length, MAX_CUSTOM_MAP_PLACEMENTS);
  assert.equal(normalized.placements[0]?.w, 360);
  assert.equal(normalized.placements[0]?.h, 12);
  assert.ok(normalized.placements.every((placement) => Math.abs(placement.x) <= source.bounds.w / 2));
  assert.equal(normalizeCustomMap(null), null);
});

test('custom map conversion uses existing ground, obstacles, hazards, and waves', () => {
  const source = createCustomMap('custom-convert');
  const ground = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'ground')!;
  const structure = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'structure')!;
  const hazard = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'hazard')!;
  const encounter = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'encounter')!;
  const map = normalizeCustomMap({
    ...source,
    groundAssetId: ground.id,
    placements: [
      { id: 'structure', assetId: structure.id, category: 'structure', x: 0, y: 0, w: 60, h: 60 },
      { id: 'hazard', assetId: hazard.id, category: 'hazard', x: 80, y: 0, w: 70, h: 54 },
      { id: 'encounter', assetId: encounter.id, category: 'encounter', x: -80, y: 0, w: 40, h: 40 },
    ],
  }, source.id)!;
  const area = customMapToArea(map);

  assert.equal(area.id, source.id);
  assert.equal(area.bounds.w, source.bounds.w);
  assert.equal(area.ground.glow, AREAS.find((candidate) => candidate.id === ground.areaId)!.ground.glow);
  assert.ok(area.obstacles.some((obstacle) => obstacle.kind === 'pothole'));
  assert.ok(area.obstacles.some((obstacle) => obstacle.kind === structure.id.slice('structure:'.length)));
  assert.ok(area.waves.some((wave) => wave.enemyId === encounter.enemyId));
  assert.equal(area.durationSec, source.durationSec);
});

test('launch validation rejects routes without threat assets and preserves normalized maps', () => {
  const source = createCustomMap('custom-empty');
  assert.ok(customMapValidationIssues(source).some((issue) => issue.includes('enemy')));
  assert.equal(normalizeCustomMaps([{ ...source, id: 'not-custom' }])[0]?.id, 'custom-import-1');
  assert.equal(normalizeCustomMaps([source, source]).length, 1);
  assert.equal(CUSTOM_MAP_GRID, 20);
});

test('the visual editor exposes every obstacle kind already used by an area', () => {
  const representedKinds = new Set(
    CUSTOM_MAP_ASSETS.filter((asset) => asset.category === 'structure' && asset.id.startsWith('structure:')).map((asset) => asset.id.replace('structure:', '')),
  );
  const usedKinds = new Set(AREAS.flatMap((area) => area.obstacles.map((obstacle) => obstacle.kind)));
  usedKinds.delete('pothole');
  usedKinds.delete('map-prop');
  assert.deepEqual([...representedKinds].sort(), [...usedKinds].sort());
});

test('shipped breach arenas use the versioned editor format without losing finds or starts', () => {
  for (const id of ['floodline-breach', 'glassroot-annex']) {
    const source = AREAS.find((area) => area.id === id)!;
    const draft = areaToCustomMapTemplate(source, `custom-${id}`);
    const saved = normalizeCustomMap(JSON.parse(JSON.stringify(draft)), draft.id)!;
    const runtime = customMapToArea(saved);
    assert.equal(saved.version, 2);
    assert.deepEqual(runtime.playerStart, source.playerStart);
    assert.deepEqual(runtime.mapInteractables?.map((entry) => entry.kind), source.mapInteractables?.map((entry) => entry.kind));
    assert.deepEqual(runtime.waves.map((wave) => wave.spawnAt), source.waves.map((wave) => wave.spawnAt));
    assert.deepEqual(runtime.authoredGroundTiles, source.authoredGroundTiles);
    assert.equal(runtime.mapFeature, source.mapFeature);
    assert.deepEqual(customMapValidationIssues(saved), []);
  }
});

test('seeded remixes and prefab quarter turns are deterministic', () => {
  const first = generateCustomMap('alpha', 'breach', 'custom-seed');
  const second = generateCustomMap('alpha', 'breach', 'custom-seed');
  assert.deepEqual(first.placements, second.placements);
  assert.notDeepEqual(first.placements, generateCustomMap('beta', 'breach', 'custom-seed').placements);
  const prefab = MAP_PREFABS[0]!;
  const placed = expandMapPrefab(prefab, { x: 100, y: 80 }, 'group', 1);
  assert.equal(placed[0]?.x, 100 - prefab.pieces[0]!.y);
  assert.equal(placed[0]?.y, 80 + prefab.pieces[0]!.x);
});

test('painted ground tiles survive normalization and reach the real renderer area', () => {
  const map = createCustomMap('custom-painted-ground');
  const tile = CUSTOM_MAP_ASSETS.find((asset) => asset.category === 'tile');
  assert.ok(tile?.groundStyle);
  map.placements.push({ id: 'paint-1', assetId: tile.id, category: 'tile', x: 40, y: -20, w: 64, h: 64 });

  const normalized = normalizeCustomMap(map, map.id);
  assert.equal(normalized?.placements[0]?.category, 'tile');
  const area = customMapToArea(normalized!);
  assert.deepEqual(area.authoredGroundTiles?.[0], { x: 40, y: -20, w: 64, h: 64, ...tile.groundStyle });
});

test('a placed root anchor creates its destructible node in playtest', () => {
  const map = createCustomMap('custom-anchor');
  map.placements.push({ id: 'anchor', assetId: 'interactable:root-anchor', category: 'interactable', x: 80, y: 40, w: 70, h: 70 });
  const area = customMapToArea(map);
  assert.equal(area.mapInteractables?.[0]?.kind, 'root-anchor');
  assert.equal(area.obstacles.filter((obstacle) => obstacle.artAssetId === 'node-pylon' && obstacle.x === 80 && obstacle.y === 40).length, 1);
});
