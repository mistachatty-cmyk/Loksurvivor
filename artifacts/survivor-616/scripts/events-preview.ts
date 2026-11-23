/**
 * Renders one run event (a supply drop, a blackout, ...) at a chosen screen size and hands back
 * still frames, so a beat can be looked at without playing a whole run. Open
 * `scripts/events-preview.html?event=blackout&w=390&h=664&area=monroe-strip` in the dev server,
 * then read `window.__shots` (data URLs: warning, middle, end). Not shipped; used by `scripts/events-shots.mjs`.
 */
import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { RUN_EVENTS_BY_ID, type RunEventId } from '@/game/data/runEvents';
import { createWorld, stepWorld } from '@/game/engine/world';
import { renderWorld } from '@/game/render/draw';

const params = new URLSearchParams(location.search);
const eventId = (params.get('event') ?? 'supply-drop') as RunEventId;
const width = Number(params.get('w') ?? 1000);
const height = Number(params.get('h') ?? 640);
const areaId = params.get('area') ?? 'monroe-strip';
const def = RUN_EVENTS_BY_ID[eventId];
const canvas = document.getElementById('c') as HTMLCanvasElement;
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d', { alpha: false })!;
const base = AREAS.find((a) => a.id === areaId) ?? AREAS[0]!;
const area = { ...base, durationSec: 99999, musicEvents: undefined, rescueAllyId: undefined };
const c = CHARACTERS[0]!;
const w = createWorld(area, c, c.stats, 7, [], 1, true, null, {
  graphicsQuality: 'high',
  runtimePerformanceTier: 'desktop',
  modifiers: {},
  runEvents: { mapsCleared: 12 },
});
w.player.invulnUntil = Infinity;
w.player.hp = w.player.maxHp = 1e9;
const startMs = 2000;
w.runEvents.schedule = [{ id: eventId, startMs }];

const marks = [
  startMs + def.warnMs * 0.8,
  startMs + def.warnMs + def.activeMs * 0.5,
  startMs + def.warnMs + def.activeMs + 800,
];
const shots: string[] = [];
const total = Math.ceil(marks[marks.length - 1]! / (1000 / 60)) + 2;
let next = 0;
for (let i = 0; i < total; i += 1) {
  const t = i / 60;
  stepWorld(w, 1 / 60, { moveX: Math.cos(t * 0.7) * 0.4, moveY: Math.sin(t * 0.5) * 0.4, ultimate: false });
  if (next < marks.length && w.now >= marks[next]!) {
    renderWorld(ctx, w, { width, height, dpr: 1 });
    shots.push(canvas.toDataURL('image/png'));
    next += 1;
  }
}
(window as unknown as { __shots: string[] }).__shots = shots;
(window as unknown as { __done: boolean }).__done = true;
