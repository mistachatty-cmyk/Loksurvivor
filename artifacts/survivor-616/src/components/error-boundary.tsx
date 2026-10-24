import { useState } from 'react';

import { formatReport, lokCrash } from '@/lib/lokCrash';
import { SendCrashButton } from '@/ui/SendCrashButton';
import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

export interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    const serialized = JSON.stringify(value);
    return new Error(serialized === undefined ? String(value) : serialized);
  } catch {
    return new Error(String(value));
  }
}

function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  const report = lokCrash.last();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!report) return;
    void navigator.clipboard
      ?.writeText(formatReport(report))
      .then(() => setCopied(true))
      .catch(() => undefined);
  };
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This part of the app hit an error. The rest of the app is still
          running.
        </p>
        {/* Dev only: messages can carry API responses and other internals. */}
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800">
            {error.message || String(error)}
          </pre>
        ) : null}
        {report ? (
          <p className="mt-3 font-mono text-xs text-gray-500">Error code {report.fingerprint}</p>
        ) : null}
        {report ? (
          <button
            type="button"
            onClick={copy}
            className="mt-3 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
            data-testid="button-copy-crash-report"
          >
            {copied ? 'Copied' : 'Copy error report'}
          </button>
        ) : null}
        {report ? (
          <div className="mt-2">
            <SendCrashButton className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const normalizedError = toError(error);
    console.error(
      'ErrorBoundary caught an error:',
      {
        name: normalizedError.name,
        message: normalizedError.message,
        stack: normalizedError.stack,
        componentStack: info.componentStack,
      },
    );
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
