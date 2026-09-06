import assert from 'node:assert/strict';
import test from 'node:test';

import { assetFromId, objectiveMarkersOf, spawnPointsOf } from './customMaps';
import { ENEMIES_BY_ID } from './enemies';
import { SECTOR_MAPS } from './sectorMaps';
import { SECTOR_MISSIONS, SECTOR_MISSIONS_BY_ID } from './sectorMissions';
import { SECTOR_UNITS, isCapturable } from './sectorUnits';

test('every authored sector map resolves all of its asset ids', () => {
  for (const map of SECTOR_MAPS) {
    assert.ok(assetFromId(map.groundAssetId), `${map.id} has unknown ground ${map.groundAssetId}`);
    for (const placement of map.placements) {
      const asset = assetFromId(placement.assetId);
      assert.ok(asset, `${map.id} places unknown asset ${placement.assetId}`);
      assert.equal(asset.category, placement.category, `${map.id}: ${placement.assetId} category mismatch`);
    }
  }
});

test('every authored sector map has exactly one player start and at least one hostile entry', () => {
  for (const map of SECTOR_MAPS) {
    assert.equal(spawnPointsOf(map, 'player').length, 1, `${map.id} should have exactly one player start`);
    assert.ok(spawnPointsOf(map, 'hostile').length > 0, `${map.id} needs at least one hostile entry`);
  }
});

test('sector map placements stay inside their own bounds', () => {
  for (const map of SECTOR_MAPS) {
    for (const placement of map.placements) {
      assert.ok(
        Math.abs(placement.x) <= map.bounds.w / 2 && Math.abs(placement.y) <= map.bounds.h / 2,
        `${map.id}: ${placement.assetId} at ${placement.x},${placement.y} is outside ${map.bounds.w}x${map.bounds.h}`,
      );
    }
  }
});

test('missions load, and each has a required objective plus a resolvable map', () => {
  // Loading this module at all exercises the mission() factory's guards.
  assert.ok(SECTOR_MISSIONS.length > 0);
  for (const mission of SECTOR_MISSIONS) {
    assert.ok(mission.objectives.some((objective) => !objective.optional), `${mission.id} has no required objective`);
    assert.ok(mission.squadCap > 0);
    assert.ok(mission.durationSec > 0);
  }
});

test('mission marker objectives point at markers the map actually places', () => {
  for (const mission of SECTOR_MISSIONS) {
    for (const objective of mission.objectives) {
      if (!objective.markerAssetId) continue;
      const map = SECTOR_MAPS.find((entry) => entry.id === mission.mapId)!;
      const markers = objectiveMarkersOf(map).filter((placement) => placement.assetId === objective.markerAssetId);
      assert.ok(markers.length > 0, `${mission.id}/${objective.id} wants ${objective.markerAssetId}`);
    }
  }
});

test('mission prerequisites reference real missions and never form a self-loop', () => {
  for (const mission of SECTOR_MISSIONS) {
    for (const requiredId of mission.requiresMissionIds ?? []) {
      assert.ok(SECTOR_MISSIONS_BY_ID[requiredId], `${mission.id} requires unknown mission ${requiredId}`);
      assert.notEqual(requiredId, mission.id, `${mission.id} requires itself`);
    }
  }
});

test('capturable units reference real enemies and are never bosses', () => {
  for (const unit of SECTOR_UNITS) {
    const enemy = ENEMIES_BY_ID[unit.enemyId];
    assert.ok(enemy, `sector unit references unknown enemy ${unit.enemyId}`);
    assert.notEqual(enemy.family, 'Boss', `${unit.enemyId} is a boss and must not be capturable`);
    assert.ok(unit.squadCost > 0);
    assert.ok(unit.captureHpFraction > 0 && unit.captureHpFraction < 1);
  }
  assert.equal(isCapturable('nightcrawler'), true);
  assert.equal(isCapturable('the-sire'), false);
});

test('each mission agrees with its map about how long the run is', () => {
  // The two values are authored separately (the mission for the briefing, the
  // map for the actual run clock). Nothing but this test stops them drifting,
  // and drift would make a mission fail on a timer the briefing never showed.
  for (const mission of SECTOR_MISSIONS) {
    const map = SECTOR_MAPS.find((entry) => entry.id === mission.mapId)!;
    assert.equal(
      mission.durationSec,
      map.durationSec,
      `${mission.id} says ${mission.durationSec}s but ${map.id} runs ${map.durationSec}s`,
    );
  }
});

test('kill-enemy objectives name enemies that exist and can actually spawn', () => {
  for (const mission of SECTOR_MISSIONS) {
    const map = SECTOR_MAPS.find((entry) => entry.id === mission.mapId)!;
    for (const objective of mission.objectives) {
      if (!objective.enemyId) continue;
      assert.ok(ENEMIES_BY_ID[objective.enemyId], `${mission.id} targets unknown enemy ${objective.enemyId}`);
      // An objective asking you to kill something the map never spawns is
      // impossible, which the type system cannot see.
      const spawns = map.placements.some((placement) =>
        (placement.category === 'enemy' || placement.category === 'encounter') &&
        placement.assetId.endsWith(`:${objective.enemyId}`));
      assert.ok(spawns, `${mission.id}/${objective.id} wants ${objective.enemyId}, which ${map.id} never spawns`);
    }
  }
});
