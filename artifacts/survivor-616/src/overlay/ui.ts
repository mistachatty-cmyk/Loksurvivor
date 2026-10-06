/**
 * The overlay's menus, built as plain DOM (the game's own screens are React and cannot ship in this bundle).
 * Each builder returns one element for the session to mount inside its shadow root and wires callbacks only;
 * it never touches the world. Every string goes through `t()`.
 */
import type { UpgradeDef } from '@/game/types';
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
