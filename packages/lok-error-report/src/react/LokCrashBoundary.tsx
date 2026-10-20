import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { Reporter } from '../reporter';
import type { ErrorReport } from '../types';
import { LokCrashPopup } from './LokCrashPopup';
import { defaultStrings, type LokErrorStrings } from './strings';

export interface LokCrashBoundaryProps {
  reporter: Reporter;
  children: ReactNode;
  strings?: LokErrorStrings;
  onSend?: (report: ErrorReport) => Promise<void>;
  autoSend?: boolean;
  onAutoSendChange?: (on: boolean) => void;
  /** Whether this crash already went to LOK (so the pop-up opens on the thank-you). */
  isSent?: (report: ErrorReport) => boolean;
  /** What to show when LokErrorReport is switched off: the app's own plain fallback. */
  fallbackWhenOff: (error: Error, reset: () => void) => ReactNode;
  /** Changing this clears a caught error (pass the route to recover on navigation). */
  resetKey?: unknown;
  accent?: string;
}

interface State { error: Error | null; report: ErrorReport | null }

const toError = (value: unknown): Error => (value instanceof Error ? value : new Error(typeof value === 'string' ? value : 'Unknown render error'));

/** Catches render crashes, files the report, and shows the LokServer pop-up (or the app's own fallback when off). */
export class LokCrashBoundary extends Component<LokCrashBoundaryProps, State> {
  state: State = { error: null, report: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const report = this.props.reporter.report({ error, kind: 'render', componentStack: info.componentStack });
    this.setState({ report });
  }

  private unsubscribe: (() => void) | null = null;

  componentDidMount(): void {
    // The dev tooling locates the exact code a moment after the crash; redraw when it arrives.
    this.unsubscribe = this.props.reporter.subscribe((event) => {
      if (this.state.report && event.report.fingerprint === this.state.report.fingerprint) this.forceUpdate();
    });
  }

  componentWillUnmount(): void {
    this.unsubscribe?.();
  }

  componentDidUpdate(prev: LokCrashBoundaryProps): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.reset();
  }

  reset = (): void => this.setState({ error: null, report: null });

  render(): ReactNode {
    const { error, report } = this.state;
    if (!error) return this.props.children;
    if (!report || !this.props.reporter.config.enabled()) return this.props.fallbackWhenOff(error, this.reset);
    return (
      <LokCrashPopup
        fatal
        report={report}
        strings={this.props.strings ?? defaultStrings}
        onRetry={this.reset}
        onSend={this.props.onSend}
        autoSend={this.props.autoSend}
        onAutoSendChange={this.props.onAutoSendChange}
        alreadySent={this.props.isSent?.(report)}
        accent={this.props.accent}
      />
    );
  }
}
