import assert from 'node:assert/strict';
import test from 'node:test';

import { AREAS } from '@/game/data/areas';
import { renderGroundLayer } from '@/game/render/draw';
import {
  SCENERY_AREA_IDS,
  createScenery,
  edgePaletteFor,
  hexToRgb,
  liftGround,
  liftModeFor,
  luma,
  pageLook,
  parseCssColor,
  pickSceneryArea,
  rgbToHex,
  scaleToLuma,
} from './scenery';

const DARK_PAGE = pageLook({ r: 6, g: 7, b: 9 }, null); // the GSix hub
const LIGHT_PAGE = pageLook({ r: 255, g: 255, b: 255 }, null);
const MID_PAGE = pageLook({ r: 128, g: 128, b: 128 }, null);

test('every scenery area id is a real, non-endless area', () => {
  for (const id of SCENERY_AREA_IDS) {
    const area = AREAS.find((a) => a.id === id);
    assert.ok(area, `unknown area id ${id}`);
    assert.ok(!area.endless, `${id} is endless (its scenery needs a stepped world)`);
  }
  assert.ok(SCENERY_AREA_IDS.length >= 9);
});

test('parseCssColor reads computed colours and treats transparent as none', () => {
  assert.deepEqual(parseCssColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30 });
  assert.deepEqual(parseCssColor('rgba(255, 128, 0, 0.9)'), { r: 255, g: 128, b: 0 });
  assert.deepEqual(parseCssColor('rgb(1 2 3 / 50%)'), { r: 1, g: 2, b: 3 });
  assert.equal(parseCssColor('rgba(0, 0, 0, 0)'), null);
  assert.equal(parseCssColor('transparent'), null);
  assert.equal(parseCssColor('not a colour'), null);
});

test('hex helpers round-trip and luma follows perception', () => {
  assert.deepEqual(hexToRgb('#0c1820'), { r: 12, g: 24, b: 32 });
  assert.equal(rgbToHex({ r: 12, g: 24, b: 32 }), '#0c1820');
  assert.equal(rgbToHex({ r: -5, g: 300, b: 12.4 }), '#00ff0c');
  assert.ok(luma({ r: 0, g: 255, b: 0 }) > luma({ r: 255, g: 0, b: 0 }));
  assert.ok(luma({ r: 255, g: 255, b: 255 }) > 254 && luma({ r: 0, g: 0, b: 0 }) === 0);
});

test('scaleToLuma reaches the target luma, keeps the hue ratio, and never blows up near-black', () => {
  const lifted = hexToRgb(scaleToLuma('#0c1820', 82));
  assert.ok(Math.abs(luma(lifted) - 82) < 6, `luma ${luma(lifted).toFixed(1)}`);
  assert.ok(lifted.b > lifted.g && lifted.g > lifted.r, 'teal-blue hue order survives');
  const fromBlack = hexToRgb(scaleToLuma('#000000', 82));
  assert.ok(luma(fromBlack) > 0 && luma(fromBlack) < 20, 'pure black is capped, not turned into noise');
  assert.equal(scaleToLuma('#ffffff', 22, 1.4), rgbToHex({ r: 255 * 0.25 + 0, g: 255 * 0.25, b: 255 * 0.25 }));
});

test('the lift makes a hole VISIBLE: dark pages get bright floors, light pages get deep ones', () => {
  for (const id of SCENERY_AREA_IDS) {
    const base = AREAS.find((a) => a.id === id)!.ground;
    const bright = liftGround(base, 'bright');
    const deep = liftGround(base, 'deep');
    assert.ok(luma(hexToRgb(bright.base)) >= 60, `${id} bright base luma ${luma(hexToRgb(bright.base)).toFixed(0)} (was ${luma(hexToRgb(base.base)).toFixed(0)})`);
    assert.ok(luma(hexToRgb(bright.base)) - DARK_PAGE.luma >= 50, `${id} contrasts the dark hub page`);
    assert.ok(LIGHT_PAGE.luma - luma(hexToRgb(deep.base)) >= 150, `${id} contrasts a white page`);
    assert.equal(bright.glow, base.glow);
    assert.equal(bright.seam, base.seam);
  }
});

test('page look: transparent backgrounds are white, warm accents read warm, lift mode follows lightness', () => {
  assert.equal(pageLook(null, null).luma, 255);
  assert.ok(pageLook({ r: 0, g: 0, b: 0 }, { r: 240, g: 120, b: 20 }).warmth > 0.25);
  assert.ok(pageLook({ r: 0, g: 0, b: 0 }, { r: 20, g: 120, b: 240 }).warmth < -0.25);
  assert.equal(liftModeFor(DARK_PAGE), 'bright');
  assert.equal(liftModeFor(LIGHT_PAGE), 'deep');
  assert.equal(liftModeFor(MID_PAGE), 'deep');
});

