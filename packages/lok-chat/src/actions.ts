/**
 * The glue between LOK Chat's pure rules (`engine.ts`) and its saved state (`store.ts`): sending a
 * message, delivering the reply after a short typing pause, people starting conversations of their
 * own, and logging what the cast say around the place. Replies are scheduled here, not in a
 * component, so one that is still "typing" when you close the window still arrives (as unread).
 */

import {
  affinityGain,
  chooseProactive,
  splitReply,
  typingMs,
  type AffinityTier,
  type ChatContext,
  type ChatEngine,
  type ChatReply,
  type DetectedIntent,
} from './engine';
import { featureOn, type FeatureFlags } from './features';
import { ME, addAffinity, appendMessage, logChannel, markRead, recordIntent, setConv, setProactiveAt, threadOf, type ChatStore } from './store';

export type ContextBuilder = (personId: string, affinity: number) => ChatContext;

export interface SendResult {
  reply: ChatReply;
  tierUp?: AffinityTier;
  delayMs: number;
}

export interface ChatActionsOptions {
  engine: ChatEngine;
  store: ChatStore;
  features?: () => FeatureFlags;
  /** How fast each person types: 1 is normal, below 1 is quicker. Lets a game tie it to temperament. */
  pace?: (personId: string) => number;
}

export function createChatActions({ engine, store, features, pace }: ChatActionsOptions) {
  const on = (feature: Parameters<typeof featureOn>[1]): boolean => featureOn(features?.(), feature);
  /** The conversation the player is looking at, so replies there are not "unread". */
  let openThreadId: string | null = null;

  function setOpenThread(id: string | null): void {
    openThreadId = id;
    if (id) store.update((s) => markRead(s, id));
  }

  /** Put a line from them into the conversation. Unread unless that conversation is open. */
  function deliver(personId: string, text: string, at: number): void {
    store.update((s) => appendMessage(s, personId, { id: store.newMessageId(at), from: personId, text, at }, { unread: openThreadId !== personId }));
  }

  /**
   * Write to someone. Their answer is worked out now and delivered `delayMs` later (a typing
   * pause); `onDelivered` runs then, e.g. to clear a typing indicator.
   */
  function sendToAlly(input: {
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
    const before = threadOf(store.get(), allyId);
    const ctx = { ...buildContext(allyId, before.affinity), conv: before.conv };
    const detected = input.detected ?? engine.detectIntent(input.text, ctx.others);
    const reply = engine.replyToIntent(detected, ctx, rng, before.recent);
    // Quick people answer fast and slow ones take their time; long replies sometimes come as two bubbles.
    const speed = Math.max(0.6, Math.min(1.5, pace?.(allyId) ?? 1));
    const parts = on('twoBubbles') ? splitReply(reply.text, rng) : [reply.text];
    const delayMs = input.instant ? 250 : typingMs(parts[0]!, speed);
    const secondMs = input.instant ? 250 : Math.round(typingMs(parts[1] ?? '', speed) * 0.7);

    let tierUp: AffinityTier | undefined;
    store.update((s) => {
      let next = appendMessage(s, allyId, { id: store.newMessageId(now), from: ME, text: input.text, at: now });
      next = recordIntent(next, allyId, reply.intent);
      next = setConv(next, allyId, reply.conv);
      const gained = addAffinity(next, allyId, affinityGain(reply.intent, before.intents[reply.intent] ?? 0));
      tierUp = gained.tierUp;
      return gained.state;
    });

    setTimeout(() => {
      deliver(allyId, parts[0]!, now + delayMs);
      const finish = (extra: number): void => {
        if (tierUp) {
          const warmer = buildContext(allyId, threadOf(store.get(), allyId).affinity);
          setTimeout(() => deliver(allyId, engine.proactiveLine('tierUp', warmer, rng), now + delayMs + extra + 1400), input.instant ? 300 : 1400);
        }
        input.onDelivered?.();
      };
      if (parts[1]) setTimeout(() => { deliver(allyId, parts[1]!, now + delayMs + secondMs); finish(secondMs); }, secondMs);
      else finish(0);
    }, delayMs);

    return { reply, tierUp, delayMs };
  }

  /**
   * Let a few people start a conversation (after a run, after a long absence, or at the start and
   * end of the day). Cheap to call often: each person is limited to one such message every few
   * hours, and nothing is written when there is nothing to say. Does nothing with `proactive` off.
   */
  function startProactive(input: {
    allyIds: readonly string[];
    buildContext: ContextBuilder;
    now: number;
    hour: number;
    rng: () => number;
    /** A finished run, keyed so the cast react to it only once. */
    run?: { key: string; cleared: boolean };
  }): number {
    if (!on('proactive')) return 0;
    const state = store.get();
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
      const ctx = input.buildContext(pick.id, threadOf(store.get(), pick.id).affinity);
      const text = engine.proactiveLine(pick.kind, ctx, input.rng);
      store.update((s) => setProactiveAt(appendMessage(s, pick.id, { id: store.newMessageId(input.now), from: pick.id, text, at: input.now }, { unread: openThreadId !== pick.id }), pick.id, input.now));
    }
    if (input.run && freshRun) store.update((s) => ({ ...s, lastRunReactedKey: input.run!.key }));
    return picks.length;
  }

  /** Someone said something around the place (to you, or to each other). */
  function logCrewLine(personId: string, text: string, roomName: string | undefined, at: number): void {
    store.update((s) => logChannel(s, { id: store.newMessageId(at), from: personId, text, at, roomName }));
  }

  return { setOpenThread, deliver, sendToAlly, startProactive, logCrewLine };
}

export type ChatActions = ReturnType<typeof createChatActions>;
