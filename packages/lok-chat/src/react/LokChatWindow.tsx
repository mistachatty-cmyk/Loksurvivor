/**
 * LOK Chat's window and launcher, game-agnostic. An app passes its people, strings, the chat runtime
 * (`createChatStore` + `createChatActions`) and, if it wants art, an avatar render-prop. Replies come from the
 * engine's authored rules, not a model, so the window works offline and says nothing a player typed back out.
 * Class names are tailwind utilities (an app without tailwind can still theme the few `--lok-chat-*` tokens
 * on the root element); every `data-testid` is stable so apps can test against it.
 */
// `React` is imported even though the automatic JSX runtime does not need it, so consumers that compile this
// source with a classic JSX setting (tsx run from another package, for one) still work.
import * as React from 'react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import type { ChatActions, ContextBuilder } from '../actions';
import { MAX_MESSAGE_CHARS, affinityTier, detectedFromQuick, quickReplies, type AffinityTier, type QuickReply } from '../engine';
import { ME, totalUnread, type ChatMessage, type ChatStore } from '../store';
import type { ChatFeature } from '../types';
import { defaultChatStrings, type LokChatStrings } from './strings';

const CHANNEL = 'channel';

export interface LokChatPerson { id: string; name: string; role: string; /** CSS colour for borders and bubbles. */ accent: string }

export interface LokChatRuntime { store: ChatStore; actions: ChatActions }

/** How the window learns which features are on, and when that changes (an app's settings). */
export interface LokChatFeatureSource {
  isOn: (feature: ChatFeature) => boolean;
  subscribe: (listener: () => void) => () => void;
}

const ALWAYS_ON: LokChatFeatureSource = { isOn: () => true, subscribe: () => () => undefined };

const TIER_STYLE: Record<AffinityTier, string> = {
  new: 'border-white/20 text-white/55',
  friend: 'border-cyan-300/60 text-cyan-100',
  close: 'border-fuchsia-300/70 text-fuchsia-100',
};

