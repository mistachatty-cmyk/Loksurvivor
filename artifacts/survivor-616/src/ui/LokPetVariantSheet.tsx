import { LOKPET_VARIANTS, lokPetRig, lokPetSpritePalette } from '@/game/data/lokPets';
import type { LokPetPalette, LokPetSilhouette } from '@/game/types';
import { RigPortrait } from './RigPortrait';

export function LokPetIcon({
  silhouette,
  palette,
  size = 36,
  className = '',
}: {
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`shrink-0 border ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: palette.accent,
        boxShadow: `0 0 12px ${palette.glow}66`,
      }}
      aria-hidden="true"
    >
      <RigPortrait rig={lokPetRig(silhouette)} palette={lokPetSpritePalette(palette)} anim="idle" size={size} />
    </div>
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