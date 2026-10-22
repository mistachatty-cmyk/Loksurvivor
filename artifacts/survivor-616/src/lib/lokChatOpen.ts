/**
 * Whether LOK Chat is open, and which view it should open to. A tiny external store so the
 * persistent nav dock, the hideout button and the `/mail` command can all open the one chat window
 * (`ui/LokChatHost.tsx`) without sharing React state.
 */
import { useSyncExternalStore } from 'react';

export type LokChatView = 'mail';

export interface LokChatOpenState {
  open: boolean;
  /** Open straight to this view instead of the usual first conversation. */
  view: LokChatView | null;
}

let state: LokChatOpenState = { open: false, view: null };
const listeners = new Set<() => void>();

function set(next: LokChatOpenState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export function openLokChat(view: LokChatView | null = null): void {
  set({ open: true, view });
}

export function closeLokChat(): void {
  if (state.open) set({ open: false, view: null });
}

export function getLokChatOpenState(): LokChatOpenState {
  return state;
}

export function useLokChatOpen(): LokChatOpenState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}
