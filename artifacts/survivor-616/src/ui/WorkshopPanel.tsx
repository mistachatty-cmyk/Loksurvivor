import { useState } from 'react';
import { CITY_RELICS, CITY_RELICS_BY_ID, RELIC_RECIPES, CRAFTING_MATERIALS, type CraftingMaterialDef } from '@/game/data/relics';
import { useMeta } from '@/game/state/metaStore';
import { ScreenLayout } from './ScreenLayout';
import { WeaponIcon } from './WeaponIcon';
import {
  Hammer,
  LockKeyhole,
  Sparkles,
  Flame,
  Shield,
  Zap,
  Anvil,
  CheckCircle2,
  KeyRound,
  Eye,
  Droplet,
  Compass,
  Boxes,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WorkshopOverviewProps {
  compact?: boolean;
}

type WorkshopTab = 'forge' | 'inventory' | 'recipes' | 'materials';

export function WorkshopOverview({ compact = false }: WorkshopOverviewProps) {
  const { meta, craftRelic } = useMeta();
  const isListView = meta.uiDensity === 'list';
  const knownRelicIds = new Set(meta.knownRelicIds);
  const craftedRelicIds = new Set(meta.craftedRelicIds ?? []);
  const ownedKeyItemIds = new Set(meta.ownedKeyItemIds ?? ['digiscope']);
  const materials = meta.relicMaterials ?? { 'phosphor-ore': 6, 'silicon-alloy': 8, 'cyber-resin': 6, 'prism-quartz': 2 };

  const [activeTab, setActiveTab] = useState<WorkshopTab>('forge');
  const [forgingRelicId, setForgingRelicId] = useState<string | null>(null);
  const [recipeFilter, setRecipeFilter] = useState<'all' | 'known'>('all');

  const knownRecipeCount = RELIC_RECIPES.filter((recipe) => knownRelicIds.has(recipe.relicId)).length;
  const visibleRecipes = recipeFilter === 'known' ? RELIC_RECIPES.filter((recipe) => knownRelicIds.has(recipe.relicId)) : RELIC_RECIPES;

  const handleForge = (relicId: string) => {
    setForgingRelicId(relicId);
    setTimeout(() => {
      craftRelic(relicId);
      setForgingRelicId(null);
    }, 700);
  };

  const KEY_ITEMS = [
    {
      id: 'digiscope',
      name: 'Digi-Scope Sensor',
      tier: 'Standard Gear',
      icon: Compass,
      color: '#38bdf8',
      description: 'Standard issue high-frequency data scanner. Reveals invisible glitch markers, hidden secret routes, and trapped data nodes.',
      effectLabel: 'Reveals hidden data caches & glitch rifts across all districts.',
      owned: ownedKeyItemIds.has('digiscope'),
    },
    {
      id: 'mining-helmet',
      name: "Sub-Level Carbide Miner's Helmet",
      tier: 'Light Tier I',
      icon: Eye,
      color: '#f59e0b',
      description: 'Heavy subterranean halogen headlamp. Eliminates pitch-black blindness on deep subterranean maps and expands base vision by +30%.',
      effectLabel: '+30% Vision Radius · Pierces Abyssal Darkness & Subterranean fog.',
      owned: ownedKeyItemIds.has('mining-helmet'),
    },
    {
      id: 'firefly-lantern',
      name: 'Bioluminescent Firefly Jar',
      tier: 'Light Tier II',
      icon: Zap,
      color: '#fbbf24',
      description: 'A pressurized vacuum jar teeming with living glowing fireflies. Emits a pulsating warm perimeter and highlights nearby loot in the dark.',
      effectLabel: '+60% Vision Radius · Ambient firefly glow reveals distant pickups.',
      owned: ownedKeyItemIds.has('firefly-lantern'),
    },
    {
      id: 'phosphor-crown',
      name: 'Apex Phosphor Crown',
      tier: 'Light Tier III (Master)',
      icon: Sparkles,
      color: '#facc15',
      description: 'A radiant crown forged from high-density phosphor ore and diamond quartz. Radiates an incandescent field that forces all enemies to emit glowing halos.',
      effectLabel: '+110% Vision Radius · Enemies radiate glowing halos in pitch darkness.',
      owned: ownedKeyItemIds.has('phosphor-crown') || craftedRelicIds.has('phosphor-crown'),
    },
    {
      id: 'bag-of-water',
      name: "Bag o' Water",
      tier: 'Hazard Survival Gear',
      icon: Droplet,
      color: '#06b6d4',
      description: 'Pressurized hydraulic fire extinguisher flask. Automatically douses fiery floor hazards and puts out burning status effects on contact.',
      effectLabel: 'Automatically douses hot floor hazards & extinguishes fire damage.',
      owned: ownedKeyItemIds.has('bag-of-water'),
    },
  ];

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'} data-testid="section-relic-workshop">
      {/* Header with Title and Relic Stats */}
      <div className="flex flex-col gap-2 border-b border-orange-300/25 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-orange-300">City Relic Workshop & Forge</span>
            <span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-orange-300 border border-orange-500/30">
              ACTIVE FORGE
            </span>
          </div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-white">Craft permanent relics & illuminate the dark</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Recover city relics from districts, refine raw materials into permanent physical relics at the Forge, and inspect light equipment tiers for subterranean exploration.
          </p>
        </div>
        <div className="shrink-0 font-mono text-xs font-bold uppercase tracking-widest text-orange-200">
          {craftedRelicIds.size} / {CITY_RELICS.length} forged · {meta.knownRelicIds.length} known
        </div>
      </div>

      {/* Materials Stash Bar */}
      <section className="rounded-lg border border-white/10 bg-black/40 p-3 shadow-inner">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/80">
            <Boxes className="h-3.5 w-3.5 text-orange-300" /> Relic Crafting Materials
          </span>
          <span className="font-mono text-[9px] text-muted-foreground uppercase">Gathered from runs, chests & veteran foes</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CRAFTING_MATERIALS.map((mat) => {
            const count = materials[mat.id] ?? 0;
            return (
              <div
                key={mat.id}
                className="flex items-center gap-2.5 rounded border border-white/10 bg-white/5 p-2 transition-colors hover:border-white/20"
                style={{ borderLeftColor: mat.color, borderLeftWidth: '3px' }}
              >
                <span className="text-xl shrink-0" role="img" aria-label={mat.name}>{mat.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black uppercase text-white">{mat.name}</p>
                  <p className="font-mono text-xs font-bold" style={{ color: mat.color }}>
                    {count} <span className="text-[9px] font-normal text-white/40">owned</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('forge')}
          className={`flex items-center gap-2 rounded px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'forge'
              ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
              : 'text-muted-foreground hover:bg-white/5 hover:text-white'
          }`}
        >
          <Hammer className="h-3.5 w-3.5" /> Relic Forge ({craftedRelicIds.size}/{CITY_RELICS.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 rounded px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'inventory'
              ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
              : 'text-muted-foreground hover:bg-white/5 hover:text-white'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5" /> Key Items & Light Sources ({ownedKeyItemIds.size})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-2 rounded px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'recipes'
              ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
              : 'text-muted-foreground hover:bg-white/5 hover:text-white'
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> City Recipe Board ({knownRecipeCount}/{RELIC_RECIPES.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 rounded px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors ${
            activeTab === 'materials'
              ? 'bg-orange-500/20 text-orange-200 border border-orange-400/40 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
              : 'text-muted-foreground hover:bg-white/5 hover:text-white'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Material Almanac
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: RELIC FORGE & PERMANENT RUN PERKS                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'forge' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-400" /> Physical Relic Anvil
            </h3>
            <p className="text-xs text-muted-foreground">
              Forging a physical relic permanently activates its in-run perk for every subsequent run.
            </p>
          </div>

          <div className={`grid gap-4 ${isListView ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {CITY_RELICS.map((relic) => {
              const known = knownRelicIds.has(relic.id);
              const crafted = craftedRelicIds.has(relic.id);
              const recipe = relic.craftRecipe;
              const isForging = forgingRelicId === relic.id;

              // Check if can craft
              let canCraft = known && !crafted && Boolean(recipe);
              if (recipe) {
                for (const [matId, req] of Object.entries(recipe.materials)) {
                  if ((materials[matId] ?? 0) < req) canCraft = false;
                }
              }

              return (
                <article
                  key={relic.id}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-lg border p-4 transition-all ${
                    crafted
                      ? 'border-emerald-500/40 bg-emerald-950/15 shadow-[0_0_14px_rgba(16,185,129,0.12)]'
                      : known
                      ? 'border-orange-400/30 bg-card/60 hover:border-orange-400/50'
                      : 'border-white/10 bg-card/25 opacity-70'
                  }`}
                  data-testid={`card-relic-forge-${relic.id}`}
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="grid h-9 w-9 shrink-0 place-items-center rounded border"
                          style={{
                            borderColor: relic.color,
                            backgroundColor: `${relic.color}15`,
                          }}
                        >
                          <Sparkles className="h-4 w-4" style={{ color: relic.color }} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black uppercase text-white truncate">{relic.name}</h4>
                          <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                            {relic.sourceAreaId}
                          </p>
                        </div>
                      </div>
                      {crafted ? (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] font-black uppercase text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="h-3 w-3" /> FORGED
                        </span>
                      ) : (
                        <span className="rounded bg-black/40 px-2 py-0.5 font-mono text-[9px] uppercase text-white/60 border border-white/10">
                          {known ? 'UNFORGED' : 'SEALED'}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="mt-3 text-xs leading-relaxed text-white/70">
                      {known ? relic.description : relic.sourceLabel}
                    </p>

                    {/* Active In-Run Perk Highlight */}
                    {recipe ? (
                      <div className="mt-3 rounded border border-orange-500/25 bg-orange-500/5 p-2.5">
                        <p className="font-mono text-[9px] font-black uppercase tracking-wider text-orange-300 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Permanent Perk
                        </p>
                        <p className="mt-1 text-xs font-medium leading-relaxed text-orange-100">
                          {recipe.perkLabel}
                        </p>
                      </div>
                    ) : null}

                    {/* Materials Requirements */}
                    {recipe && !crafted ? (
                      <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
                        <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Forging Cost:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(recipe.materials).map(([matId, req]) => {
                            const current = materials[matId] ?? 0;
                            const hasEnough = current >= req;
                            const matDef = CRAFTING_MATERIALS.find((m) => m.id === matId);
                            return (
                              <span
                                key={matId}
                                className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] border ${
                                  hasEnough
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                                }`}
                              >
                                <span>{matDef?.icon}</span>
                                <span>{matDef?.name ?? matId}:</span>
                                <span className="font-bold">{current}/{req}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Action Button */}
                  <div className="mt-4 pt-3 border-t border-white/10">
                    {crafted ? (
                      <div className="flex items-center justify-between text-xs text-emerald-300 font-mono">
                        <span className="flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" /> Perk Active in All Runs
                        </span>
                        <span className="text-[10px] text-emerald-400/80">Permanent</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleForge(relic.id)}
                        disabled={!canCraft || isForging}
                        className={`w-full flex items-center justify-center gap-2 rounded px-3 py-2 font-mono text-xs font-black uppercase tracking-wider transition-all ${
                          canCraft
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-black hover:brightness-110 shadow-[0_0_12px_rgba(249,115,22,0.4)] active:scale-95'
                            : 'bg-white/5 text-muted-foreground border border-white/10 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {isForging ? (
                          <>
                            <Hammer className="h-4 w-4 animate-spin text-black" />
                            <span>Forging Shard...</span>
                          </>
                        ) : canCraft ? (
                          <>
                            <Hammer className="h-4 w-4" />
                            <span>Forge Relic Now</span>
                          </>
                        ) : !known ? (
                          <>
                            <LockKeyhole className="h-3.5 w-3.5" />
                            <span>Find in {relic.sourceAreaId}</span>
                          </>
                        ) : (
                          <span>Insufficient Materials</span>
                        )}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: KEY ITEMS & LIGHT SOURCES                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inventory' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-sky-400" /> Key Equipment & Light Source Tiers
            </h3>
            <p className="text-xs text-muted-foreground">
              Equipment carried in your permanent inventory that alters darkness visibility, vision radius, and hazard interactions.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {KEY_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <article
                  key={item.id}
                  className={`rounded-lg border p-4 flex flex-col justify-between ${
                    item.owned
                      ? 'border-sky-500/40 bg-sky-950/15 shadow-[0_0_12px_rgba(56,189,248,0.12)]'
                      : 'border-white/10 bg-card/25 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="grid h-10 w-10 shrink-0 place-items-center rounded border"
                          style={{ borderColor: item.color, backgroundColor: `${item.color}15` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: item.color }} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black uppercase text-white">{item.name}</h4>
                          <span
                            className="font-mono text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: item.color }}
                          >
                            {item.tier}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[9px] font-black uppercase ${
                          item.owned
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : 'bg-white/5 text-muted-foreground border border-white/10'
                        }`}
                      >
                        {item.owned ? 'IN INVENTORY' : 'LOCKED'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-white/70">
                      {item.description}
                    </p>

                    <div className="mt-3 rounded border border-sky-500/25 bg-sky-500/5 p-2.5">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-sky-300">
                        Active Passive Bonus
                      </p>
                      <p className="mt-0.5 text-xs text-sky-100">
                        {item.effectLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Source:</span>
                    <span className="text-white/80">
                      {item.id === 'mining-helmet'
                        ? 'Quartermaster or Underground Chasm'
                        : item.id === 'firefly-lantern'
                        ? 'Quartermaster or Firefly Wranglers'
                        : item.id === 'phosphor-crown'
                        ? 'Workshop Forge (Firefly Hollows)'
                        : item.id === 'bag-of-water'
                        ? 'Quartermaster Store'
                        : 'Starting Operative Kit'}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: CITY RECIPE BOARD                                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'recipes' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-orange-300" />
              <h3 className="text-sm font-black uppercase tracking-widest text-white">City In-Run Recipe Board</h3>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(['all', 'known'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setRecipeFilter(filter)}
                  aria-pressed={recipeFilter === filter}
                  className={`border px-3 py-1.5 font-mono text-[9px] uppercase ${
                    recipeFilter === filter
                      ? 'border-orange-300 bg-orange-300/10 text-orange-200'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {filter === 'all' ? 'All recipes' : `Craftable (${knownRecipeCount})`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 border border-orange-300/20 bg-orange-300/5 p-2 text-center font-mono text-[8px] uppercase tracking-wider text-orange-100/75">
            <span>1 · Find relic</span>
            <span>2 · Level weapon</span>
            <span>3 · Pick recipe</span>
          </div>

          <div className={`grid gap-3 ${isListView ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {visibleRecipes.map((recipe) => {
              const known = knownRelicIds.has(recipe.relicId);
              const relic = CITY_RELICS_BY_ID[recipe.relicId];
              return (
                <article
                  key={recipe.id}
                  className={`border p-4 rounded-lg ${
                    known ? 'border-orange-300/35 bg-orange-300/5' : 'border-border/50 bg-card/30'
                  }`}
                  data-testid={`card-recipe-${recipe.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: recipe.color }}>
                        {recipe.identity}
                      </p>
                      <h4 className="mt-1 text-base font-black uppercase text-white">{recipe.name}</h4>
                    </div>
                    {known ? (
                      <WeaponIcon
                        weaponId={recipe.result.id}
                        kind={recipe.result.kind}
                        color={recipe.color}
                        size={38}
                        label={recipe.result.name}
                        className="shrink-0"
                      />
                    ) : (
                      <LockKeyhole className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/75">
                    {known ? recipe.description : `Sealed: ${relic?.sourceLabel ?? 'Find the matching district relic.'}`}
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: MATERIAL ALMANAC                                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'materials' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-300" /> Crafting Materials Catalog
            </h3>
            <p className="text-xs text-muted-foreground">
              Elemental substrates harvested from deep caverns, defeated veteran incursions, and hidden caches.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {CRAFTING_MATERIALS.map((mat) => {
              const owned = materials[mat.id] ?? 0;
              return (
                <article
                  key={mat.id}
                  className="rounded-lg border border-white/10 bg-card/40 p-4 space-y-3"
                  style={{ borderLeftColor: mat.color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl" role="img" aria-label={mat.name}>{mat.icon}</span>
                      <div>
                        <h4 className="text-base font-black uppercase text-white">{mat.name}</h4>
                        <p className="font-mono text-xs font-bold" style={{ color: mat.color }}>
                          {owned} Stashed
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {mat.description}
                  </p>
                  <div className="rounded border border-white/10 bg-black/30 p-2 font-mono text-[10px] text-white/80">
                    <span className="text-orange-300 font-bold uppercase">Harvest Source: </span>
                    {mat.source}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function WorkshopPanel({ onBack }: { onBack: () => void }) {
  return (
    <ScreenLayout title="Relic Workshop & Forge" subtitle="Craft Relics & Inspect Key Gear" onBack={onBack}>
      <WorkshopOverview />
    </ScreenLayout>
  );
}

export default WorkshopPanel;
