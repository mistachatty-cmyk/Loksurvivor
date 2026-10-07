import { useState, useMemo } from 'react';
import {
  X,
  Layers,
  Flame,
  Shield,
  Swords,
  Zap,
  Sparkles,
  Trophy,
  Info,
  RefreshCw,
  BarChart3,
  Grid3X3,
  SlidersHorizontal,
  Crown,
  Check,
  Filter,
} from 'lucide-react';
import type { MetaState } from '@/game/types';
import {
  generateVariableMatrix,
  ELEMENT_METADATA,
  DATA_TYPE_METADATA,
  FIGHTING_STYLE_METADATA,
  type CardElement,
  type CardDataType,
  type CardFightingStyle,
  type CardVariableProfile,
} from '@/game/data/cardVariables';

interface CardMatrixChartModalProps {
  meta: MetaState;
  onClose: () => void;
  onFilterSelect?: (filter: {
    element?: CardElement;
    dataType?: CardDataType;
    style?: CardFightingStyle;
    rarity?: string;
    dualElementOnly?: boolean;
    multiVariableOnly?: boolean;
  }) => void;
}

export function CardMatrixChartModal({
  meta,
  onClose,
  onFilterSelect,
}: CardMatrixChartModalProps) {
  const [tab, setTab] = useState<'overview' | 'multi-variable' | 'cross-table' | 'synergy'>('multi-variable');
  const matrix = generateVariableMatrix(meta);

  // Multi-variable interactive sandbox filters
  const [selectedElements, setSelectedElements] = useState<Set<CardElement>>(new Set());
  const [selectedDataTypes, setSelectedDataTypes] = useState<Set<CardDataType>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<CardFightingStyle>>(new Set());
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [requireDualElement, setRequireDualElement] = useState(false);
  const [requireMultiVariable, setRequireMultiVariable] = useState(false);

  const completionPct = Math.round((matrix.totalCollected / Math.max(1, matrix.totalCards)) * 100);

  // Filtered profiles for multi-variable interactive sandbox
  const filteredMultiProfiles = useMemo(() => {
    return matrix.allProfiles.filter(({ profile }) => {
      if (requireDualElement && !profile.hasDualElement) return false;
      if (requireMultiVariable) {
        const isMulti = profile.hasDualElement || profile.hasDualStyle || profile.hasDualData || profile.specialPowers.length > 1;
        if (!isMulti) return false;
      }
      if (selectedElements.size > 0) {
        const matchPrimary = selectedElements.has(profile.element);
        const matchSecondary = profile.secondaryElement ? selectedElements.has(profile.secondaryElement) : false;
        if (!matchPrimary && !matchSecondary) return false;
      }
      if (selectedDataTypes.size > 0) {
        const matchPrimary = selectedDataTypes.has(profile.dataType);
        const matchSecondary = profile.secondaryDataType ? selectedDataTypes.has(profile.secondaryDataType) : false;
        if (!matchPrimary && !matchSecondary) return false;
      }
      if (selectedStyles.size > 0) {
        const matchPrimary = selectedStyles.has(profile.fightingStyle);
        const matchSecondary = profile.secondaryFightingStyle ? selectedStyles.has(profile.secondaryFightingStyle) : false;
        if (!matchPrimary && !matchSecondary) return false;
      }
      if (selectedRarities.size > 0 && !selectedRarities.has(profile.rarity)) {
        return false;
      }
      return true;
    });
  }, [
    matrix.allProfiles,
    selectedElements,
    selectedDataTypes,
    selectedStyles,
    selectedRarities,
    requireDualElement,
    requireMultiVariable,
  ]);

  const toggleElement = (elem: CardElement) => {
    const next = new Set(selectedElements);
    if (next.has(elem)) next.delete(elem);
    else next.add(elem);
    setSelectedElements(next);
  };

  const toggleDataType = (type: CardDataType) => {
    const next = new Set(selectedDataTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setSelectedDataTypes(next);
  };

  const toggleStyle = (style: CardFightingStyle) => {
    const next = new Set(selectedStyles);
    if (next.has(style)) next.delete(style);
    else next.add(style);
    setSelectedStyles(next);
  };

  const toggleRarity = (rarity: string) => {
    const next = new Set(selectedRarities);
    if (next.has(rarity)) next.delete(rarity);
    else next.add(rarity);
    setSelectedRarities(next);
  };

  const clearMultiFilters = () => {
    setSelectedElements(new Set());
    setSelectedDataTypes(new Set());
    setSelectedStyles(new Set());
    setSelectedRarities(new Set());
    setRequireDualElement(false);
    setRequireMultiVariable(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="LokDex Multi-Variable Matrix Chart"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden border border-white/20 bg-[#0a0a10] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[.02] p-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center border border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-200">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-black uppercase text-white sm:text-xl">
                LokDex Multi-Variable Matrix & Chart
              </h2>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                Multi-Element · Dual Data · Hybrid Styles · Special Powers · Rarities & Apex EX
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-xs">
              <span className="text-white/40">COLLECTION:</span>
              <span className="font-black text-amber-300">
                {matrix.totalCollected}/{matrix.totalCards} ({completionPct}%)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center border border-white/20 bg-black/50 text-white/70 hover:border-white/50 hover:text-white"
              aria-label="Close chart modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-black/30 p-2 sm:px-6">
          <button
            type="button"
            onClick={() => setTab('multi-variable')}
            className={`flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider transition-all ${
              tab === 'multi-variable'
                ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-amber-300" />
            Multi-Variable Hub (Dual / Multi Attributes)
          </button>
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider transition-all ${
              tab === 'overview'
                ? 'border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 text-fuchsia-200" />
            Single Variable Breakdown
          </button>
          <button
            type="button"
            onClick={() => setTab('cross-table')}
            className={`flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider transition-all ${
              tab === 'cross-table'
                ? 'border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Elements × Styles Matrix
          </button>
          <button
            type="button"
            onClick={() => setTab('synergy')}
            className={`flex items-center gap-2 border px-3.5 py-1.5 font-mono text-[10px] font-black uppercase tracking-wider transition-all ${
              tab === 'synergy'
                ? 'border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100'
                : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Synergy & Matchup Wheel
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* TAB: MULTI-VARIABLE HUB (Can have more than one variable) */}
          {tab === 'multi-variable' && (
            <div className="space-y-6">
              {/* Introduction Banner */}
              <div className="border border-amber-300/30 bg-amber-400/[.03] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase text-amber-200">
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      Multi-Variable Classification System
                    </h3>
                    <p className="mt-1 text-[10px] text-white/70">
                      Many advanced cards and apex bodies contain <strong>more than one</strong> variable (e.g. Dual Elements like Fire/Volt, Hybrid Fighting Styles like Striker/Speedster, Dual Data Affinities, and multiple Special Powers). Use the multi-variable selector below to query overlapping combinations!
                    </p>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] uppercase">
                    <span className="border border-amber-300/40 bg-black/40 px-2 py-1 text-amber-300">
                      Multi-Variable Cards: {matrix.multiVariableBreakdown.hasAnyMultiVariable.count}/{matrix.multiVariableBreakdown.hasAnyMultiVariable.total}
                    </span>
                  </div>
                </div>

                {/* Multi-variable Metric Tiles */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 font-mono text-[9px] uppercase">
                  <div className="border border-white/10 bg-black/40 p-2.5">
                    <span className="text-white/40 block">Dual Elements</span>
                    <span className="mt-1 block font-black text-rose-300 text-sm">
                      {matrix.multiVariableBreakdown.dualElements.count}/{matrix.multiVariableBreakdown.dualElements.total}
                    </span>
                    <span className="text-[7.5px] text-white/50">2 Elements per card</span>
                  </div>

                  <div className="border border-white/10 bg-black/40 p-2.5">
                    <span className="text-white/40 block">Hybrid Styles</span>
                    <span className="mt-1 block font-black text-amber-300 text-sm">
                      {matrix.multiVariableBreakdown.dualStyles.count}/{matrix.multiVariableBreakdown.dualStyles.total}
                    </span>
                    <span className="text-[7.5px] text-white/50">2 Fighting styles</span>
                  </div>

                  <div className="border border-white/10 bg-black/40 p-2.5">
                    <span className="text-white/40 block">Dual Data Types</span>
                    <span className="mt-1 block font-black text-cyan-300 text-sm">
                      {matrix.multiVariableBreakdown.dualData.count}/{matrix.multiVariableBreakdown.dualData.total}
                    </span>
                    <span className="text-[7.5px] text-white/50">2 Data protocols</span>
                  </div>

                  <div className="border border-white/10 bg-black/40 p-2.5">
                    <span className="text-white/40 block">Multi Powers</span>
                    <span className="mt-1 block font-black text-purple-300 text-sm">
                      {matrix.multiVariableBreakdown.multiPowers.count}/{matrix.multiVariableBreakdown.multiPowers.total}
                    </span>
                    <span className="text-[7.5px] text-white/50">Ability + Burst proc</span>
                  </div>

                  <div className="border border-white/10 bg-black/40 p-2.5">
                    <span className="text-white/40 block">1st Edition Gold</span>
                    <span className="mt-1 block font-black text-yellow-300 text-sm">
                      {matrix.multiVariableBreakdown.firstEdition.count}/{matrix.multiVariableBreakdown.firstEdition.total}
                    </span>
                    <span className="text-[7.5px] text-white/50">Collector Foil Stamp</span>
                  </div>
                </div>
              </div>

              {/* Interactive Multi-Select Chart & Filter Sandbox */}
              <div className="border border-white/15 bg-white/[.02] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="flex items-center gap-2 font-display text-xs font-black uppercase text-white">
                      <Filter className="h-4 w-4 text-fuchsia-300" />
                      Multi-Selection Matrix Sandbox (Select Multiple Variables)
                    </h4>
                    <p className="mt-0.5 text-[9px] text-white/50">
                      Pick any number of elements, data types, fighting styles, and rarities to see the matching pool
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRequireDualElement(!requireDualElement)}
                      className={`border px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-wider transition-all ${
                        requireDualElement
                          ? 'border-rose-400 bg-rose-400/20 text-rose-200'
                          : 'border-white/15 text-white/50 hover:border-white/30'
                      }`}
                    >
                      Dual Elements Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequireMultiVariable(!requireMultiVariable)}
                      className={`border px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-wider transition-all ${
                        requireMultiVariable
                          ? 'border-amber-400 bg-amber-400/20 text-amber-200'
                          : 'border-white/15 text-white/50 hover:border-white/30'
                      }`}
                    >
                      Any Multi-Variable Only
                    </button>
                    {(selectedElements.size > 0 ||
                      selectedDataTypes.size > 0 ||
                      selectedStyles.size > 0 ||
                      selectedRarities.size > 0 ||
                      requireDualElement ||
                      requireMultiVariable) && (
                      <button
                        type="button"
                        onClick={clearMultiFilters}
                        className="border border-rose-500/40 bg-rose-500/10 px-2 py-1 font-mono text-[8px] font-black uppercase text-rose-200"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* 1. Elements Multi-Chips */}
                <div className="mt-3">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1.5">
                    Elements (Can select multiple):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ELEMENT_METADATA).map(([key, data]) => {
                      const active = selectedElements.has(key as CardElement);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleElement(key as CardElement)}
                          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[8.5px] uppercase transition-all ${
                            active
                              ? 'border-white text-black font-black'
                              : 'border-white/15 text-white/70 hover:border-white/40'
                          }`}
                          style={{ backgroundColor: active ? data.color : 'transparent' }}
                        >
                          <span>{data.icon}</span>
                          <span>{data.label.split(' ')[0]}</span>
                          {active && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Data Types Multi-Chips */}
                <div className="mt-3">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1.5">
                    Data Protocols (Can select multiple):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(DATA_TYPE_METADATA).map(([key, data]) => {
                      const active = selectedDataTypes.has(key as CardDataType);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleDataType(key as CardDataType)}
                          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[8.5px] uppercase transition-all ${
                            active
                              ? 'border-white text-black font-black'
                              : 'border-white/15 text-white/70 hover:border-white/40'
                          }`}
                          style={{ backgroundColor: active ? data.color : 'transparent' }}
                        >
                          <span>{data.badge}</span>
                          <span>{data.label}</span>
                          {active && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Fighting Styles Multi-Chips */}
                <div className="mt-3">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1.5">
                    Fighting Styles (Can select multiple):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(FIGHTING_STYLE_METADATA).map(([key, data]) => {
                      const active = selectedStyles.has(key as CardFightingStyle);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleStyle(key as CardFightingStyle)}
                          className={`flex items-center gap-1 border px-2 py-1 font-mono text-[8.5px] uppercase transition-all ${
                            active
                              ? 'border-emerald-300 bg-emerald-400 text-black font-black'
                              : 'border-white/15 text-white/70 hover:border-white/40'
                          }`}
                        >
                          <span>{data.icon}</span>
                          <span>{data.label}</span>
                          {active && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Rarities Multi-Chips */}
                <div className="mt-3">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1.5">
                    Rarities & Apex EX (Can select multiple):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].map((rarityKey) => {
                      const active = selectedRarities.has(rarityKey);
                      return (
                        <button
                          key={rarityKey}
                          type="button"
                          onClick={() => toggleRarity(rarityKey)}
                          className={`flex items-center gap-1 border px-2.5 py-1 font-mono text-[8.5px] uppercase transition-all ${
                            active
                              ? 'border-amber-300 bg-amber-400 text-black font-black'
                              : 'border-white/15 text-white/70 hover:border-white/40'
                          }`}
                        >
                          <span>{rarityKey}</span>
                          {active && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Matching Cards Pool Header & Results */}
                <div className="mt-5 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-amber-200">
                      Matching Cards ({filteredMultiProfiles.length} cards ·{' '}
                      {filteredMultiProfiles.filter((p) => p.owned).length} collected)
                    </span>
                    <span className="font-mono text-[8px] text-white/40 uppercase">
                      Click any card to inspect in collection
                    </span>
                  </div>

                  <div className="mt-3 max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {filteredMultiProfiles.map(({ card, profile, owned }) => {
                      const secondaryElem = profile.secondaryElement
                        ? ELEMENT_METADATA[profile.secondaryElement]
                        : null;
                      return (
                        <div
                          key={card.id}
                          className="flex items-center justify-between border border-white/10 bg-black/40 p-2 font-mono text-[8.5px] hover:border-white/30"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Primary + Secondary Element Tags */}
                            <div className="flex items-center gap-1">
                              <span
                                className="rounded px-1.5 py-0.5 font-black text-black text-[7.5px]"
                                style={{ backgroundColor: profile.elementColor }}
                              >
                                {profile.elementLabel.split(' ')[0]}
                              </span>
                              {secondaryElem && (
                                <span
                                  className="rounded px-1.5 py-0.5 font-black text-black text-[7.5px]"
                                  style={{ backgroundColor: secondaryElem.color }}
                                >
                                  {secondaryElem.label.split(' ')[0]}
                                </span>
                              )}
                            </div>

                            <span className="truncate font-bold text-white uppercase text-[9.5px]">
                              {owned ? card.name : 'Unknown Card'}
                            </span>

                            <span className="text-[7.5px] text-white/40 uppercase">
                              [{profile.bodySilhouette}]
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="rounded bg-white/10 px-1 py-0.5 text-[7px] uppercase font-bold text-amber-200">
                              {profile.evolutionStage}
                            </span>
                            <span className="text-[7.5px] text-emerald-300 uppercase">
                              {profile.fightingStyleLabel}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 font-bold uppercase text-[7px] ${
                                owned ? 'text-emerald-300 bg-emerald-500/10' : 'text-white/30'
                              }`}
                            >
                              {owned ? 'COLLECTED' : 'SEALED'}
                            </span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredMultiProfiles.length === 0 && (
                      <p className="py-6 text-center font-mono text-[9px] uppercase tracking-wider text-white/40">
                        No cards match the selected combination of multiple variables.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SINGLE VARIABLE BREAKDOWN */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {/* 1. Elements Section */}
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase text-white">
                    <Flame className="h-4 w-4 text-rose-400" />
                    Digital Elements (10 Affinities)
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                    Click any element to filter binder
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {(Object.entries(matrix.byElement) as [CardElement, (typeof matrix.byElement)[CardElement]][]).map(
                    ([elemKey, data]) => {
                      const metaInfo = ELEMENT_METADATA[elemKey];
                      const pct = Math.round((data.count / Math.max(1, data.total)) * 100);
                      return (
                        <button
                          key={elemKey}
                          type="button"
                          onClick={() => {
                            onFilterSelect?.({ element: elemKey });
                            onClose();
                          }}
                          className="flex flex-col border border-white/10 bg-white/[.02] p-2.5 text-left transition-all hover:border-white/40 hover:bg-white/[.05] active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                              <span style={{ color: metaInfo.color }}>{metaInfo.icon}</span>
                              {metaInfo.label.split(' ')[0]}
                            </span>
                            <span className="font-mono text-[9px] font-black text-amber-200">
                              {data.count}/{data.total}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: metaInfo.color,
                              }}
                            />
                          </div>
                          <span className="mt-1 font-mono text-[8px] uppercase tracking-widest text-white/40">
                            {pct}% collected
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>

              {/* 2. Data Types Section */}
              <section className="border-t border-white/10 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase text-white">
                    <Zap className="h-4 w-4 text-cyan-400" />
                    Data Types & System Protocols
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                    Vaccine · Virus · Data · Cyber · Quantum
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {(Object.entries(matrix.byDataType) as [CardDataType, (typeof matrix.byDataType)[CardDataType]][]).map(
                    ([typeKey, data]) => {
                      const typeMeta = DATA_TYPE_METADATA[typeKey];
                      const pct = Math.round((data.count / Math.max(1, data.total)) * 100);
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          onClick={() => {
                            onFilterSelect?.({ dataType: typeKey });
                            onClose();
                          }}
                          className="flex flex-col border border-white/10 bg-white/[.02] p-2.5 text-left transition-all hover:border-white/40 hover:bg-white/[.05] active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="rounded px-1.5 py-0.5 font-mono text-[8px] font-black text-black"
                              style={{ backgroundColor: typeMeta.color }}
                            >
                              {typeMeta.badge}
                            </span>
                            <span className="font-mono text-[9px] font-black text-amber-200">
                              {data.count}/{data.total}
                            </span>
                          </div>
                          <span className="mt-2 font-display text-xs font-bold text-white uppercase">
                            {typeMeta.label}
                          </span>
                          <span className="text-[8px] text-white/50">{typeMeta.advantage}</span>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full" style={{ width: `${pct}%`, backgroundColor: typeMeta.color }} />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>

              {/* 3. Fighting Styles Section */}
              <section className="border-t border-white/10 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-sm font-black uppercase text-white">
                    <Swords className="h-4 w-4 text-amber-400" />
                    Fighting Styles & Tactical Roles
                  </h3>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/40">
                    Striker · Blaster · Bastion · Trickster · Speedster · Weaver
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {(Object.entries(matrix.byFightingStyle) as [CardFightingStyle, (typeof matrix.byFightingStyle)[CardFightingStyle]][]).map(
                    ([styleKey, data]) => {
                      const styleMeta = FIGHTING_STYLE_METADATA[styleKey];
                      const pct = Math.round((data.count / Math.max(1, data.total)) * 100);
                      return (
                        <button
                          key={styleKey}
                          type="button"
                          onClick={() => {
                            onFilterSelect?.({ style: styleKey });
                            onClose();
                          }}
                          className="flex flex-col border border-white/10 bg-white/[.02] p-3 text-left transition-all hover:border-white/40 hover:bg-white/[.05] active:scale-[0.98]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-display text-xs font-black uppercase text-white">
                              <span>{styleMeta.icon}</span>
                              {styleMeta.label}
                            </span>
                            <span className="font-mono text-[9px] font-black text-amber-200">
                              {data.count}/{data.total}
                            </span>
                          </div>
                          <span className="mt-1 text-[8.5px] font-mono text-emerald-300">{styleMeta.perk}</span>
                          <span className="mt-0.5 text-[8px] text-white/40">{styleMeta.statFocus}</span>
                          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </section>

              {/* 4. Evolution Stages & Apex Tiers */}
              <section className="border-t border-white/10 pt-5">
                <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-black uppercase text-white">
                  <Crown className="h-4 w-4 text-amber-300" />
                  Evolution Stages & Apex Tiers
                </h3>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {Object.entries(matrix.byEvolutionStage).map(([stageKey, data]) => (
                    <div key={stageKey} className="border border-white/10 bg-white/[.02] p-2.5 text-center">
                      <span className="block font-mono text-[8px] font-black uppercase tracking-wider text-amber-200">
                        {stageKey}
                      </span>
                      <span className="mt-1 block font-display text-lg font-black text-white">
                        {data.count}/{data.total}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 5. Rarities Section */}
              <section className="border-t border-white/10 pt-5">
                <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-black uppercase text-white">
                  <Trophy className="h-4 w-4 text-yellow-300" />
                  Rarity & Foil Distribution
                </h3>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  {Object.entries(matrix.byRarity).map(([rarityKey, data]) => (
                    <button
                      key={rarityKey}
                      type="button"
                      onClick={() => {
                        onFilterSelect?.({ rarity: rarityKey });
                        onClose();
                      }}
                      className="border border-white/10 bg-white/[.02] p-2 text-center transition-all hover:border-white/40 hover:bg-white/[.05]"
                    >
                      <span className="block font-mono text-[8px] font-black uppercase tracking-wider text-white/50">
                        {rarityKey}
                      </span>
                      <span className="mt-1 block font-display text-lg font-black text-amber-200">
                        {data.count}/{data.total}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB: CROSS-TABLE */}
          {tab === 'cross-table' && (
            <div>
              <div className="mb-4">
                <h3 className="font-display text-base font-black uppercase text-white">
                  2D Cross-Classification: Elements × Fighting Styles
                </h3>
                <p className="mt-1 text-[10px] text-white/50">
                  Every card possesses both an Element and a Fighting Style. Click any cell to inspect or filter matching cards.
                </p>
              </div>

              <div className="overflow-x-auto border border-white/15 bg-black/40">
                <table className="w-full text-left font-mono text-[9px]">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/[.03]">
                      <th className="p-2.5 font-black uppercase text-white">Element</th>
                      {Object.keys(matrix.byFightingStyle).map((style) => (
                        <th key={style} className="p-2.5 text-center font-black uppercase text-white/70">
                          {style}
                        </th>
                      ))}
                      <th className="p-2.5 text-center font-black uppercase text-amber-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(matrix.byElement) as CardElement[]).map((elem) => {
                      const row = matrix.elementByStyleGrid[elem] || {};
                      const rowTotal = Object.values(row).reduce((a, b) => a + b, 0);
                      const elemMeta = ELEMENT_METADATA[elem];
                      return (
                        <tr key={elem} className="border-b border-white/5 hover:bg-white/[.02]">
                          <td className="p-2.5 font-bold flex items-center gap-1.5" style={{ color: elemMeta.color }}>
                            <span>{elemMeta.icon}</span>
                            {elemMeta.label.split(' ')[0]}
                          </td>
                          {Object.keys(matrix.byFightingStyle).map((style) => {
                            const val = row[style] || 0;
                            return (
                              <td
                                key={style}
                                className={`p-2.5 text-center font-bold ${
                                  val > 0 ? 'text-emerald-300 bg-emerald-500/[.07]' : 'text-white/20'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                          <td className="p-2.5 text-center font-black text-amber-200">{rowTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: SYNERGY & MATCHUP WHEEL */}
          {tab === 'synergy' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-base font-black uppercase text-white">
                  Tactical Advantage & Deck Synergies
                </h3>
                <p className="mt-1 text-[10px] text-white/50">
                  Combine complementary variables in your Battle and Passive Lock Decks to trigger active synergy bonuses!
                </p>
              </div>

              {/* Data Type Triangle */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-white/10 bg-white/[.02] p-4">
                  <h4 className="flex items-center gap-2 font-display text-xs font-black uppercase text-cyan-300">
                    <Zap className="h-4 w-4" />
                    Data Type Combat Cycle (1.25×)
                  </h4>
                  <p className="mt-2 text-[10px] text-white/60 leading-relaxed">
                    Like the classic Digimon triangle: <br />
                    • <strong className="text-sky-300">Vaccine</strong> purifies and counters{' '}
                    <strong className="text-rose-400">Virus</strong> (+25% DMG).<br />
                    • <strong className="text-rose-400">Virus</strong> infects and corrupts{' '}
                    <strong className="text-emerald-400">Data</strong> (+25% DMG).<br />
                    • <strong className="text-emerald-400">Data</strong> stabilizes and overpowers{' '}
                    <strong className="text-sky-300">Vaccine</strong> (+25% DMG).<br />
                    • <strong className="text-amber-400">Cyber</strong> provides high physical armor against all attacks.<br />
                    • <strong className="text-purple-400">Quantum</strong> attacks phase directly through shields!
                  </p>
                </div>

                <div className="border border-white/10 bg-white/[.02] p-4">
                  <h4 className="flex items-center gap-2 font-display text-xs font-black uppercase text-rose-300">
                    <Flame className="h-4 w-4" />
                    Elemental Rock-Paper-Scissors (1.75×)
                  </h4>
                  <p className="mt-2 text-[10px] text-white/60 leading-relaxed">
                    • <strong className="text-red-400">Fire</strong> melts Freeze & crushes Terra.<br />
                    • <strong className="text-sky-400">Freeze</strong> chills Slow & freezes Aero.<br />
                    • <strong className="text-purple-400">Slow</strong> dilutes Fire & dampens Volt.<br />
                    • <strong className="text-yellow-400">Volt</strong> short-circuits Freeze & grounds Aero.<br />
                    • <strong className="text-fuchsia-400">Glitch</strong> corrupts Volt & blinds Light.<br />
                    • <strong className="text-amber-500">Terra</strong> grounds Volt & Glitch servers.<br />
                    • <strong className="text-teal-400">Aero</strong> weathers Terra stone & disperses Slow.<br />
                    • <strong className="text-yellow-200">Light</strong> purifies Glitch errors & cleanses Dark.<br />
                    • <strong className="text-indigo-400">Dark</strong> swallows Light photons & raw kinetic energy.
                  </p>
                </div>
              </div>

              {/* Deck Synergy Perks Guide */}
              <div className="border border-white/10 bg-white/[.02] p-4">
                <h4 className="font-display text-xs font-black uppercase text-amber-300">
                  Active Deck Synergy Perks
                </h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-[9px] font-mono">
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Elemental Harmonizer</span>
                    <p className="mt-1 text-white/50">3+ distinct elements equipped: +18% elemental status effect chance.</p>
                  </div>
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Striker Vanguard</span>
                    <p className="mt-1 text-white/50">2+ Strikers in deck: +20% Critical Burst Damage on all attacks.</p>
                  </div>
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Aegis Firewall</span>
                    <p className="mt-1 text-white/50">1+ Bastion unit in deck: +25% permanent damage mitigation shield.</p>
                  </div>
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Tachyon Overdrive</span>
                    <p className="mt-1 text-white/50">2+ Speedsters in deck: +30% faster ability cooldown recovery.</p>
                  </div>
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Quantum Entangled</span>
                    <p className="mt-1 text-white/50">Quantum card equipped: card throws and companion hits bypass shields.</p>
                  </div>
                  <div className="border border-white/10 p-2.5">
                    <span className="font-black text-white">Apex Presence</span>
                    <p className="mt-1 text-white/50">Apex or Mythic card in deck: boosts all operative and companion stats +10%.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default CardMatrixChartModal;
