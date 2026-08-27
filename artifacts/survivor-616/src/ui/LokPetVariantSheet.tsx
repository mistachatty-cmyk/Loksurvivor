import { LOKPET_VARIANTS } from '@/game/data/lokPets';
import type { LokPetPalette, LokPetSilhouette } from '@/game/types';

export const LOKPET_SHAPE_CLIPS: Record<LokPetSilhouette, string> = {
  pouncer: 'polygon(12% 30%, 28% 38%, 34% 8%, 48% 25%, 52% 25%, 66% 8%, 72% 38%, 88% 30%, 92% 68%, 76% 88%, 24% 88%, 8% 68%)',
  skull: 'polygon(18% 22%, 82% 22%, 92% 52%, 76% 86%, 24% 86%, 8% 52%)',
  winglet: 'polygon(50% 28%, 8% 8%, 22% 72%, 50% 58%, 78% 72%, 92% 8%)',
  spark: 'polygon(50% 0%, 64% 31%, 100% 50%, 64% 69%, 50% 100%, 36% 69%, 0% 50%, 36% 31%)',
  jelly: 'polygon(10% 78%, 14% 38%, 28% 18%, 50% 12%, 72% 18%, 86% 38%, 90% 78%)',
  clockwork: 'polygon(22% 6%, 78% 6%, 94% 22%, 94% 78%, 78% 94%, 22% 94%, 6% 78%, 6% 22%)',
};

export function LokPetIcon({
  silhouette,
  palette,
  className = 'h-9 w-9',
}: {
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 border ${className}`}
      style={{
        backgroundColor: palette.body,
        borderColor: palette.accent,
        clipPath: LOKPET_SHAPE_CLIPS[silhouette],
        boxShadow: `0 0 12px ${palette.glow}66`,
      }}
      aria-hidden="true"
    />
  );
}

export function LokPetVariantSheet() {
  return (
    <section className="mb-5 border border-pink-400/30 bg-card/70 p-3 sm:p-4" data-testid="lokpet-variant-sheet">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <span className="text-lg text-pink-300">✦</span>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">LokPet signal sheet</h2>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-pink-300">original temporary companions</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">12 variants · 6 silhouettes</span>
      </div>
      <p className="mb-3 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
        Every blue box can generate a different little ally. The silhouette and palette are rolled separately from its combat trait, so a bat might freeze, a ghoul might burn, or a jelly might fire rapidly.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {LOKPET_VARIANTS.map((variant) => (
          <div key={variant.id} className="flex min-w-0 items-center gap-2 border border-white/10 bg-black/35 p-2">
            <LokPetIcon silhouette={variant.silhouette} palette={variant.palette} />
            <div className="min-w-0">
              <p className="truncate text-[10px] font-black uppercase tracking-wide text-white">{variant.name}</p>
              <p className="truncate text-[9px] uppercase tracking-wider" style={{ color: variant.palette.accent }}>{variant.family} · {variant.silhouette}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default LokPetVariantSheet;