/**
 * LOK Chat's rules now live in `@lok/chat` so every LOK app shares them; see `docs/LOK_CHAT.md`.
 * This file keeps the old import path for 616 Survivor: the pure helpers come straight from the
 * package, and the cast-dependent ones are bound to this game's cast (`game/chat/cast.ts`).
 */
export {
  AFFINITY_MAX,
  AFFINITY_THRESHOLDS,
  MAX_MESSAGE_CHARS,
  PROACTIVE_GAP_MS,
  WELCOME_BACK_MS,
  affinityGain,
  affinityTier,
  analysisFor,
  chooseProactive,
  detectedFromQuick,
  emptyConv,
  findSubject,
  quickReplies,
  splitReply,
  timeBucket,
  typingMs,
} from '@lok/chat';
export type {
  AffinityTier,
  Analysis,
  ChatContext,
  ChatIntent,
  ChatPerson,
  ChatReply,
  ConvState,
  DetectedIntent,
  Feeling,
  Follow,
  ProactiveCandidate,
  ProactiveInput,
  ProactiveKind,
  QuickReply,
} from '@lok/chat';

import { chatEngine } from '@/game/chat/runtime';

export const { detectIntent, replyToIntent, composeReply, proactiveLine } = chatEngine;
