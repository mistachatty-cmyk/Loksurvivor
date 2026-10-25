/**
 * Listening together, on top of the crew. The host's game announces its song, play/pause and place over a
 * small live channel shared by the crew; followers' games match it. Only songs that exist in every game
 * (the soundtrack) are shared, and only the song id and the place in it ever travel.
 */
import { openCrewChannel } from '@workspace/lok-client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useMusicPlayer } from '@/game/audio/musicPlayer';
import { lokClient } from '@/lib/lokClient';
import { followActions, HEARTBEAT_MS, hostChanged, parseListenMessage, type ListenMessage } from '@/lib/social/listenSync';
import { useSocial } from './socialStore';

export type ListenRole = 'off' | 'host' | 'guest';
export type ListenNotice = 'none' | 'noCrew' | 'pickDisc' | 'sealed' | 'ended';

interface Invite { name: string; message: ListenMessage }

interface ListenValue {
  role: ListenRole;
  /** The host's name while following. */
  hostName: string | null;
  /** Other crew members listening along while hosting. */
  followers: number;
  invite: { name: string } | null;
  notice: ListenNotice;
  /** The crew has at least one other player to listen with. */
  hasCompany: boolean;
  start: () => void;
  stop: () => void;
  accept: () => void;
  decline: () => void;
  clearNotice: () => void;
}

const ListenContext = createContext<ListenValue | null>(null);

export function ListenTogetherProvider({ children }: { children: ReactNode }) {
  const social = useSocial();
  const player = useMusicPlayer();
  const [role, setRole] = useState<ListenRole>('off');
  const [hostName, setHostName] = useState<string | null>(null);
  const [followers, setFollowers] = useState(0);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [notice, setNotice] = useState<ListenNotice>('none');

  const crewId = social.crew.crew?.id ?? null;
  const hasCompany = social.active && social.crew.members.length >= 2;
  const myName = social.me?.displayName ?? 'Player';

  // Latest values for callbacks that outlive a render.
  const live = useRef({ player, role, myName });
  live.current = { player, role, myName };
  const channelRef = useRef<ReturnType<typeof openCrewChannel> | null>(null);
  const lastSent = useRef<{ trackId: string | null; playing: boolean; positionSec: number } | null>(null);

  const snapshot = useCallback(() => {
    const p = live.current.player;
    return { trackId: p.currentTrack?.id ?? null, playing: p.isPlaying, positionSec: p.progressSec };
  }, []);

  const send = useCallback((message: ListenMessage) => channelRef.current?.send('listen', { ...message }), []);

  const apply = useCallback((message: ListenMessage, explicit: boolean) => {
    const p = live.current.player;
    if (!message.trackId) return;
    const target = p.tracks.find((t) => t.id === message.trackId);
    if (!target || target.locked) { setNotice('sealed'); return; }
    const mine = { trackId: p.currentTrack?.id ?? null, positionSec: p.progressSec, playing: p.isPlaying };
    for (const action of followActions({ ...message, trackId: message.trackId }, mine, explicit)) {
      if (action.type === 'play-track') {
        p.playTrack(action.trackId);
        // The new song needs a moment to load before it can be placed.
        window.setTimeout(() => live.current.player.seek(action.positionSec), 700);
      } else if (action.type === 'seek') p.seek(action.positionSec);
      else if (action.type === 'toggle') window.setTimeout(() => live.current.player.togglePlay(), mine.trackId === message.trackId ? 0 : 900);
    }
  }, []);

  const reset = useCallback(() => {
    setRole('off'); setHostName(null); setFollowers(0); setInvite(null); lastSent.current = null;
  }, []);

  // The crew's channel, open only while there is someone to listen with.
  useEffect(() => {
    if (!lokClient || !crewId || !hasCompany) { channelRef.current = null; reset(); return; }
    const channel = openCrewChannel(lokClient, crewId, (event, payload) => {
      if (event !== 'listen') return;
      const message = parseListenMessage(payload);
      if (!message) return;
      const current = live.current.role;
      if (current === 'host') {
        if (message.kind === 'join') { setFollowers((n) => n + 1); const s = snapshot(); channelRef.current?.send('listen', { kind: 'state', ...s }); }
        else if (message.kind === 'leave') setFollowers((n) => Math.max(0, n - 1));
      } else if (current === 'guest') {
        if (message.kind === 'state') apply(message, !message.heartbeat);
        else if (message.kind === 'stop') { reset(); setNotice('ended'); }
      } else if (message.kind === 'start') {
        setInvite({ name: message.name || 'A crewmate', message });
      }
    });
    channelRef.current = channel;
    return () => { channel.leave(); channelRef.current = null; reset(); };
  }, [crewId, hasCompany, snapshot, apply, reset]);

  // Host: announce changes, plus a heartbeat so late joiners and stalled phones catch up.
  const progress = player.progressSec;
  const trackId = player.currentTrack?.id ?? null;
  useEffect(() => {
    if (role !== 'host') return;
    const next = { trackId, playing: player.isPlaying, positionSec: progress };
    if (hostChanged(lastSent.current, next) && next.trackId) { lastSent.current = next; send({ kind: 'state', ...next, trackId: next.trackId }); }
  }, [role, trackId, player.isPlaying, progress, send]);
  useEffect(() => {
    if (role !== 'host') return;
    const timer = window.setInterval(() => {
      const s = snapshot();
      if (s.playing && s.trackId) send({ kind: 'state', ...s, trackId: s.trackId, heartbeat: true });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [role, send, snapshot]);

  const start = useCallback(() => {
    setNotice('none');
    if (!hasCompany) { setNotice('noCrew'); return; }
    const p = live.current.player;
    const track = p.currentTrack;
    if (!track || track.source === 'local') { setNotice('pickDisc'); return; }
    const s = snapshot();
    lastSent.current = s;
    setRole('host'); setFollowers(0);
    send({ kind: 'start', trackId: track.id, positionSec: s.positionSec, playing: s.playing, name: live.current.myName });
  }, [hasCompany, send, snapshot]);

  const stop = useCallback(() => {
    if (live.current.role === 'host') send({ kind: 'stop' });
    else if (live.current.role === 'guest') send({ kind: 'leave' });
    reset();
  }, [send, reset]);

  const accept = useCallback(() => {
    if (!invite) return;
    const target = live.current.player.tracks.find((t) => t.id === invite.message.trackId);
    if (!target || target.locked) { setNotice('sealed'); setInvite(null); return; }
    setNotice('none');
    setRole('guest'); setHostName(invite.name); setInvite(null);
    apply(invite.message, true);
    send({ kind: 'join', name: live.current.myName });
  }, [invite, apply, send]);

  const value = useMemo<ListenValue>(() => ({
    role, hostName, followers, invite: invite ? { name: invite.name } : null, notice, hasCompany,
    start, stop, accept, decline: () => setInvite(null), clearNotice: () => setNotice('none'),
  }), [role, hostName, followers, invite, notice, hasCompany, start, stop, accept]);

  return <ListenContext.Provider value={value}>{children}</ListenContext.Provider>;
}

export function useListenTogether(): ListenValue {
  const ctx = useContext(ListenContext);
  if (!ctx) throw new Error('useListenTogether must be used within a ListenTogetherProvider');
  return ctx;
}
