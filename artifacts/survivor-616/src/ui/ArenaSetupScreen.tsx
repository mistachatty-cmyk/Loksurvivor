/**
 * LokSurvivorArena — seat/area picker. Nothing to adapt here: no
 * multi-character-selection UI exists anywhere else in the game (see
 * `.agents/memory/loksurvivor-arena.md`), so this is a small standalone
 * screen rather than a fork of `CharacterSelect`/`AreaSelect`. Picks an
 * area and 2-4 seats' worth of unlocked characters, then hands both up to
 * `onLaunch` for `App.tsx` to mount `ArenaScreen` with.
 *
 * "Online — host a room" mode additionally owns the lobby: it opens a
 * Supabase Realtime room (free, on the already-connected `LokServices`
 * project -- no new servers, see `.agents/memory/loksurvivor-arena.md`),
 * collects remote joiners' own character picks as they connect, and only
 * calls `onLaunch` once the host presses Start -- `ArenaScreen` itself
 * never has to know a match is still filling seats.
 */

import { ArrowLeft, Copy, Minus, Plus, Users, Wifi } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { areaOpen, useMeta } from '@/game/state/metaStore';
import type { AreaDef, CharacterDef } from '@/game/types';
import { ARENA_MAX_PLAYERS, ARENA_MIN_PLAYERS, type ArenaSeat } from '@/game/arena/arenaWorld';
import { createRoomCode, hostArenaRoom, type ArenaNetRole, type HostArenaRoom } from '@/game/arena/arenaNet';
import { lokClient } from '@/lib/lokClient';

interface ArenaSetupScreenProps {
  onBack: () => void;
  onLaunch: (area: AreaDef, seats: ArenaSeat[], net?: ArenaNetRole) => void;
  onJoinOnline: () => void;
}

const SEAT_LABELS = ['Host', 'P2', 'P3', 'P4'];

interface RemoteSeat {
  seatId: string;
  name: string;
  character: CharacterDef;
}

