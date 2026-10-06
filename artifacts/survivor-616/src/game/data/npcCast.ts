import { humanoidRig } from '@/game/sprites/rigs';
import type { SpritePalette, SpriteRig } from '@/game/types';

export interface NpcCastMember {
  id: string;
  name: string;
  role: string;
  loreId: string;
  palette: SpritePalette;
  rig: SpriteRig;
}

function frogsterRig(studio: boolean): SpriteRig {
  const rig = humanoidRig({ height: 23, width: 12, headColor: 'skin', torsoColor: 'body' });
  rig.parts.push(
    // Both twins share a face, silver hair, dark frames, and a sharply cut jacket.
    { key: 'crest', x: -5, y: 21, w: 10, h: 2, color: 'accentBright', z: 7 },
    { key: 'crest', x: -6, y: 18, w: 2, h: 4, color: 'accentBright', z: 7 },
    { key: 'crest', x: 4, y: 18, w: 2, h: 4, color: 'accentBright', z: 7 },
    { key: 'face', x: -4, y: 19, w: 8, h: 2, color: 'skin', z: 7 },
    { key: 'face', x: -4, y: 19, w: 3, h: 2, color: 'ink', z: 8 },
    { key: 'face', x: 1, y: 19, w: 3, h: 2, color: 'ink', z: 8 },
    { key: 'face', x: -1, y: 20, w: 2, h: 1, color: 'ink', z: 8 },
    { key: 'face', x: -3, y: 20, w: 1, h: 1, color: 'glow', z: 9 },
    { key: 'face', x: 2, y: 20, w: 1, h: 1, color: 'glow', z: 9 },
    { key: 'torso', x: -5, y: 13, w: 2, h: 4, color: 'accent', z: 7 },
    { key: 'torso', x: 3, y: 13, w: 2, h: 4, color: 'accent', z: 7 },
    { key: 'torso', x: -1, y: 9, w: 2, h: 7, color: 'bodyDark', z: 7 },
    { key: 'torso', x: -5, y: 7, w: 10, h: 1, color: 'accent', z: 7 },
  );

  if (studio) {
    rig.parts.push(
      { key: 'crest', x: -5, y: 24, w: 10, h: 2, color: 'ink', z: 10 },
      { key: 'crest', x: -7, y: 20, w: 2, h: 5, color: 'accent', z: 10 },
      { key: 'crest', x: 5, y: 20, w: 2, h: 5, color: 'accent', z: 10 },
      { key: 'aura', x: 7, y: 15, w: 1, h: 4, color: 'glow', z: 9 },
      { key: 'aura', x: 5, y: 14, w: 3, h: 1, color: 'glow', z: 9 },
      { key: 'torso', x: -4, y: 10, w: 2, h: 2, color: 'glow', z: 8 },
    );
  } else {
    rig.parts.push(
      // The broad brim and stepped crown read as a cowboy hat at small sizes.
      { key: 'crest', x: -9, y: 23, w: 18, h: 2, color: 'bodyDark', z: 10 },
      { key: 'crest', x: -6, y: 25, w: 12, h: 4, color: 'accent', z: 10 },
      { key: 'crest', x: -5, y: 25, w: 10, h: 1, color: 'bodyDark', z: 11 },
      { key: 'crest', x: -4, y: 29, w: 8, h: 1, color: 'accent', z: 10 },
      { key: 'aura', x: 7, y: 9, w: 2, h: 8, color: 'accent', z: 1 },
      { key: 'aura', x: 6, y: 15, w: 4, h: 2, color: 'glow', z: 8 },
    );
  }
  rig.pixelHeight = 31;
  return rig;
}

function luvitnotRig(): SpriteRig {
  const rig = humanoidRig({ height: 26, width: 13, headColor: 'skin', torsoColor: 'body' });
  rig.parts.push(
    // Water and spirit are visible inside a sealed glass helmet.
    { key: 'aura', x: -8, y: 20, w: 2, h: 3, color: 'glow', z: 0 },
    { key: 'aura', x: 7, y: 23, w: 2, h: 4, color: 'glow', z: 0 },
    { key: 'aura', x: -1, y: 27, w: 2, h: 2, color: 'glow', z: 0 },
    { key: 'face', x: -4, y: 21, w: 8, h: 3, color: 'bodyDark', z: 6 },
    { key: 'face', x: -3, y: 22, w: 2, h: 1, color: 'glow', z: 7 },
    { key: 'face', x: 1, y: 22, w: 2, h: 1, color: 'glow', z: 7 },
    { key: 'crest', x: -7, y: 18, w: 1, h: 10, color: 'accentBright', z: 8 },
    { key: 'crest', x: 6, y: 18, w: 1, h: 10, color: 'accentBright', z: 8 },
    { key: 'crest', x: -7, y: 27, w: 14, h: 1, color: 'accentBright', z: 8 },
    { key: 'crest', x: -7, y: 17, w: 14, h: 2, color: 'accent', z: 8 },
    { key: 'crest', x: -5, y: 25, w: 3, h: 1, color: 'accentBright', z: 9 },
    { key: 'torso', x: -6, y: 10, w: 2, h: 7, color: 'accent', z: 7 },
    { key: 'torso', x: 4, y: 10, w: 2, h: 7, color: 'accent', z: 7 },
    { key: 'torso', x: -3, y: 12, w: 6, h: 3, color: 'bodyDark', z: 7 },
    { key: 'torso', x: -2, y: 13, w: 4, h: 1, color: 'glow', z: 8 },
    { key: 'torso', x: -6, y: 8, w: 12, h: 1, color: 'accent', z: 7 },
    { key: 'legL', x: -5, y: 0, w: 4, h: 2, color: 'bodyDark', z: 8 },
    { key: 'legR', x: 1, y: 0, w: 4, h: 2, color: 'bodyDark', z: 8 },
  );
  rig.pixelHeight = 30;
  return rig;
}

export const JEREMEY_FROGSTER: NpcCastMember = {
  id: 'jeremey-frogster',
  name: 'Jeremey Frogster',
  role: 'Circuit Frog Rancher',
  loreId: 'frogster-twins',
  palette: { ink: '#101b22', body: '#176b6a', bodyDark: '#453425', accent: '#dfb979', accentBright: '#bdc6ca', skin: '#b98e70', glow: '#6ee7b7' },
  rig: frogsterRig(false),
};

export const JERAMY_FROGSTER: NpcCastMember = {
  id: 'jeramy-frogster',
  name: 'Jeramy',
  role: 'Gorilla Studios Engineer',
  loreId: 'frogster-twins',
  palette: { ink: '#121323', body: '#53346f', bodyDark: '#27203d', accent: '#7de4ee', accentBright: '#bdc6ca', skin: '#b98e70', glow: '#f49ce7' },
  rig: frogsterRig(true),
};

export const LUVITNOT_KEEPER: NpcCastMember = {
  id: 'luvitnot-keeper',
  name: 'The Luvitnot Keeper',
  role: 'GRPD Armory Guardian',
  loreId: 'luvitnot-armory-keeper',
  palette: { ink: '#111d2a', body: '#f1f4ef', bodyDark: '#31495c', accent: '#e5bb61', accentBright: '#f8fff5', skin: '#42b9c8', glow: '#84f2e3' },
  rig: luvitnotRig(),
};
