import { overlayContainer } from './ViewportOverlay';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '@/lib/i18n';
import { EMOTES, MAX_CHAT_LENGTH, type EmoteId } from '@/lib/social/crewChat';
import { useCrewChat, type ChatLine } from '@/state/crewChat';
import { PlayerAvatar } from './PlayerAvatar';

const BTN = 'border border-border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white/80 hover:border-fuchsia-300/60 hover:text-white disabled:opacity-40';

function lineText(t: ReturnType<typeof useT>, line: ChatLine): string {
  return line.message.kind === 'chat' ? line.message.text : t(`social.emote.${line.message.emote}` as never);
}

/** The eight quick emotes. Used in the Crew overlay and during runs. */
export function EmoteBar({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const chat = useCrewChat();
  const [slow, setSlow] = useState(false);
  if (!chat.ready) return null;
  const send = (id: EmoteId) => {
    const sent = chat.emote(id);
    setSlow(!sent);
    if (!sent) window.setTimeout(() => setSlow(false), 1800);
  };
  return (
    <div className="space-y-1" data-testid="emote-bar">
      <div className={`flex flex-wrap gap-1.5 ${compact ? 'justify-center' : ''}`}>
        {EMOTES.map((id) => (
          <button key={id} type="button" className={BTN} onClick={() => send(id)} data-testid={`button-emote-${id}`}>{t(`social.emoteBtn.${id}` as never)}</button>
        ))}
      </div>
      {slow ? <p className="text-center font-mono text-[10px] text-amber-200" role="status">{t('social.chat.slow')}</p> : null}
    </div>
  );
}

/** Chat in the Crew overlay: recent lines, a box, and the emotes. */
export function CrewChatPanel() {
  const t = useT();
  const chat = useCrewChat();
  const [text, setText] = useState('');
  const [slow, setSlow] = useState(false);
  if (!chat.ready) return null;
  const submit = () => {
    if (!text.trim()) return;
    const sent = chat.say(text);
    setSlow(!sent);
    if (sent) setText('');
  };
  return (
    <section className="space-y-2 border border-border/70 bg-background/50 p-3" data-testid="crew-chat">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-200">{t('social.chat.title')}</h3>
      <ul className="max-h-36 space-y-1 overflow-y-auto" aria-live="polite" data-testid="crew-chat-lines">
        {chat.lines.length === 0 ? <li className="text-sm text-muted-foreground">{t('social.chat.empty')}</li> : chat.lines.slice(-20).map((line) => (
          <li key={line.id} className="text-sm text-white"><span className={line.mine ? 'font-bold text-fuchsia-200' : 'font-bold text-emerald-200'}>{line.mine ? t('social.you') : line.name}</span>{' '}
            <span className={line.message.kind === 'emote' ? 'italic text-white/70' : ''}>{lineText(t, line)}</span></li>
        ))}
      </ul>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input value={text} maxLength={MAX_CHAT_LENGTH} onChange={(event) => setText(event.target.value)} placeholder={t('social.chat.placeholder')} aria-label={t('social.chat.placeholder')}
          className="min-w-0 flex-1 border border-border bg-background px-3 py-2 text-sm text-white" data-testid="input-crew-chat" autoComplete="off" />
        <button type="submit" className={BTN} aria-label={t('social.chat.send')} data-testid="button-crew-chat-send"><Send className="h-3.5 w-3.5" /></button>
      </form>
      {slow ? <p className="font-mono text-[10px] text-amber-200" role="status">{t('social.chat.slow')}</p> : null}
      <EmoteBar />
    </section>
  );
}

/** Crewmates' latest lines and emotes, floating in a corner over any screen. Never takes a tap. */
export function CrewToasts() {
  const t = useT();
  const chat = useCrewChat();
  if (chat.toasts.length === 0 || typeof document === 'undefined') return null;
  return createPortal(
    <div className="pointer-events-none fixed left-[max(0.75rem,var(--safe-left))] top-[max(4.5rem,calc(var(--safe-top)+3.5rem))] z-[126] flex max-w-[min(20rem,80vw)] flex-col gap-1.5" aria-live="polite" data-testid="crew-toasts">
      {chat.toasts.map((line) => (
        <div key={line.id} className="flex items-center gap-2 border border-emerald-200/30 bg-slate-950/90 px-2 py-1.5 shadow-xl">
          <PlayerAvatar name={line.name} src={line.avatar} size={24} />
          <p className="min-w-0 text-xs text-white"><span className="font-bold text-emerald-200">{line.name}</span>{' '}<span className={line.message.kind === 'emote' ? 'italic' : ''}>{lineText(t, line)}</span></p>
        </div>
      ))}
    </div>,
    overlayContainer(),
  );
}
