import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

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

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
