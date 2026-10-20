import { useState, useSyncExternalStore } from 'react';

import { toMarkdown, type ErrorReport } from '@lok/error-report';

import { useT } from '@/lib/i18n';
import { canSendToLok, crashLog, lokCloud, sendReportToLok } from '@/lib/lokErrorReport';
import {
  getLokErrorAutoSend,
  getLokErrorEnabled,
  onLokErrorSettingChange,
  setLokErrorAutoSend,
  setLokErrorEnabled,
} from '@/lib/lokErrorReportSetting';

const btn = (active: boolean) => `border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${active ? 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-100' : 'border-border bg-background text-muted-foreground hover:border-fuchsia-300/60 hover:text-white'}`;

function useSetting(read: () => boolean): boolean {
  return useSyncExternalStore(onLokErrorSettingChange, read, () => true);
}

function Toggle({ value, onChange, label, testId }: { value: boolean; onChange: (on: boolean) => void; label: string; testId: string }) {
  const t = useT();
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={label}>
      {[true, false].map((on) => (
        <button key={String(on)} type="button" aria-pressed={value === on} className={btn(value === on)} onClick={() => onChange(on)} data-testid={`${testId}-${on ? 'on' : 'off'}`}>
          {t(on ? 'lokError.settings.on' : 'lokError.settings.off')}
        </button>
      ))}
    </div>
  );
}

/** Settings > LOK Error Report: the on/off switch, automatic sending, and the device's crash log. */
export function LokErrorSettings() {
  const t = useT();
  const enabled = useSetting(getLokErrorEnabled);
  const autoSend = useSetting(getLokErrorAutoSend);
  const [log, setLog] = useState<ErrorReport[]>(() => crashLog.list());
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const copy = async (report: ErrorReport) => { try { await navigator.clipboard.writeText(toMarkdown(report)); } catch { /* clipboard blocked */ } };
  const send = async (report: ErrorReport) => {
    try { await sendReportToLok(report); setSent((s) => ({ ...s, [report.id]: true })); } catch { /* the pop-up path shows failures; here the button just stays */ }
  };

  return (
    <section id="settings-lok-error-report" className="scroll-mt-24 border border-border bg-card p-5 sm:p-6 lg:[column-span:all]" data-testid="settings-lok-error-report">
      <h2 className="text-xl font-black uppercase text-white">{t('lokError.settings.title')}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('lokError.settings.description')}</p>
      <Toggle value={enabled} onChange={setLokErrorEnabled} label={t('lokError.settings.title')} testId="button-lok-error" />

      {enabled && canSendToLok() ? (
        <>
          <h3 className="mt-4 text-sm font-black uppercase tracking-wide text-white">{t('lokError.settings.autoSend.title')}</h3>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('lokError.settings.autoSend.description')}</p>
          <Toggle value={autoSend} onChange={setLokErrorAutoSend} label={t('lokError.settings.autoSend.title')} testId="button-lok-error-auto" />
        </>
      ) : null}

      <h3 className="mt-4 flex items-center gap-3 text-sm font-black uppercase tracking-wide text-white">
        {t('lokError.settings.log.title')}
        <span className="font-mono text-[10px] font-bold text-muted-foreground">{t('lokError.settings.log.count', { count: log.length })}</span>
        {log.length > 0 ? <button type="button" className={btn(false)} onClick={() => { crashLog.clear(); setLog([]); }} data-testid="button-lok-error-clear">{t('lokError.settings.log.clear')}</button> : null}
      </h3>
      {log.length === 0 ? <p className="mt-2 text-sm text-muted-foreground" data-testid="lok-error-log-empty">{t('lokError.settings.log.empty')}</p> : (
        <ul className="mt-2 divide-y divide-border border border-border" data-testid="lok-error-log">
          {log.map((report) => (
            <li key={report.fingerprint} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-[11px] font-bold text-cyan-200">{report.id}</span>
              <span className="min-w-0 flex-1 truncate text-white/85">{report.name} · {t(`lokError.cat.${report.category}.title` as never)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{new Date(report.at).toLocaleString()}</span>
              <button type="button" className={btn(false)} onClick={() => copy(report)}>{t('lokError.settings.log.copy')}</button>
              {lokCloud ? (
                <button type="button" className={btn(false)} disabled={sent[report.id] || lokCloud.sent(report)} onClick={() => send(report)}>
                  {sent[report.id] || lokCloud.sent(report) ? t('lokError.settings.log.sent') : t('lokError.settings.log.send')}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
