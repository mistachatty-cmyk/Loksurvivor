import { FIRST_NIGHT_CHAPTERS, recommendedFirstNightChapter } from '@/game/data/firstNight';
import { getArea } from '@/game/data/areas';
import { useMeta } from '@/game/state/metaStore';
import { CheckCircle2, ChevronRight, Compass, Lock, Radio, ShieldAlert } from 'lucide-react';

export interface FirstNightBoardProps {
  compact?: boolean;
}

export function FirstNightBoard({ compact = false }: FirstNightBoardProps) {
  const { meta, unlockedAreas } = useMeta();
  const unlockedIds = unlockedAreas.map((area) => area.id);
  const recommended = recommendedFirstNightChapter(meta.clearedAreaIds, unlockedIds);
  const sireConfirmed = meta.discoveryIds.includes('sire-ledger') || meta.clearedAreaIds.includes('bar-siege');
  const completedCount = FIRST_NIGHT_CHAPTERS.filter((chapter) => meta.clearedAreaIds.includes(chapter.areaId)).length;

  return (
    <section
      className={`border border-cyan-300/25 bg-cyan-950/10 ${compact ? 'p-4' : 'p-5 sm:p-6'}`}
      data-testid="section-first-night-board"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-cyan-200">
            <Compass className="h-4 w-4" aria-hidden="true" />
            <p className="text-xs font-bold uppercase tracking-[0.25em]">First Night case board</p>
          </div>
          <h2 className="mt-1 text-xl font-black uppercase text-white sm:text-2xl">Follow the city thread</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Rescues and landmarks are connected. Clear any district you like, but the highlighted lead keeps the opening story moving.
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs uppercase tracking-widest text-cyan-100/70">
          {completedCount}/{FIRST_NIGHT_CHAPTERS.length} leads pinned
        </span>
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? '' : 'lg:grid-cols-[1.1fr_1fr]'}`}>
        <div className="border border-cyan-300/20 bg-black/25 p-3" data-testid="first-night-thread">
          <div className="flex items-center gap-2">
            {sireConfirmed ? (
              <ShieldAlert className="h-4 w-4 text-red-300" aria-hidden="true" />
            ) : (
              <Radio className="h-4 w-4 text-cyan-200" aria-hidden="true" />
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100/80">
              {sireConfirmed ? 'Influence confirmed' : 'Signal still forming'}
            </p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-white">
            {recommended?.thread ?? 'The opening case is complete. The board has a name, but not an answer.'}
          </p>
          {sireConfirmed && (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-red-200/75">
              {recommended?.sireSignal ?? 'The Sire’s routes are now part of the case.'}
            </p>
          )}
        </div>

        <div
          className="border border-primary/40 bg-primary/10 p-3"
          data-testid="first-night-recommendation"
        >
          {recommended ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Recommended next lead</p>
                <ChevronRight className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-1 text-lg font-black uppercase text-white">{recommended.label}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/80">
                Chapter {recommended.chapter} · {recommended.worldVerb}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/75">{recommended.goal}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Opening case pinned</p>
              <p className="mt-1 text-lg font-black uppercase text-white">Choose your next block</p>
              <p className="mt-2 text-xs leading-relaxed text-white/75">Every cleared area remains available for replay and contracts.</p>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {FIRST_NIGHT_CHAPTERS.slice(0, 5).map((chapter) => {
            const cleared = meta.clearedAreaIds.includes(chapter.areaId);
            const unlocked = unlockedIds.includes(chapter.areaId);
            const isNext = recommended?.areaId === chapter.areaId;
            const area = getArea(chapter.areaId);
            const landmarkPinned = Boolean(area.discoveryId && meta.discoveryIds.includes(area.discoveryId));
            return (
              <div
                key={chapter.areaId}
                className={`border p-2.5 ${cleared ? 'border-primary/35 bg-primary/5' : isNext ? 'border-cyan-200/60 bg-cyan-200/10' : unlocked ? 'border-border bg-black/20' : 'border-border/50 bg-black/10 opacity-60'}`}
                data-testid={`first-night-thread-${chapter.areaId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/50">0{chapter.chapter}</span>
                  {cleared ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-label="Cleared" /> : unlocked ? <ChevronRight className="h-3.5 w-3.5 text-cyan-200" aria-label="Available" /> : <Lock className="h-3.5 w-3.5 text-white/40" aria-label="Locked" />}
                </div>
                <p className="mt-2 text-xs font-bold uppercase leading-tight text-white">{chapter.label}</p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-cyan-100/60">{chapter.worldVerb}</p>
                {area.landmark ? (
                  <p className={`mt-2 truncate text-[9px] uppercase tracking-widest ${landmarkPinned ? 'text-primary' : 'text-white/40'}`}>
                    {landmarkPinned ? 'Pinned · ' : 'Lead · '}{area.landmark.name}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default FirstNightBoard;