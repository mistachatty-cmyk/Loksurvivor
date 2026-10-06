/**
 * One Demo Day run on a live page: scans the page, builds the world, runs the fixed-step loop, follows the
 * player with the real scroll, and draws the game onto a low-resolution canvas stacked over the page.
 *
 * The page itself is NEVER modified. What gets "destroyed" is recorded in a `HoleField` (in low-res cells) and
 * the canvas paints the game's own ground through those holes, opaque, so the reveal reads on any page colour;
 * removing the overlay is the whole restore. While playing, an input shield stops clicks and manual scrolling
 * reaching the page (so a "destroyed" link cannot be followed) and the scroll is driven in whole cells so the
 * canvas and the page share one pixel grid.
 */
import { CHARACTERS, getCharacter } from '@/game/data/characters';
import type { CharacterDef } from '@/game/types';
import {
  addBreakables,
  applyUpgrade,
  claimLootPrize,
  createWorld,
  damageBlocksNear,
  dashPlayer,
  hudSnapshot,
  removeBreakables,
  rollUpgradeChoices,
  stepWorld,
  type World,
} from '@/game/engine/world';
import { createSfxEngine, type SfxEngine } from '@/game/audio/sfxEngine';
import { DEFAULT_SFX_STYLE, type SfxCueId } from '@/game/audio/sfxCues';
import type { UpgradeDef } from '@/game/types';
import { createRng } from '@/game/engine/math';
import { renderGroundLayer, renderWorld } from '@/game/render/draw';
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
import {
  HIT_STOP_COOLDOWN_MS,
  FLOATER_LIFE_MS,
  addFloater,
  comboAlive,
  comboBreak,
  crackCells,
  crackStage,
  dissolveDone,
  dissolveLevel,
  floaterRise,
  hitStopMs,
  newCombo,
  pruneFloaters,
  spawnDebris,
  stepDebris,
  FLASH_MS,
  type Debris,
  type Floater,
} from './fx';
import { collectLights } from './lights';
import { measureText, textCells } from './pixelFont';
import { addOutline, binariseAlpha } from './pixelPass';
import { fillWindow, HoleField } from './reveal';
import { reportUrl } from './runLink';
import { CELL_CSS, SPEED_MULT, SPRITE_UNITS, WORLD_K, lowResSize, snapToCell, targetViewUnits } from './scale';
import { scanPage, sensitivePageReason } from './scanner';
import { createScenery, pageLook, parseCssColor, type PageLook, type Scenery } from './scenery';
import { CREDIT_URL } from './strings';
import { refreshLocale, t } from './i18n';
import { FINALE_BOSS_ID, buildOverlayWaves, finaleWave } from './waves';
import { OBJECTIVE_PCT, levelComplete, levelStage, shouldSpawnBoss } from './level';
import {
  gameSpeedFactor,
  loadSettings,
  nextSetting,
  saveSettings,
  type SettingId,
  type Settings,
} from './settings';
import { buildCharacterSelect, buildCompleteCard, buildDeadCard, buildLevelUp, buildPauseMenu, buildSettingsPanel } from './ui';
import { abilityFor, castAbility } from './overlayAbilities';

const FIXED_STEP = 1 / 60;
const MAX_SUBSTEPS = 5;
const STREAM_EVERY_MS = 250;
/** A crater only carves the page for a big, heavy hit; smaller blasts just leave soot. */
const CRATER_MIN_RADIUS = 40;
const CRATER_MIN_INTENSITY = 2;
const CRATER_SHRINK = 0.8;
const MAX_CRATERS = 400;
/** Page lighter than this gets no additive glow (light on white is invisible). */
const GLOW_MAX_PAGE_LUMA = 170;
const OUTLINE = 0xff0a0605;
const COMBO_BANNER_MIN = 3;
const DOUBLE_TAP_MS = 260;
const DASH_COOLDOWN_MS = 820;
const DASH_INVULN_MS = 260;
/** The body is "blocked" when it covers under this share of the distance its speed should have carried it. */
const BLOCKED_RATIO = 0.4;

function keyDirection(key: string): { x: number; y: number } {
  const x = key === 'd' || key === 'arrowright' ? 1 : key === 'a' || key === 'arrowleft' ? -1 : 0;
  const y = key === 's' || key === 'arrowdown' ? 1 : key === 'w' || key === 'arrowup' ? -1 : 0;
  return { x, y };
}
const SPAWN_CLEARANCE = 56;
const DEFAULT_CHARACTER_ID = 'foreman';
const CHARACTER_KEY = 'demoday.character.v1';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);
/** Keys that would scroll or navigate the page under the game. */
const PAGE_KEYS = new Set(['pageup', 'pagedown', 'home', 'end', 'tab', 'enter', ' ']);

export type StartResult = { ok: true } | { ok: false; reason: string };

export interface RunSummary {
  /** Character id the run was played with. */
  character: string;
  destroyedPct: number;
  kills: number;
  level: number;
  elapsedSec: number;
}