export function ArenaSetupScreen({ onBack, onLaunch, onJoinOnline }: ArenaSetupScreenProps) {
  const { meta } = useMeta();
  const unlockedCharacters = useMemo(
    () => CHARACTERS.filter((c) =>
      (meta.unlockedCharacterIds.includes(c.id) || meta.devModeAllUnlocks) &&
      (!c.lokPetCollector || meta.lokPetCollectorAccessUnlocked || meta.devModeAllUnlocks)),
    [meta.unlockedCharacterIds, meta.devModeAllUnlocks, meta.lokPetCollectorAccessUnlocked],
  );
  const unlockedAreas = useMemo(
    () => AREAS.filter((a) => areaOpen(a, meta)),
    [meta],
  );

  const [mode, setMode] = useState<'local' | 'online-host'>('local');
  const [areaId, setAreaId] = useState(unlockedAreas[0]?.id ?? '');
  const [seatCount, setSeatCount] = useState(ARENA_MIN_PLAYERS);
  const [seatCharacterIds, setSeatCharacterIds] = useState<string[]>(() =>
    Array.from({ length: ARENA_MAX_PLAYERS }, (_, i) => unlockedCharacters[i % Math.max(1, unlockedCharacters.length)]?.id ?? ''),
  );
  const [hostCharacterId, setHostCharacterId] = useState(unlockedCharacters[0]?.id ?? '');
  const [room, setRoom] = useState<HostArenaRoom | null>(null);
  const [remoteSeats, setRemoteSeats] = useState<RemoteSeat[]>([]);
  const roomRef = useRef<HostArenaRoom | null>(null);
  const seenRequestsRef = useRef<Map<string, string>>(new Map()); // requestId -> assigned seatId

  const area = AREAS.find((a) => a.id === areaId);
  const canLaunch = Boolean(area) && seatCharacterIds.slice(0, seatCount).every(Boolean) && unlockedCharacters.length > 0;
  const charactersById = useMemo<Record<string, CharacterDef>>(
    () => Object.fromEntries(unlockedCharacters.map((c) => [c.id, c])),
    [unlockedCharacters],
  );

  useEffect(() => () => roomRef.current?.close(), []);

  function setSeatCharacter(seatIndex: number, characterId: string) {
    setSeatCharacterIds((current) => {
      const next = [...current];
      next[seatIndex] = characterId;
      return next;
    });
  }

  function launchLocal() {
    if (!area || !canLaunch) return;
    const seats: ArenaSeat[] = seatCharacterIds.slice(0, seatCount).map((characterId, i) => ({
      id: i === 0 ? 'host' : `p${i + 1}`,
      character: charactersById[characterId]!,
    }));
    onLaunch(area, seats);
  }

  function createRoom() {
    if (!lokClient || !area || !hostCharacterId) return;
    const code = createRoomCode();
    const newRoom = hostArenaRoom(lokClient, code);
    newRoom.setHandlers({
      onJoinRequest: ({ requestId, characterId, name }) => {
        const already = seenRequestsRef.current.get(requestId);
        if (already) {
          // Guest retried before our first accept reached them -- just resend it.
          newRoom.sendJoinAccepted(requestId, already);
          return;
        }
        setRemoteSeats((current) => {
          if (current.length >= ARENA_MAX_PLAYERS - 1) return current; // room full
          const seatId = `p${current.length + 2}`;
          const character = charactersById[characterId] ?? unlockedCharacters[0];
          if (!character) return current;
          seenRequestsRef.current.set(requestId, seatId);
          newRoom.sendJoinAccepted(requestId, seatId);
          return [...current, { seatId, name: name || character.name, character }];
        });
      },
    });
    roomRef.current = newRoom;
    setRoom(newRoom);
  }

  function startOnlineMatch() {
    if (!room || !area || !hostCharacterId) return;
    const hostCharacter = charactersById[hostCharacterId];
    if (!hostCharacter) return;
    const seats: ArenaSeat[] = [
      { id: 'host', character: hostCharacter },
      ...remoteSeats.map((r) => ({ id: r.seatId, character: r.character })),
    ];
    room.sendMatchStart({
      areaId: area.id,
      seats: seats.map((s) => ({ id: s.id, characterId: s.character.id, name: s.id === 'host' ? 'Host' : (remoteSeats.find((r) => r.seatId === s.id)?.name ?? s.character.name) })),
    });
    onLaunch(area, seats, { kind: 'host', code: room.code, room });
  }

  const totalOnlineSeats = 1 + remoteSeats.length;
  const shareUrl = room && typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?room=${room.code}` : '';

  return (
    <div className="min-h-dvh bg-[#0a0714] p-3 text-white" data-testid="screen-arena-setup">
      <header className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 items-center gap-1 border border-white/20 bg-black/50 px-2 font-mono text-[10px] uppercase tracking-wider text-white/75"
          data-testid="button-arena-setup-back"
        >
          <ArrowLeft size={12} /> Hideout
        </button>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-sm uppercase tracking-[0.25em] text-violet-300">LokSurvivorArena</h1>
          <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">
            2-4 players · one arena · most kills wins
          </p>
        </div>
      </header>

      {unlockedCharacters.length === 0 ? (
        <p className="border border-white/15 bg-black/40 p-3 font-mono text-[11px] text-white/60">
          Unlock at least one character before starting an arena match.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setMode('local')}
              className={`h-8 border px-3 ${mode === 'local' ? 'border-violet-300/70 bg-violet-300/15 text-violet-100' : 'border-white/20 bg-black/40 text-white/60'}`}
              data-testid="button-arena-mode-local"
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => setMode('online-host')}
              disabled={!lokClient}
              className={`h-8 border px-3 disabled:opacity-30 ${mode === 'online-host' ? 'border-violet-300/70 bg-violet-300/15 text-violet-100' : 'border-white/20 bg-black/40 text-white/60'}`}
              data-testid="button-arena-mode-online-host"
            >
              <Wifi size={11} className="mr-1 inline" /> Online — host a room
            </button>
            <button
              type="button"
              onClick={onJoinOnline}
              disabled={!lokClient}
              className="h-8 border border-white/20 bg-black/40 px-3 text-white/60 disabled:opacity-30"
              data-testid="button-arena-join-online"
            >
              Join with a code
            </button>
          </div>
          {!lokClient && (
            <p className="mb-3 font-mono text-[9px] text-white/40">
              Online play needs sign-in configured in this environment — local play still works.
            </p>
          )}

          {mode === 'local' ? (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              <section className="space-y-3">
                <div className="border border-white/15 bg-black/40 p-2">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Arena</p>
                  <select
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white"
                    data-testid="select-arena-area"
                  >
                    {unlockedAreas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border border-white/15 bg-black/40 p-2">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Players</p>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSeatCount((n) => Math.max(ARENA_MIN_PLAYERS, n - 1))}
                      disabled={seatCount <= ARENA_MIN_PLAYERS}
                      className="flex h-7 w-7 items-center justify-center border border-white/20 bg-black/50 disabled:opacity-30"
                      data-testid="button-arena-seats-minus"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="flex items-center gap-1.5 font-mono text-sm">
                      <Users size={13} className="text-violet-300" /> {seatCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSeatCount((n) => Math.min(ARENA_MAX_PLAYERS, n + 1))}
                      disabled={seatCount >= ARENA_MAX_PLAYERS}
                      className="flex h-7 w-7 items-center justify-center border border-white/20 bg-black/50 disabled:opacity-30"
                      data-testid="button-arena-seats-plus"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              </section>

              <section className="border border-white/15 bg-black/40 p-3" data-testid="arena-seat-picker">
                <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-violet-200">Seats</h2>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: seatCount }, (_, i) => (
                    <div key={i} className="border border-white/10 p-2">
                      <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">
                        {SEAT_LABELS[i] ?? `P${i + 1}`}{i === 0 ? ' (you)' : ' — local'}
                      </p>
                      <select
                        value={seatCharacterIds[i]}
                        onChange={(e) => setSeatCharacter(i, e.target.value)}
                        className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white"
                        data-testid={`select-arena-seat-${i}`}
                      >
                        {unlockedCharacters.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <p className="mt-2 font-mono text-[9px] leading-relaxed text-white/40">
                  Host uses WASD/arrows, seat 2 uses IJKL on the same keyboard, seats 3-4 use
                  connected gamepads. Every player fights with their character's starting
                  weapon — no in-run leveling in arena mode yet.
                </p>

                <button
                  type="button"
                  disabled={!canLaunch}
                  onClick={launchLocal}
                  className="mt-3 h-10 w-full border-2 border-violet-300/60 bg-violet-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100 disabled:border-white/15 disabled:bg-black/40 disabled:text-white/35"
                  data-testid="button-launch-arena"
                >
                  Start Match
                </button>
              </section>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
              <section className="space-y-3">
                <div className="border border-white/15 bg-black/40 p-2">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Arena</p>
                  <select
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    disabled={Boolean(room)}
                    className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white disabled:opacity-50"
                    data-testid="select-arena-area-online"
                  >
                    {unlockedAreas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div className="border border-white/15 bg-black/40 p-2">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-white/45">Your character</p>
                  <select
                    value={hostCharacterId}
                    onChange={(e) => setHostCharacterId(e.target.value)}
                    disabled={Boolean(room)}
                    className="w-full border border-white/20 bg-black/60 p-1.5 font-mono text-[11px] text-white disabled:opacity-50"
                    data-testid="select-arena-host-character"
                  >
                    {unlockedCharacters.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {!room && (
                  <button
                    type="button"
                    disabled={!area || !hostCharacterId}
                    onClick={createRoom}
                    className="h-10 w-full border-2 border-violet-300/60 bg-violet-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100 disabled:opacity-40"
                    data-testid="button-create-room"
                  >
                    Create Room
                  </button>
                )}
              </section>

              {room && (
                <section className="border border-white/15 bg-black/40 p-3" data-testid="arena-online-lobby">
                  <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-violet-200">Room code</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="border border-violet-300/50 bg-violet-300/10 px-3 py-1.5 font-mono text-lg font-bold tracking-[0.3em] text-violet-100" data-testid="text-room-code">
                      {room.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => { void navigator.clipboard?.writeText(shareUrl || room.code); }}
                      className="flex h-8 items-center gap-1 border border-white/20 bg-black/50 px-2 font-mono text-[10px] text-white/70"
                      data-testid="button-copy-room-link"
                    >
                      <Copy size={11} /> Copy link
                    </button>
                  </div>
                  <p className="mt-1 break-all font-mono text-[9px] text-white/40">{shareUrl}</p>

                  <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-white/45">
                    Players ({totalOnlineSeats}/{ARENA_MAX_PLAYERS})
                  </p>
                  <div className="mt-1 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between border border-white/10 px-2 py-1">
                      <span>Host (you) — {charactersById[hostCharacterId]?.name}</span>
                    </div>
                    {remoteSeats.map((r) => (
                      <div key={r.seatId} className="flex items-center justify-between border border-white/10 px-2 py-1" data-testid="arena-lobby-remote-seat">
                        <span>{r.name} — {r.character.name}</span>
                      </div>
                    ))}
                    {remoteSeats.length === 0 && (
                      <p className="border border-dashed border-white/10 px-2 py-2 text-white/35">Waiting for players to join with the code above…</p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={totalOnlineSeats < ARENA_MIN_PLAYERS}
                    onClick={startOnlineMatch}
                    className="mt-3 h-10 w-full border-2 border-violet-300/60 bg-violet-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100 disabled:border-white/15 disabled:bg-black/40 disabled:text-white/35"
                    data-testid="button-start-online-match"
                  >
                    Start Match
                  </button>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ArenaSetupScreen;
