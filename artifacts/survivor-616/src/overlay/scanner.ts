/**
 * Turns the live host page into `PageBlock`s. DOM-only and read-only: it
 * measures, it never mutates.
 *
 * Two kinds of block:
 *  - `box`: a whole element that is a sensible leaf obstacle -- images, video,
 *    canvas, controls, and small painted boxes (badges, buttons). These
 *    disappear when broken.
 *  - `text`: a word-sized chunk of one rendered line of text, measured with
 *    `Range.getClientRects()`. Hitboxes hug the glyphs instead of the
 *    element's full-column rect, so the player is not boxed in by a heading
 *    whose box is 900px wide around 200px of text. Breaking one cuts a hole in
 *    the owner element rather than hiding all of it.
 */
import { blockHp, type PageBlock } from './pageModel';

export interface ScanResult {
  blocks: PageBlock[];
  /** `elements[block.owner]` is the element a block is cut from / hides. */
  elements: Element[];
}

const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'CANVAS', 'SVG', 'IFRAME']);
const BOX_SELECTOR = 'img,video,canvas,svg,iframe,button,input,textarea,select,hr';
const PAINTABLE = new Set(['DIV', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'MAIN', 'SPAN', 'FORM', 'UL', 'OL', 'LI', 'A', 'FIGURE']);
const SKIP_TEXT_PARENT = 'script,style,noscript,template,textarea,select,option,button,svg,[contenteditable=""],[contenteditable="true"]';
const XHTML = 'http://www.w3.org/1999/xhtml';

const MAX_SCANNED_ELEMENTS = 15000;
const MAX_TEXT_NODES = 12000;
export const MAX_BLOCKS = 25000;
const MIN_SIDE = 6;
/** Painted containers bigger than this on a side are page chrome, not obstacles. */
const MAX_BOX_SIDE = 360;
/** A line of text is split into pieces about this wide so a long sentence is not one giant block. */
export const CHUNK_WIDTH = 120;

function alphaOf(color: string): number {
  if (!color || color === 'transparent') return 0;
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return 1;
  const parts = (m[1] ?? '').split(/[ ,/]+/).filter(Boolean);
  return parts.length > 3 ? parseFloat(parts[3] ?? '1') : 1;
}

function hasOwnPaint(cs: CSSStyleDeclaration): boolean {
  if (alphaOf(cs.backgroundColor) > 0.05) return true;
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
  const border = (width: string, style: string, color: string) =>
    parseFloat(width) > 0 && style !== 'none' && alphaOf(color) > 0.05;
  return (
    border(cs.borderTopWidth, cs.borderTopStyle, cs.borderTopColor) ||
    border(cs.borderBottomWidth, cs.borderBottomStyle, cs.borderBottomColor)
  );
}

/** Split a measured line rectangle into roughly CHUNK_WIDTH-wide pieces. Pure; exported for tests. */
export function chunkLine(rect: { x: number; y: number; w: number; h: number }): Array<{ x: number; y: number; w: number; h: number }> {
  const n = Math.max(1, Math.round(rect.w / CHUNK_WIDTH));
  const w = rect.w / n;
  return Array.from({ length: n }, (_, i) => ({ x: rect.x + i * w, y: rect.y, w, h: rect.h }));
}

/** Elements whose own `display` is inline: a clip-path cut belongs on the nearest non-inline ancestor. */
function blockOwner(win: Window, start: Element, body: Element): Element {
  let el: Element | null = start;
  while (el && el !== body) {
    const display = win.getComputedStyle(el).display;
    if (display !== 'inline' && display !== 'contents') return el;
    el = el.parentElement;
  }
  return body;
}

