/**
 * CalibratePrompt -- Lok Calibrate's one-tap card. It names the device it found ("Xbox Series X|S in
 * Edge") and offers to tune the game for it. Tapping Turn on calibrates and shows what changed;
 * the choice is remembered on the device. Children of the app never need to know about it: games
 * just read the published settings.
 */
import { useEffect, useRef, useState } from 'react';
import { useT, type MessageKey } from '@/lib/i18n';
import { buildProfile, describeProfile, type CalibrationProfile } from '@/lib/lokCalibrate/core';
import { applyProfile, calibrateModePref, calibrateNow, readDeviceFacts, turnOff } from '@/lib/lokCalibrate/runtime';

/** Screens where a card would get in the way of play. */
const QUIET_SCREENS = ['run', 'crew-run', 'arena', 'photosensitivity-notice', 'starter-lokpet-encounter', 'run-setup', 'jukebox'];
const SESSION_KEY = 'lok.calibrate.later';

export function CalibratePrompt({ screenName }: { screenName: string }) {
  const t = useT();
  const mode = calibrateModePref.use();
  const [found, setFound] = useState<CalibrationProfile | null>(null);
  const [done, setDone] = useState<CalibrationProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (mode === 'on') {
      void calibrateNow();
    } else if (mode === 'ask') {
      setFound(buildProfile(readDeviceFacts()));
    }
  }, [mode]);

  // The done card fades on its own so it never sits over play.
  useEffect(() => {
    if (!done) return;
    const id = window.setTimeout(() => setDone(null), 9000);
    return () => window.clearTimeout(id);
  }, [done]);

  const turnOn = async () => {
    setBusy(true);
    calibrateModePref.set('on');
    const p = await calibrateNow();
    setBusy(false);
    setFound(null);
    setDone(p);
  };
  const notNow = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* fine */
    }
    setLater(true);
  };
  const never = () => {
    calibrateModePref.set('off');
    applyProfile(null);
    setFound(null);
  };
  const off = () => {
    calibrateModePref.set('off');
    turnOff();
    setDone(null);
  };

  if (QUIET_SCREENS.includes(screenName)) return null;
  const card = 'fixed bottom-3 left-3 z-[70] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border-[3px] p-3 text-sm shadow-xl';
  const style = { background: '#FAF6EE', borderColor: '#3b2a20', color: '#3b2a20', boxShadow: '0 4px 0 #3b2a20' } as const;
  const btn = 'rounded-lg border-[3px] px-3 py-2 text-xs font-black';

  if (done) {
    const s = done.settings;
    return (
      <div className={card} style={style} role="status" data-testid="calibrate-done">
        <div className="font-black">{t('calibrate.doneTitle', { device: describeProfile(done) })}</div>
        <div className="mt-1 text-xs">{t('calibrate.doneLine', { dpr: s.dprCap, fps: s.fps, effects: t(`calibrate.tier.${done.tier}` as MessageKey) })}</div>
        <ul className="mt-1 list-disc pl-4 text-[11px] opacity-80">
          {done.notes.slice(0, 3).map((n) => (
            <li key={n}>{t(`calibrate.note.${n}` as MessageKey)}</li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <button type="button" tabIndex={-1} onPointerDown={() => setDone(null)} className={btn} style={{ borderColor: '#3b2a20', background: '#7cff6b' }}>
            {t('calibrate.ok')}
          </button>
          <button type="button" tabIndex={-1} onPointerDown={off} className={btn} style={{ borderColor: '#3b2a20', background: '#efe5d0' }}>
            {t('calibrate.turnOff')}
          </button>
        </div>
      </div>
    );
  }

  if (mode !== 'ask' || later || !found) return null;
  return (
    <div className={card} style={style} role="dialog" aria-label={t('calibrate.title')} data-testid="calibrate-prompt">
      <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{t('calibrate.title')}</div>
      <div className="mt-1 font-black">{t('calibrate.found', { device: describeProfile(found) })}</div>
      <p className="mt-1 text-xs">{t('calibrate.pitch')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" tabIndex={-1} disabled={busy} onPointerDown={() => void turnOn()} className={btn} style={{ borderColor: '#3b2a20', background: '#7cff6b' }} data-testid="button-calibrate-on">
          {busy ? t('calibrate.working') : t('calibrate.turnOn')}
        </button>
        <button type="button" tabIndex={-1} onPointerDown={notNow} className={btn} style={{ borderColor: '#3b2a20', background: '#efe5d0' }}>
          {t('calibrate.notNow')}
        </button>
        <button type="button" tabIndex={-1} onPointerDown={never} className="px-1 text-[11px] font-bold underline opacity-70">
          {t('calibrate.never')}
        </button>
      </div>
    </div>
  );
}
