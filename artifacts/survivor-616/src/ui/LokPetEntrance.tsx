import { motion } from 'framer-motion';

import { prefersReducedMotion } from '@/anim/motion';
import type { EvolutionOverlayId, LokPetPalette, LokPetSilhouette } from '@/game/types';
import { LokPetIcon } from './LokPetVariantSheet';

/** How long the cyan sweep stays on screen when a pet is sent in mid-scene. */
export const LOKPET_ENTRANCE_FLASH_MS = 700;

/**
 * A LokPet stepping in beside its operator: the same pop-in, cyan glow ring and
 * idle bob the first-night partner gets in StarterLokPetEncounter, plus an
 * optional cyan sweep for pets sent in mid-fight. Change `entranceKey` to play
 * it again (a switch, a Send, or the next pet after a faint).
 */
export function LokPetEntrance({
  silhouette,
  palette,
  overlays,
  size = 56,
  entranceKey,
  flash = false,
  className = '',
}: {
  silhouette: LokPetSilhouette;
  palette: LokPetPalette;
  overlays?: readonly EvolutionOverlayId[];
  size?: number;
  entranceKey: string | number;
  flash?: boolean;
  className?: string;
}) {
  const still = prefersReducedMotion();
  return (
    <div className={`relative ${className}`} data-testid="lokpet-entrance" data-entrance-key={entranceKey}>
      {flash && !still && (
        <motion.div
          key={`flash-${entranceKey}`}
          initial={{ opacity: 0, x: 40, scaleX: 2.4 }}
          animate={{ opacity: [0, 1, 1, 0], x: [40, 0, 0, -6] }}
          transition={{ duration: LOKPET_ENTRANCE_FLASH_MS / 1000, times: [0, .35, .75, 1] }}
          className="pointer-events-none absolute inset-y-0 -right-3 z-10 w-10 bg-gradient-to-l from-cyan-200/70 via-cyan-300/20 to-transparent"
          data-testid="lokpet-entrance-flash"
          aria-hidden="true"
        />
      )}
      <motion.div
        key={`pet-${entranceKey}`}
        initial={still ? { opacity: 0 } : { opacity: 0, x: 24, scale: .6 }}
        animate={still ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1, y: [0, -4, 0] }}
        transition={{ y: { repeat: Infinity, duration: 1.8 } }}
        className="relative"
      >
        <div className="rounded-full bg-cyan-300/5 p-1 shadow-[0_0_35px_rgba(34,211,238,.22)]">
          <LokPetIcon silhouette={silhouette} palette={palette} overlays={overlays} size={size} className="bg-black/55" />
        </div>
      </motion.div>
    </div>
  );
}
