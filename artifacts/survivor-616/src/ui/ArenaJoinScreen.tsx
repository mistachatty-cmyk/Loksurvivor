/**
 * LokSurvivorArena — join an online room by code (or via a `?room=CODE`
 * link). Mirrors `ArenaSetupScreen`'s online-host lobby from the guest's
 * side: pick a character, send a join request, then wait here until the
 * host starts the match (`match-start` broadcast) before handing off to
 * `ArenaScreen`. See `game/arena/arenaNet.ts` for the Realtime relay this
 * sits on top of.
 */
import { ArrowLeft } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { isUnlocked, useMeta } from '@/game/state/metaStore';
import type { AreaDef, CharacterDef } from '@/game/types';
import type { ArenaSeat } from '@/game/arena/arenaWorld';
import { joinArenaRoom, type ArenaNetRole, type GuestArenaRoom } from '@/game/arena/arenaNet';
import { lokClient } from '@/lib/lokClient';

interface ArenaJoinScreenProps {
  initialCode?: string;
  onBack: () => void;
  onLaunch: (area: AreaDef, seats: ArenaSeat[], net: ArenaNetRole) => void;
}

export function ArenaJoinScreen({ initialCode, onBack, onLaunch }: ArenaJoinScreenProps) {
  const { meta } = useMeta();
  const unlockedCharacters = useMemo(
    () => CHARACTERS.filter((c) =>
      (meta.unlockedCharacterIds.includes(c.id) || meta.devModeAllUnlocks) &&
      (!c.lokPetCollector || meta.lokPetCollectorAccessUnlocked || meta.devModeAllUnlocks)),
    [meta.unlockedCharacterIds, meta.devModeAllUnlocks, meta.lokPetCollectorAccessUnlocked],
  );

  const [code, setCode] = useState(initialCode?.toUpperCase() ?? '');
  const [name, setName] = useState('');
  const [characterId, setCharacterId] = useState(unlockedCharacters[0]?.id ?? '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'waiting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const roomRef = useRef<GuestArenaRoom | null>(null);
  const retryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    roomRef.current?.close();
    if (retryRef.current) clearInterval(retryRef.current);
  }, []);

  function join() {
    if (!lokClient || !code.trim() || !characterId) return;
    setStatus('connecting');
    const room = joinArenaRoom(lokClient, code.trim().toUpperCase());
    roomRef.current = room;
    room.setHandlers({
      onJoinAccepted: () => {
        setStatus('waiting');
        if (retryRef.current) { clearInterval(retryRef.current); retryRef.current = null; }
      },
      onMatchStart: (payload) => {
        const area = AREAS.find((a) => a.id === payload.areaId);
        const charactersById: Record<string, CharacterDef> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
        if (!area) {
          setStatus('error');
          setErrorMsg("Couldn't load the host's arena — try again.");
          return;
        }
        const seats: ArenaSeat[] = payload.seats
          .map((s) => ({ id: s.id, character: charactersById[s.characterId] }))
          .filter((s): s is ArenaSeat => Boolean(s.character));
        onLaunch(area, seats, { kind: 'guest', code: room.code, room });
      },
    });
    room.requestJoin(characterId, name.trim() || 'Guest');
    // Resend the join request a few times in case the host's room wasn't
    // subscribed yet when this first one landed -- broadcast has no
    // built-in retry/ack beyond what we do ourselves here. Cleared by
    // `onJoinAccepted` above once the host replies.
    let attempts = 0;
    retryRef.current = setInterval(() => {
      attempts += 1;
      if (attempts > 5) { clearInterval(retryRef.current!); retryRef.current = null; return; }
      room.requestJoin(characterId, name.trim() || 'Guest');
    }, 1500);
  }

  return (
    <div className="min-h-dvh bg-[#0a0714] p-3 text-white" data-testid="screen-arena-join">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 items-center gap-1 border border-white/20 bg-black/50 px-2 font-mono text-[10px] uppercase tracking-wider text-white/75"
          data-testid="button-arena-join-back"
        >
          <ArrowLeft size={12} /> Hideout
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-sm uppercase tracking-[0.25em] text-violet-300">Join an arena room</h1>
        </div>
      </header>

      {!lokClient ? (
        <p className="border border-white/15 bg-black/40 p-3 font-mono text-[11px] text-white/60">
          Online play needs sign-in configured in this environment.
        </p>
      ) : unlockedCharacters.length === 0 ? (
        <p className="border border-white/15 bg-black/40 p-3 font-mono text-[11px] text-white/60">
          Unlock at least one character before joining an arena match.
        </p>
      ) : (
        <div className="mx-auto max-w-sm space-y-3">
          <div className="border border-white/15 bg-black/40 p-2">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Room code</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={status !== 'idle' && status !== 'error'}
              maxLength={8}
              className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-sm tracking-[0.2em] text-white disabled:opacity-60"
              data-testid="input-arena-room-code"
            />
          </div>
          <div className="border border-white/15 bg-black/40 p-2">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Your name</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={status !== 'idle' && status !== 'error'}
              maxLength={20}
              placeholder="Guest"
              className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white disabled:opacity-60"
              data-testid="input-arena-name"
            />
          </div>
          <div className="border border-white/15 bg-black/40 p-2">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Your character</p>
            <select
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              disabled={status !== 'idle' && status !== 'error'}
              className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white disabled:opacity-60"
              data-testid="select-arena-join-character"
            >
              {unlockedCharacters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {status === 'idle' || status === 'error' ? (
            <button
              type="button"
              disabled={!code.trim() || !characterId}
              onClick={join}
              className="h-10 w-full border-2 border-violet-300/60 bg-violet-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100 disabled:opacity-40"
              data-testid="button-join-room"
            >
              Join
            </button>
          ) : (
            <p className="border border-dashed border-white/15 p-3 text-center font-mono text-[11px] text-white/60" data-testid="text-arena-join-status">
              {status === 'connecting' ? 'Connecting…' : 'Connected — waiting for the host to start the match…'}
            </p>
          )}
          {status === 'error' && (
            <p className="font-mono text-[10px] text-red-300">{errorMsg}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ArenaJoinScreen;
