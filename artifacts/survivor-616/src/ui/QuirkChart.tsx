import { QUIRK_SURGE_LORE } from '@/game/data/quirkSurgeLore';
import { QUIRK_SURGE_CHANCE, QUIRK_SURGE_UNLOCK_MAPS } from '@/game/data/enemyQuirks';
import { ENEMY_QUIRKS, QUIRK_BASE_CHANCE, QUIRK_MAX_CHANCE, quirkChart } from '@/game/data/enemyQuirks';

const KIND_LABEL: Record<string, string> = { stat: 'Stats', movement: 'Movement', defense: 'Defense', death: 'On death' };

/** Odds chart for every random enemy quirk, built from the same records the engine rolls from. */
export function QuirkChart({ mapsCleared = 0 }: { mapsCleared?: number }) {
  const rows = quirkChart();
  const topShare = Math.max(...rows.map((row) => row.sharePct));
  return (
    <section className="border border-border bg-card p-4" data-testid="section-quirk-chart">
      <h3 className="text-lg font-black uppercase tracking-tight text-white">Enemy quirk chart</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        An end-game feature (turn it on, and pick which quirks are allowed, in Settings once Victory Lap opens). Any non-boss enemy can spawn with one random quirk: {Math.round(QUIRK_BASE_CHANCE * 100)}% of spawns at the start
        of a run, rising to {Math.round(QUIRK_MAX_CHANCE * 100)}% by minute ten. A quirked enemy shows a dashed ring and its
        quirk name. {ENEMY_QUIRKS.length} quirks exist.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left font-mono text-[11px]">
          <thead className="text-[9px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3">Quirk</th>
              <th className="py-1.5 pr-3">Type</th>
              <th className="py-1.5 pr-3">What happens</th>
              <th className="py-1.5 pr-3">Odds among quirks</th>
              <th className="py-1.5 pr-3 text-right">Per spawn</th>
              <th className="py-1.5">Reward</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.quirk.id} className="border-t border-border/50 align-top" data-testid={`quirk-row-${row.quirk.id}`}>
                <td className="py-2 pr-3 font-bold" style={{ color: row.quirk.color }}>{row.quirk.name}</td>
                <td className="py-2 pr-3 text-white/60">{KIND_LABEL[row.quirk.kind]}</td>
                <td className="py-2 pr-3 font-sans text-white/80">{row.quirk.description}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 bg-white/10" aria-hidden="true">
                      <div className="h-2" style={{ width: `${(row.sharePct / topShare) * 100}%`, background: row.quirk.color }} />
                    </div>
                    <span className="text-white/80">{row.sharePct.toFixed(0)}%</span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-right text-white/80">{row.startPct.toFixed(1)}% → {row.maxPct.toFixed(1)}%</td>
                <td className="py-2 text-amber-200">{row.quirk.reward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 border border-border/70 bg-background/50 p-3" data-testid="section-surge-lore">
        <h4 className="text-sm font-black uppercase tracking-wide text-fuchsia-200">{QUIRK_SURGE_LORE.title}</h4>
        {mapsCleared >= QUIRK_SURGE_UNLOCK_MAPS ? (
          <>
            {QUIRK_SURGE_LORE.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-2 text-xs leading-relaxed text-muted-foreground">{paragraph}</p>
            ))}
            <p className="mt-3 border-l-2 border-fuchsia-300/60 pl-3 font-mono text-[11px] uppercase tracking-widest text-fuchsia-100/80">{QUIRK_SURGE_LORE.glyphs}</p>
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {Math.round(QUIRK_SURGE_CHANCE * 100)}% of runs until the end game; every run after.
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Clear {QUIRK_SURGE_UNLOCK_MAPS} maps to learn what the glyphs say. {mapsCleared} / {QUIRK_SURGE_UNLOCK_MAPS} so far.</p>
        )}
      </div>
    </section>
  );
}