export function scanPage(win: Window, ignore: readonly Element[] = []): ScanResult {
  const doc = win.document;
  const body = doc.body;
  if (!body) return { blocks: [], elements: [] };

  const vw = win.innerWidth;
  const vh = win.innerHeight;
  const sx = win.scrollX;
  const sy = win.scrollY;
  const fixedCache = new WeakMap<Element, boolean>();

  const isFixedish = (el: Element | null): boolean => {
    if (!el || el === body || el === doc.documentElement) return false;
    const cached = fixedCache.get(el);
    if (cached !== undefined) return cached;
    const pos = win.getComputedStyle(el).position;
    const result = pos === 'fixed' || pos === 'sticky' || isFixedish(el.parentElement);
    fixedCache.set(el, result);
    return result;
  };
  const isIgnored = (el: Element) => ignore.some((root) => root === el || root.contains(el));
  const isShown = (el: Element): boolean => {
    const check = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
    if (typeof check === 'function') return check.call(el, { opacityProperty: true, visibilityProperty: true });
    const cs = win.getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  const blocks: PageBlock[] = [];
  const elements: Element[] = [];
  const ownerIndex = new Map<Element, number>();
  const ownerOf = (el: Element): number => {
    let idx = ownerIndex.get(el);
    if (idx === undefined) {
      idx = elements.length;
      elements.push(el);
      ownerIndex.set(el, idx);
    }
    return idx;
  };
  const push = (owner: number, kind: PageBlock['kind'], x: number, y: number, w: number, h: number) => {
    if (blocks.length >= MAX_BLOCKS) return;
    blocks.push({ id: -1, owner, kind, x, y, w, h, hp: blockHp(w, h), destroyed: false, skip: false });
  };

  /* ---- whole-element boxes: media, controls, small painted boxes ---- */
  const boxes = new Set<Element>(Array.from(body.querySelectorAll(BOX_SELECTOR)));
  const all = body.getElementsByTagName('*');
  const limit = Math.min(all.length, MAX_SCANNED_ELEMENTS);
  for (let i = 0; i < limit; i += 1) {
    const el = all[i]!;
    if (boxes.has(el) || !PAINTABLE.has(el.tagName)) continue;
    if (hasOwnPaint(win.getComputedStyle(el))) boxes.add(el);
  }
  for (const el of boxes) {
    if (isIgnored(el) || el.namespaceURI !== XHTML && el.tagName.toUpperCase() !== 'SVG') continue;
    if (el.closest('svg') && el.tagName.toUpperCase() !== 'SVG') continue;
    if (!isShown(el) || isFixedish(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < MIN_SIDE || r.height < MIN_SIDE) continue;
    const media = MEDIA_TAGS.has(el.tagName.toUpperCase());
    if (!media && (r.width > MAX_BOX_SIDE || r.height > MAX_BOX_SIDE)) continue;
    if (r.height > vh * 2.5 || r.width > vw * 4) continue;
    push(ownerOf(el), 'box', r.left + sx, r.top + sy, r.width, r.height);
  }

  /* ---- text: tight per-line chunks, cut out of the nearest block-level owner ---- */
  const range = doc.createRange();
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let textNodes = 0;
  for (let node = walker.nextNode(); node && textNodes < MAX_TEXT_NODES; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !/\S/.test(node.nodeValue ?? '')) continue;
    if (parent.namespaceURI !== XHTML || parent.closest(SKIP_TEXT_PARENT)) continue;
    if (isIgnored(parent) || !isShown(parent) || isFixedish(parent)) continue;
    textNodes += 1;

    range.selectNodeContents(node);
    const rects = range.getClientRects();
    if (rects.length === 0) continue;
    const owner = ownerOf(blockOwner(win, parent, body));
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i]!;
      if (r.width < 4 || r.height < MIN_SIDE) continue;
      for (const chunk of chunkLine({ x: r.left + sx, y: r.top + sy, w: r.width, h: r.height })) {
        push(owner, 'text', chunk.x, chunk.y, chunk.w, chunk.h);
      }
    }
  }
  range.detach();

  blocks.sort((a, b) => a.y - b.y || a.x - b.x);
  blocks.forEach((b, id) => {
    b.id = id;
  });
  return { blocks, elements };
}

/** Domains where smashing the page would be unwelcome or unsafe: money, health, government. */
const SENSITIVE_HOST = /(^|\.)(chase|bankofamerica|wellsfargo|citi|capitalone|usbank|paypal|stripe|venmo|coinbase|robinhood|fidelity|schwab|vanguard|mychart|irs)\.(com|org|net|gov)$|\.(gov|mil|bank)$/i;

/** A reason to refuse to start, or null when the page is fine. */
export function sensitivePageReason(win: Window): string | null {
  const doc = win.document;
  const host = win.location.hostname;
  if (SENSITIVE_HOST.test(host)) return 'banking, payment, health or government site';
  if (doc.querySelector('input[type="password"]')) return 'a sign-in form';
  for (const frame of Array.from(doc.querySelectorAll('iframe'))) {
    const src = (frame.getAttribute('src') ?? '').toLowerCase();
    if (/(js\.stripe\.com|paypal\.com|checkout|payment|secure\.)/.test(src)) return 'a payment form';
  }
  return null;
}