test('scenery choice is deterministic, varies by site, and comes from the right pool', () => {
  assert.equal(pickSceneryArea(DARK_PAGE, 'example.com'), pickSceneryArea(DARK_PAGE, 'example.com'));
  const seen = new Set(['a.com', 'b.org', 'c.net', 'd.io', 'e.dev', 'f.app', 'g.xyz'].map((s) => pickSceneryArea(DARK_PAGE, s)));
  assert.ok(seen.size > 1, 'different sites do not all get the same floor');
  const warm = pageLook({ r: 5, g: 5, b: 5 }, { r: 250, g: 100, b: 10 });
  assert.ok(['old-market', 'monroe-strip', 'clockmouth-roundabout'].includes(pickSceneryArea(warm, 'x')));
  const light = pickSceneryArea(LIGHT_PAGE, 'x');
  assert.ok(['null-sector', 'civic-plaza', 'soul-foundry'].includes(light));
});

test('edge colours separate the hole from the page: bright rim on dark pages, near-black rim on light ones', () => {
  const dark = edgePaletteFor(DARK_PAGE, '#35d0bb');
  const light = edgePaletteFor(LIGHT_PAGE, '#35d0bb');
  const channel = (v: number, shift: number) => (v >>> shift) & 255;
  assert.ok(channel(dark.rim, 0) > 100 && channel(dark.rim, 8) > 150, 'light rim on a dark page');
  assert.ok(channel(light.rim, 0) < 40 && channel(light.rim, 8) < 40, 'dark rim on a light page');
  assert.ok(channel(dark.shade, 24) > 0 && channel(light.scorch, 24) > 0);
});

test('createScenery builds a never-stepped second world from a real area with the lifted palette', () => {
  const s = createScenery(DARK_PAGE, 'gsix.online');
  const real = AREAS.find((a) => a.id === s.areaId)!;
  assert.equal(s.world.area.id, real.id);
  assert.notEqual(s.world.area.ground.base, real.ground.base, 'palette was lifted');
  assert.equal(s.world.area.ground.base, s.ground.base);
  assert.equal(s.world.enemies.length, 0);
  assert.equal(s.world.area.obstacles.length, 0);
  assert.equal(s.world.area.waves.length, 0);
  assert.equal(s.world.time, 0, 'it is never stepped');
});

/** A canvas stand-in that records fillRect calls and ignores everything else. */
function recordingContext() {
  const fills: Array<{ style: unknown; args: number[] }> = [];
  let style: unknown = '';
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 640, height: 360 };
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'fillStyle') return style;
      return (...args: unknown[]) => {
        if (prop === 'fillRect') fills.push({ style, args: args as number[] });
        return new Proxy({}, handler);
      };
    },
    set(_t, prop, value) {
      if (prop === 'fillStyle') style = value;
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, fills };
}

test('renderGroundLayer paints the lifted ground (base fill + tiles) and nothing from the actor layer', () => {
  const s = createScenery(DARK_PAGE, 'gsix.online');
  const rec = recordingContext();
  renderGroundLayer(rec.ctx, s.world, { width: 427, height: 240, dpr: 1, targetViewOverride: 427 * 2.05 }, { x: 0, y: 0 });
  assert.ok(rec.fills.length > 20, `drew ${rec.fills.length} fills`);
  assert.ok(rec.fills.some((f) => f.style === s.ground.base), 'the lifted base colour was used');
  assert.ok(rec.fills.some((f) => f.style === s.ground.tile), 'the lifted tile colour was used');
});

test('renderGroundLayer is deterministic in (world, camera) and rejects a degenerate view', () => {
  const s = createScenery(DARK_PAGE, 'x');
  const a = recordingContext();
  const b = recordingContext();
  const view = { width: 200, height: 120, dpr: 1, targetViewOverride: 410 };
  renderGroundLayer(a.ctx, s.world, view, { x: 123, y: -45 });
  renderGroundLayer(b.ctx, s.world, view, { x: 123, y: -45 });
  assert.deepEqual(a.fills, b.fills);
  const c = recordingContext();
  renderGroundLayer(c.ctx, s.world, { width: 0, height: 120, dpr: 1 }, { x: 0, y: 0 });
  assert.equal(c.fills.length, 0);
});
