import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TacticalCamera } from '@/systems/TacticalCamera';
import { FogRenderer, type Entity } from '@/systems/FogRenderer';

test('TacticalCamera initializes with default values and player position', () => {
  const camera = new TacticalCamera(100, 200);
  assert.equal(camera.isTactical(), false);
  assert.deepEqual(camera.getPosition(), { x: 100, y: 200 });
  assert.equal(camera.getVisionRadius(), 400);
});

test('TacticalCamera toggleTacticalView toggles mode and vision radius', () => {
  const camera = new TacticalCamera(0, 0);
  assert.equal(camera.isTactical(), false);
  assert.equal(camera.getVisionRadius(), 400);

  camera.toggleTacticalView();
  assert.equal(camera.isTactical(), true);
  assert.equal(camera.getVisionRadius(), 300);

  camera.toggleTacticalView();
  assert.equal(camera.isTactical(), false);
  assert.equal(camera.getVisionRadius(), 400);
});

test('TacticalCamera setTargetView adapts target zoom smoothly', () => {
  const camera = new TacticalCamera(0, 0);
  const width = 1000;
  const baseTargetView = 500; // Base zoom would be 2.0
  camera.setTargetView(width, baseTargetView);

  // Initialized zoom matches target zoom on first call
  assert.equal(camera.getZoom(), 2.0);

  // Switching to tactical view reduces target zoom
  camera.toggleTacticalView();
  camera.setTargetView(width, baseTargetView);
  assert.equal(camera.getTargetZoom(), 2.0 * 0.35);

  // Updating camera moves zoom towards target zoom
  camera.update(50, 60, 0.016);
  assert.deepEqual(camera.getPosition(), { x: 50, y: 60 });
  assert.ok(camera.getZoom() < 2.0);
});

test('TacticalCamera isInVisionRadius and distance calculations work', () => {
  const camera = new TacticalCamera(0, 0);
  assert.equal(camera.isInVisionRadius(100, 0), true);
  assert.equal(camera.isInVisionRadius(450, 0), false);
  assert.equal(camera.getDistanceFromPlayer(300, 400), 500);
});

test('FogRenderer handles edge cases gracefully without throwing', () => {
  const fog = new FogRenderer();
  const camera = new TacticalCamera(0, 0);

  // Mock CanvasRenderingContext2D methods
  const calls: string[] = [];
  const mockCtx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    setTransform: () => calls.push('setTransform'),
    translate: () => calls.push('translate'),
    scale: () => calls.push('scale'),
    fillRect: () => calls.push('fillRect'),
    beginPath: () => calls.push('beginPath'),
    arc: () => calls.push('arc'),
    fill: () => calls.push('fill'),
    createRadialGradient: (_x0: number, _y0: number, r0: number, _x1: number, _y1: number, r1: number) => {
      assert.ok(r0 >= 0, 'r0 must be non-negative');
      assert.ok(r1 >= r0, 'r1 must be >= r0');
      return {
        addColorStop: () => {},
      };
    },
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
  } as unknown as CanvasRenderingContext2D;

  const entities: Entity[] = [
    { id: '1', x: 800, y: 0, type: 'enemy' },
    { id: '2', x: 100, y: 100, type: 'elite' },
    { id: '3', x: 2000, y: 2000, type: 'boss' }, // outside viewport
  ];

  assert.doesNotThrow(() => {
    fog.renderFog(mockCtx, camera, 1000, 800, 1.5);
    fog.renderDistantEyes(mockCtx, camera, entities, 1000, 800, 0.016, 1.5);
    fog.renderTacticalVignette(mockCtx, 1000, 800, 1.5);
  });

  // Verify zero or negative dimensions are handled safely
  assert.doesNotThrow(() => {
    fog.renderFog(mockCtx, camera, 0, 0, 1);
    fog.renderDistantEyes(mockCtx, camera, entities, -10, 0, 0.016, 1);
    fog.renderTacticalVignette(mockCtx, 0, 0, 1);
  });
});