const clock = (at: number): string => {
  try { return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

const Svg = ({ className, children }: { className?: string; children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ArrowLeft = ({ className }: { className?: string }) => <Svg className={className}><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
const Hash = ({ className }: { className?: string }) => <Svg className={className}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></Svg>;
const Send = ({ className }: { className?: string }) => <Svg className={className}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></Svg>;
const X = ({ className }: { className?: string }) => <Svg className={className}><path d="M18 6 6 18M6 6l12 12" /></Svg>;

/** The LOK mark: a chat bubble with an L, drawn in code like every other LOK glyph. */
export function LokMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lok-chat-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <path d="M5 6h22a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H15l-6 5v-5H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" fill="none" stroke="url(#lok-chat-mark)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M11 11v8h8" fill="none" stroke="url(#lok-chat-mark)" strokeWidth="2.6" strokeLinecap="square" />
    </svg>
  );
}

/** A coloured initials badge: the avatar when an app does not supply its own art. */
export function InitialsAvatar({ person, size }: { person: LokChatPerson; size: number }) {
  return (
    <span className="flex items-center justify-center font-black text-white" style={{ width: size, height: size, background: `${person.accent}33`, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {person.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

void React;

const useFeature = (features: LokChatFeatureSource, feature: ChatFeature): boolean => useSyncExternalStore(features.subscribe, () => features.isOn(feature), () => features.isOn(feature));

/** The button that opens LOK Chat, with an unread badge. Renders nothing when the messenger is switched off. */
export function LokChatLauncher({ runtime, strings = defaultChatStrings, features = ALWAYS_ON, onOpen, className = '' }: {
  runtime: LokChatRuntime; strings?: LokChatStrings; features?: LokChatFeatureSource; onOpen: () => void; className?: string;
}) {
  const unread = runtime.store.useChat(totalUnread);
  const enabled = useFeature(features, 'chat');
  if (!enabled) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={unread > 0 ? strings.openAriaUnread(unread) : strings.openAria}
      className={`relative inline-flex min-h-10 items-center gap-2 border border-fuchsia-300/45 bg-slate-950/70 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-fuchsia-50 hover:border-fuchsia-200 ${className}`}
      data-testid="button-lok-chat"
    >
      <LokMark className="h-4 w-4" />
      {strings.open}
      {unread > 0 ? (
        <span className="ml-1 min-w-4 rounded-full bg-fuchsia-400 px-1 text-center text-[9px] font-black leading-4 text-slate-950" data-testid="lok-chat-unread-badge">{unread > 9 ? '9+' : unread}</span>
      ) : null}
    </button>
  );
}

export interface LokChatWindowProps {
  people: readonly LokChatPerson[];
  runtime: LokChatRuntime;
  buildContext: ContextBuilder;
  /** Display name of the room a person is in. */
  roomNameOf: (person: LokChatPerson) => string;
  strings?: LokChatStrings;
  features?: LokChatFeatureSource;
  renderAvatar?: (person: LokChatPerson, size: number) => ReactNode;
  reduceMotion?: boolean;
  /** A line under each person's name, e.g. `@vee.lok`. */
  handleOf?: (person: LokChatPerson) => string;
  /** Open this conversation first. */
  initialId?: string | null;
  onClose: () => void;
}

export function LokChatWindow({ people, runtime, buildContext, roomNameOf, strings = defaultChatStrings, features = ALWAYS_ON, renderAvatar, reduceMotion = false, handleOf, initialId, onClose }: LokChatWindowProps) {
  const { store, actions } = runtime;
  const avatar = (person: LokChatPerson, size: number): ReactNode => (renderAvatar ? renderAvatar(person, size) : <InitialsAvatar person={person} size={size} />);
  const threads = store.useChat((s) => s.threads);
  const channel = store.useChat((s) => s.channel);
  const firstId = useMemo(() => {
    if (initialId && (initialId === CHANNEL || people.some((a) => a.id === initialId))) return initialId;
    return people.find((a) => (threads[a.id]?.unread ?? 0) > 0)?.id ?? people[0]?.id ?? CHANNEL;
    // Only the first render decides what opens; later unread changes must not yank you elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selected, setSelected] = useState<string | null>(firstId);
  // On a phone the list and the conversation take turns.
  const [showList, setShowList] = useState(false);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ally = people.find((a) => a.id === selected);
  const thread = selected ? threads[selected] : undefined;

  useEffect(() => {
    actions.setOpenThread(ally ? ally.id : null);
    return () => actions.setOpenThread(null);
  }, [ally?.id, actions]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { inputRef.current?.focus(); }, [selected]);

  // Hand focus back to whatever opened the window when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener && typeof opener.focus === 'function') opener.focus(); };
  }, []);

  const clearAll = () => {
    if (window.confirm(strings.clearConfirm)) store.clear();
  };

  const messageCount = thread?.messages.length ?? 0;
  const channelCount = channel.length;
  const isTyping = ally ? typing[ally.id] === true : false;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messageCount, channelCount, isTyping, selected, reduceMotion]);

  const send = (text: string, detected?: QuickReply) => {
    if (!ally) return;
    const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!clean) return;
    const id = ally.id;
    setTyping((state) => ({ ...state, [id]: true }));
    actions.sendToAlly({
      allyId: id,
      text: clean,
      detected: detected ? detectedFromQuick(detected) : undefined,
      buildContext,
      now: Date.now(),
      rng: Math.random,
      instant: reduceMotion,
      onDelivered: () => setTyping((state) => ({ ...state, [id]: false })),
    });
    setDraft('');
  };

  const groupOn = useFeature(features, 'group');
  const [groupDraft, setGroupDraft] = useState('');
  const sendGroup = (text: string) => {
    const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!clean) return;
    actions.sendToGroup({
      text: clean,
      people: people.map((a) => ({ id: a.id, name: a.name, role: a.role, room: roomNameOf(a) })),
      buildContext,
      now: Date.now(),
      rng: Math.random,
      instant: reduceMotion,
    });
    setGroupDraft('');
  };

  const suggestions = useMemo<QuickReply[]>(
    () => (ally ? quickReplies({ ...buildContext(ally.id, thread?.affinity ?? 0), conv: thread?.conv }, thread?.intents ?? {}) : []),
    // Re-pick suggestions as the conversation moves on (each reply changes what has been asked).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ally?.id, thread?.affinity, thread?.intents, thread?.conv],
  );

  const selectRow = (id: string) => { setSelected(id); setShowList(false); };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-2 sm:p-4" data-testid="lok-chat" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lok-chat-title"
        className="flex h-[min(90dvh,720px)] w-full max-w-4xl flex-col overflow-hidden border border-fuchsia-300/35 bg-slate-950 text-white shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-slate-950 to-fuchsia-500/10 px-3 py-2">
          <LokMark />
          <h2 id="lok-chat-title" className="font-mono text-xs font-black uppercase tracking-[.3em] text-white">{strings.title}</h2>
          <span className="hidden font-mono text-[9px] uppercase tracking-widest text-white/40 sm:inline">{strings.footer}</span>
          <button type="button" onClick={clearAll} className="ml-auto border border-white/15 px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-white/55 hover:border-white/40 hover:text-white" data-testid="button-lok-chat-clear">{strings.clear}</button>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center border border-white/15 text-white/70 hover:border-white/50 hover:text-white" aria-label={strings.close} data-testid="button-lok-chat-close"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Conversations */}
          <nav aria-label={strings.chats} className={`${showList ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black/30 md:flex md:w-64`}>
            <button
              type="button"
              onClick={() => selectRow(CHANNEL)}
              aria-current={selected === CHANNEL}
              className={`flex items-center gap-3 border-b border-white/5 px-3 py-3 text-left hover:bg-white/5 ${selected === CHANNEL ? 'bg-white/10' : ''}`}
              data-testid="lok-chat-row-channel"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-cyan-300/40 bg-cyan-400/10 text-cyan-200"><Hash className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{strings.channel}</span>
                <span className="block truncate text-[11px] text-white/50">{channel[channel.length - 1]?.text ?? strings.channelBlurb}</span>
              </span>
            </button>
            {people.length === 0 ? <p className="p-4 text-sm text-white/55">{strings.noCrew}</p> : null}
            {people.map((a) => {
              const th = threads[a.id];
              const last = th?.messages[th.messages.length - 1];
              const unread = th?.unread ?? 0;
              const tier = affinityTier(th?.affinity ?? 0);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => selectRow(a.id)}
                  aria-current={selected === a.id}
                  className={`flex items-center gap-3 border-b border-white/5 px-3 py-3 text-left hover:bg-white/5 ${selected === a.id ? 'bg-white/10' : ''}`}
                  data-testid={`lok-chat-row-${a.id}`}
                >
                  <span className="relative shrink-0 border bg-black/40" style={{ borderColor: a.accent }}>{avatar(a, 44)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-white">{a.name}</span>
                      <span className={`border px-1 font-mono text-[8px] uppercase tracking-wider ${TIER_STYLE[tier]}`}>{strings.tier[tier]}</span>
                    </span>
                    <span className="block truncate text-[11px] text-white/50">{last ? `${last.from === ME ? `${strings.you}: ` : ''}${last.text}` : a.role}</span>
                  </span>
                  {unread > 0 ? <span className="min-w-5 rounded-full bg-fuchsia-400 px-1.5 text-center text-[10px] font-black leading-5 text-slate-950" aria-label={strings.unreadCount(unread)}>{unread}</span> : null}
                </button>
              );
            })}
          </nav>

          {/* Conversation */}
          <section className={`${showList ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
            {selected === CHANNEL || !ally ? (
              <>
                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                  <button type="button" onClick={() => setShowList(true)} className="inline-flex h-9 items-center gap-1 border border-white/15 px-2 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white md:hidden" aria-label={strings.back}><ArrowLeft className="h-4 w-4" /></button>
                  <Hash className="h-4 w-4 text-cyan-200" />
                  <div className="min-w-0">
                    <p className="text-sm font-black">{strings.channel}</p>
                    <p className="truncate text-[11px] text-white/50">{strings.channelBlurb}</p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" data-testid="lok-chat-channel">
                  {channel.length === 0 ? <p className="p-4 text-center text-sm text-white/50">{strings.channelEmpty}</p> : null}
                  {channel.map((entry) => {
                    const speaker = people.find((a) => a.id === entry.from);
                    const mine = entry.from === ME;
                    return (
                      <div key={entry.id} className="flex items-start gap-2" data-testid={mine ? 'lok-chat-channel-mine' : 'lok-chat-channel-entry'}>
                        <span className="mt-0.5 shrink-0 border bg-black/40" style={{ borderColor: speaker?.accent ?? '#ffffff55' }}>
                          {speaker ? avatar(speaker, 28) : <span className="block h-7 w-7" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[9px] uppercase tracking-wider text-white/45">{mine ? strings.you : (speaker?.name ?? entry.from)} · {clock(entry.at)}{entry.roomName ? ` · ${entry.roomName}` : ''}</p>
                          <p className="text-sm leading-snug text-white/90">{entry.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                {groupOn ? (
                  <form className="flex gap-2 border-t border-white/10 p-2" onSubmit={(event) => { event.preventDefault(); sendGroup(groupDraft); }}>
                    <input
                      value={groupDraft}
                      onChange={(event) => setGroupDraft(event.target.value)}
                      maxLength={MAX_MESSAGE_CHARS}
                      placeholder={strings.channelPlaceholder}
                      aria-label={strings.channelPlaceholder}
                      autoComplete="off"
                      className="min-h-10 min-w-0 flex-1 border border-white/20 bg-black/50 px-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/70 focus:outline-none"
                      data-testid="lok-chat-channel-input"
                    />
                    <button type="submit" disabled={!groupDraft.trim()} className="inline-flex min-h-10 items-center gap-2 border border-fuchsia-300/50 bg-fuchsia-400/15 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-fuchsia-50 hover:bg-fuchsia-400/25 disabled:opacity-40" data-testid="lok-chat-channel-send">
                      <Send className="h-4 w-4" />{strings.send}
                    </button>
                  </form>
                ) : null}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
                  <button type="button" onClick={() => setShowList(true)} className="inline-flex h-9 items-center gap-1 border border-white/15 px-2 text-white/70 hover:text-white md:hidden" aria-label={strings.back}><ArrowLeft className="h-4 w-4" /></button>
                  <span className="shrink-0 border bg-black/40" style={{ borderColor: ally.accent }}>{avatar(ally, 40)}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-black"><span className="truncate">{ally.name}</span><span className={`border px-1 font-mono text-[8px] uppercase tracking-wider ${TIER_STYLE[affinityTier(thread?.affinity ?? 0)]}`}>{strings.tier[affinityTier(thread?.affinity ?? 0)]}</span></p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white/45">{handleOf ? `${handleOf(ally)} · ` : ''}{strings.here(roomNameOf(ally))}</p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" aria-label={ally.name} data-testid="lok-chat-thread">
                  {messageCount === 0 ? <p className="p-6 text-center text-sm text-white/50">{strings.empty(ally.name)}</p> : null}
                  {thread?.messages.map((m: ChatMessage) => {
                    const mine = m.from === ME;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={mine ? 'lok-chat-message-mine' : 'lok-chat-message-theirs'}>
                        <div
                          className={`max-w-[82%] border px-3 py-2 text-sm leading-snug ${mine ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-50' : 'bg-white/5 text-white/92'}`}
                          style={mine ? undefined : { borderColor: `${ally.accent}88` }}
                        >
                          <p>{m.text}</p>
                          <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-white/35">{clock(m.at)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {isTyping ? (
                    <div className="flex justify-start" role="status" aria-label={strings.typing(ally.name)} data-testid="lok-chat-typing">
                      <div className="flex items-center gap-1 border bg-white/5 px-3 py-3" style={{ borderColor: `${ally.accent}88` }}>
                        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full bg-white/60 ${reduceMotion ? '' : 'animate-pulse'}`} style={{ animationDelay: `${i * 150}ms` }} />)}
                      </div>
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>

                <div className="border-t border-white/10 p-2">
                  <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={strings.suggested}>
                    {suggestions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => send(strings.quickLabel(q.labelKey, q.labelParams), q)}
                        className="border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-white/85 hover:border-cyan-200/70 hover:text-white"
                        data-testid={`lok-chat-quick-${q.id}`}
                      >
                        {strings.quickLabel(q.labelKey, q.labelParams)}
                      </button>
                    ))}
                  </div>
                  <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={MAX_MESSAGE_CHARS}
                      placeholder={strings.placeholder(ally.name)}
                      aria-label={strings.placeholder(ally.name)}
                      autoComplete="off"
                      className="min-h-10 min-w-0 flex-1 border border-white/20 bg-black/50 px-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/70 focus:outline-none"
                      data-testid="lok-chat-input"
                    />
                    <button type="submit" disabled={!draft.trim()} className="inline-flex min-h-10 items-center gap-2 border border-fuchsia-300/50 bg-fuchsia-400/15 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-fuchsia-50 hover:bg-fuchsia-400/25 disabled:opacity-40" data-testid="lok-chat-send">
                      <Send className="h-4 w-4" />{strings.send}
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
