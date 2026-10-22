import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';
import { restoreUiTransparency } from '@/ui/UiTransparencyControls';
import { applyScrollbarPrefs } from '@/lib/scrollbar';
import { applyTextSize } from '@/lib/textScale';
import { MotionConfig } from 'framer-motion';
import { applyMotionMode, getMotionMode, registerLiveFeedLoad } from '@/anim/motion';
import { initLocalization } from '@/lib/i18n';
import { getCrashScreen, lokCrash, startCrashWatch } from '@/lib/lokCrash';
import { optionalChunkLoading } from '@/lib/optionalChunk';

// After a deploy, an already-open or home-screen copy can ask for a code chunk
// that no longer exists. Reload once to pick up the new build instead of
// showing the error page. The session flag stops a reload loop.
window.addEventListener('vite:preloadError', (event) => {
  lokCrash.capture((event as Event & { payload?: unknown }).payload ?? 'preload error', 'chunk');
  // An optional piece failed to load: let it fail quietly rather than resetting the app.
  if (optionalChunkLoading()) {
    event.preventDefault();
    return;
  }
  try {
    if (window.sessionStorage.getItem('survivor616.chunk-reload') === '1') return;
    window.sessionStorage.setItem('survivor616.chunk-reload', '1');
  } catch {
    return;
  }
  event.preventDefault();
  // Remember where the player was, so the reload puts them back instead of on the title screen.
  try {
    window.sessionStorage.setItem('survivor616.reload-resume', JSON.stringify({ screen: getCrashScreen(), at: Date.now() }));
  } catch {
    /* the reload still happens, just from the title screen */
  }
  window.location.reload();
});

// The reload-once flag only guards against an immediate reload loop. After the page has run happily for a
// while, forget it, so a later deploy can be picked up with another single reload.
window.setTimeout(() => {
  try {
    window.sessionStorage.removeItem('survivor616.chunk-reload');
  } catch {
    /* storage blocked */
  }
}, 20_000);

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

installRuntimeDiagnostics();
restoreUiTransparency();
applyMotionMode();
applyTextSize();
applyScrollbarPrefs();
registerLiveFeedLoad();

function mount(): void {
  lokCrash.install();
startCrashWatch();
  createRoot(document.getElementById('root')!, {
    // Keeps caught errors off reportError(), which would raise the dev overlay.
    onCaughtError: (error, errorInfo) => {
      lokCrash.capture(error, 'render');
      console.error(error, errorInfo.componentStack);
    },
  }).render(
    <ErrorBoundary>
      <MotionConfig reducedMotion={getMotionMode() === 'full' ? 'never' : 'user'}>
        <App />
      </MotionConfig>
    </ErrorBoundary>,
  );
}

// English needs no network and mounts immediately. A saved non-English choice
// loads its file first, so the title screen never flashes English.
void initLocalization().finally(mount);
