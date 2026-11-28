/**
 * PartyLobby -- host or join an online Lok Party (Slice 4).
 *
 * Host: gets a 5-letter code, sees four seats (bots fill empty ones), invites by link, share sheet
 * or a crew invite, and starts when ready. Guest: types or opens the code and takes a bot's seat.
 */

import { press } from './press';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS_BY_ID } from '@/game/data/characters';
import { lokClient } from '@/lib/lokClient';
import { useSocialOptional } from '@/state/socialStore';
import { useT } from '@/lib/i18n';
import { RigPreview, ROSTER_IDS } from './dropShared';
import { QrCode } from '@/ui/QrCode';
import { decodeGoal, encodeGoal, type BoardGoal } from './lokBoard';
import { haptic } from '../../../../lib/lok-universe/src/haptics';
import { assignSeat, createPartyCode, initialSeats, normalizePartyCode, openPartyRoom, partyLink, seatToBot, type OnlineSession, type PartyRoom, type Seat } from './partyNet';

const CREAM = '#FAF6EE';
const ESPRESSO = '#3b2a20';
const LANE = ['#38f2ff', '#ff3fd2', '#ffd23f', '#7cff6b'];

interface Props {
  characterId: string;
  rounds: number;
  /** A code from an invite link: join straight away. */
  joinCode?: string | null;
  onStart: (s: OnlineSession) => void;
  onBack: () => void;
}

