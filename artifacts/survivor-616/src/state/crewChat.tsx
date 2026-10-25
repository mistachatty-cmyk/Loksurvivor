/**
 * Crew chat and emotes, carried on the crew's shared channel. Lines live only in memory for the session
 * (nothing is stored, here or on the server). Crewmates' lines appear as short toasts over any screen,
 * runs included, unless "Crew chat" is switched off in Settings.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { crewChatPref } from '@/lib/powerSaver';
import { useNetConfig } from '@/lib/social/netConfig';
import { CHAT_EVENT, CHAT_HISTORY, cleanChat, createChatLimiter, parseCrewChat, type CrewChatMessage, type EmoteId } from '@/lib/social/crewChat';
import { useSocial } from './socialStore';

export interface ChatLine {
  id: number;
  userId: string;
  name: string;
  avatar: string | null;
  mine: boolean;
  message: CrewChatMessage;
  at: number;
}

const MUTE_KEY = 'survivor616.crew.muted.v1';
function readMuted(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(MUTE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(0, 50) : []);
  } catch { return new Set(); }
}
function writeMuted(ids: ReadonlySet<string>): void {
  try { window.localStorage.setItem(MUTE_KEY, JSON.stringify([...ids])); } catch { /* the mute lasts for this session */ }
}

const TOAST_MS = 4500;
const MAX_TOASTS = 3;

interface CrewChatValue {
  /** The channel is open and chat is switched on. */
  ready: boolean;
  lines: ChatLine[];
  toasts: ChatLine[];
  /** false = the player is sending too fast; the line was not sent. */
  say: (text: string) => boolean;
  emote: (id: EmoteId) => boolean;
  muted: ReadonlySet<string>;
  /** Hides or shows one crewmate's lines on this device. Kept on this device only. */
  toggleMute: (userId: string) => void;
}

const ChatContext = createContext<CrewChatValue | null>(null);

export function CrewChatProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const net = useNetConfig();
  const enabled = crewChatPref.use() && net.chat;
  const [muted, setMuted] = useState<ReadonlySet<string>>(() => readMuted());
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [toasts, setToasts] = useState<ChatLine[]>([]);
  const limiter = useRef(createChatLimiter());
  const perMinute = useRef(createChatLimiter(net.chatPerMinute, 60_000));
  useEffect(() => { perMinute.current = createChatLimiter(net.chatPerMinute, 60_000); }, [net.chatPerMinute]);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const counter = useRef(0);
  const live = useRef({ members: social.crew.members, me: social.me?.userId ?? null });
  live.current = { members: social.crew.members, me: social.me?.userId ?? null };
  const bus = social.bus;
  const crewId = social.crew.crew?.id ?? null;

  const push = useCallback((line: ChatLine, toast: boolean) => {
    setLines((prev) => [...prev, line].slice(-CHAT_HISTORY));
    if (!toast) return;
    setToasts((prev) => [...prev, line].slice(-MAX_TOASTS));
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== line.id)), TOAST_MS);
  }, []);

  // A new crew starts with a clean slate.
  useEffect(() => { setLines([]); setToasts([]); }, [crewId]);

  useEffect(() => {
    if (!bus.up || !enabled) return;
    return bus.on(CHAT_EVENT, (payload) => {
      const from = typeof payload.from === 'string' ? payload.from : '';
      const member = live.current.members.find((m) => m.userId === from);
      if (!member || member.userId === live.current.me || mutedRef.current.has(member.userId)) return;
      const message = parseCrewChat(payload);
      if (!message) return;
      counter.current += 1;
      push({ id: counter.current, userId: member.userId, name: member.name, avatar: member.avatar, mine: false, message, at: Date.now() }, true);
    });
  }, [bus, enabled, push]);

  const transmit = useCallback((message: CrewChatMessage): boolean => {
    const me = live.current.members.find((m) => m.userId === live.current.me);
    if (!bus.up || !me) return false;
    const now = Date.now();
    if (!limiter.current.allow(now) || !perMinute.current.allow(now)) return false;
    bus.send(CHAT_EVENT, { ...message, from: me.userId });
    counter.current += 1;
    push({ id: counter.current, userId: me.userId, name: me.name, avatar: me.avatar, mine: true, message, at: Date.now() }, false);
    return true;
  }, [bus, push]);

  const value = useMemo<CrewChatValue>(() => ({
    ready: bus.up && enabled,
    lines,
    toasts: enabled ? toasts : [],
    say: (text) => { const clean = cleanChat(text); return clean ? transmit({ kind: 'chat', text: clean }) : true; },
    emote: (id) => transmit({ kind: 'emote', emote: id }),
    muted,
    toggleMute: (userId) => setMuted((prev) => {
      const next = new Set(prev);
      if (!next.delete(userId)) next.add(userId);
      writeMuted(next);
      return next;
    }),
  }), [bus.up, enabled, lines, toasts, transmit, muted]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useCrewChat(): CrewChatValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useCrewChat must be used within a CrewChatProvider');
  return ctx;
}

export function useCrewChatOptional(): CrewChatValue | null {
  return useContext(ChatContext);
}
