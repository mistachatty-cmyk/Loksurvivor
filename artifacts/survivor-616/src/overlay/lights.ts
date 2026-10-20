/**
 * Light sources for the overlay's additive light layer (the article's middle layer: soft glow between the
 * hi-res page and the crisp pixel layer). Pure, so it is tested under node; `session.ts` paints the result.
 * Units are world units; `r` is the glow radius and `a` its peak opacity, 0..1.
 */
import type { World } from '@/game/engine/world';

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  a: number;
}

export interface LightBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const LIGHT_CAP = 64;

const XP_GLOW = '#7dffb0';
const HEALTH_GLOW = '#ff6b6b';
const CRED_GLOW = '#ffd45e';
const LOOT_GLOW = '#e08cff';
const PLAYER_GLOW = '#ffcf8a';

function pickupColor(kind: string): string {
  if (kind === 'health') return HEALTH_GLOW;
  if (kind === 'cred') return CRED_GLOW;
  if (kind === 'loot-box' || kind === 'card-pack' || kind === 'sweep') return LOOT_GLOW;
  return XP_GLOW;
}

/** Everything that glows right now and is near the view, brightest first when over the cap. */
export function collectLights(w: World, bounds: LightBounds, cap = LIGHT_CAP): Light[] {
  const out: Light[] = [];
  const pad = 80;
  const near = (x: number, y: number, r: number) =>
    x + r + pad >= bounds.left && x - r - pad <= bounds.right && y + r + pad >= bounds.top && y - r - pad <= bounds.bottom;

  const p = w.player;
  if (w.now < w.ultActiveUntil) out.push({ x: p.x, y: p.y, r: 220, color: PLAYER_GLOW, a: 0.55 });
  else out.push({ x: p.x, y: p.y, r: 46, color: PLAYER_GLOW, a: 0.22 });

  for (const e of w.effects) {
    if (!near(e.x, e.y, e.radius)) continue;
    const span = Math.max(1, e.expiresAt - e.bornAt);
    const fade = Math.max(0, Math.min(1, (e.expiresAt - w.now) / span));
    out.push({ x: e.x, y: e.y, r: Math.min(260, e.radius * 1.1 + 30), color: e.color, a: 0.18 + 0.42 * fade });
  }
  for (const pr of w.projectiles) {
    if (!near(pr.x, pr.y, pr.radius)) continue;
    out.push({ x: pr.x, y: pr.y, r: pr.radius * 4 + 16, color: pr.color, a: pr.fromPlayer ? 0.5 : 0.35 });
  }
  for (const k of w.pickups) {
    if (!near(k.x, k.y, 12)) continue;
    out.push({ x: k.x, y: k.y, r: k.kind === 'loot-box' ? 40 : 22, color: pickupColor(k.kind), a: 0.45 });
  }
  for (const i of w.impacts) {
    if (near(i.x, i.y, i.radius)) out.push({ x: i.x, y: i.y, r: i.radius * 1.6, color: '#ffe2b0', a: 0.8 });
  }

  if (out.length <= cap) return out;
  return out.sort((a, b) => b.a * b.r - a.a * a.r).slice(0, cap);
}