function clientId(): string {
  try {
    const k = 'lokparty.client';
    const have = sessionStorage.getItem(k);
    if (have) return have;
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(k, id);
    return id;
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function PartyLobby({ characterId, rounds, joinCode, onStart, onBack }: Props) {
  const t = useT();
  const social = useSocialOptional();
  const myName = social?.me?.displayName || CHARACTERS_BY_ID[characterId]?.name || 'Player';
  // Read through a ref: a profile that loads late must not close the room and make a new code.
  const nameRef = useRef(myName);
  nameRef.current = myName;
  const [mode, setMode] = useState<'choose' | 'host' | 'join'>(joinCode ? 'join' : 'choose');
  // The game's goal and length, chosen by the host here and sent to everyone with the seats.
  const [roundsCode, setRoundsCode] = useState(rounds);
  const roundsRef = useRef(rounds);
  roundsRef.current = roundsCode;
  const broadcastRef = useRef<() => void>(() => undefined);
  const [code, setCode] = useState(joinCode ?? '');
  const [typed, setTyped] = useState(joinCode ?? '');
  const [seats, setSeats] = useState<Seat[]>([]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [copied, setCopied] = useState(false);
  const [crewSent, setCrewSent] = useState(false);
  const [full, setFull] = useState(false);
  const roomRef = useRef<PartyRoom | null>(null);
  const seatsRef = useRef<Seat[]>([]);
  const started = useRef(false);
  const me = useMemo(() => clientId(), []);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  // Keep the crew channel open while the lobby is up so invites can go out.
  useEffect(() => social?.bus.hold(), [social?.bus]);

  // Host a room.
  useEffect(() => {
    if (mode !== 'host' || !lokClient) return;
    const c = createPartyCode();
    setCode(c);
    const room = openPartyRoom(lokClient as never, c);
    roomRef.current = room;
    const initial = initialSeats(characterId, nameRef.current, ROSTER_IDS);
    seatsRef.current = initial;
    setSeats(initial);
    const broadcast = () => {
      seatsRef.current = seatsRef.current.map((st) => (st.kind === 'host' ? { ...st, name: nameRef.current } : st));
      room.send('lobby', { seats: seatsRef.current, rounds: roundsRef.current });
    };
    broadcastRef.current = broadcast;
    room.setHandlers({
      onStatus: setStatus,
      onJoinRequest: (m) => {
        const r = assignSeat(seatsRef.current, m);
        if (!r) return;
        seatsRef.current = r.seats;
        setSeats(r.seats);
        broadcast();
      },
      onLeave: (m) => {
        if (m.host) return;
        seatsRef.current = seatToBot(seatsRef.current, m.seat);
        setSeats(seatsRef.current);
        broadcast();
      },
    });
    const id = window.setInterval(broadcast, 3000);
    return () => {
      window.clearInterval(id);
      if (!started.current) {
        room.send('leave', { seat: 0, host: true });
        room.close();
      }
    };
  }, [mode, characterId]);

  // Join a room.
  useEffect(() => {
    if (mode !== 'join' || !lokClient || code.length !== 5) return;
    const room = openPartyRoom(lokClient as never, code);
    roomRef.current = room;
    room.setHandlers({
      onStatus: setStatus,
      onLobby: (m) => {
        seatsRef.current = m.seats;
        setSeats(m.seats);
        if (typeof m.rounds === 'number') setRoundsCode(m.rounds);
        const mine = m.seats.find((st) => st.clientId === me);
        setFull(!mine && m.seats.every((st) => st.kind !== 'bot'));
      },
      onStart: (m) => {
        const mine = m.seats.find((st) => st.clientId === me);
        if (!mine) return;
        started.current = true;
        onStartRef.current({ room, host: false, mySeat: mine.index, seats: m.seats, seed: m.seed, rounds: m.rounds });
      },
      onLeave: (m) => {
        if (m.host) setStatus('disconnected');
      },
    });
    // Keep asking until the game starts: if the start message is lost, the host sends it again.
    const ask = () => room.send('join-request', { clientId: me, characterId, name: nameRef.current });
    ask();
    const id = window.setInterval(ask, 2000);
    return () => {
      window.clearInterval(id);
      if (!started.current) {
        const mine = seatsRef.current.find((st) => st.clientId === me);
        if (mine) room.send('leave', { seat: mine.index, host: false });
        room.close();
      }
    };
  }, [mode, code, characterId, me]);

  const start = () => {
    const room = roomRef.current;
    if (!room) return;
    const seed = (Date.now() ^ 0x616) >>> 0;
    started.current = true;
    room.send('start', { seed, rounds: roundsRef.current, seats: seatsRef.current });
    onStart({ room, host: true, mySeat: 0, seats: seatsRef.current, seed, rounds: roundsRef.current });
  };

  const setOptions = (next: number) => {
    setRoundsCode(next);
    roundsRef.current = next;
    broadcastRef.current();
  };

  // A friend arriving gets a small buzz so the host knows without staring at the screen.
  const humans = seats.filter((st) => st.kind !== 'bot').length;
  const lastHumans = useRef(0);
  useEffect(() => {
    if (humans > lastHumans.current && lastHumans.current > 0) haptic('pickup');
    lastHumans.current = humans;
  }, [humans]);

  // Keep the phone awake while people gather. The browser releases it on its own when the tab is hidden.
  useEffect(() => {
    if (mode === 'choose') return;
    let lock: { release: () => Promise<void> } | null = null;
    let off = false;
    const take = () => {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      void wl?.request('screen').then((l) => (off ? void l.release() : (lock = l))).catch(() => undefined);
    };
    take();
    const again = () => document.visibilityState === 'visible' && take();
    document.addEventListener('visibilitychange', again);
    return () => {
      off = true;
      document.removeEventListener('visibilitychange', again);
      void lock?.release();
    };
  }, [mode]);

  const link = code ? partyLink(code, window.location.origin) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: t('lokParty.title'), text: t('lokParty.online.shareText', { code }), url: link });
    } catch {
      void copy();
    }
  };
  const inviteCrew = () => {
    if (!social?.bus.up) return;
    social.bus.send('party-invite', { code, from: myName });
    setCrewSent(true);
  };

  if (!lokClient) {
    return (
      <Shell onBack={onBack} t={t}>
        <p className="text-sm">{t('lokParty.online.unavailable')}</p>
      </Shell>
    );
  }

  if (mode === 'choose') {
    return (
      <Shell onBack={onBack} t={t}>
        <div className="grid gap-3">
          <Big onPress={() => setMode('host')} tone="#ffcf3c">
            {t('lokParty.online.host')}
            <span className="block text-xs font-bold opacity-70">{t('lokParty.online.hostHint')}</span>
          </Big>
          <div className="rounded-xl border-[3px] p-3" style={{ borderColor: ESPRESSO }}>
            <div className="text-xs font-black uppercase tracking-widest">{t('lokParty.online.joinTitle')}</div>
            <div className="mt-2 flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(normalizePartyCode(e.target.value))}
                placeholder="ABCDE"
                inputMode="text"
                autoCapitalize="characters"
                className="w-full rounded-lg border-[3px] bg-white px-3 py-2 text-center font-mono text-2xl font-black tracking-[.4em]"
                style={{ borderColor: ESPRESSO }}
              />
              <Big
                onPress={() => {
                  if (typed.length === 5) {
                    setCode(typed);
                    setMode('join');
                  }
                }}
                tone="#7cff6b"
              >
                {t('lokParty.online.join')}
              </Big>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell onBack={onBack} t={t}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-widest">{t('lokParty.online.code')}</div>
          <div className="font-mono text-4xl font-black tracking-[.3em]">{code || '.....'}</div>
        </div>
        <StatusDot status={status} t={t} />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border-[3px] p-2" style={{ borderColor: ESPRESSO, background: '#fff' }} data-testid="party-qr">
        <div className="shrink-0" style={{ width: 132, height: 132 }}>
          {link ? <QrCode value={link} size={132} label={t('lokParty.online.qrLabel', { code })} /> : <div className="h-full w-full animate-pulse bg-black/10" aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black leading-tight">{t('lokParty.online.qrTitle')}</div>
          <div className="mt-1 text-xs leading-snug opacity-75">{t('lokParty.online.qrHelp')}</div>
          <div className="mt-1 text-[11px] font-bold opacity-60">{t('lokParty.online.seated', { count: humans || 1 })}</div>
        </div>
      </div>
      <OptionsDrawer mode={mode} code={roundsCode} onChange={setOptions} t={t} />
      {mode === 'host' ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Small onPress={copy}>{copied ? t('lokParty.online.copied') : t('lokParty.online.copy')}</Small>
          <Small onPress={share}>{t('lokParty.online.share')}</Small>
          <Small onPress={inviteCrew} disabled={!social?.bus.up}>
            {crewSent ? t('lokParty.online.crewSent') : t('lokParty.online.crew')}
          </Small>
        </div>
      ) : null}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(seats.length ? seats : ROSTER_IDS.map((id, i): Seat => ({ index: i, kind: 'bot', characterId: id, name: '' }))).map((st) => (
          <div key={st.index} className="flex flex-col items-center rounded-xl border-[3px] p-1" style={{ borderColor: st.clientId === me || (mode === 'host' && st.index === 0) ? LANE[st.index] : ESPRESSO, background: st.kind === 'bot' ? '#efe5d0' : '#fff' }}>
            <RigPreview id={st.characterId} size={56} />
            <span className="w-full truncate text-center text-[11px] font-black">{st.kind === 'bot' ? t('lokParty.drop.bot') : st.name}</span>
            <span className="text-[9px] font-bold uppercase opacity-60">{st.kind === 'host' ? t('lokParty.online.hostTag') : st.kind === 'guest' ? t('lokParty.online.friend') : t('lokParty.online.open')}</span>
          </div>
        ))}
      </div>
      {full ? <p className="mt-2 text-sm font-bold text-red-700">{t('lokParty.online.full')}</p> : null}
      <p className="mt-3 text-xs opacity-75">{t('lokParty.online.botsFill')}</p>
      {mode === 'host' ? (
        <Big onPress={start} tone="#7cff6b">
          {t('lokParty.online.start')}
        </Big>
      ) : (
        <p className="mt-2 text-center text-sm font-black">{t('lokParty.online.waitHost')}</p>
      )}
    </Shell>
  );
}

