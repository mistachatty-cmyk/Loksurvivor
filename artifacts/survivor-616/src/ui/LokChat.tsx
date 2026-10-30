import { ViewportOverlay } from './ViewportOverlay';
/**
 * LOK Chat: message the crew you have rescued. Their answers come from the procedural chat
 * rules (`engine/lokChat.ts`), not a model, so it works offline, costs nothing to run and
 * says nothing a player typed back out. Conversations are kept on this device
 * (`state/lokChatStore.ts`); the shared #hideout channel logs what the crew say around the
 * hideout as they say it.
 *
 * Fixed overlay, rendered from HubScreen the way LorePopup is.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Hash, Mail, Send, X } from 'lucide-react';

import { prefersReducedMotion } from '@/anim/motion';
import { useT } from '@/lib/i18n';
import { allyRig } from '@/game/data/progression';
import { runChatCommand, type CommandResult } from '@/game/engine/chatCommands';
import { useMeta } from '@/game/state/metaStore';
import { fireCheatFx } from '@/lib/cheatFx';
import type { LokChatView } from '@/lib/lokChatOpen';
import { MAX_MESSAGE_CHARS, affinityTier, quickReplies, type AffinityTier, type QuickReply } from '@/game/engine/lokChat';
import { sendToAlly, setOpenThread, type ContextBuilder } from '@/game/state/lokChatActions';
import { ME, clearLokChat, totalUnread, useLokChat, type ChatMessage } from '@/game/state/lokChatStore';
import type { AllyDef } from '@/game/types';

import { CheatBar } from './CheatBar';
import { MailboxPanel } from './MailboxPanel';
import { RigPortrait } from './RigPortrait';
import { useCheats } from './useCheats';

const CHANNEL = 'channel';
const MAIL = 'mail';
/** How many of the bot's lines stay on screen. */
const TOY_LINES = 6;

interface ToyLine {
  id: number;
  text: string;
}

const handleOf = (ally: AllyDef): string => `@${ally.id}.lok`;

const TIER_STYLE: Record<AffinityTier, string> = {
  new: 'border-white/20 text-white/55',
  friend: 'border-cyan-300/60 text-cyan-100',
  close: 'border-fuchsia-300/70 text-fuchsia-100',
};

