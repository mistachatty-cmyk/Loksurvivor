/**
 * The overlay's menus, built as plain DOM (the game's own screens are React and cannot ship in this bundle).
 * Each builder returns one element for the session to mount inside its shadow root and wires callbacks only;
 * it never touches the world. Every string goes through `t()`.
 */
import { drawRig } from '@/game/render/sprite';
import type { CharacterDef, UpgradeDef } from '@/game/types';
import { abilityFor } from './overlayAbilities';
import { t, type OverlayKey } from './i18n';
import { SETTINGS_SCHEMA, optionValues, type SettingDef, type SettingId, type Settings } from './settings';

type Doc = Document;

function el<K extends keyof HTMLElementTagNameMap>(doc: Doc, tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(doc: Doc, label: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el(doc, 'button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function panel(doc: Doc, title: string): { root: HTMLElement; body: HTMLElement } {
  const root = el(doc, 'div', 'panel');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', title);
  root.append(el(doc, 'h2', '', title));
  const body = el(doc, 'div', 'panel-body');
  root.appendChild(body);
  return { root, body };
}

export interface PauseHandlers {
  onResume(): void;
  onSettings(): void;
  onCharacters?(): void;
  onRestore(): void;
  shareUrl: string;
  onLeave(): void;
  creditUrl: string;
}

export function buildPauseMenu(doc: Doc, h: PauseHandlers): HTMLElement {
  const { root, body } = panel(doc, t('overlay.pause.title'));
  body.append(button(doc, t('overlay.pause.resume'), h.onResume, 'primary'), button(doc, t('overlay.pause.settings'), h.onSettings));
  if (h.onCharacters) body.append(button(doc, t('overlay.pause.characters'), h.onCharacters));
  body.append(button(doc, t('overlay.pause.restore'), h.onRestore));
  const share = el(doc, 'a', 'btn', t('overlay.pause.share'));
  share.href = h.shareUrl;
  share.target = '_blank';
  share.rel = 'noopener noreferrer';
  body.append(share, button(doc, t('overlay.pause.leave'), h.onLeave, 'danger'));
  const credit = el(doc, 'a', 'credit-link', t('overlay.pause.credit'));
  credit.href = h.creditUrl;
  credit.target = '_blank';
  credit.rel = 'noopener noreferrer';
  root.appendChild(credit);
  return root;
}

function valueLabel(def: SettingDef, settings: Settings): string {
  const raw = String((settings as unknown as Record<string, unknown>)[def.id]);
  if (def.kind === 'toggle') return t(raw === 'true' ? 'overlay.value.on' : 'overlay.value.off');
  const option = def.options?.find((o) => o.value === raw);
  return t(`overlay.value.${option?.labelKey ?? raw}` as OverlayKey);
}

export function buildSettingsPanel(doc: Doc, settings: Settings, onCycle: (id: SettingId) => Settings, onBack: () => void): HTMLElement {
  const { root, body } = panel(doc, t('overlay.settings.title'));
  const groups: Array<SettingDef['group']> = ['gameplay', 'graphics', 'audio'];
  for (const group of groups) {
    const defs = SETTINGS_SCHEMA.filter((d) => d.group === group);
    if (defs.length === 0) continue;
    body.append(el(doc, 'h3', '', t(`overlay.group.${group}` as OverlayKey)));
    for (const def of defs) {
      const row = el(doc, 'div', 'setting');
      row.append(el(doc, 'span', 'setting-label', t(`overlay.setting.${def.labelKey}` as OverlayKey)));
      const control = button(doc, valueLabel(def, settings), () => {
        settings = onCycle(def.id);
        control.textContent = valueLabel(def, settings);
      }, 'setting-value');
      control.setAttribute('data-setting', def.id);
      control.setAttribute('aria-label', `${t(`overlay.setting.${def.labelKey}` as OverlayKey)}: ${valueLabel(def, settings)}`);
      row.append(control);
      body.append(row);
    }
  }
  body.append(button(doc, t('overlay.settings.back'), onBack, 'primary'));
  return root;
}

/** Three upgrade cards; click or press 1, 2, 3. */
export function buildLevelUp(doc: Doc, level: number, choices: readonly UpgradeDef[], onPick: (choice: UpgradeDef) => void): HTMLElement {
  const { root, body } = panel(doc, `${t('overlay.levelup.title')} ${t('overlay.level', { level })}`);
  body.append(el(doc, 'p', 'hint-line', t('overlay.levelup.pick')));
  const row = el(doc, 'div', 'choices');
  choices.forEach((choice, i) => {
    const card = button(doc, '', () => onPick(choice), 'choice');
    card.append(el(doc, 'span', 'choice-key', String(i + 1)), el(doc, 'strong', '', choice.name), el(doc, 'span', 'choice-desc', choice.description));
    row.append(card);
  });
  body.append(row);
  return root;
}

export interface FinishHandlers {
  shareUrl: string;
  onKeep?(): void;
  onLeave(): void;
}

export function buildCompleteCard(doc: Doc, pct: number, h: FinishHandlers): HTMLElement {
  const { root, body } = panel(doc, t('overlay.complete.title'));
  body.append(el(doc, 'p', '', t('overlay.complete.body', { pct })));
  if (h.onKeep) body.append(button(doc, t('overlay.complete.keep'), h.onKeep, 'primary'));
  body.append(button(doc, t('overlay.complete.leave'), h.onLeave));
  return root;
}

export function buildDeadCard(doc: Doc, h: FinishHandlers): HTMLElement {
  const { root, body } = panel(doc, t('overlay.dead.title'));
  body.append(el(doc, 'p', '', t('overlay.dead.body')));
  body.append(button(doc, t('overlay.complete.leave'), h.onLeave, 'primary'));
  return root;
}

/** Whether a setting control currently reads as "on" (used by tests of the schema wiring). */
export function settingChoices(def: SettingDef): string[] {
  return optionValues(def);
}

const PORTRAIT_W = 40;
const PORTRAIT_H = 52;

/** One survivor, baked from the game's own procedural rig at 1x (one rig pixel = one canvas pixel, scaled up with hard edges). */
function portrait(doc: Doc, character: CharacterDef): HTMLCanvasElement {
  const canvas = el(doc, 'canvas', 'portrait');
  canvas.width = PORTRAIT_W;
  canvas.height = PORTRAIT_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const scale = character.rig.pixelHeight > PORTRAIT_H - 6 ? (PORTRAIT_H - 6) / character.rig.pixelHeight : 1;
    try {
      drawRig(ctx, character.rig, character.palette, 'idle', 0, PORTRAIT_W / 2, PORTRAIT_H - 3, 1, scale, { outline: true });
    } catch {
      // A rig that fails to bake just shows an empty frame; the name still identifies it.
    }
  }
  return canvas;
}

export interface SelectHandlers {
  onPlay(character: CharacterDef): void;
  /** True when picking a survivor will restart a run already under way. */
  restarts: boolean;
  onCancel?(): void;
}

function matches(character: CharacterDef, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [character.name, character.id, character.handle, character.tagline].some((field) => field.toLowerCase().includes(q));
}

/**
 * The roster: every survivor in a searchable, keyboard-navigable grid with baked portraits. Arrow keys move
 * between cards, typing filters, Enter plays the focused one. Unlock rules are deliberately ignored here.
 */
export function buildCharacterSelect(doc: Doc, characters: readonly CharacterDef[], selectedId: string, h: SelectHandlers): HTMLElement {
  const { root, body } = panel(doc, t('overlay.select.title'));
  root.classList.add('wide');
  let selected = characters.find((c) => c.id === selectedId) ?? characters[0]!;

  const search = el(doc, 'input', 'search');
  search.type = 'search';
  search.placeholder = t('overlay.select.search');
  search.setAttribute('aria-label', t('overlay.select.search'));
  const count = el(doc, 'div', 'hint-line');
  const grid = el(doc, 'div', 'roster');
  grid.setAttribute('role', 'listbox');
  const detail = el(doc, 'div', 'detail');
  const play = button(doc, '', () => h.onPlay(selected), 'primary');

  const cards = new Map<string, HTMLButtonElement>();
  for (const character of characters) {
    const card = el(doc, 'button', 'card-option');
    card.type = 'button';
    card.setAttribute('role', 'option');
    card.dataset.character = character.id;
    card.append(portrait(doc, character), el(doc, 'span', 'card-name', character.name));
    card.addEventListener('click', () => select(character));
    card.addEventListener('dblclick', () => h.onPlay(character));
    card.addEventListener('focus', () => select(character, false));
    cards.set(character.id, card);
    grid.append(card);
  }

  function select(character: CharacterDef, focus = true): void {
    selected = character;
    for (const [id, card] of cards) card.setAttribute('aria-selected', String(id === character.id));
    if (focus) cards.get(character.id)?.focus();
    const ability = abilityFor(character);
    detail.replaceChildren(
      el(doc, 'strong', '', character.name),
      el(doc, 'span', 'hint-line', character.tagline),
      el(doc, 'span', 'stats', `${t('overlay.stat.hp')} ${Math.round(character.stats.maxHp)} · ${t('overlay.stat.speed')} ${Math.round(character.stats.speed)} · ${t('overlay.stat.power')} ${character.stats.power.toFixed(1)}${character.rarity === 'legendary' ? ` · ${t('overlay.select.legendary')}` : ''}`),
      el(doc, 'span', 'hint-line', t(ability ? (`overlay.ability.${ability.labelKey}` as OverlayKey) : 'overlay.ability.none')),
    );
    play.textContent = t('overlay.select.play', { name: character.name });
  }

  function filter(): void {
    let shown = 0;
    let first: CharacterDef | undefined;
    for (const character of characters) {
      const hit = matches(character, search.value);
      cards.get(character.id)!.hidden = !hit;
      if (hit) {
        shown += 1;
        first ??= character;
      }
    }
    count.textContent = shown === 0 ? t('overlay.select.none') : t('overlay.select.count', { shown, total: characters.length });
    if (first && !matches(selected, search.value)) select(first, false);
  }
  search.addEventListener('input', filter);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      h.onPlay(selected);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      (grid.querySelector('button:not([hidden])') as HTMLElement | null)?.focus();
    }
  });
  grid.addEventListener('keydown', (e) => {
    const visible = [...grid.querySelectorAll<HTMLButtonElement>('button:not([hidden])')];
    const at = visible.indexOf(doc.activeElement as HTMLButtonElement);
    const shadowActive = (grid.getRootNode() as ShadowRoot).activeElement as HTMLButtonElement | null;
    const index = at >= 0 ? at : visible.indexOf(shadowActive as HTMLButtonElement);
    if (index < 0) return;
    const top = visible[0]!.offsetTop;
    const cols = Math.max(1, visible.filter((b) => b.offsetTop === top).length);
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (step === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        h.onPlay(selected);
      }
      return;
    }
    e.preventDefault();
    const next = visible[Math.min(visible.length - 1, Math.max(0, index + step))];
    next?.focus();
  });

  body.append(search, count, grid, detail);
  if (h.restarts) body.append(el(doc, 'p', 'hint-line', t('overlay.select.restart')));
  const actions = el(doc, 'div', 'actions-row');
  actions.append(play);
  if (h.onCancel) actions.append(button(doc, t('overlay.settings.back'), h.onCancel));
  body.append(actions);
  select(selected, false);
  filter();
  return root;
}