const RACE_TARGETS = { crowns: [2, 3, 5], relics: [3, 5, 8] } as const;

function goalText(g: BoardGoal, rounds: number, t: ReturnType<typeof useT>): string {
  if (g.kind === 'crowns') return t('lokParty.board.goalCrowns', { count: g.target });
  if (g.kind === 'relics') return t('lokParty.board.goalRelics', { count: g.target });
  return t('lokParty.board.rounds', { count: rounds });
}

/**
 * The game's goal and length. Collapsed it is one quiet line that always says what is being played, so
 * nobody has to open it to know; open it (the chevron) and the host can change it in a short scrolling
 * panel that never grows past a few rows. Guests see the same line and a read-only panel.
 */
export function OptionsDrawer({ mode, code, onChange, t }: { mode: 'host' | 'join'; code: number; onChange: (n: number) => void; t: ReturnType<typeof useT> }) {
  const [open, setOpen] = useState(false);
  const { goal, rounds } = decodeGoal(code);
  const host = mode === 'host';
  const kind = goal.kind;
  const lenIdx = kind === 'rounds' ? 1 : Math.max(0, (RACE_TARGETS[kind] as readonly number[]).indexOf(goal.target));
  const chip = (active: boolean, label: string, onPress: () => void, key: string) => (
    <button key={key} type="button" disabled={!host} {...press(onPress)} aria-pressed={active} className="rounded-lg border-2 px-2 py-2 text-xs font-black disabled:opacity-70" style={{ borderColor: ESPRESSO, background: active ? '#ffcf3c' : 'transparent' }}>
      {label}
    </button>
  );
  const setKind = (k: 'rounds' | 'crowns' | 'relics') => onChange(k === 'rounds' ? 10 : encodeGoal({ kind: k, target: RACE_TARGETS[k][1] }, 10));
  return (
    <div className="mt-3 rounded-xl border-[3px]" style={{ borderColor: ESPRESSO }}>
      <button type="button" {...press(() => setOpen((v) => !v))} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" data-testid="party-options-toggle">
        <span className="min-w-0">
          <span className="block text-[10px] font-black uppercase tracking-widest opacity-60">{t('lokParty.online.options')}</span>
          <span className="block truncate text-sm font-black">{goalText(goal, rounds, t)}</span>
        </span>
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}>
          <path d="M5 8l6 6 6-6" fill="none" stroke={ESPRESSO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="max-h-44 overflow-y-auto border-t-2 px-3 py-2" style={{ borderColor: ESPRESSO, overscrollBehavior: 'contain' }} role="group" aria-label={t('lokParty.online.options')}>
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest opacity-60">{t('lokParty.board.goal')}</div>
          <div className="grid grid-cols-3 gap-2">
            {(['rounds', 'crowns', 'relics'] as const).map((k) => chip(kind === k, t(k === 'rounds' ? 'lokParty.board.goalRounds' : k === 'crowns' ? 'lokParty.board.goalRaceCrowns' : 'lokParty.board.goalRaceRelics'), () => setKind(k), k))}
          </div>
          <div className="mb-1 mt-3 text-[10px] font-black uppercase tracking-widest opacity-60">{t('lokParty.board.length')}</div>
          <div className="grid grid-cols-3 gap-2">
            {kind === 'rounds'
              ? [5, 10, 15].map((n) => chip(rounds === n, t('lokParty.board.rounds', { count: n }), () => onChange(n), `r${n}`))
              : [0, 1, 2].map((i) => chip(lenIdx === i, t(kind === 'crowns' ? 'lokParty.board.goalCrowns' : 'lokParty.board.goalRelics', { count: RACE_TARGETS[kind][i] }), () => onChange(encodeGoal({ kind, target: RACE_TARGETS[kind][i] }, 10)), `l${i}`))}
          </div>
          <p className="mt-2 text-[11px] opacity-70">{host ? t('lokParty.board.goalHelp') : t('lokParty.online.optionsGuest')}</p>
        </div>
      ) : null}
    </div>
  );
}

