import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, Sparkles, BookOpen, Bug, Flame, Cpu, Compass } from 'lucide-react';
import { LORE_CHRONICLES, type LoreEntry } from '@/game/data/lore';
import { prefersReducedMotion as prefersReducedMotionNow } from '@/anim/motion';

export interface LorePopupProps {
  onClose: () => void;
  initialChapterId?: string;
}

export function LorePopup({ onClose, initialChapterId }: LorePopupProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'origins' | 'digiverse' | 'data-pets' | 'mines'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(initialChapterId ?? null);

  const filteredEntries = LORE_CHRONICLES.filter((entry) => {
    if (selectedFilter === 'origins') return entry.id.includes('origin') || entry.id.includes('siphon') || entry.id.includes('invasion');
    if (selectedFilter === 'digiverse') return entry.id.includes('eclipse') || entry.id.includes('lock-decks') || entry.id.includes('luvitnot');
    if (selectedFilter === 'data-pets') return entry.id.includes('data-pets') || entry.id.includes('rancher') || entry.id.includes('russel') || entry.id.includes('frogster');
    if (selectedFilter === 'mines') return entry.id.includes('mines');
    return true;
  });

  const prefersReducedMotion = prefersReducedMotionNow();

  return (
    <div
      className="fixed inset-0 z-[160] grid place-items-center overflow-y-auto bg-black/90 p-4 py-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Mission Briefing & Digi-Verse Lore"
      data-testid="section-lore-popup"
    >
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative w-full max-w-xl border-2 border-red-500/70 bg-gradient-to-b from-red-950/80 via-[#100305] to-black p-5 sm:p-6 shadow-[0_0_60px_rgba(239,68,68,0.3)] text-left"
      >
        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 grid h-9 w-9 place-items-center border border-red-500/40 bg-black/80 text-red-200 transition-all active:scale-[0.97] hover:border-red-400 hover:text-white"
          aria-label="Dismiss intel dossier"
          data-testid="button-close-lore-modal"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header (Setup identical to UpdatePopup with red mission briefing theme) */}
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center border border-red-500/60 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <ShieldAlert className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-red-400">
              ARCHON-616 // DECLASSIFIED DOSSIER
            </p>
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              THE DIGI-VERSE ARCHIVES
            </h2>
          </div>
        </div>

        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-red-300/75">
          Cycle 616.9 · Declassified Dossier #{LORE_CHRONICLES.length} · Non-Organic Synthetic Reality
        </p>

        {/* Filter Pills */}
        <div className="mt-3.5 flex flex-wrap gap-1.5 border-y border-red-500/25 py-2.5">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
              selectedFilter === 'all'
                ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-red-500/30 bg-black/40 text-red-400/70 hover:border-red-400/60 hover:text-red-200'
            }`}
          >
            All Chapters ({LORE_CHRONICLES.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('origins')}
            className={`flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
              selectedFilter === 'origins'
                ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-red-500/30 bg-black/40 text-red-400/70 hover:border-red-400/60 hover:text-red-200'
            }`}
          >
            <Cpu className="h-2.5 w-2.5" /> AI Trap
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('digiverse')}
            className={`flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
              selectedFilter === 'digiverse'
                ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-red-500/30 bg-black/40 text-red-400/70 hover:border-red-400/60 hover:text-red-200'
            }`}
          >
            <Flame className="h-2.5 w-2.5" /> The Eclipse
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('data-pets')}
            className={`flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
              selectedFilter === 'data-pets'
                ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-red-500/30 bg-black/40 text-red-400/70 hover:border-red-400/60 hover:text-red-200'
            }`}
          >
            <Bug className="h-2.5 w-2.5" /> Data Pets & Ranch
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('mines')}
            className={`flex items-center gap-1 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider transition-colors ${
              selectedFilter === 'mines'
                ? 'border-red-400 bg-red-500/25 text-red-100 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'border-red-500/30 bg-black/40 text-red-400/70 hover:border-red-400/60 hover:text-red-200'
            }`}
          >
            <Compass className="h-2.5 w-2.5" /> Deep-Mines
          </button>
        </div>

        {/* Scrollable Entry Cards */}
        <div className="mt-3.5 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.id || filteredEntries.length === 1;

            return (
              <div
                key={entry.id}
                className="border border-red-500/35 bg-red-950/20 p-3.5 transition-colors hover:border-red-500/60"
                data-testid={`lore-entry-${entry.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/20 pb-2">
                  <span className="inline-flex items-center gap-1 border border-red-500/60 bg-red-500/15 px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest text-red-300">
                    <ShieldAlert className="h-2.5 w-2.5" />
                    Chapter {entry.chapterNumber} // {entry.classifiedLevel} // {entry.codename}
                  </span>
                  <span className="font-mono text-[9px] text-red-300/60">{entry.timestamp}</span>
                </div>

                <h3 className="mt-2 text-sm font-black uppercase tracking-wide text-white">
                  {entry.title}
                </h3>
                <p className="font-mono text-[9px] uppercase tracking-wider text-red-400/80">
                  {entry.subtitle}
                </p>

                <p className="mt-1.5 text-xs leading-relaxed text-red-100/90 font-sans">
                  {entry.summary}
                </p>

                {/* Collapsible/Expandable full intel */}
                <div className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-zinc-300 font-sans border-t border-red-500/15 pt-2">
                  {entry.content.map((paragraph, idx) => (
                    <p key={idx} className="text-zinc-300/90 leading-relaxed">{paragraph}</p>
                  ))}
                </div>

                {entry.keyIntel && entry.keyIntel.length > 0 && (
                  <div className="mt-3 border-t border-red-500/20 bg-red-950/30 p-2.5">
                    <p className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest text-red-300">
                      <Sparkles className="h-3 w-3 text-red-400" />
                      Tactical Resistance Directives:
                    </p>
                    <ul className="mt-1 space-y-1 pl-3 list-disc text-[11px] text-red-200/90 font-sans">
                      {entry.keyIntel.map((intel, idx) => (
                        <li key={idx}>{intel}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Acknowledge Button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border border-red-500/80 bg-red-600/25 py-3 text-sm font-black uppercase tracking-widest text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.25)] transition-all hover:bg-red-600/40 hover:border-red-400 active:scale-[0.99]"
          data-testid="button-acknowledge-lore"
        >
          Acknowledge Intel & Resist
        </button>
      </motion.div>
    </div>
  );
}

export default LorePopup;
