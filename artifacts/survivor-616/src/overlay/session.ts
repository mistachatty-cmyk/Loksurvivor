/**
 * One Demo Day run on a live page: scans the page, builds the world, runs the
 * fixed-step loop, follows the player with the real scroll, renders the game
 * onto a low-resolution transparent canvas stacked over the page, and hides
 * (reversibly) whatever gets broken.
 */
import { getCharacter } from '@/game/data/characters';
import {
  addBreakables,
  applyUpgrade,
  createWorld,
  hudSnapshot,
  removeBreakables,
  rollUpgradeChoices,
  stepWorld,
  type World,
} from '@/game/engine/world';
import { renderWorld } from '@/game/render/draw';
import { PageHider } from './hider';
import {
  blockToObstacle,
  cameraForScroll,
  clampDocSize,
  destroyedFraction,
  diffWindow,
  overlayArea,
  pageToWorld,
  scrollTargetFor,
  selectActive,
  skipBlocksNear,
  worldToPage,
  type DocSize,
  type PageBlock,
} from './pageModel';
import { reportUrl } from './runLink';
import { scanPage, sensitivePageReason } from './scanner';
import { CREDIT_URL, STRINGS } from './strings';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 5;
/** Game pixel size in CSS px: the page is hi-res, the game is deliberately chunky. */
const PIXEL = 2;
const STREAM_EVERY_MS = 250;
const SPAWN_CLEARANCE = 56;
const CHARACTER_ID = 'foreman';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);

export type StartResult = { ok: true } | { ok: false; reason: string };

export interface RunSummary {
  destroyedPct: number;
  kills: number;
  level: number;
  elapsedSec: number;
}

const STYLE = `
:host { all: initial; }
.layer { position: fixed; inset: 0; overflow: hidden; pointer-events: none; font: 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #f4f1ea; }
canvas { position: fixed; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; pointer-events: none; }
.hud { position: fixed; top: 10px; left: 10px; display: grid; gap: 6px; text-shadow: 0 1px 0 #000, 0 0 3px #000; }
.bar { width: 180px; height: 10px; background: rgba(0,0,0,.6); border: 1px solid #000; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
.bar > i { display: block; height: 100%; width: 0; background: #e4572e; }
.bar.pct > i { background: #f2c14e; }
.row { display: flex; gap: 8px; align-items: center; }
.dock { position: fixed; left: 10px; bottom: 10px; display: flex; gap: 8px; align-items: center; pointer-events: none; }
.dock .hint { opacity: .85; text-shadow: 0 1px 0 #000, 0 0 3px #000; }
.dock button, .dock a { pointer-events: auto; font: inherit; color: #f4f1ea; background: rgba(15,15,20,.88); border: 1px solid rgba(255,255,255,.35); padding: 4px 8px; cursor: pointer; text-decoration: none; }
.dock button:hover, .dock a:hover { background: rgba(40,40,52,.95); }
.credit { position: fixed; right: 10px; bottom: 10px; pointer-events: auto; opacity: .8; }
.credit a { color: #f4f1ea; text-decoration: underline; }
.card { position: fixed; right: 16px; bottom: 16px; width: 260px; pointer-events: auto; background: rgba(15,15,20,.96); border: 1px solid rgba(255,255,255,.4); box-shadow: 0 6px 24px rgba(0,0,0,.45); padding: 12px 14px; display: grid; gap: 8px; }
.card h2 { all: unset; display: block; font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #f2c14e; }
.card dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0; }
.card dt { opacity: .75; }
.card dd { margin: 0; text-align: right; font-weight: 700; }
.card .actions { display: flex; gap: 8px; }
.card .actions a, .card .actions button { flex: 1; text-align: center; font: inherit; color: #0b0b0e; background: #f2c14e; border: 0; padding: 6px 8px; cursor: pointer; text-decoration: none; font-weight: 700; }
.card .actions button { color: #f4f1ea; background: rgba(255,255,255,.12); font-weight: 400; }
.toast { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); background: rgba(15,15,20,.92); border: 1px solid rgba(255,255,255,.35); padding: 8px 12px; }
`;

function isEditableTarget(target: EventTarget | undefined): { editable: boolean; activatable: boolean } {
  if (!(target instanceof Element)) return { editable: false, activatable: false };
  const editable = !!target.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"],[role="slider"]');
  const activatable = !!target.closest('button,a[href],summary,[role="button"]');
  return { editable, activatable };
}

