import { BatteryCharging } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { useT } from '@/lib/i18n';
import { dailyFeedPref } from '@/lib/dailyFeed';
import { tabGuardPref } from '@/lib/saveGuard';
import { mediaControlsPref, playtimeSharingPref, SAVER_CAPS, saverCapPref, saverModePref, usePowerStatus, type SaverMode } from '@/lib/powerSaver';
import { formatBytes, readStorageReport, requestPersistentStorage, type StorageReport } from '@/lib/storageUsage';

import { CrashReportsToggle } from './CrashReportsToggle';

const ON = 'border-cyan-300/60 bg-cyan-400/15 text-cyan-100';
const OFF = 'border-border bg-background text-muted-foreground hover:border-cyan-300/60 hover:text-white';
const CHIP = 'border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors';

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border border-border/70 bg-background/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-white">{title}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

function SwitchRow({ title, body, on, onChange, testId }: { title: string; body: string; on: boolean; onChange: (next: boolean) => void; testId: string }) {
  const t = useT();
  return (
    <Row title={title} body={body}>
      <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={`${CHIP} ${on ? ON : OFF}`} data-testid={testId}>
        {on ? t('overlay.value.on') : t('overlay.value.off')}
      </button>
    </Row>
  );
}

function useStorageReport() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const refresh = useCallback(() => {
    void readStorageReport().then(setReport);
  }, []);
  useEffect(refresh, [refresh]);
  return { report, refresh };
}

/** Settings > Power, storage and data: everything that costs battery, space or network, in one place. */
export function PowerSettings() {
  const t = useT();
  const mode = saverModePref.use();
  const cap = saverCapPref.use();
  const controls = mediaControlsPref.use();
  const playtime = playtimeSharingPref.use();
  const tabGuard = tabGuardPref.use();
  const dailyFeed = dailyFeedPref.use();
  const status = usePowerStatus();
  const { report, refresh } = useStorageReport();
  const [persistMessage, setPersistMessage] = useState<string | null>(null);

  const modes: { id: SaverMode; label: string }[] = [
    { id: 'off', label: t('settings.power.mode.off') },
    { id: 'auto', label: t('settings.power.mode.auto') },
    { id: 'on', label: t('settings.power.mode.on') },
  ];
  const battery = status.facts.batteryLevel === null ? '' : `${Math.round(status.facts.batteryLevel * 100)}%`;
  const statusText = !status.saving
    ? t('settings.power.status.idle')
    : status.reason === 'battery'
      ? t('settings.power.status.battery', { level: battery })
      : status.reason === 'dataSaver'
        ? t('settings.power.status.dataSaver')
        : t('settings.power.status.manual');
  const share = report?.usage != null && report.quota ? Math.min(100, Math.max(1, Math.round((report.usage / report.quota) * 100))) : null;

  return (
    <section id="settings-power" className="scroll-mt-24 border border-border bg-card p-5 sm:p-6" data-testid="section-power-settings">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
          <BatteryCharging className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase text-white">{t('settings.power.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('settings.power.intro')}</p>
        </div>
      </div>

      <Row title={t('settings.power.saver')} body={t('settings.power.saverBody')}>
        {modes.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => saverModePref.set(m.id)} className={`${CHIP} ${mode === m.id ? ON : OFF}`} data-testid={`button-power-saver-${m.id}`}>
            {m.label}
          </button>
        ))}
      </Row>
      <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-cyan-200" role="status" data-testid="text-power-status">
        {statusText}
      </p>

      <Row title={t('settings.power.cap')} body={t('settings.power.capBody')}>
        {SAVER_CAPS.map((fps) => (
          <button key={fps} type="button" aria-pressed={cap === String(fps)} onClick={() => saverCapPref.set(String(fps))} className={`${CHIP} ${cap === String(fps) ? ON : OFF}`} data-testid={`button-power-cap-${fps}`}>
            {fps} FPS
          </button>
        ))}
      </Row>

      <SwitchRow title={t('settings.power.controls')} body={t('settings.power.controlsBody')} on={controls} onChange={(next) => mediaControlsPref.set(next)} testId="button-power-media-controls" />
      <SwitchRow title={t('settings.power.playtime')} body={t('settings.power.playtimeBody')} on={playtime} onChange={(next) => playtimeSharingPref.set(next)} testId="button-power-playtime" />
      <SwitchRow title={t('settings.power.daily')} body={t('settings.power.dailyBody')} on={dailyFeed} onChange={(next) => dailyFeedPref.set(next)} testId="button-power-daily-feed" />
      <SwitchRow title={t('settings.power.tabGuard')} body={t('settings.power.tabGuardBody')} on={tabGuard} onChange={(next) => tabGuardPref.set(next)} testId="button-power-tab-guard" />
      <CrashReportsToggle />

      <div className="mt-3 border border-border/70 bg-background/50 p-4" data-testid="panel-storage-usage">
        <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.power.storage')}</h3>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('settings.power.storageBody')}</p>
        <dl className="mt-3 grid gap-2 font-mono text-xs text-muted-foreground sm:grid-cols-3">
          <div className="border border-border/60 p-3">
            <dt className="uppercase tracking-widest">{t('settings.power.storage.save')}</dt>
            <dd className="mt-1 text-base text-white" data-testid="text-storage-save">{report ? formatBytes(report.save) : '…'}</dd>
          </div>
          <div className="border border-border/60 p-3">
            <dt className="uppercase tracking-widest">{t('settings.power.storage.media')}</dt>
            <dd className="mt-1 text-base text-white" data-testid="text-storage-media">
              {report?.media && report.media.files > 0 ? `${formatBytes(report.media.bytes)} · ${report.media.files}` : report ? t('settings.power.storage.none') : '…'}
            </dd>
          </div>
          <div className="border border-border/60 p-3">
            <dt className="uppercase tracking-widest">{t('settings.power.storage.total')}</dt>
            <dd className="mt-1 text-base text-white" data-testid="text-storage-total">
              {report?.usage != null ? `${formatBytes(report.usage)}${share ? ` · ${share}%` : ''}` : report ? t('settings.power.storage.unknown') : '…'}
            </dd>
          </div>
        </dl>
        {share !== null && (
          <div className="mt-3 h-1.5 w-full bg-border/60" aria-hidden="true">
            <div className="h-full bg-cyan-300" style={{ width: `${share}%` }} />
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={report?.persisted === true || report?.persisted === null}
            onClick={() => {
              void requestPersistentStorage().then((ok) => {
                setPersistMessage(ok ? t('settings.power.persist.done') : t('settings.power.persist.denied'));
                refresh();
              });
            }}
            className={`${CHIP} ${report?.persisted ? ON : OFF} disabled:cursor-not-allowed disabled:opacity-60`}
            data-testid="button-protect-save"
          >
            {report?.persisted ? t('settings.power.persist.on') : t('settings.power.persist')}
          </button>
          <button type="button" onClick={refresh} className={`${CHIP} ${OFF}`} data-testid="button-storage-refresh">
            {t('settings.power.refresh')}
          </button>
          {persistMessage && <span className="text-xs text-muted-foreground" role="status">{persistMessage}</span>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('settings.power.persistBody')}</p>
      </div>

      <div className="mt-3 border border-border/70 bg-background/50 p-4" data-testid="panel-network-note">
        <h3 className="text-sm font-black uppercase tracking-wide text-white">{t('settings.power.network')}</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('settings.power.networkBody')}</p>
      </div>
    </section>
  );
}

export default PowerSettings;
