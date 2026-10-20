import { useState, type CSSProperties } from 'react';

import { redact } from '../redact';
import { locationLabel, toMarkdown, toPlainSummary } from '../format';
import type { ErrorReport } from '../types';
import { defaultStrings, type LokErrorStrings } from './strings';

export interface LokCrashPopupProps {
  report: ErrorReport;
  strings?: LokErrorStrings;
  /** A render crash replaces the screen and offers Try again; anything else is a closable card. */
  fatal?: boolean;
  onClose?: () => void;
  onRetry?: () => void;
  /** Present when sending to LOK is available. Resolves when sent, rejects on failure. */
  onSend?: (report: ErrorReport) => Promise<void>;
  /** True once the report was already sent (so the button reads Sent). */
  alreadySent?: boolean;
  /** Current automatic-send choice; with `onAutoSendChange` the pop-up offers the checkbox. */
  autoSend?: boolean;
  onAutoSendChange?: (on: boolean) => void;
  accent?: string;
}

const FLICKER_CSS = `
@keyframes lok-flicker { 0%,100%{opacity:1} 46%{opacity:1} 48%{opacity:.25} 50%{opacity:1} 52%{opacity:.4} 54%{opacity:1} }
.lok-owl-eye { animation: lok-flicker 3.2s infinite; transform-origin: center; }
@keyframes lok-thanks-rise { 0%{opacity:0;transform:translateY(8px) scale(.6)} 25%{opacity:1} 100%{opacity:0;transform:translateY(-34px) scale(1)} }
@keyframes lok-thanks-hop { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} 60%{transform:translateY(-3px)} }
@keyframes lok-thanks-in { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:none} }
.lok-thanks { animation: lok-thanks-in .28s ease-out both; }
.lok-thanks-owl { animation: lok-thanks-hop 1.1s ease-in-out 2; }
.lok-spark { animation: lok-thanks-rise 1.6s ease-out infinite; opacity: 0; }
@media (prefers-reduced-motion: reduce) { .lok-owl-eye, .lok-thanks, .lok-thanks-owl { animation: none; } .lok-spark { animation: none; opacity: .8; } }
`;

/** LokServer, drawn in code (no image asset): two round eyes in a tufted body. */
function Owl({ accent }: { accent: string }) {
  return (
    <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
      <path d="M8 10l6 4h20l6-4v22a10 10 0 0 1-10 10H18A10 10 0 0 1 8 32z" fill="#1c1630" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      <circle className="lok-owl-eye" cx="17" cy="23" r="6" fill="#0b0816" stroke={accent} strokeWidth="2" />
      <circle className="lok-owl-eye" cx="31" cy="23" r="6" fill="#0b0816" stroke={accent} strokeWidth="2" />
      <circle cx="17" cy="23" r="2.2" fill={accent} />
      <circle cx="31" cy="23" r="2.2" fill={accent} />
      <path d="M22 30l2 3 2-3z" fill="#e879f9" />
    </svg>
  );
}

/** The thank-you: LokServer hops and little lights drift up. Drawn in code, plays for a moment. */
function Thanks({ accent, title, body }: { accent: string; title: string; body: string }) {
  const sparks = [{ x: 6, d: 0, c: accent }, { x: 22, d: 0.35, c: '#e879f9' }, { x: 38, d: 0.7, c: '#fde047' }, { x: 54, d: 0.2, c: accent }, { x: 70, d: 0.55, c: '#e879f9' }];
  return (
    <div className="lok-thanks" style={{ ...box, borderColor: `${accent}88`, display: 'flex', gap: 12, alignItems: 'center' }} data-testid="lok-crash-thanks" role="status">
      <div className="lok-thanks-owl" style={{ position: 'relative', width: 56, height: 56, flex: 'none' }}>
        <Owl accent={accent} />
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 40 }}>
        <p style={{ margin: 0, font: '800 16px ui-sans-serif, system-ui' }}>{title}</p>
        <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.8 }}>{body}</p>
        <svg viewBox="0 0 80 20" width="80" height="20" aria-hidden="true" style={{ position: 'absolute', right: 0, top: -6, overflow: 'visible' }}>
          {sparks.map((s, i) => (
            <path key={i} className="lok-spark" style={{ animationDelay: `${s.d}s` }} d={`M${s.x} 10l1.6 3.4 3.4 1.6-3.4 1.6L${s.x} 20l-1.6-3.4L${s.x - 5} 15l3.4-1.6z`} fill={s.c} />
          ))}
        </svg>
      </div>
    </div>
  );
}