export class DemoDaySession {
  private readonly win: Window;
  private readonly hider = new PageHider();
  private readonly keys = new Set<string>();
  private readonly alive = new Map<number, number>(); // block id -> breakable uid

  private world: World | null = null;
  private blocks: PageBlock[] = [];
  private elements: Element[] = [];
  private doc: DocSize = { w: 1, h: 1 };
  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hpFill: HTMLElement | null = null;
  private pctFill: HTMLElement | null = null;
  private pctText: HTMLElement | null = null;
  private lowW = 1;
  private lowH = 1;
  private raf = 0;
  private lastTime = 0;
  private acc = 0;
  private lastStream = 0;
  private lastHud = 0;
  private ultRequested = false;
  private resizeTimer = 0;
  private running = false;

  constructor(win: Window = window) {
    this.win = win;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): StartResult {
    if (this.running) return { ok: true };
    const reason = sensitivePageReason(this.win);
    if (reason) {
      this.toast(`${STRINGS.refusedPrefix} ${reason}.`);
      return { ok: false, reason };
    }

    const docEl = this.win.document.documentElement;
    const viewport = { w: this.win.innerWidth, h: this.win.innerHeight };
    this.doc = clampDocSize(
      { w: Math.max(docEl.scrollWidth, this.win.document.body?.scrollWidth ?? 0), h: Math.max(docEl.scrollHeight, this.win.document.body?.scrollHeight ?? 0) },
      viewport,
    );

    this.mount();
    this.blocks = [];
    const scan = scanPage(this.win, this.host ? [this.host] : []);
    this.blocks = scan.blocks;
    this.elements = scan.elements;
    if (this.blocks.length === 0) {
      this.unmount();
      this.toast(STRINGS.nothingToBreak);
      return { ok: false, reason: 'nothing to break' };
    }

    const foreman = getCharacter(CHARACTER_ID);
    const world = createWorld(overlayArea(this.doc), foreman, foreman.stats, (Date.now() % 100000) | 0, [], 1, false);
    this.world = world;

    const spawnPage = {
      x: Math.min(this.doc.w - 1, this.win.scrollX + viewport.w / 2),
      y: Math.min(this.doc.h - 1, this.win.scrollY + viewport.h / 2),
    };
    const spawnWorld = pageToWorld(spawnPage.x, spawnPage.y, this.doc);
    world.player.x = spawnWorld.x;
    world.player.y = spawnWorld.y;
    skipBlocksNear(this.blocks, spawnPage, SPAWN_CLEARANCE);

    this.layout();
    this.stream(true);

    this.win.addEventListener('keydown', this.onKeyDown, true);
    this.win.addEventListener('keyup', this.onKeyUp, true);
    this.win.addEventListener('blur', this.onBlur);
    this.win.addEventListener('resize', this.onResize);

    this.running = true;
    this.lastTime = performance.now();
    this.acc = 0;
    this.raf = this.win.requestAnimationFrame(this.frame);
    return { ok: true };
  }

  /** Stop the run. `restore` puts every hidden element back; pass false to leave the wreckage for a screenshot. */
  stop(restore = true): RunSummary | null {
    if (!this.running && !this.host) return null;
    const summary = this.summary();
    this.running = false;
    this.win.cancelAnimationFrame(this.raf);
    this.win.removeEventListener('keydown', this.onKeyDown, true);
    this.win.removeEventListener('keyup', this.onKeyUp, true);
    this.win.removeEventListener('blur', this.onBlur);
    this.win.removeEventListener('resize', this.onResize);
    this.win.clearTimeout(this.resizeTimer);
    if (restore) this.hider.restoreAll();
    this.unmount();
    this.keys.clear();
    this.alive.clear();
    this.world = null;
    if (summary && (summary.elapsedSec >= 3 || summary.destroyedPct > 0)) this.showEndCard(summary, restore);
    return summary;
  }

  /** Put every hidden element back without ending the run. */
  restorePage(): void {
    this.hider.restoreAll();
    for (const b of this.blocks) b.destroyed = false;
    this.rescan();
  }

  summary(): RunSummary | null {
    if (!this.world) return null;
    const hud = hudSnapshot(this.world);
    return {
      destroyedPct: Math.round(destroyedFraction(this.blocks) * 100),
      kills: hud.kills,
      level: hud.level,
      elapsedSec: Math.round(hud.elapsedSec),
    };
  }

