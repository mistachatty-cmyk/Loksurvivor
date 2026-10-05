/**
 * Art recipes for 616 Survivor's cards: exactly the data the game itself
 * draws a card from (rig + palette, or LokPet silhouette + palette), in the
 * portable `CardArtRecipe` shape. Used for this game's own binder AND
 * published to the shared registry, so other games redraw the same model.
 * Trimmed to idle/walk clips to keep each card ~2 KB.
 */
import type { CardArtRecipe } from '@workspace/lok-client';

import type { LokAssetManifest } from '@/game/lok/types';
import type { SpriteRig } from '@/game/types';
import { ALLIES, allyRig } from './progression';
import { CHARACTERS } from './characters';
import { ENEMIES } from './enemies';
import { LOKPET_VARIANTS_BY_ID } from './lokPets';
import type { LokDeckCardMetadata } from './cards';

const slim = (rig: SpriteRig) => ({ pixelHeight: rig.pixelHeight, parts: rig.parts, anims: { idle: rig.anims.idle, walk: rig.anims.walk } });
const colors = (palette: object) => palette as Record<string, string>;

export function artRecipeFor(card: LokAssetManifest): CardArtRecipe | null {
  const info = card.metadata as Partial<LokDeckCardMetadata> | undefined;
  if (info?.subjectType === 'character') {
    const character = CHARACTERS.find((entry) => entry.id === info.subjectId);
    if (character) return { kind: 'sprite-rig', rig: slim(character.rig), palette: colors(character.palette), anim: 'idle' };
  }
  if (info?.subjectType === 'enemy') {
    const enemy = ENEMIES.find((entry) => entry.id === info.subjectId);
    if (enemy) return { kind: 'sprite-rig', rig: slim(enemy.rig), palette: colors(enemy.palette), anim: 'walk' };
  }
  if (info?.subjectType === 'ally') {
    const ally = ALLIES.find((entry) => entry.id === info.subjectId);
    if (ally) return { kind: 'sprite-rig', rig: slim(allyRig(ally)), palette: colors(ally.palette), anim: 'idle' };
  }
  if (info?.subjectType === 'lokpet') {
    const variant = info.subjectId ? LOKPET_VARIANTS_BY_ID[info.subjectId] : undefined;
    if (variant) return { kind: 'lokpet-silhouette', silhouette: variant.silhouette, palette: colors(variant.palette) };
  }
  return null;
}
