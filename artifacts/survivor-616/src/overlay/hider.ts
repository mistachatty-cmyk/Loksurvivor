/**
 * Reversible "destruction" of host-page elements. The overlay never removes
 * nodes, wraps text or edits attributes other than ONE inline style property
 * per element (`visibility` to hide a whole element, `clip-path` to cut holes
 * in one), so a framework (React/Vue/Svelte) that owns the page keeps working
 * and `restoreAll()` puts back exactly what was there before.
 */
type Styled = Element & ElementCSSInlineStyle;

interface Saved {
  value: string;
  priority: string;
}

export interface PageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How far outside the element's box the clip keeps painting, so shadows, outlines and ascenders survive. */
const CLIP_PAD = 48;
/** Holes on the same line closer than this are merged into one subpath (keeps the path short on long paragraphs). */
const MERGE_GAP = 1.5;

/** Merge holes that sit on the same row and touch or overlap horizontally. Pure; exported for tests. */
export function mergeHoles(holes: readonly PageRect[]): PageRect[] {
  const sorted = [...holes].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: PageRect[] = [];
  for (const hole of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.y - hole.y) <= MERGE_GAP &&
      Math.abs(last.h - hole.h) <= MERGE_GAP &&
      hole.x <= last.x + last.w + MERGE_GAP
    ) {
      const right = Math.max(last.x + last.w, hole.x + hole.w);
      last.w = right - last.x;
      continue;
    }
    out.push({ ...hole });
  }
  return out;
}

/** `clip-path: path(evenodd, ...)` value: the padded box with every hole punched out. Pure; exported for tests. */
export function clipPathFor(box: PageRect, holes: readonly PageRect[]): string {
  const f = (n: number) => Math.round(n * 10) / 10;
  let d = `M${-CLIP_PAD} ${-CLIP_PAD}H${f(box.w + CLIP_PAD)}V${f(box.h + CLIP_PAD)}H${-CLIP_PAD}Z`;
  for (const hole of mergeHoles(holes)) {
    const x0 = f(hole.x - box.x);
    const y0 = f(hole.y - box.y);
    d += `M${x0} ${y0}H${f(x0 + hole.w)}V${f(y0 + hole.h)}H${x0}Z`;
  }
  return `path(evenodd, "${d}")`;
}

export class PageHider {
  private readonly hidden = new Map<Styled, Saved>();
  private readonly clipped = new Map<Styled, Saved>();
  private readonly holes = new Map<Styled, PageRect[]>();

  get count(): number {
    return this.hidden.size + this.clipped.size;
  }

  has(el: Element): boolean {
    return this.hidden.has(el as Styled);
  }

  /** Make a whole element disappear. */
  hide(el: Element): void {
    const node = el as Styled;
    if (!('style' in node) || this.hidden.has(node)) return;
    this.hidden.set(node, {
      value: node.style.getPropertyValue('visibility'),
      priority: node.style.getPropertyPriority('visibility'),
    });
    node.style.setProperty('visibility', 'hidden', 'important');
  }

  /**
   * Punch a hole (in page coordinates) through an element. The element's own box is re-measured on
   * every cut so the clip lines up even if the page scrolled since the last one.
   */
  cut(el: Element, hole: PageRect, scroll: { x: number; y: number }): void {
    const node = el as Styled;
    if (!('style' in node) || this.hidden.has(node)) return;
    if (!this.clipped.has(node)) {
      this.clipped.set(node, {
        value: node.style.getPropertyValue('clip-path'),
        priority: node.style.getPropertyPriority('clip-path'),
      });
      this.holes.set(node, []);
    }
    const list = this.holes.get(node)!;
    list.push(hole);
    const r = el.getBoundingClientRect();
    const box = { x: r.left + scroll.x, y: r.top + scroll.y, w: r.width, h: r.height };
    node.style.setProperty('clip-path', clipPathFor(box, list), 'important');
  }

  restoreAll(): void {
    for (const [node, previous] of this.hidden) this.restore(node, 'visibility', previous);
    for (const [node, previous] of this.clipped) this.restore(node, 'clip-path', previous);
    this.hidden.clear();
    this.clipped.clear();
    this.holes.clear();
  }

  private restore(node: Styled, property: string, previous: Saved): void {
    try {
      if (previous.value) node.style.setProperty(property, previous.value, previous.priority);
      else node.style.removeProperty(property);
    } catch {
      // The node may belong to a document that has since been torn down; nothing left to restore.
    }
  }
}
