/**
 * LokSurvivorArena — seat/area picker. Nothing to adapt here: no
 * multi-character-selection UI exists anywhere else in the game (see
 * `.agents/memory/loksurvivor-arena.md`), so this is a small standalone
 * screen rather than a fork of `CharacterSelect`/`AreaSelect`. Picks an
 * area and 2-4 seats' worth of unlocked characters, then hands both up to
 * `onLaunch` for `App.tsx` to mount `ArenaScreen` with.
 */

import { ArrowLeft, Minus, Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AREAS } from '@/game/data/areas';
import { CHARACTERS } from '@/game/data/characters';
import { isUnlocked, useMeta } from '@/game/state/metaStore';
import type { AreaDef, CharacterDef } from '@/game/types';
import { ARENA_MAX_PLAYERS, ARENA_MIN_PLAYERS, type ArenaSeat } from '@/game/arena/arenaWorld';

interface ArenaSetupScreenProps {
  onBack: () => void;
  onLaunch: (area: AreaDef, seats: ArenaSeat[]) => void;
}

const SEAT_LABELS = ['Host', 'P2', 'P3', 'P4'];

export function ArenaSetupScreen({ onBack, onLaunch }: ArenaSetupScreenProps) {
  const { meta } = useMeta();
  const unlockedCharacters = useMemo(
    () => CHARACTERS.filter((c) => meta.unlockedCharacterIds.includes(c.id) || meta.devModeAllUnlocks),
    [meta.unlockedCharacterIds, meta.devModeAllUnlocks],
  );
  const unlockedAreas = useMemo(
    () => AREAS.filter((a) => isUnlocked(a.unlock, meta)),
    [meta],
  );

  const [areaId, setAreaId] = useState(unlockedAreas[0]?.id ?? '');
  const [seatCount, setSeatCount] = useState(ARENA_MIN_PLAYERS);
  const [seatCharacterIds, setSeatCharacterIds] = useState<string[]>(() =>
    Array.from({ length: ARENA_MAX_PLAYERS }, (_, i) => unlockedCharacters[i % Math.max(1, unlockedCharacters.length)]?.id ?? ''),
  );

  const area = AREAS.find((a) => a.id === areaId);
  const canLaunch = Boolean(area) && seatCharacterIds.slice(0, seatCount).every(Boolean) && unlockedCharacters.length > 0;

  function setSeatCharacter(seatIndex: number, characterId: string) {
    setSeatCharacterIds((current) => {
      const next = [...current];
      next[seatIndex] = characterId;
      return next;
    });
  }

  function launch() {
    if (!area || !canLaunch) return;
    const charactersById: Record<string, CharacterDef> = Object.fromEntries(unlockedCharacters.map((c) => [c.id, c]));
    const seats: ArenaSeat[] = seatCharacterIds.slice(0, seatCount).map((characterId, i) => ({
      id: i === 0 ? 'host' : `p${i + 1}`,
      character: charactersById[characterId]!,
    }));
    onLaunch(area, seats);
  }

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
              Local play only for now: host uses WASD/arrows, seat 2 uses IJKL on the same
              keyboard, seats 3-4 use connected gamepads. Every player fights with their
              character's starting weapon — no in-run leveling in arena mode yet.
            </p>

            <button
              type="button"
              disabled={!canLaunch}
              onClick={launch}
              className="mt-3 h-10 w-full border-2 border-violet-300/60 bg-violet-300/15 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-violet-100 disabled:border-white/15 disabled:bg-black/40 disabled:text-white/35"
              data-testid="button-launch-arena"
            >
              Start Match
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export default ArenaSetupScreen;
