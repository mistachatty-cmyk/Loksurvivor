import { Check, Lock, Sparkles } from 'lucide-react';

import { THEMED_PALETTES } from '@/game/data/themedPalettes';
import { useMeta } from '@/game/state/metaStore';

/**
 * Hideout section for buying/equipping cosmetic character/world color
 * palettes with loot tokens. Mirrors the UI-theme section's card layout so
 * both purchase flows read as the same system, but spends the run-loot
 * currency instead of cred.
 */
export function PaletteStore() {
  const { meta, buyPalette, equipPalette } = useMeta();

  return (
    <section className="border border-border bg-card p-5 sm:p-6 lg:col-span-2" data-testid="section-palette-store">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center border border-primary/40 bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Artisian Valur</p>
          <h2 className="mt-1 text-xl font-black uppercase text-white">Paint Gallery</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Visit the Paint Gallery to spend loot tokens earned in runs and commission custom character and world
            colorways through Artisian Valur's exquisite palette collection. Purely cosmetic &mdash; gameplay never
            changes.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {THEMED_PALETTES.map((theme) => {
              const owned = meta.ownedPaletteIds.includes(theme.id);
              const equipped = meta.activePaletteId === theme.id;
              const affordable = meta.lootTokens >= theme.cost;
              return (
                <div
                  key={theme.id}
                  className={`border p-4 ${equipped ? 'border-primary bg-primary/5' : 'border-border bg-background'}`}
                  data-testid={`card-palette-${theme.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-wide text-white">{theme.name}</h3>
                    {equipped ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                  </div>
                  <div className="mt-2 flex gap-1">
                    {[theme.palette.body, theme.palette.accent, theme.palette.accentBright, theme.palette.glow].map(
                      (color, i) => (
                        <span
                          key={i}
                          className="h-5 flex-1 border border-white/10"
                          style={{ backgroundColor: color }}
                        />
                      ),
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{theme.description}</p>

                  {owned ? (
                    <button
                      type="button"
                      onClick={() => equipPalette(theme.id)}
                      disabled={equipped}
                      className={`mt-3 w-full border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        equipped
                          ? 'cursor-default border-primary/40 text-primary/70'
                          : 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                      }`}
                      data-testid={`button-equip-palette-${theme.id}`}
                    >
                      {equipped ? 'Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buyPalette(theme.id)}
                      disabled={!affordable}
                      className={`mt-3 flex w-full items-center justify-center gap-2 border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors ${
                        affordable
                          ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                          : 'cursor-not-allowed border-border text-muted-foreground/50'
                      }`}
                      data-testid={`button-buy-palette-${theme.id}`}
                    >
                      {!affordable ? <Lock className="h-3 w-3" /> : null}
                      {affordable
                        ? `Buy for ${theme.cost} token${theme.cost === 1 ? '' : 's'}`
                        : `Need ${theme.cost} token${theme.cost === 1 ? '' : 's'}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
