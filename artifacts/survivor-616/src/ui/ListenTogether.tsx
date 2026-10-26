import { Headphones } from 'lucide-react';
import { createPortal } from 'react-dom';

import { useT } from '@/lib/i18n';
import { useNetConfig } from '@/lib/social/netConfig';
import { useListenTogether } from '@/state/listenTogether';
import { useSocial } from '@/state/socialStore';

const BTN = 'border border-border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:border-fuchsia-300/60 hover:text-white';
const BTN_ON = 'border border-fuchsia-300/60 bg-fuchsia-400/15 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-fuchsia-100';

/** Start, stop or leave a listen-together session, with a line saying what is going on. Used in the Crew overlay. */
export function ListenTogetherBar() {
  const t = useT();
  const listen = useListenTogether();
  const net = useNetConfig();
  if (!net.listen || (!listen.hasCompany && listen.role === 'off')) return null;
  return (
    <section className="space-y-2 border border-border/70 bg-background/50 p-3" data-testid="listen-bar">
      <h3 className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-sky-200"><Headphones className="h-3.5 w-3.5" />{t('social.listen.title')}</h3>
      {listen.role === 'host' ? <p className="text-sm text-white">{t('social.listen.hosting', { n: String(listen.followers) })}</p> : null}
      {listen.role === 'guest' ? <p className="text-sm text-white">{t('social.listen.following', { name: listen.hostName ?? '' })}</p> : null}
      {listen.role === 'off' ? <p className="text-sm text-muted-foreground">{t('social.listen.body')}</p> : null}
      <div className="flex flex-wrap gap-2">
        {listen.role === 'off' ? <button type="button" className={BTN_ON} onClick={listen.start} data-testid="button-listen-start">{t('social.listen.start')}</button> : null}
        {listen.role === 'host' ? <button type="button" className={BTN} onClick={listen.stop} data-testid="button-listen-stop">{t('social.listen.stop')}</button> : null}
        {listen.role === 'guest' ? <button type="button" className={BTN} onClick={listen.stop} data-testid="button-listen-leave">{t('social.listen.leave')}</button> : null}
      </div>
      {listen.notice !== 'none' ? <p className="text-sm text-amber-200" role="status">{t(`social.listen.notice.${listen.notice}` as never)}</p> : null}
    </section>
  );
}

/** The round button in the Jukebox Room. Opens the crew when there is nobody to listen with yet. */
export function JukeboxListenButton() {
  const t = useT();
  const listen = useListenTogether();
  const social = useSocial();
  if (!social.signedIn) return null;
  const on = listen.role !== 'off';
  const label = on ? t(listen.role === 'host' ? 'social.listen.stop' : 'social.listen.leave') : t('social.listen.start');
  return (
    <button
      type="button" aria-pressed={on} aria-label={label} title={label}
      onClick={() => { if (on) listen.stop(); else if (!listen.hasCompany) social.openOverlay('crew'); else listen.start(); }}
      className={`rounded-full p-2 ${on ? 'bg-white/20 text-white' : 'text-white/60'}`} data-testid="button-jukebox-listen"
    >
      <Headphones size={18} />
    </button>
  );
}

/** A crewmate's invite, shown over everything until answered. */
export function ListenInviteBanner() {
  const t = useT();
  const listen = useListenTogether();
  if (!listen.invite || typeof document === 'undefined') return null;
  return createPortal(
    <div role="alertdialog" aria-label={t('social.listen.title')} className="fixed inset-x-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[125] mx-auto flex max-w-md items-center gap-3 border border-sky-300/50 bg-slate-950/95 p-3 text-white shadow-2xl backdrop-blur" data-testid="listen-invite">
      <Headphones className="h-5 w-5 shrink-0 text-sky-200" />
      <p className="min-w-0 flex-1 text-sm">{t('social.listen.invite', { name: listen.invite.name })}</p>
      <button type="button" className={BTN_ON} onClick={listen.accept} data-testid="button-listen-join">{t('social.listen.join')}</button>
      <button type="button" className={BTN} onClick={listen.decline}>{t('social.crew.decline')}</button>
    </div>,
    document.body,
  );
}
