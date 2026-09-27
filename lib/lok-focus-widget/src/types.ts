export interface FocusPosition {
  /** Percent from the left edge, 0-100. */
  x: number;
  /** Percent from the top edge, 0-100. */
  y: number;
}

export interface FocusSession {
  gameAppKey: string | null;
  label: string | null;
  durationMs: number;
  startedAt: number;
}

export interface FocusWidgetHandle {
  destroy(): void;
}
