import { CITY_RELICS, RELIC_RECIPES } from '@/game/data/relics';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { Hammer, LockKeyhole, Sparkles, Swords } from 'lucide-react';

export interface WorkshopOverviewProps {
  compact?: boolean;
}

export function WorkshopOverview({ compact = false }: WorkshopOverviewProps) {
  const { meta } = useMeta();
  const isListView = meta.uiDensity === 'list';
  const knownRelicIds = new Set(meta.knownRelicIds);
  const knownRecipeCount = RELIC_RECIPES.filter((recipe) => knownRelicIds.has(recipe.relicId)).length;

  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'} data-testid="section-relic-workshop">
      <div className="flex flex-col gap-2 border-b border-orange-300/25 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">City Relic Workshop</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">Craft the city into an edge</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Relic knowledge is permanent. The weapon treatment is not inventory: bring the base weapon into a run,
            level it, and choose the recipe from a normal level-up draft.
          </p>
        </div>
        <div className="shrink-0 font-mono text-xs font-bold uppercase tracking-widest text-orange-200">
          {meta.knownRelicIds.length} / {CITY_RELICS.length} relics · {knownRecipeCount} / {RELIC_RECIPES.length} recipes
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Relic knowledge</h3>
        </div>
        <div className={`grid gap-3 ${isListView ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {CITY_RELICS.map((relic) => {
            const found = knownRelicIds.has(relic.id);
            return (
              <article
                key={relic.id}
                className={`border border-l-4 p-4 ${found ? 'border-border bg-card' : 'border-border/50 bg-card/30'}`}
                style={{ borderLeftColor: found ? relic.color : undefined }}
                data-testid={`card-relic-${relic.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center border ${found ? 'border-white/20 bg-black/40' : 'border-white/10 bg-black/20 opacity-50'}`}>
                    {found ? <Sparkles className="h-4 w-4" style={{ color: relic.color }} /> : <LockKeyhole className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className={`text-xs font-black uppercase tracking-wide ${found ? 'text-white' : 'text-muted-foreground'}`}>
                      {found ? relic.name : 'Unknown city relic'}
                    </h4>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-orange-200/70">
                      {found ? 'Knowledge recovered' : 'Knowledge unavailable'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {found ? relic.description : relic.sourceLabel}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-orange-300" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Recipe board</h3>
        </div>
        <div className={`grid gap-3 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
          {RELIC_RECIPES.map((recipe) => {
            const known = knownRelicIds.has(recipe.relicId);
            return (
              <article
                key={recipe.id}
                className={`border p-4 ${known ? 'border-orange-300/35 bg-orange-300/5' : 'border-border/50 bg-card/30'}`}
                data-testid={`card-recipe-${recipe.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: recipe.color }}>
                      {recipe.identity}
                    </p>
                    <h4 className="mt-1 text-base font-black uppercase text-white">{known ? recipe.name : 'Sealed recipe'}</h4>
                  </div>
                  {known ? <Swords className="h-5 w-5 shrink-0" style={{ color: recipe.color }} /> : <LockKeyhole className="h-5 w-5 shrink-0 text-muted-foreground" />}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-white/75">
                  {known ? recipe.description : 'Find the matching district relic to decode this treatment.'}
                </p>
                <p className="mt-3 border-t border-white/10 pt-3 font-mono text-[10px] uppercase leading-relaxed tracking-wider text-orange-100/75">
                  {known ? recipe.triggerLabel : 'Unavailable until relic knowledge is recovered.'}
                </p>
                {known ? (
                  <p className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Result: {recipe.result.name} · {recipe.result.kind}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function WorkshopPanel({ onBack }: { onBack: () => void }) {
  return (
    <ScreenLayout title="Workshop" subtitle="City Relic Recipes" onBack={onBack}>
      <WorkshopOverview />
    </ScreenLayout>
  );
}

export default WorkshopPanel;