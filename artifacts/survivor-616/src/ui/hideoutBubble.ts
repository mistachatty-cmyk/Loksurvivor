/**
 * Speech bubbles for the hideout strip, drawn on the canvas next to whoever is
 * talking instead of in a box pinned over the bottom of the strip (which sat on
 * everyone's feet). The layout is pure so it can be tested: given the speaker's
 * head position and the strip size it picks a spot above the head when there is
 * room, otherwise beside it, and always keeps the bubble inside the canvas.
 */

export interface BubbleLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  titleH: number;
  placement: 'above' | 'right' | 'left';
  /** Where the tail's tip touches, on the speaker's side. */
  tailX: number;
  tailY: number;
}

export interface BubbleInput {
  text: string;
  title?: string;
  /** Horizontal centre of the speaker. */
  anchorX: number;
  /** Top of the speaker's head. */
  headY: number;
  cssW: number;
  cssH: number;
  maxTextW?: number;
  maxLines?: number;
  /** Bubbles already placed this frame; this one is nudged clear of them when it can be. */
  avoid?: ReadonlyArray<BubbleRect>;
}

export interface BubbleRect { x: number; y: number; w: number; h: number }

export function rectsOverlap(a: BubbleRect, b: BubbleRect, pad = 2): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

export const BUBBLE_LINE_H = 13;
export const BUBBLE_PAD = 6;
const TITLE_H = 11;
const EDGE = 4;

export function wrapBubbleText(measure: (s: string) => number, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxW || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1]!;
  while (last.length > 1 && measure(`${last}…`) > maxW) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function baseLayout(measure: (s: string) => number, input: BubbleInput): BubbleLayout {
  const { anchorX, headY, cssW, cssH } = input;
  const maxTextW = Math.min(input.maxTextW ?? 200, Math.max(60, cssW - EDGE * 2 - BUBBLE_PAD * 2));
  const lines = wrapBubbleText(measure, input.text, maxTextW, input.maxLines ?? 4);
  const titleH = input.title ? TITLE_H : 0;
  const textW = Math.max(input.title ? measure(input.title) : 0, ...lines.map(measure));
  const w = Math.ceil(textW + BUBBLE_PAD * 2);
  const h = Math.ceil(lines.length * BUBBLE_LINE_H + titleH + BUBBLE_PAD * 2);
  const clampX = (x: number) => Math.max(EDGE, Math.min(cssW - w - EDGE, x));

  const aboveY = headY - h - 9;
  if (aboveY >= EDGE) {
    const x = clampX(anchorX - w / 2);
    return { x, y: aboveY, w, h, lines, titleH, placement: 'above', tailX: Math.max(x + 9, Math.min(x + w - 9, anchorX)), tailY: headY - 1 };
  }
  // No headroom: stand the bubble beside the head, on whichever side has room.
  const sideGap = 20;
  const y = Math.max(EDGE, Math.min(cssH - h - EDGE, headY + 12 - h / 2));
  const fitsRight = anchorX + sideGap + w <= cssW - EDGE;
  const fitsLeft = anchorX - sideGap - w >= EDGE;
  const right = fitsRight || !fitsLeft;
  const x = clampX(right ? anchorX + sideGap : anchorX - sideGap - w);
  return {
    x, y, w, h, lines, titleH,
    placement: right ? 'right' : 'left',
    tailX: right ? x : x + w,
    tailY: Math.max(y + 8, Math.min(y + h - 8, headY + 12)),
  };
}

/** Where the bubble goes: the natural spot, moved up or down past anything already there. */
export function layoutBubble(measure: (s: string) => number, input: BubbleInput): BubbleLayout {
  const layout = baseLayout(measure, input);
  const taken = input.avoid;
  if (!taken || taken.length === 0) return layout;
  const clampY = (y: number) => Math.max(EDGE, Math.min(input.cssH - layout.h - EDGE, y));
  for (let pass = 0; pass < taken.length; pass += 1) {
    const hit = taken.find((r) => rectsOverlap(layout, r));
    if (!hit) break;
    const up = hit.y - layout.h - 3;
    const down = hit.y + hit.h + 3;
    if (up >= EDGE) layout.y = up;
    else if (down + layout.h <= input.cssH - EDGE) layout.y = down;
    else layout.y = clampY(layout.y);
  }
  return layout;
}

export interface BubbleDraw extends BubbleInput {
  accent: string;
  /** 0..1 through the bubble's life. */
  age: number;
  /** Milliseconds since it appeared, for the pop-in. */
  sinceMs: number;
}

/** Measure a bubble without drawing it, so callers can decide whether it fits. */
export function measureBubble(ctx: CanvasRenderingContext2D, d: BubbleInput): BubbleLayout {
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const layout = layoutBubble((s) => ctx.measureText(s).width, d);
  ctx.restore();
  return layout;
}

export function drawBubble(ctx: CanvasRenderingContext2D, d: BubbleDraw): BubbleLayout {
  ctx.save();
  ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  const layout = layoutBubble((s) => ctx.measureText(s).width, d);
  const fade = d.age > 0.88 ? Math.max(0, (1 - d.age) / 0.12) : 1;
  const pop = Math.min(1, d.sinceMs / 120);
  const cx = layout.x + layout.w / 2;
  const cy = layout.y + layout.h / 2;
  ctx.globalAlpha = fade * (0.35 + 0.65 * pop);
  ctx.translate(cx, cy);
  const k = 0.88 + 0.12 * pop;
  ctx.scale(k, k);
  ctx.translate(-cx, -cy);

  const r = 5;
  ctx.beginPath();
  ctx.moveTo(layout.x + r, layout.y);
  ctx.arcTo(layout.x + layout.w, layout.y, layout.x + layout.w, layout.y + layout.h, r);
  ctx.arcTo(layout.x + layout.w, layout.y + layout.h, layout.x, layout.y + layout.h, r);
  ctx.arcTo(layout.x, layout.y + layout.h, layout.x, layout.y, r);
  ctx.arcTo(layout.x, layout.y, layout.x + layout.w, layout.y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,18,0.93)';
  ctx.fill();
  ctx.strokeStyle = d.accent;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tail.
  ctx.beginPath();
  if (layout.placement === 'above') {
    ctx.moveTo(layout.tailX - 5, layout.y + layout.h);
    ctx.lineTo(layout.tailX + 5, layout.y + layout.h);
    ctx.lineTo(layout.tailX, layout.tailY);
  } else {
    const dir = layout.placement === 'right' ? 1 : -1;
    ctx.moveTo(layout.tailX, layout.tailY - 5);
    ctx.lineTo(layout.tailX, layout.tailY + 5);
    ctx.lineTo(layout.tailX - dir * 7, layout.tailY);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,18,0.93)';
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let ty = layout.y + BUBBLE_PAD;
  if (d.title) {
    ctx.font = '700 8px ui-monospace, monospace';
    ctx.fillStyle = d.accent;
    ctx.fillText(d.title.toUpperCase(), layout.x + BUBBLE_PAD, ty + 1);
    ty += layout.titleH;
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif';
  }
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (const line of layout.lines) {
    ctx.fillText(line, layout.x + BUBBLE_PAD, ty);
    ty += BUBBLE_LINE_H;
  }
  ctx.restore();
  return layout;
}
