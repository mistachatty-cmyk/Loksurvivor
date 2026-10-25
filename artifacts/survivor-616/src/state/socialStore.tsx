/**
 * Friends, crew, recent players and who is online, for the signed-in account. One live connection
 * (Realtime) carries friend/crew changes and presence. Nothing connects while signed out, while the
 * "Friends and crew" switch in Settings is off, or when the page has been hidden for a while.
 */
import {
  acceptCrewInvite, createCrew, openCrewChannel, declineCrewInvite, EMPTY_CREW_STATE, getCrewState, inviteToCrew, joinPresence, kickFromCrew, leaveCrew, listFriends,
  listRecentPlayers, newFriendCode, recordRecentPlayers, removeFriend, requestFriend, respondToFriend, setCardSettings, subscribeSocial, syncPlayerCard,
  type CrewAcceptResult, type CrewInviteResult, type FriendRequestResult, type LokCrewState, type LokFriend, type LokPlayerCard, type LokPresence, type LokRecentPlayer,
} from '@workspace/lok-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { lokClient } from '@/lib/lokClient';
import { friendsPref } from '@/lib/powerSaver';
import { crewmateIds } from '@/lib/social/crewRules';
import { friendCodeFromSearch } from '@/lib/social/friendCode';
import { avatarFor, displayNameFor } from '@/lib/social/identity';
import { useAuth } from './authStore';

export const GAME_KEY = 'survivor616';
export const OPEN_CREW_EVENT = 'lok:open-crew';
export type CrewTab = 'crew' | 'friends' | 'recent' | 'add';
export type Doing = 'menu' | 'run' | 'theater';

/** Short live messages shared by everyone in the crew (listening together, chat, emotes). */
export interface CrewBus {
  /** True while the crew's channel is open (a crew with at least two players, and friends switched on). */
  up: boolean;
  send: (event: string, payload: Record<string, unknown>) => void;
  /** Listens for one kind of message; returns the way to stop. */
  on: (event: string, handler: (payload: Record<string, unknown>) => void) => () => void;
}

/** How long a hidden page keeps its live connection before letting go. */
const HIDDEN_GRACE_MS = 60_000;

interface SocialValue {
  /** Friends are on, the player is signed in and the shared database is reachable. */
  active: boolean;
  signedIn: boolean;
  /** The database has not been set up for friends yet. */
  setupNeeded: boolean;
  me: LokPlayerCard | null;
  friends: LokFriend[];
  recent: LokRecentPlayer[];
  crew: LokCrewState;
  online: Record<string, LokPresence>;
  bus: CrewBus;
  /** Requests and crew invites waiting for an answer. */
  waiting: number;
  open: boolean;
  tab: CrewTab;
  prefillCode: string | null;
  openOverlay: (tab?: CrewTab, code?: string | null) => void;
  closeOverlay: () => void;
  setTab: (tab: CrewTab) => void;
  /** Tells friends what this player is doing; `room` marks an open crew run others can join. */
  setDoing: (doing: Doing, room?: string | null) => void;
  refresh: () => Promise<void>;
  addByCode: (code: string) => Promise<FriendRequestResult | 'error'>;
  answerRequest: (userId: string, accept: boolean) => Promise<void>;
  unfriend: (userId: string) => Promise<void>;
  startCrew: () => Promise<void>;
  invite: (userId: string) => Promise<CrewInviteResult | 'error'>;
  acceptInvite: (crewId: string) => Promise<CrewAcceptResult | 'error'>;
  declineInvite: (crewId: string) => Promise<void>;
  leave: () => Promise<void>;
  kick: (userId: string) => Promise<void>;
  makeNewCode: () => Promise<void>;
  setShowOnline: (show: boolean) => Promise<void>;
}

const SocialContext = createContext<SocialValue | null>(null);

