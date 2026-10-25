/**
 * Crew chat and emotes: the rules, kept apart from the screens. Lines are short, rate-limited on the way
 * out and checked again on the way in, so a broken or hostile client cannot flood a crewmate's screen.
 */

export const CHAT_EVENT = 'chat';
export const MAX_CHAT_LENGTH = 120;
/** At most this many lines in a rolling window. */
export const CHAT_BURST = 4;
export const CHAT_WINDOW_MS = 8000;
export const CHAT_HISTORY = 40;

export const EMOTES = ['wave', 'gg', 'nice', 'help', 'ready', 'laugh', 'thanks', 'go'] as const;
export type EmoteId = (typeof EMOTES)[number];

export type CrewChatMessage =
  | { kind: 'chat'; text: string }
  | { kind: 'emote'; emote: EmoteId };

/** One line of text, trimmed, with control characters and runs of spaces removed. */
export function cleanChat(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHAT_LENGTH);
}

export function isEmote(value: unknown): value is EmoteId {
  return typeof value === 'string' && (EMOTES as readonly string[]).includes(value);
}

/** Reads a message that arrived from another player; null for anything that is not a valid line or emote. */
export function parseCrewChat(payload: Record<string, unknown>): CrewChatMessage | null {
  if (payload.kind === 'emote') return isEmote(payload.emote) ? { kind: 'emote', emote: payload.emote } : null;
  if (payload.kind === 'chat' && typeof payload.text === 'string') {
    const text = cleanChat(payload.text);
    return text ? { kind: 'chat', text } : null;
  }
  return null;
}

/** Sliding-window limiter: `allow(now)` is true and counts the send, or false when the player is going too fast. */
export function createChatLimiter(burst = CHAT_BURST, windowMs = CHAT_WINDOW_MS): { allow: (now: number) => boolean } {
  let sent: number[] = [];
  return {
    allow(now) {
      sent = sent.filter((at) => now - at < windowMs);
      if (sent.length >= burst) return false;
      sent.push(now);
      return true;
    },
  };
}