const clock = (at: number): string => {
  try { return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

/** The LOK mark: a chat bubble with an L, drawn in code like every other LOK glyph. */
function LokMark({ className = 'h-6 w-6' }: { className?: string }) {
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

/** The hub's button for opening LOK Chat, with an unread badge. */
export function LokChatLauncher({ onOpen, className = '' }: { onOpen: () => void; className?: string }) {
  const t = useT();
  const unread = useLokChat(totalUnread);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={unread > 0 ? t('lokChat.openAriaUnread', { count: unread }) : t('lokChat.openAria')}
      className={`relative inline-flex min-h-10 items-center gap-2 border border-fuchsia-300/45 bg-slate-950/70 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-fuchsia-50 hover:border-fuchsia-200 ${className}`}
      data-testid="button-lok-chat"
    >
      <LokMark className="h-4 w-4" />
      {t('lokChat.open')}
      {unread > 0 ? (
        <span className="ml-1 min-w-4 rounded-full bg-fuchsia-400 px-1 text-center text-[9px] font-black leading-4 text-slate-950" data-testid="lok-chat-unread-badge">{unread > 9 ? '9+' : unread}</span>
      ) : null}
    </button>
  );
}

export interface LokChatOverlayProps {
  /** Rescued crew, in the order to list them. */
  allies: readonly AllyDef[];
  buildContext: ContextBuilder;
  /** Display name of the room an ally is in. */
  roomNameOf: (ally: AllyDef) => string;
  /** Open this conversation first. */
  initialId?: string | null;
  /** Open straight to a view (the mailbox) instead of a conversation. */
  initialView?: LokChatView | null;
  onClose: () => void;
}

export function LokChatOverlay({ allies, buildContext, roomNameOf, initialId, initialView, onClose }: LokChatOverlayProps) {
  const t = useT();
  const { meta } = useMeta();
  const unreadMail = meta.trainingMailbox.filter((entry) => !entry.read).length;
  const threads = useLokChat((s) => s.threads);
  const channel = useLokChat((s) => s.channel);
  const firstId = useMemo(() => {
    if (initialView === 'mail') return MAIL;
    if (initialId && (initialId === CHANNEL || allies.some((a) => a.id === initialId))) return initialId;
    // New mail comes first: opening the chat with something waiting shows it.
    if (unreadMail > 0) return MAIL;
    return allies.find((a) => (threads[a.id]?.unread ?? 0) > 0)?.id ?? allies[0]?.id ?? CHANNEL;
    // Only the first render decides what opens; later unread changes must not yank you elsewhere.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selected, setSelected] = useState<string | null>(firstId);
  // On a phone the list and the conversation take turns.
  const [showList, setShowList] = useState(false);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  // Cheat phrases typed into chat run instead of being sent; the master phrase is the only way dev access turns on.
  const { run: runCheat, devAccess } = useCheats();
  const [cheatNote, setCheatNote] = useState('');
  const [showCheatBar, setShowCheatBar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const reduceMotion = prefersReducedMotion();

  const [toys, setToys] = useState<ToyLine[]>([]);
  const toySeq = useRef(0);
  const pushToy = (text: string) => {
    toySeq.current += 1;
    const line = { id: toySeq.current, text };
    setToys((list) => [...list, line].slice(-TOY_LINES));
  };
  const describe = (result: CommandResult & { kind: 'say' }): string => {
    const params: Record<string, string | number> = { ...(result.params ?? {}) };
    for (const [name, key] of Object.entries(result.paramKeys ?? {})) params[name] = t(key as never);
    return t(result.key as never, params as never);
  };
  /** Runs a typed `/command`. Returns true when the text was one (so it is not also sent as chat). */
  const runToy = (text: string): boolean => {
    const result = runChatCommand(text, { rng: Math.random, now: new Date() });
    if (!result) return false;
    switch (result.kind) {
      case 'say':
        pushToy(describe(result));
        break;
      case 'fx':
        fireCheatFx(result.fx);
        pushToy(t(`cheat.fx.${result.fx}` as never));
        break;
      case 'open':
        setSelected(MAIL);
        setShowList(false);
        break;
      case 'clear':
        setToys([]);
        break;
    }
    return true;
  };

  const ally = allies.find((a) => a.id === selected);
  const thread = selected ? threads[selected] : undefined;

  useEffect(() => {
    setOpenThread(ally ? ally.id : null);
    return () => setOpenThread(null);
  }, [ally?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { inputRef.current?.focus(); }, [selected]);

  // Hand focus back to whatever opened the window (the hub's LOK Chat button) when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener && typeof opener.focus === 'function') opener.focus(); };
  }, []);

  const clearAll = () => {
    if (window.confirm(t('lokChat.clearConfirm'))) clearLokChat();
  };

  const messageCount = thread?.messages.length ?? 0;
  const channelCount = channel.length;
  const isTyping = ally ? typing[ally.id] === true : false;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [messageCount, channelCount, isTyping, selected, reduceMotion]);

  const send = (text: string, detected?: QuickReply) => {
    if (!detected) {
      if (runToy(text)) {
        setDraft('');
        return;
      }
      const cheat = runCheat(text);
      if (cheat.handled) {
        setCheatNote(cheat.message);
        setDraft('');
        return;
      }
    }
    if (!ally) {
      // The channel and the mailbox are not conversations; point at what can be typed here.
      if (text.trim()) pushToy(t('lokChat.cmd.pickSomeone'));
      setDraft('');
      return;
    }
    const clean = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!clean) return;
    const id = ally.id;
    setTyping((state) => ({ ...state, [id]: true }));
    sendToAlly({
      allyId: id,
      text: clean,
      detected: detected ? { intent: detected.intent, subject: detected.subject } : undefined,
      buildContext,
      now: Date.now(),
      rng: Math.random,
      instant: reduceMotion,
      onDelivered: () => setTyping((state) => ({ ...state, [id]: false })),
    });
    setDraft('');
  };

  const suggestions = useMemo<QuickReply[]>(
    () => (ally ? quickReplies(buildContext(ally.id, thread?.affinity ?? 0), thread?.intents ?? {}) : []),
    // Re-pick suggestions as the conversation moves on (each reply changes what has been asked).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ally?.id, thread?.affinity, thread?.intents],
  );

  const selectRow = (id: string) => { setSelected(id); setShowList(false); };

  /** The bot's replies to /commands: short-lived lines above the typing box, never saved. */
  const toyStrip = toys.length > 0 ? (
    <div className="mb-2 max-h-28 space-y-1 overflow-y-auto border border-emerald-300/25 bg-emerald-400/5 px-2 py-1.5" role="log" aria-live="polite" data-testid="lok-chat-toys">
      {toys.map((line) => (
        <p key={line.id} className="text-xs leading-snug text-emerald-50/90">
          <span className="mr-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-300">{t('lokChat.bot')}</span>
          {line.text}
        </p>
      ))}
    </div>
  ) : null;

  /** A typing box for the channel and mailbox: no one to message there, but the tricks work. */
  const trickComposer = (
    <div className="border-t border-white/10 p-2">
      {cheatNote ? <p className="mb-2 border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100" role="status" data-testid="cheat-chat-note">{cheatNote}</p> : null}
      {toyStrip}
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); send(draft); }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={MAX_MESSAGE_CHARS}
          placeholder={t('lokChat.commandPlaceholder')}
          aria-label={t('lokChat.commandPlaceholder')}
          autoComplete="off"
          className="min-h-10 min-w-0 flex-1 border border-white/20 bg-black/50 px-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/70 focus:outline-none"
          data-testid="lok-chat-trick-input"
        />
        <button type="submit" disabled={!draft.trim()} className="inline-flex min-h-10 items-center gap-2 border border-emerald-300/50 bg-emerald-400/15 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-50 hover:bg-emerald-400/25 disabled:opacity-40" data-testid="lok-chat-trick-send">
          <Send className="h-4 w-4" />{t('lokChat.send')}
        </button>
      </form>
    </div>
  );

  return (
    <ViewportOverlay>
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-2 sm:p-4" data-testid="lok-chat" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lok-chat-title"
        className="flex h-[min(90dvh,720px)] w-full max-w-4xl flex-col overflow-hidden border border-fuchsia-300/35 bg-slate-950 text-white shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-slate-950 to-fuchsia-500/10 px-3 py-2">
          <LokMark />
          <h2 id="lok-chat-title" className="font-mono text-xs font-black uppercase tracking-[.3em] text-white">{t('lokChat.title')}</h2>
          <span className="hidden font-mono text-[9px] uppercase tracking-widest text-white/40 sm:inline">{t('lokChat.footer')}</span>
          <button type="button" onClick={clearAll} className="ml-auto border border-white/15 px-2 py-2 font-mono text-[9px] font-bold uppercase tracking-widest text-white/55 hover:border-white/40 hover:text-white" data-testid="button-lok-chat-clear">{t('lokChat.clear')}</button>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center border border-white/15 text-white/70 hover:border-white/50 hover:text-white" aria-label={t('lokChat.close')} data-testid="button-lok-chat-close"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Conversations */}
          <nav aria-label={t('lokChat.chats')} className={`${showList ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black/30 md:flex md:w-64`}>
            <button
              type="button"
              onClick={() => selectRow(MAIL)}
              aria-current={selected === MAIL}
              className={`flex items-center gap-3 border-b border-white/5 px-3 py-3 text-left hover:bg-white/5 ${selected === MAIL ? 'bg-white/10' : ''}`}
              data-testid="lok-chat-row-mail"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-amber-300/40 bg-amber-400/10 text-amber-200"><Mail className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-white">{t('lokChat.mail')}</span>
                <span className="block truncate text-[11px] text-white/50">{t('lokChat.mailBlurb')}</span>
              </span>
              {unreadMail > 0 ? <span className="min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-black leading-5 text-white" aria-label={t('lokChat.mailUnread', { count: unreadMail })} data-testid="lok-chat-mail-badge">{unreadMail}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => selectRow(CHANNEL)}
              aria-current={selected === CHANNEL}
              className={`flex items-center gap-3 border-b border-white/5 px-3 py-3 text-left hover:bg-white/5 ${selected === CHANNEL ? 'bg-white/10' : ''}`}
              data-testid="lok-chat-row-channel"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-cyan-300/40 bg-cyan-400/10 text-cyan-200"><Hash className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-white">{t('lokChat.channel')}</span>
                <span className="block truncate text-[11px] text-white/50">{channel[channel.length - 1]?.text ?? t('lokChat.channelBlurb')}</span>
              </span>
            </button>
            {allies.length === 0 ? <p className="p-4 text-sm text-white/55">{t('lokChat.noCrew')}</p> : null}
            {allies.map((a) => {
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
                  <span className="relative shrink-0 border bg-black/40" style={{ borderColor: a.palette.accent }}>
                    <RigPortrait rig={allyRig(a)} palette={a.palette} size={44} animated={false} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-black text-white">{a.name}</span>
                      <span className={`border px-1 font-mono text-[8px] uppercase tracking-wider ${TIER_STYLE[tier]}`}>{t(`lokChat.tier.${tier}` as never)}</span>
                    </span>
                    <span className="block truncate text-[11px] text-white/50">{last ? `${last.from === ME ? `${t('lokChat.you')}: ` : ''}${last.text}` : a.role}</span>
                  </span>
                  {unread > 0 ? <span className="min-w-5 rounded-full bg-fuchsia-400 px-1.5 text-center text-[10px] font-black leading-5 text-slate-950" aria-label={t('lokChat.unreadCount', { count: unread })}>{unread}</span> : null}
                </button>
              );
            })}
          </nav>

          {/* Conversation */}
          <section className={`${showList ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col md:flex`}>
            {selected === MAIL ? (
              <>
                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                  <button type="button" onClick={() => setShowList(true)} className="inline-flex h-9 items-center gap-1 border border-white/15 px-2 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white md:hidden" aria-label={t('lokChat.back')}><ArrowLeft className="h-4 w-4" /></button>
                  <Mail className="h-4 w-4 text-amber-200" />
                  <div className="min-w-0">
                    <p className="text-sm font-black">{t('lokChat.mail')}</p>
                    <p className="truncate text-[11px] text-white/50">{t('lokChat.mailBlurb')}</p>
                  </div>
                </div>
                <MailboxPanel />
                {trickComposer}
              </>
            ) : selected === CHANNEL || !ally ? (
              <>
                <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                  <button type="button" onClick={() => setShowList(true)} className="inline-flex h-9 items-center gap-1 border border-white/15 px-2 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:text-white md:hidden" aria-label={t('lokChat.back')}><ArrowLeft className="h-4 w-4" /></button>
                  <Hash className="h-4 w-4 text-cyan-200" />
                  <div className="min-w-0">
                    <p className="text-sm font-black">{t('lokChat.channel')}</p>
                    <p className="truncate text-[11px] text-white/50">{t('lokChat.channelBlurb')}</p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" data-testid="lok-chat-channel">
                  {channel.length === 0 ? <p className="p-4 text-center text-sm text-white/50">{t('lokChat.channelEmpty')}</p> : null}
                  {channel.map((entry) => {
                    const speaker = allies.find((a) => a.id === entry.from);
                    return (
                      <div key={entry.id} className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 border bg-black/40" style={{ borderColor: speaker?.palette.accent ?? '#ffffff55' }}>
                          {speaker ? <RigPortrait rig={allyRig(speaker)} palette={speaker.palette} size={28} animated={false} /> : <span className="block h-7 w-7" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[9px] uppercase tracking-wider text-white/45">{speaker?.name ?? entry.from} · {clock(entry.at)}{entry.roomName ? ` · ${entry.roomName}` : ''}</p>
                          <p className="text-sm leading-snug text-white/90">{entry.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </div>
                {trickComposer}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
                  <button type="button" onClick={() => setShowList(true)} className="inline-flex h-9 items-center gap-1 border border-white/15 px-2 text-white/70 hover:text-white md:hidden" aria-label={t('lokChat.back')}><ArrowLeft className="h-4 w-4" /></button>
                  <span className="shrink-0 border bg-black/40" style={{ borderColor: ally.palette.accent }}><RigPortrait rig={allyRig(ally)} palette={ally.palette} size={40} animated={false} /></span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-black"><span className="truncate">{ally.name}</span><span className={`border px-1 font-mono text-[8px] uppercase tracking-wider ${TIER_STYLE[affinityTier(thread?.affinity ?? 0)]}`}>{t(`lokChat.tier.${affinityTier(thread?.affinity ?? 0)}` as never)}</span></p>
                    <p className="truncate font-mono text-[10px] uppercase tracking-wider text-white/45">{handleOf(ally)} · {t('lokChat.here', { room: roomNameOf(ally) })}</p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" role="log" aria-live="polite" aria-label={ally.name} data-testid="lok-chat-thread">
                  {messageCount === 0 ? <p className="p-6 text-center text-sm text-white/50">{t('lokChat.empty', { name: ally.name })}</p> : null}
                  {thread?.messages.map((m: ChatMessage) => {
                    const mine = m.from === ME;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={mine ? 'lok-chat-message-mine' : 'lok-chat-message-theirs'}>
                        <div
                          className={`max-w-[82%] border px-3 py-2 text-sm leading-snug ${mine ? 'border-cyan-300/40 bg-cyan-400/15 text-cyan-50' : 'bg-white/5 text-white/92'}`}
                          style={mine ? undefined : { borderColor: `${ally.palette.accent}88` }}
                        >
                          <p>{m.text}</p>
                          <p className="mt-1 font-mono text-[8px] uppercase tracking-wider text-white/35">{clock(m.at)}</p>
                        </div>
                      </div>
                    );
                  })}
                  {isTyping ? (
                    <div className="flex justify-start" role="status" aria-label={t('lokChat.typing', { name: ally.name })} data-testid="lok-chat-typing">
                      <div className="flex items-center gap-1 border bg-white/5 px-3 py-3" style={{ borderColor: `${ally.palette.accent}88` }}>
                        {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full bg-white/60 ${reduceMotion ? '' : 'animate-pulse'}`} style={{ animationDelay: `${i * 150}ms` }} />)}
                      </div>
                    </div>
                  ) : null}
                  <div ref={endRef} />
                </div>

                <div className="border-t border-white/10 p-2">
                  {cheatNote ? <p className="mb-2 border border-cyan-300/40 bg-cyan-400/10 px-2 py-1 text-xs text-cyan-100" role="status" data-testid="cheat-chat-note">{cheatNote}</p> : null}
                  {devAccess ? (
                    <div className="mb-2">
                      <button type="button" onClick={() => setShowCheatBar((open) => !open)} aria-expanded={showCheatBar} data-testid="button-chat-cheat-bar" className="border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-100">
                        {t('cheat.chatNote')}
                      </button>
                      {showCheatBar ? <div className="mt-2 max-h-48 overflow-y-auto"><CheatBar /></div> : null}
                    </div>
                  ) : null}
                  {toyStrip}
                  <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={t('lokChat.suggested')}>
                    {suggestions.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => send(t(q.labelKey as never, q.labelParams), q)}
                        className="border border-white/20 bg-white/5 px-2.5 py-1.5 text-[11px] font-bold text-white/85 hover:border-cyan-200/70 hover:text-white"
                        data-testid={`lok-chat-quick-${q.id}`}
                      >
                        {t(q.labelKey as never, q.labelParams)}
                      </button>
                    ))}
                  </div>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => { event.preventDefault(); send(draft); }}
                  >
                    <input
                      ref={inputRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={MAX_MESSAGE_CHARS}
                      placeholder={t('lokChat.placeholder', { name: ally.name })}
                      aria-label={t('lokChat.placeholder', { name: ally.name })}
                      autoComplete="off"
                      className="min-h-10 min-w-0 flex-1 border border-white/20 bg-black/50 px-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/70 focus:outline-none"
                      data-testid="lok-chat-input"
                    />
                    <button type="submit" disabled={!draft.trim()} className="inline-flex min-h-10 items-center gap-2 border border-fuchsia-300/50 bg-fuchsia-400/15 px-3 font-mono text-[10px] font-bold uppercase tracking-widest text-fuchsia-50 hover:bg-fuchsia-400/25 disabled:opacity-40" data-testid="lok-chat-send">
                      <Send className="h-4 w-4" />{t('lokChat.send')}
                    </button>
                  </form>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
    </ViewportOverlay>
  );
}