const STYLE = `
:host { all: initial; }
.layer { position: fixed; inset: 0; overflow: hidden; pointer-events: none; font: 12px/1.3 ui-monospace, Menlo, Consolas, monospace; color: #f4f1ea; }
canvas { position: fixed; left: 0; top: 0; image-rendering: pixelated; image-rendering: crisp-edges; pointer-events: none; transform-origin: 0 0; }
.hud { position: fixed; top: 10px; left: 10px; display: grid; gap: 6px; padding: 6px 8px; background: rgba(15,15,20,.85); border: 1px solid rgba(255,255,255,.25); text-shadow: 0 1px 0 #000; }
.bar { width: 180px; height: 10px; background: rgba(0,0,0,.6); border: 1px solid #000; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
.bar > i { display: block; height: 100%; width: 0; background: #e4572e; }
.bar.pct > i { background: #f2c14e; }
.row { display: flex; gap: 8px; align-items: center; }
.dock { position: fixed; left: 10px; bottom: 10px; display: flex; gap: 8px; align-items: center; pointer-events: none; }
.dock .hint { padding: 4px 8px; background: rgba(15,15,20,.85); border: 1px solid rgba(255,255,255,.2); text-shadow: 0 1px 0 #000; }
.dock button, .dock a { pointer-events: auto; font: inherit; color: #f4f1ea; background: rgba(15,15,20,.88); border: 1px solid rgba(255,255,255,.35); padding: 4px 8px; cursor: pointer; text-decoration: none; }
.dock button:hover, .dock a:hover { background: rgba(40,40,52,.95); }
.credit { position: fixed; right: 10px; bottom: 10px; pointer-events: auto; padding: 4px 8px; background: rgba(15,15,20,.85); border: 1px solid rgba(255,255,255,.2); }
.credit a { color: #f4f1ea; text-decoration: underline; }
.card { position: fixed; right: 16px; bottom: 16px; width: 260px; pointer-events: auto; background: rgba(15,15,20,.96); border: 1px solid rgba(255,255,255,.4); box-shadow: 0 6px 24px rgba(0,0,0,.45); padding: 12px 14px; display: grid; gap: 8px; }
.card h2 { all: unset; display: block; font-size: 14px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #f2c14e; }
.card dl { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 0; }
.card dt { opacity: .75; }
.card dd { margin: 0; text-align: right; font-weight: 700; }
.card .actions { display: flex; gap: 8px; }
.card .actions a, .card .actions button { flex: 1; text-align: center; font: inherit; color: #0b0b0e; background: #f2c14e; border: 0; padding: 6px 8px; cursor: pointer; text-decoration: none; font-weight: 700; }
.card .actions button { color: #f4f1ea; background: rgba(255,255,255,.12); font-weight: 400; }
.glow { position: fixed; left: 0; top: 0; pointer-events: none; image-rendering: auto; transform-origin: 0 0; }
.panel.wide { max-width: min(94vw, 760px); }
.search { font: inherit; color: #f4f1ea; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.3); padding: 8px 10px; width: 100%; box-sizing: border-box; }
.search:focus { outline: 2px solid #f2c14e; outline-offset: 1px; }
.roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; max-height: 44vh; overflow: auto; padding: 2px; }
.card-option { display: grid; justify-items: center; gap: 2px; padding: 6px 4px !important; }
.card-option[aria-selected="true"] { outline: 2px solid #f2c14e; background: rgba(242,193,78,.15) !important; }
.card-option .card-name { font-size: 10px; text-align: center; line-height: 1.2; }
canvas.portrait { position: static; width: 80px; height: 104px; }
.detail { display: grid; gap: 2px; min-height: 66px; }
.stats { opacity: .85; }
.actions-row { display: flex; gap: 8px; }
.actions-row > * { flex: 1; }
[hidden] { display: none !important; }
.menus { position: fixed; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(5,6,10,.5); pointer-events: auto; }
.menus.open { display: flex; }
.panel { min-width: 260px; max-width: min(92vw, 560px); max-height: 90vh; overflow: auto; background: rgba(15,15,20,.97); border: 1px solid rgba(255,255,255,.4); box-shadow: 0 8px 32px rgba(0,0,0,.55); padding: 16px 18px; display: grid; gap: 10px; }
.panel h2 { all: unset; display: block; font-size: 16px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #f2c14e; }
.panel h3 { all: unset; display: block; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; opacity: .7; margin-top: 6px; }
.panel p { margin: 0; }
.panel-body { display: grid; gap: 8px; }
.panel button, .panel a.btn { font: inherit; color: #f4f1ea; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.3); padding: 8px 12px; cursor: pointer; text-align: center; text-decoration: none; }
.panel button:hover, .panel a.btn:hover { background: rgba(255,255,255,.2); }
.panel button:focus-visible, .panel a:focus-visible { outline: 2px solid #f2c14e; outline-offset: 1px; }
.panel .primary { background: #f2c14e; color: #0b0b0e; font-weight: 700; border-color: #f2c14e; }
.panel .danger { border-color: #e4572e; color: #ffb4a0; }
.setting { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.setting-value { min-width: 130px; }
.choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.choice { display: grid; gap: 4px; text-align: left; align-content: start; min-height: 110px; }
.choice-key { color: #f2c14e; font-weight: 700; }
.choice-desc { opacity: .8; font-size: 11px; }
.credit-link { color: #f4f1ea; opacity: .6; font-size: 11px; }
.hint-line { opacity: .75; }
.notice { position: fixed; left: 50%; top: 70px; transform: translateX(-50%); background: rgba(15,15,20,.92); border: 1px solid #f2c14e; color: #f2c14e; padding: 6px 14px; font-weight: 700; letter-spacing: .06em; pointer-events: none; }
.hud .sub { opacity: .8; }
.bar.xp > i { background: #4de1ff; }
.bar.dash > i { background: #a78bfa; }
@media (max-width: 640px) { .choices { grid-template-columns: 1fr; } }
.shield { position: fixed; inset: 0; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; cursor: default; }
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

  /* the reveal: what was destroyed, and the scenery drawn through it */
  private field = new HoleField(1, 1);
  private craters: Array<{ x: number; y: number; r: number }> = [];
  private scenery: Scenery | null = null;
  private maskBuf = new Uint32Array(0);
  private edgeBuf = new Uint32Array(0);
  private maskCanvas: HTMLCanvasElement | null = null;
  private edgeCanvas: HTMLCanvasElement | null = null;
  private sceneCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private edgeCtx: CanvasRenderingContext2D | null = null;
  private sceneCtx: CanvasRenderingContext2D | null = null;
  private lastFieldVersion = -1;
  private lastOrigin = { x: Number.NaN, y: Number.NaN };
  private holesInWindow = 0;
  private ownerIds = new WeakMap<Element, number>();

  /* feel: flashes, dissolves, debris, numbers, combo, hit-stop, sound */
  private rng = createRng(1);
  private floaters: Floater[] = [];
  private debris: Debris[] = [];
  private dissolves: Array<{ block: PageBlock; bornAt: number; level: number }> = [];
  private combo = newCombo();
  private hitStopUntil = 0;
  private lastHitStopAt = -1e9;
  private audio: AudioContext | null = null;
  private sfx: SfxEngine | null = null;
  private muted = false;
  private crackCache = new Map<string, Array<[number, number]>>();
  private ownerColors = new WeakMap<Element, string[]>();
  private actorCanvas: HTMLCanvasElement | null = null;
  private actorCtx: CanvasRenderingContext2D | null = null;
  private lightHost: HTMLElement | null = null;
  private lightCanvas: HTMLCanvasElement | null = null;
  private lightCtx: CanvasRenderingContext2D | null = null;
  private lightsOn = false;
  private nextOwnerId = 1;

  /* survival: phases, menus, settings, dash, objective */
  onLevelComplete?: (summary: RunSummary) => void;
  private settings: Settings = loadSettings(null);
  private phase: 'select' | 'playing' | 'paused' | 'levelup' | 'complete' | 'dead' = 'playing';
  private characterId = DEFAULT_CHARACTER_ID;
  private selectFromPause = false;
  private abilityRequested = false;
  private menuLayer: HTMLElement | null = null;
  private settingsOpen = false;
  private dashRequest: { x: number; y: number } | null = null;
  private readonly lastTap = new Map<string, number>();
  private lastMove = { x: 0, y: 1 };
  private lastPos = { x: 0, y: 0 };
  private shoulderAt = 0;
  private dashHitAt = 0;
  private bossSpawned = false;
  private levelDone = false;
  private noticeEl: HTMLElement | null = null;
  private noticeTimer = 0;
  private hud: {
    level: HTMLElement | null;
    xp: HTMLElement | null;
    objective: HTMLElement | null;
    dash: HTMLElement | null;
    ability: HTMLElement | null;
  } = { level: null, xp: null, objective: null, dash: null, ability: null };

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
      this.toast(t('overlay.refused', { reason: t(`overlay.reason.${reason}` as const) }));
      return { ok: false, reason };
    }

    const docEl = this.win.document.documentElement;
    const viewport = { w: this.win.innerWidth, h: this.win.innerHeight };
    this.doc = clampDocSize(
      { w: Math.max(docEl.scrollWidth, this.win.document.body?.scrollWidth ?? 0), h: Math.max(docEl.scrollHeight, this.win.document.body?.scrollHeight ?? 0) },
      viewport,
    );

    refreshLocale(this.win.navigator.languages?.length ? this.win.navigator.languages : [this.win.navigator.language]);
    this.settings = loadSettings(this.storage());
    (this.win.document.activeElement as HTMLElement | null)?.blur?.();
    this.mount();
    const scan = scanPage(this.win, this.host ? [this.host] : []);
    this.blocks = scan.blocks;
    this.elements = scan.elements;
    if (this.blocks.length === 0) {
      this.unmount();
      this.toast(t('overlay.nothing'));
      return { ok: false, reason: 'nothing to break' };
    }

    this.characterId = this.rememberedCharacter();
    const world = this.makeWorld(this.characterId, viewport);
    this.world = world;

    this.phase = 'select';
    this.settingsOpen = false;
    this.abilityRequested = false;
    this.dashRequest = null;
    this.bossSpawned = false;
    this.levelDone = false;
    this.lastPos = { x: world.player.x, y: world.player.y };
    this.field = new HoleField(Math.ceil(this.doc.w / CELL_CSS), Math.ceil(this.doc.h / CELL_CSS));
    this.craters = [];
    const look = this.readPageLook();
    this.scenery = createScenery(look, this.win.location.hostname);
    this.lightsOn = look.luma < GLOW_MAX_PAGE_LUMA;
    this.applySettings();
    this.lastFieldVersion = -1;
    this.rng = createRng((Date.now() % 1e9) | 0);
    this.floaters = [];
    this.debris = [];
    this.dissolves = [];
    this.combo = newCombo();
    this.hitStopUntil = 0;
    this.crackCache.clear();
    this.ensureAudio();

    skipBlocksNear(this.blocks, this.spawnPage(viewport), SPAWN_CLEARANCE);

    this.mountLightHost();
    this.applySettings();
    this.layout();
    this.stream(true);

    this.win.addEventListener('keydown', this.onKeyDown, true);
    this.win.addEventListener('keyup', this.onKeyUp, true);
    this.win.addEventListener('blur', this.onBlur);
    this.win.document.addEventListener('visibilitychange', this.onVisibility);
    this.win.addEventListener('resize', this.onResize);
    this.win.addEventListener('wheel', this.onScrollInput, { capture: true, passive: false });
    this.win.addEventListener('touchmove', this.onScrollInput, { capture: true, passive: false });

    this.running = true;
    this.lastTime = performance.now();
    this.acc = 0;
    this.raf = this.win.requestAnimationFrame(this.frame);
    this.phase = 'select';
    this.selectFromPause = false;
    this.openSelect();
    return { ok: true };
  }

  /**
   * Stop the run. The page was never modified, so removing the overlay is the whole restore. `restore = false`
   * leaves the final frame (holes and all) up for a moment instead, for a screenshot.
   */
  stop(restore = true): RunSummary | null {
    if (!this.running && !this.host) return null;
    const summary = this.summary();
    this.running = false;
    this.win.cancelAnimationFrame(this.raf);
    this.win.removeEventListener('keydown', this.onKeyDown, true);
    this.win.removeEventListener('keyup', this.onKeyUp, true);
    this.win.removeEventListener('blur', this.onBlur);
    this.win.document.removeEventListener('visibilitychange', this.onVisibility);
    this.win.removeEventListener('resize', this.onResize);
    this.win.clearTimeout(this.noticeTimer);
    this.win.removeEventListener('wheel', this.onScrollInput, true);
    this.win.removeEventListener('touchmove', this.onScrollInput, true);
    this.win.clearTimeout(this.resizeTimer);
    this.unmount();
    this.keys.clear();
    this.alive.clear();
    this.world = null;
    this.scenery = null;
    this.field.clear();
    this.floaters = [];
    this.debris = [];
    this.dissolves = [];
    this.sfx?.dispose();
    this.sfx = null;
    void this.audio?.close().catch(() => undefined);
    this.audio = null;
    if (summary && (summary.elapsedSec >= 3 || summary.destroyedPct > 0)) this.showEndCard(summary, restore);
    return summary;
  }

  /** Put the page back to whole without ending the run: forget every hole and let every block be hit again. */
  restorePage(): void {
    this.field.clear();
    this.craters = [];
    this.dissolves = [];
    for (const b of this.blocks) b.destroyed = false;
    this.rescan();
  }

  summary(): RunSummary | null {
    if (!this.world) return null;
    const hud = hudSnapshot(this.world);
    return {
      character: this.characterId,
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
    const key = e.key.toLowerCase();
    if (editable && key !== 'escape') return;
    this.ensureAudio();
    if (key === 'm' && !e.repeat) {
      this.muted = !this.muted;
      this.applySettings();
      return;
    }
    if (key === 'escape' || key === 'p') {
      if (e.repeat) return;
      e.preventDefault();
      this.onPauseKey();
      return;
    }
    if (this.phase === 'levelup') {
      const n = Number(key);
      if (n >= 1 && n <= this.levelUpChoices.length) {
        e.preventDefault();
        this.pickUpgrade(this.levelUpChoices[n - 1]!);
        return;
      }
    }
    if (key === ' ') {
      if (activatable) return; // let a focused button/link keep its own Space
      if (this.phase === 'playing') this.ultRequested = true;
      e.preventDefault();
      return;
    }
    if (key === 'f' && !e.repeat && !activatable) {
      if (this.phase === 'playing') this.abilityRequested = true;
      return;
    }
    if (key === 'shift') {
      if (this.phase === 'playing' && !e.repeat) this.requestDash();
      return;
    }
    if (MOVE_KEYS.has(key)) {
      e.preventDefault();
      if (this.phase !== 'playing') return;
      if (!e.repeat) {
        const last = this.lastTap.get(key);
        const nowMs = performance.now();
        this.lastTap.set(key, nowMs);
        if (last !== undefined && nowMs - last < DOUBLE_TAP_MS) this.requestDash(keyDirection(key));
      }
      this.keys.add(key);
      return;
    }
    // Page keys (scroll, tab, enter) must not move or activate the page underneath, but stay usable on our own buttons.
    if (PAGE_KEYS.has(key) && !activatable) e.preventDefault();
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };

  private readonly onBlur = () => {
    this.keys.clear();
    this.pause();
  };

  private readonly onVisibility = () => {
    if (this.win.document.hidden) {
      this.keys.clear();
      this.pause();
    }
  };

  /** The driven scroll is the only scroll while playing: wheel and touch never reach the page. */
  private readonly onScrollInput = (e: Event) => {
    if (e.cancelable) e.preventDefault();
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
    const live = this.phase === 'playing';
    const frozen = !live || now < this.hitStopUntil;
    if (live && !frozen) this.acc += dt * gameSpeedFactor(this.settings);
    if (!live) this.acc = 0;

    const move = this.moveVector();
    if (move.moveX !== 0 || move.moveY !== 0) this.lastMove = { x: move.moveX, y: move.moveY };
    if (live) this.tryDash(world);
    if (live && this.abilityRequested) {
      this.abilityRequested = false;
      castAbility(world, move.moveX !== 0 || move.moveY !== 0 ? { x: move.moveX, y: move.moveY } : this.lastMove);
    }
    let steps = 0;
    while (!frozen && this.acc >= FIXED_STEP && steps < MAX_SUBSTEPS) {
      stepWorld(world, FIXED_STEP, { ...move, ultimate: this.ultRequested });
      this.ultRequested = false;
      this.acc -= FIXED_STEP;
      steps += 1;
    }
    if (steps === MAX_SUBSTEPS) this.acc = 0;

    if (live) {
      this.bodyContact(world, steps * FIXED_STEP, move);
      this.processHits(world);
      this.collectBroken(world, now);
      this.collectImpacts(world);
      this.updateDissolves(world);
      stepDebris(this.debris, dt);
      pruneFloaters(this.floaters, world.now);
      this.drainSfx(world);
      this.drainLoot(world);
      this.checkLevelFlow(world);
      this.followWithScroll(world, dt);
    }
    this.render(world);
    if (now - this.lastHud >= 100) {
      this.lastHud = now;
      this.updateHud(world);
    }
    this.raf = this.win.requestAnimationFrame(this.frame);
  };

  /* ----------------------------------------------------------- roster */

  private rememberedCharacter(): string {
    try {
      const id = this.storage()?.getItem(CHARACTER_KEY);
      if (id && CHARACTERS.some((c) => c.id === id)) return id;
    } catch {
      // storage blocked: use the default
    }
    return DEFAULT_CHARACTER_ID;
  }

  private spawnPage(viewport: { w: number; h: number }): { x: number; y: number } {
    return {
      x: Math.min(this.doc.w - 1, this.win.scrollX + viewport.w / 2),
      y: Math.min(this.doc.h - 1, this.win.scrollY + viewport.h / 2),
    };
  }

  /** A fresh world for `id`: faster stats for the page's scale, the page's waves, and the player where the view is centred. */
  private makeWorld(id: string, viewport: { w: number; h: number }): World {
    const character = CHARACTERS.some((c) => c.id === id) ? getCharacter(id) : getCharacter(DEFAULT_CHARACTER_ID);
    const stats = { ...character.stats, speed: character.stats.speed * SPEED_MULT };
    const world = createWorld(overlayArea(this.doc), character, stats, (Date.now() % 100000) | 0, [], 1, false);
    world.area.waves = buildOverlayWaves({ blocks: this.blocks.length, zen: this.settings.mode === 'zen' });
    const spawn = pageToWorld(this.spawnPage(viewport).x, this.spawnPage(viewport).y, this.doc);
    world.player.x = spawn.x;
    world.player.y = spawn.y;
    this.lastPos = { x: spawn.x, y: spawn.y };
    this.abilityText(character);
    return world;
  }

  private abilityText(character: CharacterDef): void {
    const ability = abilityFor(character);
    if (this.hud.ability) this.hud.ability.textContent = t(ability ? (`overlay.ability.${ability.labelKey}` as const) : 'overlay.ability.none');
  }

  private openSelect(): void {
    this.settingsOpen = false;
    this.keys.clear();
    this.showMenu(
      buildCharacterSelect(this.win.document, CHARACTERS, this.characterId, {
        restarts: this.selectFromPause,
        onPlay: (character) => this.chooseCharacter(character),
        onCancel: this.selectFromPause ? () => this.openPauseMenu() : undefined,
      }),
    );
  }

  /** Start (or restart) the run as `character`. Switching mid-run puts the page back and starts over. */
  private chooseCharacter(character: CharacterDef): void {
    const viewport = { w: this.win.innerWidth, h: this.win.innerHeight };
    try {
      this.storage()?.setItem(CHARACTER_KEY, character.id);
    } catch {
      // storage blocked: the choice lasts for this run only
    }
    const changed = character.id !== this.characterId || this.selectFromPause;
    this.characterId = character.id;
    if (changed || !this.world) {
      this.alive.clear();
      this.world = this.makeWorld(character.id, viewport);
      this.bossSpawned = false;
      this.levelDone = false;
      this.dissolves = [];
      this.floaters = [];
      this.debris = [];
      this.combo = newCombo();
      this.hitStopUntil = 0;
      this.ultRequested = false;
      this.dashRequest = null;
      this.abilityRequested = false;
      this.restorePage();
      skipBlocksNear(this.blocks, this.spawnPage(viewport), SPAWN_CLEARANCE);
      this.stream(false);
    }
    this.applySettings();
    this.closeMenu();
    this.phase = 'playing';
    this.acc = 0;
    this.lastTime = performance.now();
    this.ensureAudio();
  }

  /* ------------------------------------------------------- survival flow */

  private storage(): Storage | null {
    try {
      return this.win.localStorage;
    } catch {
      return null;
    }
  }

  /** Push the current settings into everything that reads them. Safe to call any time. */
  private applySettings(): void {
    this.sfx?.setEnabled(this.settings.sfx && !this.muted);
    if (this.lightHost) this.lightHost.style.display = this.lightsOn && this.settings.glow && !this.settings.reducedFlashes ? '' : 'none';
    const world = this.world;
    if (world) {
      const zen = this.settings.mode === 'zen';
      world.area.waves = buildOverlayWaves({ blocks: this.blocks.length, zen });
      if (this.bossSpawned && !zen) world.area.waves.push(finaleWave(world.time));
    }
  }

  /** Esc / P: pause, or step back out of whatever menu is open. */
  private onPauseKey(): void {
    if (this.phase === 'select') {
      if (this.selectFromPause) this.openPauseMenu();
      else void this.stop(true);
      return;
    }
    if (this.phase === 'playing') this.pause();
    else if (this.phase === 'paused') {
      if (this.settingsOpen || this.selectFromPause) this.openPauseMenu();
      else this.resume();
    }
  }

  private pause(): void {
    if (this.phase !== 'playing' || !this.world) return;
    this.phase = 'paused';
    this.keys.clear();
    this.openPauseMenu();
  }

  private resume(): void {
    if (this.phase !== 'paused') return;
    this.closeMenu();
    this.phase = 'playing';
    this.acc = 0;
    this.lastTime = performance.now();
  }

  private openPauseMenu(): void {
    this.settingsOpen = false;
    if (this.phase === 'select') this.phase = 'paused';
    this.selectFromPause = false;
    const summary = this.summary();
    this.showMenu(
      buildPauseMenu(this.win.document, {
        onResume: () => this.resume(),
        onSettings: () => this.openSettings(),
        onCharacters: () => {
          this.selectFromPause = true;
          this.openSelect();
        },
        onRestore: () => {
          this.restorePage();
          this.resume();
        },
        shareUrl: summary ? reportUrl(summary, summary.character) : CREDIT_URL,
        onLeave: () => void this.stop(true),
        creditUrl: CREDIT_URL,
      }),
    );
  }

  private openSettings(): void {
    this.settingsOpen = true;
    this.showMenu(
      buildSettingsPanel(
        this.win.document,
        this.settings,
        (id: SettingId) => {
          this.settings = nextSetting(this.settings, id);
          saveSettings(this.storage(), this.settings);
          this.applySettings();
          return this.settings;
        },
        () => this.openPauseMenu(),
      ),
    );
  }

  private showMenu(panel: HTMLElement): void {
    const layer = this.menuLayer;
    if (!layer) return;
    layer.replaceChildren(panel);
    layer.classList.add('open');
    ((panel.querySelector('[aria-selected="true"]') ?? panel.querySelector('button.primary, button, a')) as HTMLElement | null)?.focus();
  }

  private closeMenu(): void {
    this.menuLayer?.replaceChildren();
    this.menuLayer?.classList.remove('open');
    this.settingsOpen = false;
  }

  /** A short, self-clearing line near the top of the screen (boss warnings, loot). */
  private notice(message: string): void {
    const layer = this.host?.shadowRoot?.querySelector('.layer');
    if (!layer) return;
    this.noticeEl?.remove();
    const doc = this.win.document;
    const el = doc.createElement('div');
    el.className = 'notice';
    el.textContent = message;
    layer.appendChild(el);
    this.noticeEl = el;
    this.win.clearTimeout(this.noticeTimer);
    this.noticeTimer = this.win.setTimeout(() => el.remove(), 2600);
  }

  private requestDash(direction?: { x: number; y: number }): void {
    const mv = this.moveVector();
    const dir = direction ?? (mv.moveX !== 0 || mv.moveY !== 0 ? { x: mv.moveX, y: mv.moveY } : this.lastMove);
    this.dashRequest = dir;
  }

  private tryDash(world: World): void {
    const req = this.dashRequest;
    if (!req) return;
    this.dashRequest = null;
    if (dashPlayer(world, req.x, req.y)) {
      world.player.invulnUntil = Math.max(world.player.invulnUntil, world.now + DASH_INVULN_MS);
    }
  }

  /**
   * Walking into page text chews at it (about 1.5x power per second) so the player is never walled in by blocks
   * the weapons do not reach, and a dash bulldozes through whatever it overlaps.
   */
  private bodyContact(world: World, simSec: number, move: { moveX: number; moveY: number }): void {
    const p = world.player;
    const moved = Math.hypot(p.x - this.lastPos.x, p.y - this.lastPos.y);
    this.lastPos = { x: p.x, y: p.y };
    if (p.dashUntil > world.now) {
      if (world.now - this.dashHitAt >= 60) {
        this.dashHitAt = world.now;
        damageBlocksNear(world, p.x, p.y, p.radius + 8, 8 * world.stats.power, 1);
      }
      return;
    }
    if ((move.moveX === 0 && move.moveY === 0) || simSec <= 0) return;
    const expected = world.stats.speed * simSec;
    if (moved >= expected * BLOCKED_RATIO || world.now - this.shoulderAt < 250) return;
    this.shoulderAt = world.now;
    damageBlocksNear(world, p.x, p.y, p.radius + 3, Math.max(1, 1.5 * world.stats.power * 0.25));
  }

  /** Loot boxes queue prizes that grant nothing until claimed; claim at once so the reel can never stall the run. */
  private drainLoot(world: World): void {
    while (world.pendingReel.length > 0) {
      const prize = world.pendingReel.shift()!;
      claimLootPrize(world, prize);
      this.playSfx('lootBox');
      this.notice(t('overlay.loot', { label: prize.label }));
    }
  }

  private levelState() {
    const world = this.world!;
    return {
      destroyed: destroyedFraction(this.blocks),
      elapsedSec: world.time,
      zen: this.settings.mode === 'zen',
      bossSpawned: this.bossSpawned,
      bossKilled: (world.killsByEnemy[FINALE_BOSS_ID] ?? 0) >= 1,
    };
  }

  /** Level-ups, the boss, completion and death: everything that changes which screen the player is looking at. */
  private checkLevelFlow(world: World): void {
    if (world.outcome === 'dead' && this.phase === 'playing') {
      this.phase = 'dead';
      this.keys.clear();
      const summary = this.summary();
      this.showMenu(
        buildDeadCard(this.win.document, { shareUrl: summary ? reportUrl(summary, summary.character) : CREDIT_URL, onLeave: () => void this.stop(true) }),
      );
      return;
    }
    if (world.pendingLevelUps > 0) {
      if (this.settings.levelUp === 'auto') this.autoLevelUp(world);
      else {
        this.openLevelUp(world);
        return;
      }
    }
    const state = this.levelState();
    if (shouldSpawnBoss(state)) {
      this.bossSpawned = true;
      world.area.waves.push(finaleWave(world.time));
      this.notice(t('overlay.boss.warning'));
      this.playSfx('bossWarning');
    }
    if (!this.levelDone && levelComplete(state)) this.completeLevel();
  }

  private levelUpChoices: UpgradeDef[] = [];

  private openLevelUp(world: World): void {
    const choices = rollUpgradeChoices(world);
    if (choices.length === 0) {
      world.pendingLevelUps = 0;
      return;
    }
    this.levelUpChoices = choices;
    this.phase = 'levelup';
    this.keys.clear();
    this.showMenu(buildLevelUp(this.win.document, world.level, choices, (choice) => this.pickUpgrade(choice)));
  }

  private pickUpgrade(choice: UpgradeDef): void {
    const world = this.world;
    if (!world || this.phase !== 'levelup') return;
    applyUpgrade(world, choice);
    this.closeMenu();
    this.phase = 'playing';
    this.acc = 0;
    this.lastTime = performance.now();
  }

  private completeLevel(): void {
    this.levelDone = true;
    this.phase = 'complete';
    this.keys.clear();
    const summary = this.summary();
    if (summary) this.onLevelComplete?.(summary);
    this.playSfx('levelUp');
    this.showMenu(
      buildCompleteCard(this.win.document, summary?.destroyedPct ?? Math.round(OBJECTIVE_PCT * 100), {
        shareUrl: summary ? reportUrl(summary, summary.character) : CREDIT_URL,
        onKeep: () => {
          this.closeMenu();
          this.phase = 'playing';
          this.acc = 0;
          this.lastTime = performance.now();
        },
        onLeave: () => void this.stop(true),
      }),
    );
  }

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

  /* ------------------------------------------------------------ reveal */

  /** Page background and accent colours, from computed styles only (no pixel readback). */
  private readPageLook(): PageLook {
    const doc = this.win.document;
    const bg = (el: Element | null) => (el ? parseCssColor(this.win.getComputedStyle(el).backgroundColor) : null);
    const background = bg(doc.body) ?? bg(doc.documentElement);
    const accentEl = doc.querySelector('main a[href], a[href], h1');
    const accent = accentEl ? parseCssColor(this.win.getComputedStyle(accentEl).color) : null;
    return pageLook(background, accent);
  }

  /** Stable key for "this block of this element", so destroyed state survives a re-scan. */
  private blockKeys(): Map<number, string> {
    const counts = new Map<string, number>();
    const keys = new Map<number, string>();
    for (const b of this.blocks) {
      const el = this.elements[b.owner];
      if (!el) continue;
      let id = this.ownerIds.get(el);
      if (id === undefined) {
        id = this.nextOwnerId++;
        this.ownerIds.set(el, id);
      }
      const base = `${id}:${b.kind}`;
      const n = counts.get(base) ?? 0;
      counts.set(base, n + 1);
      keys.set(b.id, `${base}:${n}`);
    }
    return keys;
  }

  /** Cut a hole for a destroyed block, then take down anything now standing in a hole. */
  private punchBlock(b: PageBlock): void {
    this.field.addRect(b.x / CELL_CSS, b.y / CELL_CSS, b.w / CELL_CSS, b.h / CELL_CSS);
  }

  /** Blocks whose centre now sits in a hole are gone too: the player cannot be walled in by an invisible block. */
  private cascadeIntoHoles(world: World): void {
    const gone = new Set<number>();
    for (const [id, uid] of this.alive) {
      const b = this.blocks[id];
      if (!b || b.destroyed) continue;
      if (this.field.isHole(Math.floor((b.x + b.w / 2) / CELL_CSS), Math.floor((b.y + b.h / 2) / CELL_CSS))) {
        b.destroyed = true;
        gone.add(uid);
      }
    }
    for (const uid of gone) {
      for (const [id, u] of this.alive) if (u === uid) this.alive.delete(id);
    }
    if (gone.size > 0) removeBreakables(world, gone);
  }

  /**
   * Every block the game just broke flashes, dissolves into a hole in the reveal (the page itself is untouched),
   * throws debris, feeds the combo and, when it is big, briefly stops the world.
   */
  private collectBroken(world: World, realNow: number): void {
    const gone = new Set<number>();
    for (const b of world.breakables) {
      if (b.kind !== 'page-block' || !b.broken || b.domId === undefined) continue;
      gone.add(b.uid);
      this.alive.delete(b.domId);
      const block = this.blocks[b.domId];
      if (!block || block.destroyed) continue;
      block.destroyed = true;
      this.dissolves.push({ block, bornAt: world.now, level: 0 });
      const hit = worldToPage(b.lastHitX ?? world.player.x, b.lastHitY ?? world.player.y, this.doc);
      this.throwDebris(block, { x: hit.x / CELL_CSS, y: hit.y / CELL_CSS });
      this.playSfx('obstacleBreak');
      const milestone = comboBreak(this.combo, world.now);
      if (milestone !== null) this.playSfx('speedTally');
      const stop = hitStopMs(b.maxHp, 1);
      if (stop > 0 && this.settings.hitStop && realNow - this.lastHitStopAt > HIT_STOP_COOLDOWN_MS) {
        this.hitStopUntil = realNow + stop;
        this.lastHitStopAt = realNow;
      }
    }
    if (gone.size > 0) removeBreakables(world, gone);
  }

  /** Advance every dissolve: after the flash the rect is eaten away in dither steps, then finally opened whole. */
  private updateDissolves(world: World): void {
    if (this.dissolves.length === 0) return;
    let finished = false;
    for (let i = this.dissolves.length - 1; i >= 0; i -= 1) {
      const d = this.dissolves[i]!;
      const age = world.now - d.bornAt;
      const b = d.block;
      const rect = [b.x / CELL_CSS, b.y / CELL_CSS, b.w / CELL_CSS, b.h / CELL_CSS] as const;
      if (dissolveDone(age)) {
        this.field.addRect(...rect);
        this.dissolves.splice(i, 1);
        finished = true;
        continue;
      }
      const level = dissolveLevel(age);
      if (level > d.level) {
        d.level = level;
        this.field.addDither(...rect, level);
      }
    }
    if (finished) this.cascadeIntoHoles(world);
  }

  /** Colours a block's debris should have: the text colour for text, the element's own paint (or the page accent) for boxes. */
  private debrisColors(block: PageBlock): string[] {
    const el = this.elements[block.owner];
    if (!el) return ['#e8ecf1'];
    const cached = this.ownerColors.get(el);
    if (cached) return cached;
    const cs = this.win.getComputedStyle(el);
    const colors: string[] = [];
    const text = parseCssColor(cs.color);
    const paint = parseCssColor(cs.backgroundColor) ?? parseCssColor(cs.borderTopColor);
    const css = (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`;
    if (block.kind === 'text') {
      if (text) colors.push(css(text));
    } else {
      if (paint) colors.push(css(paint));
      if (text) colors.push(css(text));
    }
    if (colors.length === 0) colors.push('#cfd6df');
    this.ownerColors.set(el, colors);
    return colors;
  }

  private throwDebris(block: PageBlock, from: { x: number; y: number }): void {
    const wCells = block.w / CELL_CSS;
    const hCells = block.h / CELL_CSS;
    const count = Math.max(3, Math.min(28, Math.round(Math.sqrt(wCells * hCells) * 0.9)));
    spawnDebris(this.debris, this.rng, { x: block.x / CELL_CSS, y: block.y / CELL_CSS, w: wCells, h: hCells }, from, this.debrisColors(block), count);
  }

  /** Damage numbers, hit sounds. Merged per block so a flurry of hits reads as one climbing number. */
  private processHits(world: World): void {
    if (world.propHits.length === 0) return;
    const byUid = new Map<number, number>();
    for (const b of world.breakables) if (b.domId !== undefined) byUid.set(b.uid, b.domId);
    let struck = false;
    for (const hit of world.propHits) {
      const id = byUid.get(hit.uid);
      const block = id === undefined ? undefined : this.blocks[id];
      if (!block || hit.amount < 1) continue;
      struck = true;
      addFloater(this.floaters, block.id, (block.x + block.w / 2) / CELL_CSS, block.y / CELL_CSS - 2, hit.amount, hit.kill, world.now);
    }
    world.propHits.length = 0;
    if (struck) this.playSfx('hit');
  }

  /* ------------------------------------------------------------ sound */

  /** The AudioContext is made on a user gesture (start or the first key), never at load. */
  private ensureAudio(): void {
    if (!this.audio) {
      try {
        const audioWin = this.win as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const Ctor = audioWin.AudioContext ?? audioWin.webkitAudioContext;
        if (Ctor) {
          this.audio = new Ctor();
          this.sfx = createSfxEngine(this.audio);
          this.sfx.setEnabled(!this.muted);
        }
      } catch {
        this.audio = null;
        this.sfx = null;
      }
    }
    if (this.audio?.state === 'suspended') void this.audio.resume().catch(() => undefined);
  }

  private playSfx(cue: SfxCueId, onBeat = false): void {
    this.sfx?.play(cue, DEFAULT_SFX_STYLE, onBeat);
  }

  private drainSfx(world: World): void {
    if (world.sfxEvents.length === 0) return;
    for (const ev of world.sfxEvents.splice(0)) this.playSfx(ev.cue, ev.onBeat);
  }

  /** Big blasts carve craters (blank page included: that is the "background revealed"), every blast leaves soot. */
  private collectImpacts(world: World): void {
    if (world.impacts.length === 0) return;
    let carved = false;
    for (const hit of world.impacts) {
      const page = worldToPage(hit.x, hit.y, this.doc);
      const cx = page.x / CELL_CSS;
      const cy = page.y / CELL_CSS;
      const rCells = hit.radius / SPRITE_UNITS;
      if (hit.radius >= CRATER_MIN_RADIUS && hit.intensity >= CRATER_MIN_INTENSITY) {
        const r = Math.max(2, rCells * CRATER_SHRINK);
        if (this.field.addCircle(cx, cy, r)) {
          carved = true;
          if (this.craters.length < MAX_CRATERS) this.craters.push({ x: cx, y: cy, r });
        }
      }
      this.field.addScorch(cx, cy, rCells * 1.5);
    }
    world.impacts.length = 0;
    if (carved) this.cascadeIntoHoles(world);
  }

  /* ------------------------------------------------------------ world sync */

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

  /**
   * Re-measure after a resize: positions can reflow. The page was never changed, so the scan sees everything;
   * destroyed blocks are matched back by (element, ordinal) and the holes rebuilt from them plus the craters.
   * The world keeps the page size it started with, so anything that now lies outside it is left alone.
   */
  private rescan(): void {
    const world = this.world;
    if (!world || !this.running) return;
    const before = this.blockKeys();
    const destroyedKeys = new Set<string>();
    for (const b of this.blocks) if (b.destroyed) destroyedKeys.add(before.get(b.id) ?? '');

    removeBreakables(world, new Set(this.alive.values()));
    this.alive.clear();
    const scan = scanPage(this.win, this.host ? [this.host] : []);
    this.blocks = scan.blocks;
    this.elements = scan.elements;

    const after = this.blockKeys();
    this.field.clear();
    for (const b of this.blocks) {
      if (b.x + b.w > this.doc.w || b.y + b.h > this.doc.h) b.skip = true;
      if (destroyedKeys.has(after.get(b.id) ?? '\0')) {
        b.destroyed = true;
        this.punchBlock(b);
      }
    }
    for (const c of this.craters) this.field.addCircle(c.x, c.y, c.r);
    const pagePos = worldToPage(world.player.x, world.player.y, this.doc);
    skipBlocksNear(this.blocks, pagePos, SPAWN_CLEARANCE);
    this.stream(false);
  }

  /**
   * The real window scroll follows the player, in whole cells, so the canvas and the page stay on one grid.
   * The page is not user-scrollable while the shield is up, so this is the only thing that moves it.
   */
  private followWithScroll(world: World, dt: number): void {
    const viewport = { w: this.win.innerWidth, h: this.win.innerHeight };
    const pagePos = worldToPage(world.player.x, world.player.y, this.doc);
    const target = scrollTargetFor(pagePos, viewport, this.doc);
    const maxX = Math.max(0, this.doc.w - viewport.w);
    const maxY = Math.max(0, this.doc.h - viewport.h);
    const k = Math.min(1, dt * 8);
    const sx = Math.round(this.win.scrollX);
    const sy = Math.round(this.win.scrollY);
    // Heavy hits shake the real scroll in whole cells, so the page and the game shake together (zero at clamped edges).
    const shake = this.settings.shake && world.shake > 3 ? Math.min(2, Math.round(world.shake / 8)) : 0;
    const jitter = () => (shake > 0 ? Math.round((this.rng() * 2 - 1) * shake) * CELL_CSS : 0);
    const nx = Math.min(maxX, Math.max(0, snapToCell(sx + (target.x - sx) * k) + jitter()));
    const ny = Math.min(maxY, Math.max(0, snapToCell(sy + (target.y - sy) * k) + jitter()));
    if (nx !== sx || ny !== sy) this.win.scrollTo({ left: nx, top: ny, behavior: 'instant' });
  }

  /* ------------------------------------------------------------ drawing */

  private render(world: World): void {
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!ctx || !canvas) return;
    const sx = Math.round(this.win.scrollX);
    const sy = Math.round(this.win.scrollY);
    const cellX = Math.floor(sx / CELL_CSS);
    const cellY = Math.floor(sy / CELL_CSS);
    // The canvas is one cell wider/taller than the viewport; shifting it by the sub-cell scroll remainder keeps it
    // locked to the page even where the scroll is clamped to a non-multiple (the bottom of the page).
    canvas.style.transform = `translate(${-(sx - cellX * CELL_CSS)}px, ${-(sy - cellY * CELL_CSS)}px)`;

    const originCss = { x: cellX * CELL_CSS, y: cellY * CELL_CSS };
    world.camera = cameraForScroll(originCss, { w: this.lowW * CELL_CSS, h: this.lowH * CELL_CSS }, this.doc);

    const view = { width: this.lowW, height: this.lowH, dpr: 1, targetViewOverride: targetViewUnits(this.lowW) };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.lowW, this.lowH);
    this.drawReveal(world, view, cellX, cellY);
    this.drawPageFx(world, cellX, cellY);
    this.drawDebris(cellX, cellY);
    this.drawActors(world, view);
    this.drawFloaters(world, cellX, cellY);
    this.drawCombo(world);
    this.drawLights(world, sx, sy, cellX, cellY);
  }

  /** Actors, projectiles and particles on their own canvas, so alpha can be snapped and outlined without touching the reveal. */
  private drawActors(world: World, view: { width: number; height: number; dpr: number; targetViewOverride: number }): void {
    const { ctx, actorCtx, actorCanvas } = this;
    if (!ctx || !actorCtx || !actorCanvas) return;
    renderWorld(actorCtx, world, { ...view, overlay: true });
    const img = actorCtx.getImageData(0, 0, this.lowW, this.lowH);
    const px = new Uint32Array(img.data.buffer);
    binariseAlpha(px, 110);
    if (this.settings.outline) addOutline(px, this.lowW, this.lowH, OUTLINE);
    actorCtx.putImageData(img, 0, 0);
    ctx.drawImage(actorCanvas, 0, 0);
  }

  /** Hit flash, break flash and cracks, painted over the page at each block's own cells. */
  private drawPageFx(world: World, cellX: number, cellY: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const view = { x0: cellX - 2, y0: cellY - 2, x1: cellX + this.lowW + 2, y1: cellY + this.lowH + 2 };
    const inView = (b: PageBlock) => {
      const bx = b.x / CELL_CSS;
      const by = b.y / CELL_CSS;
      return bx < view.x1 && by < view.y1 && bx + b.w / CELL_CSS > view.x0 && by + b.h / CELL_CSS > view.y0;
    };
    for (const b of world.breakables) {
      if (b.kind !== 'page-block' || b.domId === undefined || b.broken) continue;
      const block = this.blocks[b.domId];
      if (!block || !inView(block)) continue;
      const bx = Math.floor(block.x / CELL_CSS) - cellX;
      const by = Math.floor(block.y / CELL_CSS) - cellY;
      const bw = Math.ceil(block.w / CELL_CSS);
      const bh = Math.ceil(block.h / CELL_CSS);
      if (!this.settings.reducedFlashes && b.lastHitAt !== undefined && world.now - b.lastHitAt < 90) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(bx, by, bw, bh);
      }
      const stage = crackStage(b.maxHp > 0 ? b.hp / b.maxHp : 1);
      if (stage === 0) continue;
      const key = `${block.id}:${stage}`;
      let cells = this.crackCache.get(key);
      if (!cells) {
        cells = crackCells(block.id + 1, bw, bh, stage);
        this.crackCache.set(key, cells);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y] of cells) ctx.fillRect(bx + x + 1, by + y, 1, 1);
      ctx.fillStyle = '#05060a';
      for (const [x, y] of cells) ctx.fillRect(bx + x, by + y, 1, 1);
    }
    for (const d of this.dissolves) {
      if (this.settings.reducedFlashes || world.now - d.bornAt >= FLASH_MS) continue;
      const b = d.block;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(Math.floor(b.x / CELL_CSS) - cellX, Math.floor(b.y / CELL_CSS) - cellY, Math.ceil(b.w / CELL_CSS), Math.ceil(b.h / CELL_CSS));
    }
  }

  private drawDebris(cellX: number, cellY: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const d of this.debris) {
      if (d.life < d.maxLife * 0.2 && (Math.floor(d.x) + Math.floor(d.y)) % 2 === 0) continue; // dither out at the end
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.floor(d.x - cellX), Math.floor(d.y - cellY), d.size, d.size);
    }
  }

  /** Pixel text with a one-cell dark outline, `scale` cells per font cell. */
  private drawPixelText(text: string, x: number, y: number, colour: string, scale = 1): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const cells = textCells(text);
    ctx.fillStyle = '#05060a';
    for (const [cx, cy] of cells) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.fillRect(x + cx * scale + ox, y + cy * scale + oy, scale, scale);
    }
    ctx.fillStyle = colour;
    for (const [cx, cy] of cells) ctx.fillRect(x + cx * scale, y + cy * scale, scale, scale);
  }

  private drawFloaters(world: World, cellX: number, cellY: number): void {
    if (!this.settings.damageNumbers) return;
    for (const f of this.floaters) {
      const age = world.now - f.bornAt;
      if (age > FLOATER_LIFE_MS) continue;
      const scale = f.kill ? 2 : 1;
      const w = measureText(f.text) * scale;
      this.drawPixelText(f.text, Math.floor(f.x - w / 2 - cellX), Math.floor(f.y - floaterRise(age) - cellY), f.kill ? '#ffd45e' : '#ffffff', scale);
    }
  }

  private drawCombo(world: World): void {
    const count = comboAlive(this.combo, world.now);
    if (count < COMBO_BANNER_MIN) return;
    const text = `X${count}`;
    const scale = count >= 25 ? 3 : 2;
    const w = measureText(text) * scale;
    this.drawPixelText(text, Math.floor(this.lowW / 2 - w / 2), 8, count >= 25 ? '#ff8c42' : '#ffd45e', scale);
    this.drawPixelText('COMBO', Math.floor(this.lowW / 2 - measureText('COMBO') / 2), 8 + 5 * scale + 3, '#ffffff', 1);
  }

  /** Soft additive glow between the page and the pixel layer: half resolution, smoothed, drawn with `lighter`. */
  private drawLights(world: World, sx: number, sy: number, cellX: number, cellY: number): void {
    const { lightCtx, lightCanvas } = this;
    if (!lightCtx || !lightCanvas) return;
    lightCtx.setTransform(1, 0, 0, 1, 0, 0);
    lightCtx.globalCompositeOperation = 'source-over';
    lightCtx.globalAlpha = 1;
    lightCtx.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
    lightCanvas.style.transform = `translate(${-(sx - cellX * CELL_CSS)}px, ${-(sy - cellY * CELL_CSS)}px)`;
    const halfW = (this.lowW * SPRITE_UNITS) / 2;
    const halfH = (this.lowH * SPRITE_UNITS) / 2;
    const cam = world.camera;
    const lights = collectLights(world, { left: cam.x - halfW, top: cam.y - halfH, right: cam.x + halfW, bottom: cam.y + halfH });
    lightCtx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const lx = ((l.x - cam.x) / SPRITE_UNITS + this.lowW / 2) / 2;
      const ly = ((l.y - cam.y) / SPRITE_UNITS + this.lowH / 2) / 2;
      const r = Math.max(2, l.r / SPRITE_UNITS / 2);
      const g = lightCtx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, l.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lightCtx.globalAlpha = l.a;
      lightCtx.fillStyle = g;
      lightCtx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    lightCtx.globalAlpha = 1;
  }

  /** Scenery through the holes, then rim/shade/soot, onto the pixel canvas (under the actors). */
  private drawReveal(world: World, view: { width: number; height: number; dpr: number; targetViewOverride: number }, cellX: number, cellY: number): void {
    const { ctx, scenery } = this;
    if (!ctx || !scenery || !this.maskCtx || !this.edgeCtx || !this.sceneCtx || !this.maskCanvas || !this.edgeCanvas || !this.sceneCanvas) return;
    if (this.field.holeCount === 0 && this.field.version === 0) return;

    const moved = cellX !== this.lastOrigin.x || cellY !== this.lastOrigin.y;
    if (this.field.version !== this.lastFieldVersion || moved) {
      this.lastFieldVersion = this.field.version;
      this.lastOrigin = { x: cellX, y: cellY };
      this.holesInWindow = fillWindow(this.field, cellX, cellY, this.lowW, this.lowH, this.maskBuf, this.edgeBuf, scenery.edges);
      this.maskCtx.putImageData(new ImageData(new Uint8ClampedArray(this.maskBuf.buffer, 0, this.lowW * this.lowH * 4), this.lowW, this.lowH), 0, 0);
      this.edgeCtx.putImageData(new ImageData(new Uint8ClampedArray(this.edgeBuf.buffer, 0, this.lowW * this.lowH * 4), this.lowW, this.lowH), 0, 0);
    }

    if (this.holesInWindow > 0) {
      const sw = scenery.world;
      sw.now = world.now;
      sw.time = world.time;
      sw.cycle = world.cycle;
      // Mirror-wrap the camera so a page taller than the area's own map keeps showing authored scenery.
      const centreX = (cellX * CELL_CSS + (this.lowW * CELL_CSS) / 2) / WORLD_K;
      const centreY = (cellY * CELL_CSS + (this.lowH * CELL_CSS) / 2) / WORLD_K;
      const wrap = (v: number, size: number) => (((v % size) + size) % size) - size / 2;
      const cam = { x: wrap(centreX, sw.bounds.w), y: wrap(centreY, sw.bounds.h) };

      const sc = this.sceneCtx;
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      sc.clearRect(0, 0, this.lowW, this.lowH);
      renderGroundLayer(sc, sw, view, cam);
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(this.maskCanvas, 0, 0);
      sc.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.sceneCanvas, 0, 0);
    }
    ctx.drawImage(this.edgeCanvas, 0, 0);
  }

  /* ------------------------------------------------------------- DOM */

  private makeCanvas(doc: Document): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } {
    const canvas = doc.createElement('canvas');
    return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: false }) };
  }

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
    // The shield sits under the canvas and the UI: it takes every pointer event so the page below is inert.
    const shield = doc.createElement('div');
    shield.className = 'shield';
    shield.addEventListener('wheel', this.onScrollInput, { passive: false });
    shield.addEventListener('touchmove', this.onScrollInput, { passive: false });
    shield.addEventListener('contextmenu', (e) => e.preventDefault());
    layer.appendChild(shield);

    const main = this.makeCanvas(doc);
    layer.appendChild(main.canvas);

    const hud = doc.createElement('div');
    hud.className = 'hud';
    const hpRow = this.row(doc, t('overlay.hp'), 'bar');
    const xpRow = this.row(doc, t('overlay.level', { level: 1 }), 'bar xp');
    const pctRow = this.row(doc, t('overlay.destroyed'), 'bar pct');
    const dashRow = this.row(doc, t('overlay.dash'), 'bar dash');
    const objective = doc.createElement('div');
    objective.className = 'sub';
    this.hpFill = hpRow.fill;
    this.pctFill = pctRow.fill;
    this.pctText = pctRow.value;
    const ability = doc.createElement('div');
    ability.className = 'sub';
    this.hud = { level: xpRow.name, xp: xpRow.fill, objective, dash: dashRow.fill, ability };
    hud.append(hpRow.el, xpRow.el, pctRow.el, objective, dashRow.el, ability);
    layer.appendChild(hud);

    const dock = doc.createElement('div');
    dock.className = 'dock';
    const exit = doc.createElement('button');
    exit.type = 'button';
    exit.textContent = t('overlay.exit');
    exit.addEventListener('click', () => this.stop(true));
    const hint = doc.createElement('span');
    hint.className = 'hint';
    hint.textContent = t('overlay.hint');
    dock.append(exit, hint);
    layer.appendChild(dock);

    const credit = doc.createElement('div');
    credit.className = 'credit';
    credit.append(`${t('overlay.credit.prefix')} `);
    const link = doc.createElement('a');
    link.href = CREDIT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = t('overlay.credit.name');
    credit.appendChild(link);
    layer.appendChild(credit);

    const menus = doc.createElement('div');
    menus.className = 'menus';
    layer.appendChild(menus);
    this.menuLayer = menus;

    root.appendChild(layer);
    doc.documentElement.appendChild(host);
    this.host = host;
    this.canvas = main.canvas;
    this.ctx = main.ctx;
    // Off-screen work canvases (never attached): the hole mask, the rim/soot layer and the scenery pass.
    const mask = this.makeCanvas(doc);
    const edge = this.makeCanvas(doc);
    const scene = this.makeCanvas(doc);
    this.maskCanvas = mask.canvas;
    this.maskCtx = mask.ctx;
    this.edgeCanvas = edge.canvas;
    this.edgeCtx = edge.ctx;
    this.sceneCanvas = scene.canvas;
    this.sceneCtx = scene.ctx;
    const actor = doc.createElement('canvas');
    this.actorCanvas = actor;
    this.actorCtx = actor.getContext('2d', { willReadFrequently: true });
  }

  /** The additive light layer: its own top-level host (blend modes need a top-level element) stacked under the pixel layer. */
  private mountLightHost(): void {
    if (!this.lightsOn || !this.host) return;
    const doc = this.win.document;
    const host = doc.createElement('div');
    host.setAttribute('data-demoday', '');
    const cssApi = (this.win as unknown as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS;
    const blend = cssApi?.supports?.('mix-blend-mode', 'plus-lighter') ? 'plus-lighter' : 'screen';
    host.style.cssText = `all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;mix-blend-mode:${blend};`;
    const root = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    const canvas = doc.createElement('canvas');
    canvas.className = 'glow';
    root.append(style, canvas);
    doc.documentElement.insertBefore(host, this.host);
    this.lightHost = host;
    this.lightCanvas = canvas;
    this.lightCtx = canvas.getContext('2d');
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
    return { el, fill, value, name };
  }

  private unmount(): void {
    this.host?.remove();
    this.lightHost?.remove();
    this.lightHost = null;
    this.lightCanvas = null;
    this.lightCtx = null;
    this.actorCanvas = null;
    this.actorCtx = null;
    this.host = null;
    this.canvas = null;
    this.ctx = null;
    this.maskCanvas = this.edgeCanvas = this.sceneCanvas = null;
    this.maskCtx = this.edgeCtx = this.sceneCtx = null;
    this.hpFill = null;
    this.pctFill = null;
    this.pctText = null;
    this.menuLayer = null;
    this.noticeEl = null;
    this.hud = { level: null, xp: null, objective: null, dash: null, ability: null };
  }

  /** Size every low-res surface to cover the viewport in whole cells (+1 so the sub-cell scroll shift never shows a gap). */
  private layout(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const low = lowResSize({ w: this.win.innerWidth, h: this.win.innerHeight });
    this.lowW = low.w + 1;
    this.lowH = low.h + 1;
    for (const c of [canvas, this.maskCanvas, this.edgeCanvas, this.sceneCanvas]) {
      if (!c) continue;
      c.width = this.lowW;
      c.height = this.lowH;
    }
    canvas.style.width = `${this.lowW * CELL_CSS}px`;
    canvas.style.height = `${this.lowH * CELL_CSS}px`;
    if (this.actorCanvas) {
      this.actorCanvas.width = this.lowW;
      this.actorCanvas.height = this.lowH;
    }
    if (this.lightCanvas) {
      this.lightCanvas.width = Math.ceil(this.lowW / 2);
      this.lightCanvas.height = Math.ceil(this.lowH / 2);
      this.lightCanvas.style.width = `${this.lowW * CELL_CSS}px`;
      this.lightCanvas.style.height = `${this.lowH * CELL_CSS}px`;
    }
    this.maskBuf = new Uint32Array(this.lowW * this.lowH);
    this.edgeBuf = new Uint32Array(this.lowW * this.lowH);
    this.lastFieldVersion = -1;
  }

  private updateHud(world: World): void {
    const hud = hudSnapshot(world);
    const pct = destroyedFraction(this.blocks) * 100;
    if (this.hpFill) this.hpFill.style.width = `${hud.maxHp > 0 ? (hud.hp / hud.maxHp) * 100 : 0}%`;
    if (this.pctFill) this.pctFill.style.width = `${pct}%`;
    if (this.pctText) this.pctText.textContent = `${Math.round(pct)}%`;
    if (this.hud.level) this.hud.level.textContent = t('overlay.level', { level: hud.level });
    if (this.hud.xp) this.hud.xp.style.width = `${hud.xpToNext > 0 ? Math.min(100, (hud.xp / hud.xpToNext) * 100) : 0}%`;
    if (this.hud.objective) {
      const stage = levelStage(this.levelState());
      this.hud.objective.textContent =
        stage === 'smash' ? t('overlay.objective', { pct: Math.round(OBJECTIVE_PCT * 100) }) : stage === 'boss' ? t('overlay.objective.boss') : '';
    }
    if (this.hud.dash) {
      const left = Math.max(0, world.player.dashReadyAt - world.now);
      this.hud.dash.style.width = `${Math.round((1 - Math.min(1, left / DASH_COOLDOWN_MS)) * 100)}%`;
    }
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
    title.textContent = t('overlay.end.title');
    const note = doc.createElement('div');
    note.textContent = restored ? t('overlay.end.restored') : '';
    note.hidden = !restored;

    const stats = doc.createElement('dl');
    const minutes = Math.floor(summary.elapsedSec / 60);
    const seconds = String(summary.elapsedSec % 60).padStart(2, '0');
    const rows: Array<[string, string]> = [
      [t('overlay.end.destroyed'), `${summary.destroyedPct}%`],
      [t('overlay.end.kills'), String(summary.kills)],
      [t('overlay.end.level'), String(summary.level)],
      [t('overlay.end.time'), `${minutes}:${seconds}`],
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
    share.href = reportUrl(summary, summary.character);
    share.target = '_blank';
    share.rel = 'noopener noreferrer';
    share.textContent = t('overlay.end.share');
    const close = doc.createElement('button');
    close.type = 'button';
    close.textContent = t('overlay.end.close');
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
