/**
 * Procedural art for hideout visitors and ground pickups, drawn on the strip canvas as plain
 * rectangles and arcs like the props (`hideoutPropArt.ts`). A new visitor look is one `case`
 * here plus its row in `data/hideoutAmbient.ts`.
 */
import type { AmbientPickupDef, AmbientVisitorDef } from '@/game/data/hideoutAmbient';

const INK = '#0b0b12';

export interface VisitorDrawOptions {
  def: AmbientVisitorDef;
  x: number;
  groundY: number;
  /** Pixel height of the figure. */
  h: number;
  dir: 1 | -1;
  now: number;
  /** 0 to 1 through a squash, or null while alive. */
  squash: number | null;
}

export function drawVisitor(ctx: CanvasRenderingContext2D, o: VisitorDrawOptions): void {
  const { def, x, groundY, h, dir, now, squash } = o;
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(dir, 1);
  const stride = Math.sin(now / (def.id === 'running-man' ? 70 : 140));
  if (def.id === 'llama') drawLlama(ctx, def, h, stride);
  else if (def.id === 'digi-mite') drawMite(ctx, def, h, now, squash);
  else drawRunner(ctx, def, h, stride, def.id === 'courier');
  ctx.restore();
  if (squash !== null) {
    // A little splat ring on the ground.
    ctx.save();
    ctx.globalAlpha = 0.6 * (1 - squash);
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, groundY + 1, h * (0.4 + squash * 1.1), h * 0.12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, hh);
}

function drawLlama(ctx: CanvasRenderingContext2D, def: AmbientVisitorDef, h: number, stride: number): void {
  const u = h / 20;
  // Legs (two pairs swinging opposite ways).
  for (const [lx, phase] of [[-6, 1], [-3, -1], [3, -1], [6, 1]] as const) {
    rect(ctx, lx * u - u * 0.7 + stride * phase * u * 1.2, -7 * u, u * 1.4, 7 * u, def.body);
  }
  rect(ctx, -8 * u, -13 * u, 16 * u, 7 * u, def.accent); // body
  rect(ctx, -8 * u, -9 * u, 16 * u, 3 * u, def.body);
  rect(ctx, 6 * u, -19 * u, 3 * u, 8 * u, def.accent); // neck
  rect(ctx, 6 * u, -21 * u, 6 * u, 3.5 * u, def.accent); // head
  rect(ctx, 7 * u, -23.5 * u, 1.3 * u, 2.5 * u, def.body); // ears
  rect(ctx, 9.5 * u, -23.5 * u, 1.3 * u, 2.5 * u, def.body);
  rect(ctx, 10 * u, -20.2 * u, 1.2 * u, 1.2 * u, INK); // eye
  rect(ctx, -9.5 * u, -12 * u, 2 * u, 3 * u, def.accent); // tail
}

function drawRunner(ctx: CanvasRenderingContext2D, def: AmbientVisitorDef, h: number, stride: number, carries: boolean): void {
  const u = h / 20;
  const lean = def.id === 'running-man' ? 2 * u : 0;
  // Legs.
  rect(ctx, -2.2 * u + stride * 3 * u, -8 * u, 2 * u, 8 * u, def.body);
  rect(ctx, 0.4 * u - stride * 3 * u, -8 * u, 2 * u, 8 * u, def.body);
  // Torso, arms, head.
  ctx.save();
  ctx.translate(lean, 0);
  rect(ctx, -3 * u, -15 * u, 6 * u, 7.5 * u, def.accent);
  rect(ctx, -1 * u + stride * 3 * u, -14.5 * u, 2 * u, 6 * u, def.body);
  ctx.fillStyle = '#e8c9a6';
  ctx.fillRect(-2 * u, -20 * u, 4.5 * u, 4.5 * u);
  rect(ctx, 0.8 * u, -18.5 * u, 1 * u, 1 * u, INK);
  if (carries) {
    rect(ctx, 2 * u, -14 * u, 5 * u, 4.5 * u, '#c08a4a');
    rect(ctx, 4 * u, -14 * u, 1 * u, 4.5 * u, '#f3e2b5');
  }
  ctx.restore();
}

function drawMite(ctx: CanvasRenderingContext2D, def: AmbientVisitorDef, h: number, now: number, squash: number | null): void {
  const flat = squash === null ? 1 : Math.max(0.12, 1 - squash * 1.6);
  ctx.save();
  ctx.scale(1 + (1 - flat) * 0.9, flat);
  ctx.fillStyle = def.body;
  ctx.beginPath();
  ctx.ellipse(0, -h * 0.5, h * 0.55, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = def.accent;
  ctx.beginPath();
  ctx.arc(h * 0.18, -h * 0.58, h * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(h * 0.14, -h * 0.62, h * 0.07, h * 0.07);
  if (squash === null) {
    ctx.strokeStyle = def.accent;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i += 1) {
      const lx = -h * 0.3 + i * h * 0.3;
      const wig = Math.sin(now / 60 + i * 2) * h * 0.08;
      ctx.beginPath();
      ctx.moveTo(lx, -h * 0.2);
      ctx.lineTo(lx + wig, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawPickup(ctx: CanvasRenderingContext2D, def: AmbientPickupDef, x: number, groundY: number, now: number, ageFrac: number): void {
  const bob = Math.sin(now / 260 + x) * 1.5;
  const blink = ageFrac > 0.8 && Math.floor(now / 160) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(x, groundY - 6 + bob);
  ctx.shadowColor = def.color;
  ctx.shadowBlur = 6;
  ctx.fillStyle = def.color;
  if (def.id === 'coin') {
    ctx.beginPath();
    ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-1, -2.5, 2, 5);
  } else if (def.id === 'snack') {
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(-8, -1, -4, -7, 0, -3);
    ctx.bezierCurveTo(4, -7, 8, -1, 0, 4);
    ctx.fill();
  } else {
    ctx.fillRect(-4, -3, 8, 6);
    ctx.fillStyle = INK;
    ctx.fillRect(-1.5, -1.5, 3, 3);
  }
  ctx.restore();
}
