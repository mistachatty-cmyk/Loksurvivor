/**
 * The Operators tab's browsable roster, rendered below the creator: the
 * player's own saved custom operators on top, then every hand-authored
 * character reinterpreted through the Forge engine (`characterForgeRoster.ts`).
 * Picking a card loads its design into the creator as an editable starting
 * point -- switchable, never destructive to the saved operator or the
 * original character it was forged from.
 */
import { useMemo, useState } from 'react';

import { getCharacterRoster, type RosterEntry } from '@/game/data/characterForgeRoster';
import { buildOperatorRig, type OperatorDesign } from '@/game/data/operatorForge';
import type { ForgedOperator } from '@/game/data/operatorForge';
import { RigPortrait } from './RigPortrait';

const FIELD = 'w-full border border-border bg-background px-2 py-2 text-sm text-white';

export interface OperatorRosterProps {
  savedOperators: ForgedOperator[];
  onSelectSaved: (op: ForgedOperator) => void;
  onSelectRosterEntry: (entry: RosterEntry) => void;
}

export function OperatorRoster({ savedOperators, onSelectSaved, onSelectRosterEntry }: OperatorRosterProps) {
  const [query, setQuery] = useState('');
  const roster = useMemo(() => getCharacterRoster(), []);
  const visibleRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? roster.filter((entry) => entry.name.toLowerCase().includes(q)) : roster;
  }, [roster, query]);

  return (
    <section className="mt-6 border border-border bg-card p-4" data-testid="operator-roster">
      <h2 className="text-sm font-black uppercase tracking-wide">616 Roster</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Browse and switch between operators. Picking one loads it into the creator above as a starting point -- it stays
        fully editable, and nothing about the original is ever changed.
      </p>

      {savedOperators.length > 0 && (
        <div className="mt-4" data-testid="operator-roster-saved">
          <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Your Operators</h3>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {savedOperators.map((op) => (
              <li key={op.id}>
                <button
                  type="button"
                  onClick={() => onSelectSaved(op)}
                  className="flex w-full flex-col items-center gap-1 border border-border p-2 hover:border-primary/60"
                  data-testid={`roster-saved-${op.id}`}
                >
                  <RigPortrait rig={buildOperatorRig(op.design)} palette={op.design.palette} size={64} animated={false} />
                  <span className="w-full truncate text-center text-[11px] font-bold uppercase">{op.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <input
          className={FIELD}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the roster"
          aria-label="Search the roster"
          data-testid="operator-roster-search"
        />
        <ul className="mt-3 grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6" data-testid="operator-roster-grid">
          {visibleRoster.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelectRosterEntry(entry)}
                className="flex w-full flex-col items-center gap-1 border border-border p-2 hover:border-primary/60"
                title={entry.blurb}
                data-testid={`roster-character-${entry.id}`}
              >
                <RigPortrait rig={buildOperatorRig(entry.design)} palette={entry.design.palette} size={64} animated={false} />
                <span className="w-full truncate text-center text-[11px] font-bold uppercase">{entry.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export type { OperatorDesign, RosterEntry };
