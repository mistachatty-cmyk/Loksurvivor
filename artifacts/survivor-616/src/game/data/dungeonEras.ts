/**
 * Dungeon era styles.  Each era visually identifies the generation a room
 * was built in -- 1970s basement, 1990s back office, 2010s cellar bar -- so
 * consecutive rooms feel distinct even when the layout is similar.
 */
import type { DungeonEra } from '@/game/types';

export const DUNGEON_ERAS: DungeonEra[] = [
  {
    name: '70s Basement',
    ground: { base: '#1a1208', tile: '#24180c', seam: '#0e0a05', glow: '#f0a040' },
    bounds: { w: 560, h: 440 },
    obstacles: [
      { x: -200, y: -150, w: 80, h: 60, kind: 'crate' },
      { x: 180, y: -120, w: 70, h: 50, kind: 'crate' },
      { x: -160, y: 140, w: 100, h: 44, kind: 'barrier' },
      { x: 160, y: 150, w: 60, h: 60, kind: 'crate' },
    ],
  },
  {
    name: '90s Back Room',
    ground: { base: '#0c1218', tile: '#141c26', seam: '#080c10', glow: '#4de1ff' },
    bounds: { w: 620, h: 480 },
    obstacles: [
      { x: -230, y: -180, w: 60, h: 60, kind: 'crate' },
      { x: 220, y: -160, w: 60, h: 80, kind: 'crate' },
      { x: 0, y: -180, w: 120, h: 40, kind: 'barrier' },
      { x: -180, y: 160, w: 70, h: 70, kind: 'dumpster' },
      { x: 200, y: 170, w: 60, h: 60, kind: 'crate' },
    ],
  },
  {
    name: 'Cellar Cavern',
    ground: { base: '#0c1510', tile: '#14211a', seam: '#070c09', glow: '#7ef0bd' },
    bounds: { w: 500, h: 420 },
    obstacles: [
      { x: -160, y: -140, w: 70, h: 70, kind: 'planter' },
      { x: 150, y: -100, w: 70, h: 80, kind: 'planter' },
      { x: 0, y: 150, w: 90, h: 50, kind: 'planter' },
      { x: -180, y: 120, w: 50, h: 50, kind: 'planter' },
    ],
  },
  {
    name: 'Industrial Loft',
    ground: { base: '#121214', tile: '#1c1c20', seam: '#09090b', glow: '#ff7ab8' },
    bounds: { w: 680, h: 500 },
    obstacles: [
      { x: -280, y: -180, w: 60, h: 60, kind: 'ac-unit' },
      { x: 260, y: -160, w: 60, h: 60, kind: 'ac-unit' },
      { x: -200, y: 180, w: 120, h: 44, kind: 'barrier' },
      { x: 190, y: 190, w: 80, h: 44, kind: 'barrier' },
      { x: 0, y: 0, w: 60, h: 60, kind: 'ac-unit' },
    ],
  },
  {
    name: 'Gold Era Studio',
    ground: { base: '#161208', tile: '#201a0e', seam: '#0c0906', glow: '#ffd45e' },
    bounds: { w: 580, h: 460 },
    obstacles: [
      { x: -200, y: -140, w: 80, h: 70, kind: 'crate' },
      { x: 180, y: -130, w: 80, h: 70, kind: 'crate' },
      { x: -60, y: 160, w: 180, h: 40, kind: 'barrier' },
      { x: -220, y: 150, w: 50, h: 50, kind: 'crate' },
      { x: 220, y: 150, w: 50, h: 50, kind: 'crate' },
    ],
  },
];