const box: CSSProperties = { border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.04)', padding: '8px 10px', marginTop: 10 };
const label: CSSProperties = { font: '700 10px ui-monospace, monospace', letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.55, margin: '0 0 4px' };
const btn: CSSProperties = { font: '700 11px ui-monospace, monospace', letterSpacing: '.08em', textTransform: 'uppercase', padding: '8px 12px', border: '1px solid rgba(255,255,255,.28)', background: 'rgba(255,255,255,.06)', color: 'inherit', cursor: 'pointer' };

function download(report: ErrorReport) {
  try {
    const blob = new Blob([toMarkdown(report)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { /* a blocked download is not worth a second crash */ }
}

/**
 * The crash pop-up. In dev (and only when the dev tooling reached the source) it shows the
 * exact file, line and code. Anywhere else it says LOK has no access to the code, and shows
 * nothing that could carry private data: no message, no stack.
 */
export function LokCrashPopup({ report, strings = defaultStrings, fatal = false, onClose, onRetry, onSend, alreadySent = false, autoSend = false, onAutoSendChange, accent = '#22d3ee' }: LokCrashPopupProps) {
  const [copied, setCopied] = useState(false);
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [note, setNote] = useState('');
  const [auto, setAuto] = useState(autoSend);
  const dev = report.mode === 'dev';
  const resolved = report.source?.frames[0];
  const cat = strings.categories[report.category] ?? strings.categories.unknown;

  const withNote = (): ErrorReport => {
    const text = redact(note.trim(), 500);
    return text ? { ...report, note: text } : report;
  };
  const copy = async () => {
    try {
      const r = withNote();
      await navigator.clipboard.writeText(dev ? toMarkdown(r) : toPlainSummary(r) + (r.note ? `\n${r.note}` : ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };
  const send = async () => {
    if (!onSend) return;
    setSendState('sending');
    try { await onSend(withNote()); setSendState('sent'); } catch { setSendState('failed'); }
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="lok-crash-title"
      data-testid="lok-crash-popup"
      style={{
        position: 'fixed', inset: 0, zIndex: 2147483000, display: 'grid', placeItems: 'center', padding: 12,
        background: fatal ? 'rgba(6,4,14,.94)' : 'rgba(6,4,14,.7)', color: '#f4f0ff', fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <style>{FLICKER_CSS}</style>
      <div style={{ width: 'min(560px, 100%)', maxHeight: '92dvh', overflowY: 'auto', border: `1px solid ${accent}77`, background: '#0e0a1c', boxShadow: `0 0 40px ${accent}22`, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Owl accent={accent} />
          <div>
            <h2 id="lok-crash-title" style={{ margin: 0, font: '800 20px ui-sans-serif, system-ui', letterSpacing: '.02em' }}>{strings.title}</h2>
            <p style={{ margin: '2px 0 0', opacity: 0.75, fontSize: 13 }}>{strings.subtitle}</p>
          </div>
        </div>

        <div style={box}>
          <p style={{ ...label, color: accent, opacity: 1 }} data-testid="lok-crash-category">{cat.title}</p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>{cat.body}</p>
        </div>

        <div style={box} data-testid="lok-crash-where">
          <p style={label}>{strings.whereTitle}</p>
          {dev ? (
            <>
              <p style={{ margin: 0, font: '600 13px ui-monospace, monospace', wordBreak: 'break-all' }} data-testid="lok-crash-location">{locationLabel(report)}</p>
              {!resolved ? <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.65 }}>{strings.rawLocation}</p> : null}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14 }} data-testid="lok-crash-noaccess">{strings.noAccess}</p>
          )}
        </div>

        {dev ? (
          <div style={box}>
            <p style={label}>{strings.messageTitle}</p>
            <p style={{ margin: 0, font: '600 13px ui-monospace, monospace', wordBreak: 'break-word' }}>{report.name}: {report.message}</p>
          </div>
        ) : null}

        {dev && resolved?.snippet ? (
          <div style={box}>
            <p style={label}>{strings.codeTitle}</p>
            <pre style={{ margin: 0, overflowX: 'auto', font: '12px/1.5 ui-monospace, monospace' }} data-testid="lok-crash-code">
              {resolved.snippet.lines.map((text, i) => {
                const hit = i === resolved.snippet!.highlight;
                return (
                  <div key={i} style={{ background: hit ? 'rgba(244,63,94,.22)' : undefined, color: hit ? '#fecdd3' : undefined }}>
                    <span style={{ opacity: 0.45 }}>{String(resolved.snippet!.startLine + i).padStart(4)} </span>{hit ? '> ' : '  '}{text}
                  </div>
                );
              })}
            </pre>
          </div>
        ) : null}

        {dev && report.componentStack && report.componentStack.length > 0 ? (
          <div style={box}>
            <p style={label}>{strings.componentTitle}</p>
            <p style={{ margin: 0, font: '12px/1.5 ui-monospace, monospace', opacity: 0.8 }}>{report.componentStack.slice(0, 6).join(' › ')}</p>
          </div>
        ) : null}

        {onSend && sendState !== 'sent' ? (
          <label style={{ display: 'block', marginTop: 10 }}>
            <span style={label}>{strings.noteLabel}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder={strings.notePlaceholder}
              rows={3}
              maxLength={500}
              data-testid="lok-crash-note"
              style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', font: '14px/1.4 ui-sans-serif, system-ui', color: 'inherit', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.2)', padding: 8 }}
            />
          </label>
        ) : null}
        {onSend && onAutoSendChange ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12, opacity: 0.85, cursor: 'pointer' }}>
            <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); onAutoSendChange(e.target.checked); }} data-testid="lok-crash-auto" />
            {strings.autoSend}
          </label>
        ) : null}
        {sendState === 'sent' || alreadySent ? <Thanks accent={accent} title={strings.thanksTitle} body={strings.thanksBody} /> : null}
        <p style={{ margin: '10px 0 0', font: '11px ui-monospace, monospace', opacity: 0.55 }}>
          {strings.reportId(report.id)} · {strings.build(report.appVersion, report.buildId)} · {strings.seen(report.count)}
        </p>
        <p style={{ margin: '2px 0 10px', fontSize: 11, opacity: 0.5 }}>{strings.privacy}</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {fatal && onRetry ? <button type="button" style={{ ...btn, borderColor: accent, color: accent }} onClick={onRetry} data-testid="lok-crash-retry">{strings.retry}</button> : null}
          <button type="button" style={btn} onClick={copy} data-testid="lok-crash-copy">{copied ? strings.copied : strings.copy}</button>
          <button type="button" style={btn} onClick={() => download(withNote())} data-testid="lok-crash-download">{strings.download}</button>
          {onSend ? (
            <button type="button" style={btn} disabled={sendState === 'sending' || sendState === 'sent'} onClick={send} data-testid="lok-crash-send">
              {sendState === 'sending' ? strings.sending : sendState === 'sent' ? strings.sent : strings.send}
            </button>
          ) : null}
          {!fatal && onClose ? <button type="button" style={{ ...btn, marginLeft: 'auto' }} onClick={onClose} data-testid="lok-crash-close">{strings.close}</button> : null}
        </div>
        {sendState === 'failed' ? <p style={{ margin: '8px 0 0', fontSize: 12, color: '#fda4af' }}>{strings.sendFailed}</p> : null}
      </div>
    </div>
  );
}
