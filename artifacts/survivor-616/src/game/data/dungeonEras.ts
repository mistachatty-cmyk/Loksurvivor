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
      { x: 0, y: 20, w: 100, h: 22, kind: 'cover' },
      { x: -40, y: -90, w: 50, h: 50, kind: 'crate-breakable' },
      { x: 100, y: -80, w: 44, h: 44, kind: 'reflective-surface' },
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
      { x: 80, y: 100, w: 44, h: 48, kind: 'flora' },
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
      { x: 80, y: 40, w: 42, h: 46, kind: 'flora' },
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
      { x: -80, y: -40, w: 54, h: 54, kind: 'crate-breakable' },
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
  {
    name: 'Flooded Archive',
    ground: { base: '#08181b', tile: '#0d292b', seam: '#061012', glow: '#35d0bb' },
    bounds: { w: 720, h: 520 },
    obstacles: [
      { x: -280, y: -180, w: 180, h: 30, kind: 'barrier' },
      { x: 240, y: -170, w: 120, h: 30, kind: 'barrier' },
      { x: -230, y: 150, w: 60, h: 90, kind: 'planter' },
      { x: 0, y: 70, w: 70, h: 70, kind: 'fuse-box' },
      { x: 230, y: 160, w: 90, h: 60, kind: 'car-wreck' },
      { x: 0, y: -190, w: 28, h: 30, kind: 'street-lamp' },
    ],
  },
  {
    name: 'Municipal Rotunda',
    ground: { base: '#171221', tile: '#251936', seam: '#0b0810', glow: '#b58cff' },
    bounds: { w: 640, h: 640 },
    obstacles: [
      { x: -210, y: -210, w: 70, h: 70, kind: 'planter' },
      { x: 210, y: -210, w: 70, h: 70, kind: 'planter' },
      { x: -210, y: 210, w: 70, h: 70, kind: 'planter' },
      { x: 210, y: 210, w: 70, h: 70, kind: 'planter' },
      { x: -300, y: 0, w: 24, h: 180, kind: 'barrier' },
      { x: 300, y: 0, w: 24, h: 180, kind: 'barrier' },
    ],
  },
];
