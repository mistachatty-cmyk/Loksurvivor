import { createRoot } from 'react-dom/client';

import App from './App';
import { AppCrashBoundary, AppCrashHost } from '@/components/lok-crash-boundary';
import { installCrashTestHooks, reporter } from '@/lib/lokErrorReport';
import { LokCrashProbe } from '@/ui/LokCrashProbe';

import './index.css';
import { restoreUiTransparency } from '@/ui/UiTransparencyControls';
import { applyScrollbarPrefs } from '@/lib/scrollbar';
import { applyTextSize } from '@/lib/textScale';
import { MotionConfig } from 'framer-motion';
import { applyMotionMode, getMotionMode, registerLiveFeedLoad } from '@/anim/motion';
import { initLocalization } from '@/lib/i18n';

function describeUnknown(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

/**
 * The dev overlay treats every window error without a native Error as an
 * exception and replaces its details with "(unknown runtime error)". Resource
 * failures and rejected non-Error values are still useful diagnostics, but
 * should not make the whole game look crashed.
 */
function installRuntimeDiagnostics(): void {
  window.addEventListener(
    'error',
    (event) => {
      if (event.error instanceof Error) return;

      const target = event.target instanceof Element
        ? {
            tag: event.target.tagName.toLowerCase(),
            source: event.target instanceof HTMLImageElement
              ? event.target.currentSrc || event.target.src
              : event.target instanceof HTMLLinkElement
                ? event.target.href
                : undefined,
          }
        : undefined;
      console.error('Browser error without an exception object:', {
        message: event.message || 'No error message supplied.',
        source: event.filename || undefined,
        line: event.lineno || undefined,
        column: event.colno || undefined,
        target,
      });
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (event.reason instanceof Error) return;

      console.error('Unhandled rejection without an Error object:', describeUnknown(event.reason));
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}

// LokErrorReport listens first so it sees the errors the diagnostics below swallow.
reporter.install();
installCrashTestHooks();
installRuntimeDiagnostics();
restoreUiTransparency();
applyMotionMode();
applyTextSize();
applyScrollbarPrefs();
registerLiveFeedLoad();

function mount(): void {
  createRoot(document.getElementById('root')!, {
    // Keeps caught errors off reportError(), which would raise the dev overlay. (The boundary has
    // already filed the report in componentDidCatch.)
    onCaughtError: (error, errorInfo) => {
      console.error(error, errorInfo.componentStack);
    },
    // Not caught by any boundary: still a crash worth a report.
    onUncaughtError: (error, errorInfo) => {
      reporter.report({ error, kind: 'render', componentStack: errorInfo.componentStack });
      console.error(error, errorInfo.componentStack);
    },
    onRecoverableError: (error) => {
      reporter.breadcrumb('log', `Recovered: ${error instanceof Error ? error.message : String(error)}`);
    },
  }).render(
    <AppCrashBoundary>
      <MotionConfig reducedMotion={getMotionMode() === 'full' ? 'never' : 'user'}>
        <App />
        {import.meta.env.DEV ? <LokCrashProbe /> : null}
      </MotionConfig>
      <AppCrashHost />
    </AppCrashBoundary>,
  );
}

// English needs no network and mounts immediately. A saved non-English choice
// loads its file first, so the title screen never flashes English.
void initLocalization().finally(mount);
