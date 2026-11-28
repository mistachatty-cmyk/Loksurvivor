/**
 * The transcript harness: run a scripted conversation through the engine and measure it. It is how a
 * cast is judged without a person reading thousands of lines: how often the engine fell back to
 * "I don't know", whether anything repeated, which topics were reachable. Pure and seeded.
 */
import { emptyConv, type ChatContext, type ChatEngine, type ChatPerson } from './engine';
import type { ConvState } from './talk';

/** A representative spread of what players actually type: greetings, topics, feelings, follow-ups, small talk. */
export const STANDARD_SCRIPT: readonly string[] = [
  'hi', 'how are you', 'tell me about the city', 'why', 'tell me more', 'lol', 'i am so tired', 'yes', 'what about food',
  'hmm', 'do you like music', 'ok', 'tell me about your work', 'what are you scared of', 'why', 'cool', 'what do you do for fun',
  'i had a rough day', 'no', 'tell me about the future', 'thanks', 'what is your favorite thing', 'tell me more', 'wow', 'do you sleep',
  'who are your friends', 'maybe', 'tell me something real', 'haha', 'bye',
];

export interface TranscriptOptions {
  tone: 'family' | 'wry';
  affinity: number;
  seed: number;
  /** Extra context facts (room, weather...). */
  context?: Partial<ChatContext>;
  script?: readonly string[];
}

export interface TranscriptStats {
  replies: number;
  /** Replies the engine could only answer with a generic "I don't know" style fallback. */
  fallbacks: number;
  repeats: number;
  fallbackRate: number;
  repeatRate: number;
  longest: number;
  /** Every topic key the conversation touched, with the deepest layer reached. */
  depths: Record<string, number>;
  lines: string[];
}

function rngFrom(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function runTranscript(engine: ChatEngine, self: ChatPerson, others: readonly ChatPerson[], options: TranscriptOptions): TranscriptStats {
  const rng = rngFrom(options.seed);
  const script = options.script ?? STANDARD_SCRIPT;
  let conv: ConvState = emptyConv();
  const recent: string[] = [];
  const seen = new Set<string>();
  const stats: TranscriptStats = { replies: 0, fallbacks: 0, repeats: 0, fallbackRate: 0, repeatRate: 0, longest: 0, depths: {}, lines: [] };
  for (const message of script) {
    const ctx: ChatContext = {
      self, others, roomName: 'the main room', crewHere: others.slice(0, 1).map((p) => p.name), weather: 'clear', hour: 14,
      tone: options.tone, affinity: options.affinity, conv, ...options.context,
    };
    const reply = engine.replyToIntent(engine.detectIntent(message, others), ctx, rng, recent);
    stats.replies += 1;
    if (reply.intent === 'unknown') stats.fallbacks += 1;
    if (seen.has(reply.text)) stats.repeats += 1;
    seen.add(reply.text);
    recent.push(reply.text);
    stats.lines.push(`> ${message}\n  ${reply.text}`);
    stats.longest = Math.max(stats.longest, reply.text.length);
    conv = reply.conv;
  }
  stats.depths = { ...conv.depths };
  stats.fallbackRate = stats.fallbacks / Math.max(1, stats.replies);
  stats.repeatRate = stats.repeats / Math.max(1, stats.replies);
  return stats;
}
