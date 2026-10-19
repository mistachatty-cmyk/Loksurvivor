/**
 * The glue between LOK Chat's pure rules (`engine/lokChat.ts`) and its saved state
 * (`state/lokChatStore.ts`): sending a message, delivering the reply after a short typing
 * pause, crew starting conversations of their own, and logging what the crew say around
 * the hideout. Replies are scheduled here, not in a component, so one that is still
 * "typing" when you close the window still arrives (as an unread message).
 */

import {
  affinityGain,
  chooseProactive,
  detectIntent,
  proactiveLine,
  replyToIntent,
  typingMs,
  type AffinityTier,
  type ChatContext,
  type ChatReply,
  type DetectedIntent,
} from '@/game/engine/lokChat';
import {
  ME,
  addAffinity,
  appendMessage,
  getLokChat,
  logChannel,
  markRead,
  newMessageId,
  recordIntent,
  setProactiveAt,
  threadOf,
  updateLokChat,
} from '@/game/state/lokChatStore';

export type ContextBuilder = (allyId: string, affinity: number) => ChatContext;

/** The conversation the player is looking at, so replies there are not "unread". */
let openThreadId: string | null = null;

export function setOpenThread(id: string | null): void {
  openThreadId = id;
  if (id) updateLokChat((s) => markRead(s, id));
}

export interface SendResult {
  reply: ChatReply;
  tierUp?: AffinityTier;
  delayMs: number;
}

/**
 * Write to someone. Their answer is worked out now and delivered `delayMs` later (a typing
 * pause); `onDelivered` runs then, e.g. to clear a typing indicator.
 */
export function sendToAlly(input: {
  allyId: string;
  /** What shows as the player's own message. */
  text: string;
  /** Skip text matching when the player tapped a quick reply. */
  detected?: DetectedIntent;
  buildContext: ContextBuilder;
  now: number;
  rng: () => number;
  /** Fast typing for reduced motion. */
  instant?: boolean;
  onDelivered?: () => void;
}): SendResult {
  const { allyId, buildContext, now, rng } = input;
  const before = threadOf(getLokChat(), allyId);
  const ctx = buildContext(allyId, before.affinity);
  const detected = input.detected ?? detectIntent(input.text, ctx.others);
  const reply = replyToIntent(detected, ctx, rng, before.recent);
  const delayMs = input.instant ? 250 : typingMs(reply.text);

  let tierUp: AffinityTier | undefined;
  updateLokChat((s) => {
    let next = appendMessage(s, allyId, { id: newMessageId(now), from: ME, text: input.text, at: now });
    next = recordIntent(next, allyId, reply.intent);
    const gained = addAffinity(next, allyId, affinityGain(reply.intent, before.intents[reply.intent] ?? 0));
    tierUp = gained.tierUp;
    return gained.state;
  });

  setTimeout(() => {
    deliver(allyId, reply.text, now + delayMs);
    if (tierUp) {
      const warmer = buildContext(allyId, threadOf(getLokChat(), allyId).affinity);
      setTimeout(() => deliver(allyId, proactiveLine('tierUp', warmer, rng), now + delayMs + 1400), input.instant ? 300 : 1400);
    }
    input.onDelivered?.();
  }, delayMs);

  return { reply, tierUp, delayMs };
}

/** Put a line from them into the conversation. Unread unless that conversation is open. */
export function deliver(allyId: string, text: string, at: number): void {
  updateLokChat((s) => appendMessage(s, allyId, { id: newMessageId(at), from: allyId, text, at }, { unread: openThreadId !== allyId }));
}

/**
 * Let a few crew members start a conversation (after a run, after a long absence, or at the
 * start and end of the day). Cheap to call often: each person is limited to one such message
 * every few hours, and nothing is written when there is nothing to say.
 */
export function startProactive(input: {
  allyIds: readonly string[];
  buildContext: ContextBuilder;
  now: number;
  hour: number;
  rng: () => number;
  /** A finished run, keyed so the crew react to it only once. */
  run?: { key: string; cleared: boolean };
}): number {
  const state = getLokChat();
  const freshRun = input.run && input.run.key !== state.lastRunReactedKey ? { cleared: input.run.cleared } : undefined;
  const picks = chooseProactive({
    now: input.now,
    hour: input.hour,
    freshRun,
    candidates: input.allyIds.map((id) => {
      const thread = threadOf(state, id);
      const last = thread.messages[thread.messages.length - 1];
      return { id, affinity: thread.affinity, lastProactiveAt: thread.lastProactiveAt, lastActivityAt: last?.at ?? 0 };
    }),
  });
  for (const pick of picks) {
    const ctx = input.buildContext(pick.id, threadOf(getLokChat(), pick.id).affinity);
    const text = proactiveLine(pick.kind, ctx, input.rng);
    updateLokChat((s) => setProactiveAt(appendMessage(s, pick.id, { id: newMessageId(input.now), from: pick.id, text, at: input.now }, { unread: openThreadId !== pick.id }), pick.id, input.now));
  }
  if (input.run && freshRun) updateLokChat((s) => ({ ...s, lastRunReactedKey: input.run!.key }));
  return picks.length;
}

/** A crew member said something around the hideout (to you, or to each other). */
export function logCrewLine(allyId: string, text: string, roomName: string | undefined, at: number): void {
  updateLokChat((s) => logChannel(s, { id: newMessageId(at), from: allyId, text, at, roomName }));
}