  /* ------------------------------------------------------------ input */

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // composedPath()[0] sees through shadow roots, where `target` is only the host element.
    const { editable, activatable } = isEditableTarget(e.composedPath()[0]);
    if (editable) return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      this.stop(true);
      return;
    }
    if (key === ' ') {
      if (activatable) return; // let a focused button/link keep its own Space
      this.ultRequested = true;
      e.preventDefault();
      return;
    }
    if (MOVE_KEYS.has(key)) {
      this.keys.add(key);
      e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private readonly onBlur = () => {
    this.keys.clear();
  };

  private readonly onResize = () => {
    this.layout();
    this.win.clearTimeout(this.resizeTimer);
    this.resizeTimer = this.win.setTimeout(() => this.rescan(), 400);
  };

  private moveVector(): { moveX: number; moveY: number } {
    const k = this.keys;
    let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let y = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0);
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { moveX: x, moveY: y };
  }

  /* -------------------------------------------------------- main loop */

  private readonly frame = (now: number) => {
    if (!this.running || !this.world) return;
    const world = this.world;
    const dt = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.acc += dt;

    const move = this.moveVector();
    let steps = 0;
    while (this.acc >= FIXED_STEP && steps < MAX_SUBSTEPS) {
      stepWorld(world, FIXED_STEP, { ...move, ultimate: this.ultRequested });
      this.ultRequested = false;
      this.acc -= FIXED_STEP;
      steps += 1;
    }
    if (steps === MAX_SUBSTEPS) this.acc = 0;

    this.autoLevelUp(world);
    this.collectBroken(world);
    if (now - this.lastStream >= STREAM_EVERY_MS) {
      this.lastStream = now;
      this.stream(false);
    }
    this.followWithScroll(world, dt);
    this.render(world);
    if (now - this.lastHud >= 100) {
      this.lastHud = now;
      this.updateHud(world);
    }
    if (world.outcome !== 'running') {
      this.toast(STRINGS.title);
    }
    this.raf = this.win.requestAnimationFrame(this.frame);
  };

  /** Level-ups pick a random upgrade (the game's own "random-live" presentation) so the page never waits on a menu. */
  private autoLevelUp(world: World): void {
    for (let guard = 0; guard < 5 && world.pendingLevelUps > 0; guard += 1) {
      const before = world.pendingLevelUps;
      const choices = rollUpgradeChoices(world);
      if (choices.length === 0) {
        world.pendingLevelUps = 0;
        return;
      }
      applyUpgrade(world, choices[Math.floor(world.rng() * choices.length)] ?? choices[0]!);
      if (world.pendingLevelUps >= before) return;
    }
  }

  /**
   * Apply every block the game just broke to the page, and drop it from the world. A `box` hides its whole
   * element (and every block nested inside it, which would otherwise linger as an invisible wall); a `text`
   * chunk cuts a hole in its owner.
   */
  private collectBroken(world: World): void {
    const gone = new Set<number>();
    const scroll = { x: this.win.scrollX, y: this.win.scrollY };
    for (const b of world.breakables) {
      if (b.kind !== 'page-block' || !b.broken || b.domId === undefined) continue;
      gone.add(b.uid);
      this.alive.delete(b.domId);
      const block = this.blocks[b.domId];
      if (!block || block.destroyed) continue;
      const el = this.elements[block.owner];
      if (!el) continue;
      block.destroyed = true;
      if (block.kind === 'box') {
        this.hider.hide(el);
        this.destroyNestedIn(el, gone);
      } else {
        this.hider.cut(el, { x: block.x, y: block.y, w: block.w, h: block.h }, scroll);
      }
    }
    removeBreakables(world, gone);
  }

  /** Blocks owned by an element inside a hidden one are gone with it. */
  private destroyNestedIn(root: Element, gone: Set<number>): void {
    for (const other of this.blocks) {
      if (other.destroyed) continue;
      const el = this.elements[other.owner];
      if (!el || !root.contains(el)) continue;
      other.destroyed = true;
      const uid = this.alive.get(other.id);
      if (uid !== undefined) gone.add(uid);
      this.alive.delete(other.id);
    }
  }

  /** Keep only blocks near the player alive in the world (the page can be tens of thousands of px tall). */
  private stream(initial: boolean): void {
    const world = this.world;
    if (!world) return;
    const pagePos = worldToPage(world.player.x, world.player.y, this.doc);
    const desired = selectActive(this.blocks, pagePos.y, this.win.innerHeight);
    const { add, removeIds } = diffWindow(new Set(this.alive.keys()), desired);

    if (removeIds.length > 0) {
      const uids = new Set<number>();
      for (const id of removeIds) {
        const uid = this.alive.get(id);
        if (uid !== undefined) uids.add(uid);
        this.alive.delete(id);
      }
      removeBreakables(world, uids);
    }
    if (add.length > 0) {
      const created = addBreakables(world, add.map((b) => blockToObstacle(b, this.doc)));
      for (const c of created) if (c.domId !== undefined) this.alive.set(c.domId, c.uid);
    }
    void initial;
  }

  /** Re-measure after a resize: positions can reflow. Elements already hidden stay hidden and are skipped by the scan. */
  private rescan(): void {
    const world = this.world;
    if (!world || !this.running) return;
    const uids = new Set(this.alive.values());
    removeBreakables(world, uids);
    this.alive.clear();
    const scan = scanPage(this.win, this.host ? [this.host] : []);
    this.blocks = scan.blocks;
    this.elements = scan.elements;
    const pagePos = worldToPage(world.player.x, world.player.y, this.doc);
    skipBlocksNear(this.blocks, pagePos, SPAWN_CLEARANCE);
    this.stream(false);
  }

  /** The real window scroll follows the player, so the canvas and the page stay locked together. */
  private followWithScroll(world: World, dt: number): void {
    const viewport = { w: this.win.innerWidth, h: this.win.innerHeight };
    const pagePos = worldToPage(world.player.x, world.player.y, this.doc);
    const target = scrollTargetFor(pagePos, viewport, this.doc);
    const k = Math.min(1, dt * 8);
    const nx = this.win.scrollX + (target.x - this.win.scrollX) * k;
    const ny = this.win.scrollY + (target.y - this.win.scrollY) * k;
    if (Math.abs(nx - this.win.scrollX) > 0.5 || Math.abs(ny - this.win.scrollY) > 0.5) {
      this.win.scrollTo({ left: Math.round(nx), top: Math.round(ny), behavior: 'instant' });
    }
  }

  private render(world: World): void {
    const ctx = this.ctx;
    if (!ctx) return;
    world.camera = cameraForScroll(
      { x: this.win.scrollX, y: this.win.scrollY },
      { w: this.lowW * PIXEL, h: this.lowH * PIXEL },
      this.doc,
    );
    renderWorld(ctx, world, {
      width: this.lowW,
      height: this.lowH,
      dpr: 1,
      // 1 world unit == 1 CSS px on screen; the canvas then draws it at 1/PIXEL size and CSS scales it back up.
      targetViewOverride: this.lowW * PIXEL,
      overlay: true,
    });
  }

  /* ------------------------------------------------------------- DOM */

  private mount(): void {
    const doc = this.win.document;
    const host = doc.createElement('div');
    host.setAttribute('data-demoday', '');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'open' });

    const style = doc.createElement('style');
    style.textContent = STYLE;
    root.appendChild(style);

    const layer = doc.createElement('div');
    layer.className = 'layer';
    const canvas = doc.createElement('canvas');
    layer.appendChild(canvas);

    const hud = doc.createElement('div');
    hud.className = 'hud';
    const hpRow = this.row(doc, STRINGS.hp, 'bar');
    const pctRow = this.row(doc, STRINGS.destroyed, 'bar pct');
    this.hpFill = hpRow.fill;
    this.pctFill = pctRow.fill;
    this.pctText = pctRow.value;
    hud.append(hpRow.el, pctRow.el);
    layer.appendChild(hud);

    const dock = doc.createElement('div');
    dock.className = 'dock';
    const exit = doc.createElement('button');
    exit.type = 'button';
    exit.textContent = STRINGS.exit;
    exit.addEventListener('click', () => this.stop(true));
    const hint = doc.createElement('span');
    hint.className = 'hint';
    hint.textContent = STRINGS.hint;
    dock.append(exit, hint);
    layer.appendChild(dock);

    const credit = doc.createElement('div');
    credit.className = 'credit';
    credit.append(`${STRINGS.creditPrefix} `);
    const link = doc.createElement('a');
    link.href = CREDIT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = STRINGS.creditName;
    credit.appendChild(link);
    layer.appendChild(credit);

    root.appendChild(layer);
    doc.documentElement.appendChild(host);
    this.host = host;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  private row(doc: Document, label: string, barClass: string) {
    const el = doc.createElement('div');
    const head = doc.createElement('div');
    head.className = 'row';
    const name = doc.createElement('span');
    name.textContent = label;
    const value = doc.createElement('span');
    head.append(name, value);
    const bar = doc.createElement('div');
    bar.className = barClass;
    const fill = doc.createElement('i');
    bar.appendChild(fill);
    el.append(head, bar);
    return { el, fill, value };
  }

  private unmount(): void {
    this.host?.remove();
    this.host = null;
    this.canvas = null;
    this.ctx = null;
    this.hpFill = null;
    this.pctFill = null;
    this.pctText = null;
  }

  private layout(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.lowW = Math.max(1, Math.ceil(this.win.innerWidth / PIXEL));
    this.lowH = Math.max(1, Math.ceil(this.win.innerHeight / PIXEL));
    canvas.width = this.lowW;
    canvas.height = this.lowH;
    canvas.style.width = `${this.lowW * PIXEL}px`;
    canvas.style.height = `${this.lowH * PIXEL}px`;
  }

  private updateHud(world: World): void {
    const hud = hudSnapshot(world);
    const pct = destroyedFraction(this.blocks) * 100;
    if (this.hpFill) this.hpFill.style.width = `${hud.maxHp > 0 ? (hud.hp / hud.maxHp) * 100 : 0}%`;
    if (this.pctFill) this.pctFill.style.width = `${pct}%`;
    if (this.pctText) this.pctText.textContent = `${Math.round(pct)}%`;
  }

  /**
   * What the player sees after the page is put back: their numbers and a link to the hub's report page.
   * The run rides in the link's fragment, so nothing about it (or the page) is sent anywhere.
   */
  private showEndCard(summary: RunSummary, restored: boolean): void {
    const doc = this.win.document;
    const host = doc.createElement('div');
    host.setAttribute('data-demoday', '');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;

    const layer = doc.createElement('div');
    layer.className = 'layer';
    const card = doc.createElement('div');
    card.className = 'card';

    const title = doc.createElement('h2');
    title.textContent = STRINGS.endTitle;
    const note = doc.createElement('div');
    note.textContent = restored ? STRINGS.endRestored : '';
    note.hidden = !restored;

    const stats = doc.createElement('dl');
    const minutes = Math.floor(summary.elapsedSec / 60);
    const seconds = String(summary.elapsedSec % 60).padStart(2, '0');
    const rows: Array<[string, string]> = [
      [STRINGS.endDestroyed, `${summary.destroyedPct}%`],
      [STRINGS.endKills, String(summary.kills)],
      [STRINGS.endLevel, String(summary.level)],
      [STRINGS.endTime, `${minutes}:${seconds}`],
    ];
    for (const [label, value] of rows) {
      const dt = doc.createElement('dt');
      dt.textContent = label;
      const dd = doc.createElement('dd');
      dd.textContent = value;
      stats.append(dt, dd);
    }

    const actions = doc.createElement('div');
    actions.className = 'actions';
    const share = doc.createElement('a');
    share.href = reportUrl(summary);
    share.target = '_blank';
    share.rel = 'noopener noreferrer';
    share.textContent = STRINGS.endShare;
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = STRINGS.endClose;
    close.addEventListener('click', () => host.remove());
    actions.append(share, close);

    card.append(title, note, stats, actions);
    layer.appendChild(card);
    root.append(style, layer);
    doc.documentElement.appendChild(host);
    this.win.setTimeout(() => host.remove(), 45000);
  }

  /** A short message that clears itself. Used before the overlay is mounted, so it carries its own host. */
  private toast(message: string): void {
    const doc = this.win.document;
    const host = doc.createElement('div');
    host.setAttribute('data-demoday', '');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const root = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    const toast = doc.createElement('div');
    toast.className = 'toast layer';
    toast.textContent = message;
    root.append(style, toast);
    doc.documentElement.appendChild(host);
    this.win.setTimeout(() => host.remove(), 4000);
  }
}