function Shell({ children, onBack, t }: { children: React.ReactNode; onBack: () => void; t: ReturnType<typeof useT> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto" style={{ background: 'radial-gradient(ellipse at 50% 20%, #2a1d5c 0%, #07061a 70%)' }}>
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-4">
        <div className="text-center text-white">
          <div className="font-mono text-xs uppercase tracking-[.3em] text-cyan-300">{t('lokParty.title')}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{t('lokParty.online.title')}</h1>
        </div>
        <div className="w-full max-w-md rounded-2xl border-[3px] p-4" style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 5px 0 ${ESPRESSO}` }}>
          {children}
        </div>
        <button type="button" {...press(onBack)} className="rounded-lg border border-white/30 px-5 py-2 text-sm font-bold text-white">
          {t('lokParty.drop.back')}
        </button>
      </div>
    </div>
  );
}

function Big({ children, onPress, tone }: { children: React.ReactNode; onPress: () => void; tone: string }) {
  return (
    <button type="button" {...press(onPress)} className="mt-2 w-full rounded-xl border-[3px] px-3 py-3 text-lg font-black active:translate-y-[3px]" style={{ background: tone, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 3px 0 ${ESPRESSO}` }}>
      {children}
    </button>
  );
}

function Small({ children, onPress, disabled }: { children: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} {...press(() => !disabled && onPress())} className="rounded-lg border-[3px] px-2 py-2 text-xs font-black disabled:opacity-40" style={{ borderColor: ESPRESSO, background: '#efe5d0', color: ESPRESSO }}>
      {children}
    </button>
  );
}