const missing = (message: string | undefined): boolean => Boolean(message && /does not exist|could not find the function|schema cache|relation .* does not exist/i.test(message));

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const enabled = friendsPref.use();
  const userId = user?.id ?? null;
  const active = Boolean(lokClient && userId && enabled);

  const [setupNeeded, setSetupNeeded] = useState(false);
  const [me, setMe] = useState<LokPlayerCard | null>(null);
  const [friends, setFriends] = useState<LokFriend[]>([]);
  const [recent, setRecent] = useState<LokRecentPlayer[]>([]);
  const [crew, setCrew] = useState<LokCrewState>(EMPTY_CREW_STATE);
  const [online, setOnline] = useState<Record<string, LokPresence>>({});
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<CrewTab>('crew');
  const [prefillCode, setPrefillCode] = useState<string | null>(null);

  const [busUp, setBusUp] = useState(false);
  const busChannelRef = useRef<ReturnType<typeof openCrewChannel> | null>(null);
  const busHandlers = useRef(new Map<string, Set<(payload: Record<string, unknown>) => void>>());
  const bus = useMemo<CrewBus>(() => ({
    up: busUp,
    send: (event, payload) => busChannelRef.current?.send(event, payload),
    on: (event, handler) => {
      const set = busHandlers.current.get(event) ?? new Set();
      set.add(handler);
      busHandlers.current.set(event, set);
      return () => { set.delete(handler); };
    },
  }), [busUp]);

  const doingRef = useRef<Doing>('menu');
  const roomRef = useRef<string | null>(null);
  const trackState = () => ({ game: GAME_KEY, doing: doingRef.current, ...(roomRef.current ? { room: roomRef.current } : {}) });
  const presenceRef = useRef<ReturnType<typeof joinPresence> | null>(null);
  const showOnlineRef = useRef(true);
  const recordedRef = useRef('');

  const name = useMemo(() => displayNameFor(user), [user]);
  const avatar = useMemo(() => avatarFor(user), [user]);

  const refresh = useCallback(async () => {
    if (!lokClient || !userId) return;
    const [f, r, c] = await Promise.all([listFriends(lokClient), listRecentPlayers(lokClient), getCrewState(lokClient)]);
    const failure = [f, r, c].find((x) => !x.ok);
    if (failure && !failure.ok) {
      if (missing(failure.error)) setSetupNeeded(true);
      return;
    }
    setSetupNeeded(false);
    if (f.ok) setFriends(f.friends);
    if (r.ok) setRecent(r.players);
    if (c.ok) setCrew(c.state);
  }, [userId]);

  // Card, first load and the live subscription.
  useEffect(() => {
    if (!active || !lokClient || !userId) {
      setMe(null); setFriends([]); setRecent([]); setCrew(EMPTY_CREW_STATE); setOnline({});
      return;
    }
    let cancelled = false;
    void syncPlayerCard(lokClient, name, avatar).then((result) => {
      if (cancelled) return;
      if (result.ok) { setMe(result.card); showOnlineRef.current = result.card.showOnline; void refresh(); }
      else if (missing(result.error)) setSetupNeeded(true);
    });
    const unsubscribe = subscribeSocial(lokClient, userId, () => void refresh());
    return () => { cancelled = true; unsubscribe(); };
  }, [active, userId, name, avatar, refresh]);

  // Presence: connect while the page is visible, let go after it has been hidden a minute.
  useEffect(() => {
    if (!active || !lokClient || !userId || setupNeeded) return;
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (presenceRef.current) return;
      const channel = joinPresence(lokClient!, userId, setOnline);
      presenceRef.current = channel;
      if (showOnlineRef.current) channel.track(trackState());
    };
    const disconnect = () => {
      presenceRef.current?.leave();
      presenceRef.current = null;
      setOnline({});
    };
    connect();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimer = setTimeout(disconnect, HIDDEN_GRACE_MS);
      } else {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        hiddenTimer = null;
        connect();
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      disconnect();
    };
  }, [active, userId, setupNeeded, refresh]);

  // The crew's shared channel: open only while there is someone to talk to.
  const crewId = crew.crew?.id ?? null;
  const hasCompany = active && crew.members.length >= 2;
  useEffect(() => {
    if (!lokClient || !crewId || !hasCompany) { busChannelRef.current = null; setBusUp(false); return; }
    const channel = openCrewChannel(lokClient, crewId, (event, payload) => {
      busHandlers.current.get(event)?.forEach((handler) => handler(payload));
    });
    busChannelRef.current = channel;
    setBusUp(true);
    return () => { channel.leave(); busChannelRef.current = null; setBusUp(false); };
  }, [crewId, hasCompany]);

  const setDoing = useCallback((doing: Doing, room?: string | null) => {
    doingRef.current = doing;
    roomRef.current = room ?? null;
    if (showOnlineRef.current) presenceRef.current?.track({ game: GAME_KEY, doing, ...(room ? { room } : {}) });
  }, []);

  // Crewmates become "recent players" once per crew line-up.
  useEffect(() => {
    if (!lokClient || !userId || !crew.crew) return;
    const others = crewmateIds(crew, userId);
    const key = `${crew.crew.id}:${others.join(',')}`;
    if (others.length === 0 || recordedRef.current === key) return;
    recordedRef.current = key;
    void recordRecentPlayers(lokClient, others, GAME_KEY);
  }, [crew, userId]);

  const openOverlay = useCallback((next?: CrewTab, code?: string | null) => {
    setTab(next ?? 'crew');
    setPrefillCode(code ?? null);
    setOpen(true);
    void refresh();
  }, [refresh]);
  const closeOverlay = useCallback(() => { setOpen(false); setPrefillCode(null); }, []);

  // `?friend=CODE` links and the open event (for places outside React).
  useEffect(() => {
    const code = typeof window !== 'undefined' ? friendCodeFromSearch(window.location.search) : null;
    if (code) {
      openOverlay('add', code);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('friend');
        window.history.replaceState(window.history.state, '', url.toString());
      } catch { /* the link still worked */ }
    }
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: CrewTab }>).detail;
      openOverlay(detail?.tab);
    };
    window.addEventListener(OPEN_CREW_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CREW_EVENT, onOpen);
  }, [openOverlay]);

  const addByCode = useCallback(async (code: string) => {
    if (!lokClient) return 'error' as const;
    const result = await requestFriend(lokClient, code);
    if (!result.ok) return 'error' as const;
    void refresh();
    return result.result;
  }, [refresh]);

  const run = useCallback(async (action: () => Promise<unknown>) => { await action(); await refresh(); }, [refresh]);

  const value: SocialValue = {
    active, signedIn: Boolean(userId), setupNeeded, me, friends, recent, crew, online, bus,
    waiting: friends.filter((f) => f.status === 'pending' && f.incoming).length + crew.invites.length,
    open, tab, prefillCode, openOverlay, closeOverlay, setTab, setDoing, refresh, addByCode,
    answerRequest: (id, accept) => run(() => respondToFriend(lokClient!, id, accept)),
    unfriend: (id) => run(() => removeFriend(lokClient!, id)),
    startCrew: () => run(() => createCrew(lokClient!, GAME_KEY)),
    invite: async (id) => {
      if (!lokClient || !crew.crew) return 'error';
      const result = await inviteToCrew(lokClient, crew.crew.id, id);
      return result.ok ? result.result : 'error';
    },
    acceptInvite: async (crewId) => {
      if (!lokClient) return 'error';
      const result = await acceptCrewInvite(lokClient, crewId);
      await refresh();
      return result.ok ? result.result : 'error';
    },
    declineInvite: (crewId) => run(() => declineCrewInvite(lokClient!, crewId)),
    leave: () => run(() => leaveCrew(lokClient!)),
    kick: (id) => run(() => kickFromCrew(lokClient!, id)),
    makeNewCode: async () => {
      if (!lokClient) return;
      const result = await newFriendCode(lokClient);
      if (result.ok) setMe((card) => (card ? { ...card, friendCode: result.code } : card));
    },
    setShowOnline: async (show) => {
      if (!lokClient) return;
      showOnlineRef.current = show;
      setMe((card) => (card ? { ...card, showOnline: show } : card));
      if (show) presenceRef.current?.track(trackState()); else presenceRef.current?.untrack();
      await setCardSettings(lokClient, { showOnline: show });
    },
  };

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error('useSocial must be used within a SocialProvider');
  return ctx;
}

/** For code that may render outside the provider (tests, standalone previews). */
export function useSocialOptional(): SocialValue | null {
  return useContext(SocialContext);
}

export function openCrewOverlay(tab?: CrewTab): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_CREW_EVENT, { detail: { tab } }));
}
