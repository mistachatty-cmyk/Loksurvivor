/**
 * The Crew overlay: friends, your crew of up to four, recent players and adding people by code or
 * QR. A button opens it from any screen and it sits above everything, runs included. Rendered into
 * document.body so no screen's own stacking can cover it.
 */
import { Check, Copy, Share2, UserPlus, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '@/lib/i18n';
import { invitable, isLeader, isOnline, MAX_CREW_SIZE, onlineCount, slotsLeft, sortFriends } from '@/lib/social/crewRules';
import { friendShareUrl, normalizeFriendCode } from '@/lib/social/friendCode';
import { useAuth } from '@/state/authStore';
import { useSocial, type CrewTab } from '@/state/socialStore';
import { ListenTogetherBar } from './ListenTogether';
import { PlayerAvatar } from './PlayerAvatar';
import { QrCode } from './QrCode';

const TAB_KEYS: CrewTab[] = ['crew', 'friends', 'recent', 'add'];
const BTN = 'border border-border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-white/80 hover:border-fuchsia-300/60 hover:text-white disabled:opacity-40';
const BTN_ON = 'border border-fuchsia-300/60 bg-fuchsia-400/15 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-fuchsia-100 disabled:opacity-40';

/** The button that opens the overlay. Shows how many friends are online and how many things wait for an answer. */
export function CrewButton() {
  const t = useT();
  const social = useSocial();
  const count = onlineCount(social.friends, social.online);
  return (
    <button
      type="button" onClick={() => social.openOverlay()} aria-label={t('social.button.aria')}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 border border-emerald-200/35 bg-slate-950/85 px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-50 shadow-xl backdrop-blur transition hover:border-emerald-100 active:scale-95"
      data-testid="button-global-crew"
    >
      <Users className="h-4 w-4 text-emerald-200" />
      <span className="hidden sm:inline">{t('social.button')}</span>
      {social.active && count > 0 ? <span className="rounded-full bg-emerald-400 px-1.5 text-[9px] font-black leading-4 text-slate-950" data-testid="crew-online-count">{count}</span> : null}
      {social.waiting > 0 ? <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-fuchsia-500 px-1 text-center text-[9px] font-black leading-4 text-white" data-testid="crew-waiting-badge">{social.waiting > 9 ? '9+' : social.waiting}</span> : null}
    </button>
  );
}

function SignedOut() {
  const t = useT();
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const providers = [
    ['discord', 'Discord', auth.signInWithDiscord], ['github', 'GitHub', auth.signInWithGitHub],
    ['google', 'Google', auth.signInWithGoogle], ['apple', 'Apple', auth.signInWithApple],
  ] as const;
  return (
    <div className="space-y-3 p-4" data-testid="crew-signed-out">
      <h3 className="text-lg font-black uppercase text-white">{t('social.signin.title')}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{t('social.signin.body')}</p>
      {!auth.available ? <p className="text-sm text-amber-200">{t('social.signin.unavailable')}</p> : (
        <div className="grid grid-cols-2 gap-2">
          {providers.map(([id, label, run]) => (
            <button key={id} type="button" className={BTN} data-testid={`button-crew-signin-${id}`}
              onClick={async () => { const { error } = await run(); setMessage(error ? t('social.signin.failed', { provider: label }) : ''); }}>
              {label}
            </button>
          ))}
        </div>
      )}
      {message ? <p className="text-sm text-amber-200" role="status">{message}</p> : null}
    </div>
  );
}

function Row({ children, testId }: { children: ReactNode; testId?: string }) {
  return <li className="flex items-center gap-3 border border-border/70 bg-background/50 p-2.5" data-testid={testId}>{children}</li>;
}

function CrewTabView() {
  const t = useT();
  const s = useSocial();
  const [note, setNote] = useState('');
  const leader = isLeader(s.crew, s.me?.userId);
  const candidates = invitable(s.friends, s.crew);
  const invited = useMemo(() => new Set<string>(), []);
  const slots = Array.from({ length: MAX_CREW_SIZE }, (_, i) => s.crew.members[i] ?? null);

  return (
    <div className="space-y-4 p-4">
      {s.crew.invites.length > 0 ? (
        <section aria-label={t('social.crew.invitesTitle')} className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-200">{t('social.crew.invitesTitle')}</h3>
          <ul className="space-y-2">
            {s.crew.invites.map((invite) => (
              <Row key={invite.crewId} testId="crew-invite-row">
                <PlayerAvatar name={invite.fromName} src={invite.fromAvatar} size={36} />
                <span className="min-w-0 flex-1 text-sm text-white">{t('social.crew.invitesFrom', { name: invite.fromName })}</span>
                <button type="button" className={BTN_ON} data-testid="button-crew-accept" onClick={async () => { const r = await s.acceptInvite(invite.crewId); setNote(r === 'full' ? t('social.crew.full') : ''); }}>{t('social.crew.accept')}</button>
                <button type="button" className={BTN} onClick={() => void s.declineInvite(invite.crewId)}>{t('social.crew.decline')}</button>
              </Row>
            ))}
          </ul>
        </section>
      ) : null}

      {!s.crew.crew ? (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{t('social.crew.empty', { max: String(MAX_CREW_SIZE) })}</p>
          <button type="button" className={BTN_ON} onClick={() => void s.startCrew()} data-testid="button-crew-start">{t('social.crew.start')}</button>
        </div>
      ) : (
        <section className="space-y-3">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-200">{t('social.crew.count', { n: String(s.crew.members.length), max: String(MAX_CREW_SIZE) })}</h3>
          <ul className="grid grid-cols-2 gap-2" data-testid="crew-slots">
            {slots.map((member, i) => member ? (
              <li key={member.userId} className="flex flex-col items-center gap-1 border border-border/70 bg-background/50 p-3 text-center" data-testid="crew-member">
                <PlayerAvatar name={member.name} src={member.avatar} size={52} online={member.userId === s.me?.userId ? true : isOnline(member, s.online)} />
                <span className="max-w-full truncate text-sm font-bold text-white">{member.userId === s.me?.userId ? t('social.you') : member.name}</span>
                {s.crew.crew?.leaderId === member.userId ? <span className="font-mono text-[9px] uppercase tracking-widest text-amber-200">{t('social.crew.leader')}</span> : null}
                {leader && member.userId !== s.me?.userId ? <button type="button" className="font-mono text-[9px] uppercase tracking-widest text-white/50 hover:text-white" onClick={() => void s.kick(member.userId)}>{t('social.crew.kick')}</button> : null}
              </li>
            ) : (
              <li key={`open-${i}`} className="grid min-h-[7.5rem] place-items-center border border-dashed border-border/60 p-3 font-mono text-[10px] uppercase tracking-widest text-white/35">{t('social.crew.openSlot')}</li>
            ))}
          </ul>

          {slotsLeft(s.crew) > 0 ? (
            <div className="space-y-2">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t('social.crew.inviteTitle')}</h3>
              {candidates.length === 0 ? <p className="text-sm text-muted-foreground">{t('social.crew.nobody')}</p> : (
                <ul className="space-y-2">
                  {sortFriends(candidates, s.online).map((friend) => (
                    <Row key={friend.userId}>
                      <PlayerAvatar name={friend.name} src={friend.avatar} size={32} online={isOnline(friend, s.online)} />
                      <span className="min-w-0 flex-1 truncate text-sm text-white">{friend.name}</span>
                      <button type="button" className={BTN} data-testid="button-crew-invite"
                        onClick={async () => { const r = await s.invite(friend.userId); invited.add(friend.userId); setNote(t(r === 'sent' ? 'social.crew.result.sent' : r === 'full' ? 'social.crew.result.full' : 'social.crew.result.error')); }}>
                        {invited.has(friend.userId) ? t('social.crew.invited') : t('social.crew.invite')}
                      </button>
                    </Row>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          <ListenTogetherBar />
          <button type="button" className={BTN} onClick={() => void s.leave()} data-testid="button-crew-leave">{t('social.crew.leave')}</button>
        </section>
      )}
      {note ? <p className="text-sm text-fuchsia-100" role="status">{note}</p> : null}
    </div>
  );
}

function FriendsTabView() {
  const t = useT();
  const s = useSocial();
  const requests = s.friends.filter((f) => f.status === 'pending' && f.incoming);
  const sent = s.friends.filter((f) => f.status === 'pending' && !f.incoming);
  const friends = sortFriends(s.friends.filter((f) => f.status === 'accepted'), s.online);
  const label = (id: string) => t(`social.doing.${s.online[id]?.doing === 'run' || s.online[id]?.doing === 'theater' ? s.online[id]!.doing : 'menu'}` as never);
  return (
    <div className="space-y-4 p-4">
      {requests.length + sent.length > 0 ? (
        <section className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-200">{t('social.friends.requests')}</h3>
          <ul className="space-y-2">
            {requests.map((f) => (
              <Row key={f.userId} testId="friend-request-row">
                <PlayerAvatar name={f.name} src={f.avatar} size={36} />
                <span className="min-w-0 flex-1 text-sm text-white">{t('social.friends.incoming', { name: f.name })}</span>
                <button type="button" className={BTN_ON} data-testid="button-friend-accept" onClick={() => void s.answerRequest(f.userId, true)}>{t('social.friends.accept')}</button>
                <button type="button" className={BTN} onClick={() => void s.answerRequest(f.userId, false)}>{t('social.friends.decline')}</button>
              </Row>
            ))}
            {sent.map((f) => (
              <Row key={f.userId}>
                <PlayerAvatar name={f.name} src={f.avatar} size={32} />
                <span className="min-w-0 flex-1 truncate text-sm text-white/80">{f.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/45">{t('social.friends.sent')}</span>
                <button type="button" className={BTN} onClick={() => void s.unfriend(f.userId)}>{t('social.crew.kick')}</button>
              </Row>
            ))}
          </ul>
        </section>
      ) : null}
      {friends.length === 0 ? <p className="text-sm text-muted-foreground">{t('social.friends.none')}</p> : (
        <section className="space-y-2">
          <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-200">{t('social.friends.onlineCount', { n: String(onlineCount(s.friends, s.online)) })}</h3>
          <ul className="space-y-2" data-testid="friend-list">
            {friends.map((f) => {
              const on = isOnline(f, s.online);
              return (
                <Row key={f.userId} testId="friend-row">
                  <PlayerAvatar name={f.name} src={f.avatar} size={36} online={on} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-white">{f.name}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-white/45">{on ? label(f.userId) : t('social.friends.offline')}</span>
                  </span>
                  {s.crew.crew && slotsLeft(s.crew) > 0 && !s.crew.members.some((m) => m.userId === f.userId) ? <button type="button" className={BTN} onClick={() => void s.invite(f.userId)}>{t('social.crew.invite')}</button> : null}
                  <button type="button" className="font-mono text-[10px] uppercase tracking-widest text-white/40 hover:text-white" onClick={() => void s.unfriend(f.userId)}>{t('social.friends.remove')}</button>
                </Row>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecentTabView() {
  const t = useT();
  const s = useSocial();
  const friendIds = new Set(s.friends.filter((f) => f.status === 'accepted').map((f) => f.userId));
  if (s.recent.length === 0) return <p className="p-4 text-sm text-muted-foreground">{t('social.recent.none')}</p>;
  return (
    <ul className="space-y-2 p-4" data-testid="recent-list">
      {s.recent.map((p) => (
        <Row key={p.userId}>
          <PlayerAvatar name={p.name} src={p.avatar} size={36} online={s.online[p.userId] ? true : undefined} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold text-white">{p.name}</span>
            <span className="block font-mono text-[10px] uppercase tracking-widest text-white/45">{new Date(p.lastPlayedAt).toLocaleDateString()}</span>
          </span>
          {friendIds.has(p.userId) || p.isFriend ? <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-200">{t('social.recent.friend')}</span> : null}
        </Row>
      ))}
    </ul>
  );
}

function AddTabView() {
  const t = useT();
  const s = useSocial();
  const [code, setCode] = useState(s.prefillCode ?? '');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(false);
  const mine = s.me?.friendCode ?? '';
  const link = mine ? friendShareUrl(mine) : '';

  useEffect(() => { if (s.prefillCode) setCode(s.prefillCode); }, [s.prefillCode]);

  const send = async () => {
    const normalized = normalizeFriendCode(code);
    if (!normalized) { setResult(t('social.add.result.invalid')); return; }
    const answer = await s.addByCode(normalized);
    setResult(t(`social.add.result.${answer}` as never));
    if (answer === 'sent' || answer === 'accepted') setCode('');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(mine); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* copy blocked */ }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: t('social.title'), url: link });
      else await navigator.clipboard.writeText(link);
    } catch { /* cancelled */ }
  };

  return (
    <div className="space-y-5 p-4">
      <section className="space-y-2">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-200">{t('social.add.mine')}</h3>
        <p className="font-mono text-2xl font-black tracking-widest text-white" data-testid="crew-my-code">{mine || '...'}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BTN} onClick={() => void copy()} disabled={!mine} data-testid="button-crew-copy-code">{copied ? <><Check className="mr-1 inline h-3.5 w-3.5" />{t('social.add.copied')}</> : <><Copy className="mr-1 inline h-3.5 w-3.5" />{t('social.add.copy')}</>}</button>
          <button type="button" className={BTN} onClick={() => void share()} disabled={!mine}><Share2 className="mr-1 inline h-3.5 w-3.5" />{t('social.add.share')}</button>
          <button type="button" className={qr ? BTN_ON : BTN} aria-pressed={qr} onClick={() => setQr(!qr)} disabled={!mine} data-testid="button-crew-qr">{qr ? t('social.add.hideQr') : t('social.add.showQr')}</button>
        </div>
        {qr && link ? (
          <div className="flex flex-col items-start gap-2 pt-1" data-testid="crew-qr">
            <QrCode value={link} label={t('social.add.qrLabel')} />
            <p className="max-w-xs text-xs text-muted-foreground">{t('social.add.qrBody')}</p>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-white/60">{t('social.add.enter')}</h3>
        <div className="flex gap-2">
          <input
            value={code} onChange={(e) => { setCode(e.target.value); setResult(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
            placeholder={t('social.add.placeholder')} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={16}
            className="min-w-0 flex-1 border border-border bg-background px-3 py-2 font-mono text-sm uppercase tracking-widest text-white" data-testid="input-friend-code"
          />
          <button type="button" className={BTN_ON} onClick={() => void send()} data-testid="button-friend-send"><UserPlus className="mr-1 inline h-3.5 w-3.5" />{t('social.add.send')}</button>
        </div>
        {result ? <p className="text-sm text-fuchsia-100" role="status" data-testid="friend-result">{result}</p> : null}
      </section>

      <section className="space-y-2 border-t border-border/60 pt-4">
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-bold text-white">{t('social.add.online')}</span>
            <span className="block max-w-xs text-xs text-muted-foreground">{t('social.add.onlineBody')}</span>
          </span>
          <button type="button" aria-pressed={s.me?.showOnline ?? true} onClick={() => void s.setShowOnline(!(s.me?.showOnline ?? true))} className={s.me?.showOnline ?? true ? BTN_ON : BTN} data-testid="button-crew-show-online">{s.me?.showOnline ?? true ? 'On' : 'Off'}</button>
        </label>
        <div className="flex items-start justify-between gap-3">
          <span className="max-w-xs text-xs text-muted-foreground">{t('social.add.newCodeBody')}</span>
          <button type="button" className={BTN} onClick={() => void s.makeNewCode()}>{t('social.add.newCode')}</button>
        </div>
      </section>
    </div>
  );
}

/** The panel itself. Mount once near the root. */
export function CrewOverlay() {
  const t = useT();
  const s = useSocial();
  const { open, closeOverlay } = s;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeOverlay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOverlay]);

  if (!open || typeof document === 'undefined') return null;
  const body = !s.signedIn ? <SignedOut /> : !s.active ? <p className="p-4 text-sm text-muted-foreground">{t('social.off')}</p> : s.setupNeeded ? <p className="p-4 text-sm text-muted-foreground" data-testid="crew-setup-needed">{t('social.setup')}</p> : s.tab === 'crew' ? <CrewTabView /> : s.tab === 'friends' ? <FriendsTabView /> : s.tab === 'recent' ? <RecentTabView /> : <AddTabView />;

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeOverlay} data-testid="crew-overlay">
      <div role="dialog" aria-modal="true" aria-label={t('social.title')} onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col border border-border bg-slate-950 text-white shadow-2xl sm:max-h-[85dvh]">
        <header className="flex items-center gap-3 border-b border-border/70 p-4">
          {s.me ? <PlayerAvatar name={s.me.displayName} src={s.me.avatarUrl} size={44} online={s.me.showOnline} /> : <Users className="h-6 w-6 text-emerald-200" />}
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-200">{t('social.title')}</p>
            <p className="truncate text-lg font-black text-white" data-testid="crew-my-name">{s.me?.displayName ?? ''}</p>
          </div>
          <button type="button" onClick={closeOverlay} aria-label={t('social.close')} className="p-2 text-white/70 hover:text-white" data-testid="button-crew-close"><X className="h-5 w-5" /></button>
        </header>
        {s.signedIn && s.active && !s.setupNeeded ? (
          <nav className="grid grid-cols-4 border-b border-border/70" role="tablist">
            {TAB_KEYS.map((key) => (
              <button key={key} type="button" role="tab" aria-selected={s.tab === key} onClick={() => s.setTab(key)}
                className={`relative px-2 py-3 font-mono text-[11px] font-bold uppercase tracking-widest ${s.tab === key ? 'bg-fuchsia-400/10 text-fuchsia-100' : 'text-white/55 hover:text-white'}`} data-testid={`tab-crew-${key}`}>
                {t(`social.tab.${key}` as never)}
                {key === 'friends' && s.friends.some((f) => f.status === 'pending' && f.incoming) ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fuchsia-400" /> : null}
                {key === 'crew' && s.crew.invites.length > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-fuchsia-400" /> : null}
              </button>
            ))}
          </nav>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      </div>
    </div>,
    document.body,
  );
}
