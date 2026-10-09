/**
 * Settings > Controls: keyboard and mouse, controller and touch on one page, so the
 * dash and every other action can be set up for whatever the player is holding.
 * Changes save at once and apply to the run immediately (even from the pause menu).
 */
import { useEffect, useState } from 'react';
import { Gamepad2, Keyboard, MousePointer2, Smartphone } from 'lucide-react';

import {
  CONTROL_ACTIONS, CONTROL_LABELS, GAMEPAD_BUTTON_NAMES, getControls, keyLabel, rebindButton, rebindKey,
  resetControls, saveControls, type ControlAction, type ControlSettings,
} from '@/game/input/controls';
import { useT } from '@/lib/i18n';
import { Switch } from './EndgameControls';

const BUTTON = 'min-h-9 border border-border bg-background px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:border-primary';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 py-3 first:border-t-0">
      <div className="min-w-0 max-w-md">
        <p className="text-sm font-bold text-white">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Section({ icon, title, intro, children, testId }: { icon: React.ReactNode; title: string; intro: string; children: React.ReactNode; testId: string }) {
  return (
    <section className="border border-border bg-card p-5 sm:p-6" data-testid={testId}>
      <h2 className="flex items-center gap-2 text-xl font-black uppercase text-white">{icon}{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ControlsSettings() {
  const t = useT();
  const [controls, setControls] = useState<ControlSettings>(getControls);
  const [listening, setListening] = useState<{ kind: 'key' | 'pad'; action: ControlAction } | null>(null);
  const [padName, setPadName] = useState<string | null>(null);

  const update = (next: ControlSettings) => setControls(saveControls(next));

  // Which controller is connected right now, if any.
  useEffect(() => {
    const read = () => {
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((candidate) => candidate && candidate.connected);
      setPadName(pad ? pad.id.replace(/\s*\(.*$/, '') : null);
    };
    read();
    window.addEventListener('gamepadconnected', read);
    window.addEventListener('gamepaddisconnected', read);
    return () => {
      window.removeEventListener('gamepadconnected', read);
      window.removeEventListener('gamepaddisconnected', read);
    };
  }, []);

  // Capture the next key press while rebinding a key.
  useEffect(() => {
    if (listening?.kind !== 'key') return undefined;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key !== 'Escape') update(rebindKey(controls, listening.action, event.key));
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, controls]);

  // Capture the next controller button press while rebinding a button.
  useEffect(() => {
    if (listening?.kind !== 'pad') return undefined;
    let raf = 0;
    const waitUp = new Set<number>();
    const poll = () => {
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((candidate) => candidate && candidate.connected);
      if (pad) {
        pad.buttons.forEach((button, index) => {
          if (index > 11) return;
          if (button.pressed && !waitUp.has(index)) {
            update(rebindButton(controls, listening.action, index));
            setListening(null);
          }
          if (!button.pressed) waitUp.delete(index);
        });
      }
      if (raf !== -1) raf = requestAnimationFrame(poll);
    };
    // Buttons already held when listening starts are ignored until released.
    Array.from(navigator.getGamepads?.() ?? []).forEach((pad) => pad?.buttons.forEach((b, i) => { if (b.pressed) waitUp.add(i); }));
    raf = requestAnimationFrame(poll);
    return () => { cancelAnimationFrame(raf); raf = -1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, controls]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6" data-testid="settings-controls">
      <Section icon={<Keyboard className="h-5 w-5 text-cyan-200" />} title={t('controls.keyboard.title')} intro={t('controls.keyboard.intro')} testId="controls-keyboard">
        {CONTROL_ACTIONS.map((action) => (
          <Row key={action} label={CONTROL_LABELS[action]}>
            <button
              type="button"
              className={`${BUTTON} min-w-28 ${listening?.kind === 'key' && listening.action === action ? 'border-primary text-primary' : ''}`}
              onClick={() => setListening(listening?.kind === 'key' && listening.action === action ? null : { kind: 'key', action })}
              data-testid={`button-bind-key-${action}`}
            >
              {listening?.kind === 'key' && listening.action === action ? t('controls.pressKey') : keyLabel(controls.keys[action])}
            </button>
          </Row>
        ))}
        <p className="border-t border-border/60 py-3 text-xs text-muted-foreground">{t('controls.keyboard.fixed')}</p>
      </Section>

      <Section icon={<MousePointer2 className="h-5 w-5 text-cyan-200" />} title={t('controls.mouse.title')} intro={t('controls.mouse.intro')} testId="controls-mouse">
        <Row label={t('controls.mouse.doubleClick')} hint={t('controls.mouse.doubleClickHint')}>
          <Switch on={controls.mouse.doubleClickDash} label={t('controls.mouse.doubleClick')} onClick={() => update({ ...controls, mouse: { doubleClickDash: !controls.mouse.doubleClickDash } })} testId="switch-mouse-double-dash" />
        </Row>
      </Section>

      <Section icon={<Gamepad2 className="h-5 w-5 text-cyan-200" />} title={t('controls.pad.title')} intro={t('controls.pad.intro')} testId="controls-pad">
        <Row label={t('controls.pad.status')} hint={padName ?? t('controls.pad.none')}>
          <Switch on={controls.gamepad.enabled} label={t('controls.pad.enabled')} onClick={() => update({ ...controls, gamepad: { ...controls.gamepad, enabled: !controls.gamepad.enabled } })} testId="switch-pad-enabled" />
        </Row>
        <Row label={t('controls.pad.deadzone')} hint={t('controls.pad.deadzoneHint')}>
          <input
            type="range" min={5} max={60} step={5} value={Math.round(controls.gamepad.deadzone * 100)}
            aria-label={t('controls.pad.deadzone')}
            onChange={(event) => update({ ...controls, gamepad: { ...controls.gamepad, deadzone: Number(event.target.value) / 100 } })}
            className="w-44 accent-cyan-300" data-testid="range-pad-deadzone"
          />
        </Row>
        {CONTROL_ACTIONS.map((action) => (
          <Row key={action} label={CONTROL_LABELS[action]}>
            <button
              type="button"
              className={`${BUTTON} min-w-36 ${listening?.kind === 'pad' && listening.action === action ? 'border-primary text-primary' : ''}`}
              onClick={() => setListening(listening?.kind === 'pad' && listening.action === action ? null : { kind: 'pad', action })}
              data-testid={`button-bind-pad-${action}`}
            >
              {listening?.kind === 'pad' && listening.action === action ? t('controls.pressButton') : GAMEPAD_BUTTON_NAMES[controls.gamepad.buttons[action]] ?? `Button ${controls.gamepad.buttons[action]}`}
            </button>
          </Row>
        ))}
        <p className="border-t border-border/60 py-3 text-xs text-muted-foreground">{t('controls.pad.fixed')}</p>
      </Section>

      <Section icon={<Smartphone className="h-5 w-5 text-cyan-200" />} title={t('controls.touch.title')} intro={t('controls.touch.intro')} testId="controls-touch">
        <Row label={t('controls.touch.dashButton')} hint={t('controls.touch.dashButtonHint')}>
          <Switch on={controls.touch.dashButton} label={t('controls.touch.dashButton')} onClick={() => update({ ...controls, touch: { ...controls.touch, dashButton: !controls.touch.dashButton } })} testId="switch-touch-dash-button" />
        </Row>
        <Row label={t('controls.touch.doubleTap')} hint={t('controls.touch.doubleTapHint')}>
          <Switch on={controls.touch.doubleTapDash} label={t('controls.touch.doubleTap')} onClick={() => update({ ...controls, touch: { ...controls.touch, doubleTapDash: !controls.touch.doubleTapDash } })} testId="switch-touch-double-tap" />
        </Row>
      </Section>

      <div>
        <button type="button" className={BUTTON} onClick={() => { setControls(resetControls()); setListening(null); }} data-testid="button-controls-reset">{t('controls.reset')}</button>
      </div>
    </div>
  );
}

export default ControlsSettings;