function StatusDot({ status, t }: { status: string; t: ReturnType<typeof useT> }) {
  const color = status === 'connected' ? '#1f9e3a' : status === 'connecting' ? '#d9a10b' : '#c8102e';
  const label = status === 'connected' ? t('lokParty.online.connected') : status === 'connecting' ? t('lokParty.online.connecting') : t('lokParty.online.offline');
  return (
    <span className="flex items-center gap-1 text-[11px] font-black uppercase">
      <span className="inline-block h-3 w-3 rounded-full border-2" style={{ background: color, borderColor: ESPRESSO }} />
      {label}
    </span>
  );
}

/** App-wide: a crew mate's party invite pops a small card anywhere in the game. */
export function PartyInviteToast() {
  const t = useT();
  const social = useSocialOptional();
  const [invite, setInvite] = useState<{ code: string; from: string } | null>(null);
  const [warned, setWarned] = useState(false);
  useEffect(() => setWarned(false), [invite]);
  useEffect(() => {
    if (!social?.bus.up) return;
    return social.bus.on('party-invite', (p) => {
      const code = normalizePartyCode(String(p.code ?? ''));
      if (code.length === 5) setInvite({ code, from: String(p.from ?? '').slice(0, 24) });
    });
  }, [social?.bus]);
  useEffect(() => {
    if (!invite) return;
    const id = window.setTimeout(() => setInvite(null), 30_000);
    return () => window.clearTimeout(id);
  }, [invite]);
  if (!invite) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-[min(92vw,360px)] -translate-x-1/2 rounded-2xl border-[3px] p-3" style={{ background: CREAM, borderColor: ESPRESSO, color: ESPRESSO, boxShadow: `0 5px 0 ${ESPRESSO}` }} data-testid="party-invite-toast">
      <div className="text-sm font-black">{t('lokParty.online.invited', { name: invite.from || t('lokParty.online.friend') })}</div>
      {warned ? <p className="mt-1 text-xs font-bold text-red-700">{t('lokParty.online.leaveRun')}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" {...press(() => {
            if (!warned && social?.inRun()) setWarned(true);
            else window.location.assign(`/?screen=lok-party&party=${invite.code}`);
          })} className="flex-1 rounded-xl border-[3px] py-2 font-black" style={{ background: '#7cff6b', borderColor: ESPRESSO }}>
          {warned ? t('lokParty.online.joinAnyway') : t('lokParty.online.join')}
        </button>
        <button type="button" {...press(() => setInvite(null))} className="rounded-xl border-[3px] px-3 py-2 font-black" style={{ borderColor: ESPRESSO }}>
          {t('lokParty.board.skip')}
        </button>
      </div>
    </div>
  );
}
